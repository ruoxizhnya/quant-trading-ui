import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useSyncStore, visibleNextRun } from './sync'
import type { SyncJob, SyncSchedule } from '@/types/sync'

// The store imports both the job legs and (since A-08 步骤 2) the schedule +
// read-out legs, so the mock factory lists all of them. A missing key here
// would surface as "xxx is not a function" inside whichever test happens to
// reach it, not as a clean failure — hence the explicit list.
const api = vi.hoisted(() => ({
  getDataSourceStatus: vi.fn(),
  getDataSourceHealth: vi.fn(),
  createSyncJob: vi.fn(),
  listSyncJobs: vi.fn(),
  getSyncJob: vi.fn(),
  cancelSyncJob: vi.fn(),
  retrySyncJob: vi.fn(),
  syncJobProgressStreamPath: vi.fn((id: string) => `/api/sync/jobs/${id}/progress`),
  listSyncSchedules: vi.fn(),
  createSyncSchedule: vi.fn(),
  updateSyncSchedule: vi.fn(),
  deleteSyncSchedule: vi.fn(),
  toggleSyncSchedule: vi.fn(),
  runSyncScheduleNow: vi.fn(),
  getWorkerStats: vi.fn(),
  getSchedulerStats: vi.fn(),
}))

vi.mock('@/api/sync', () => api)

function makeJob(overrides: Partial<SyncJob> = {}): SyncJob {
  return {
    id: 'job-1',
    job_type: 'stocks',
    status: 'pending',
    progress_percent: 0,
    total_items: 0,
    processed_items: 0,
    failed_items: 0,
    created_at: '2026-09-16T00:00:00Z',
    retry_count: 0,
    max_retries: 3,
    ...overrides,
  }
}

const makeSchedule = (over: Partial<SyncSchedule> = {}): SyncSchedule => ({
  id: 1,
  name: 'Daily OHLCV Sync',
  job_type: 'ohlcv',
  cron_expression: '0 9 * * *',
  params: { symbols: ['000001.SZ'] },
  is_active: true,
  created_at: '2026-09-25T20:41:18Z',
  updated_at: '2026-09-25T20:41:18Z',
  ...over,
})

class FakeEventSource {
  static instances: FakeEventSource[] = []
  url: string
  closed = false
  onopen: (() => void) | null = null
  onerror: (() => void) | null = null
  constructor(url: string) {
    this.url = url
    FakeEventSource.instances.push(this)
  }
  addEventListener() {}
  close() {
    this.closed = true
  }
}

// 顶层 setup：Pinia 实例、mock 计数器、EventSource 记录都必须逐用例重置。
// 放在某个 describe 内部会漏 —— 排程那几组用例曾因此看到 5 次 listSyncSchedules
// 调用和上一条用例留下的 workerStats，把"编排错"和"用例互串"混成一锅。
beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  FakeEventSource.instances = []
  vi.stubGlobal('EventSource', FakeEventSource)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('sync store', () => {
  it('has a clean initial state', () => {
    const store = useSyncStore()
    expect(store.jobs).toEqual([])
    expect(store.activeJob).toBeNull()
    expect(store.isSyncRunning).toBe(false)
    expect(store.progressPercent).toBe(0)
    expect(store.isDataSourceEnabled).toBe(false)
    expect(store.primaryDataSource).toBe('unknown')
  })

  it('fetches data source status', async () => {
    const store = useSyncStore()
    api.getDataSourceStatus.mockResolvedValue({
      enabled: true,
      primary: 'tushare',
    })
    await store.fetchDataSourceStatus()
    expect(store.isDataSourceEnabled).toBe(true)
    expect(store.primaryDataSource).toBe('tushare')
  })

  it('surfaces data source status errors', async () => {
    const store = useSyncStore()
    api.getDataSourceStatus.mockRejectedValue(new Error('boom'))
    await expect(store.fetchDataSourceStatus()).rejects.toThrow('boom')
    expect(store.error).toBe('boom')
  })

  it('fetches data source health', async () => {
    const store = useSyncStore()
    api.getDataSourceHealth.mockResolvedValue({ status: 'ok' })
    await store.fetchDataSourceHealth()
    expect(store.dataSourceHealth).toEqual({ status: 'ok' })
  })

  it('fetches sync jobs', async () => {
    const store = useSyncStore()
    api.listSyncJobs.mockResolvedValue({ jobs: [makeJob()], count: 1 })
    await store.fetchSyncJobs()
    expect(store.jobs).toHaveLength(1)
    expect(store.jobs[0].id).toBe('job-1')
  })

  it('applies job updates as upsert', () => {
    const store = useSyncStore()
    store.applyJobUpdate(makeJob({ id: 'a', status: 'running' }))
    expect(store.jobs).toHaveLength(1)
    store.applyJobUpdate(makeJob({ id: 'a', status: 'completed', progress_percent: 100 }))
    expect(store.jobs).toHaveLength(1)
    expect(store.jobs[0].status).toBe('completed')
    store.applyJobUpdate(makeJob({ id: 'b' }))
    expect(store.jobs).toHaveLength(2)
  })

  it('prefers an active job over a terminal one', () => {
    const store = useSyncStore()
    store.applyJobUpdate(makeJob({ id: 'done', status: 'completed', progress_percent: 100 }))
    store.applyJobUpdate(makeJob({ id: 'active', status: 'running', progress_percent: 40 }))
    expect(store.activeJob?.id).toBe('active')
    expect(store.isSyncRunning).toBe(true)
    expect(store.progressPercent).toBe(40)
  })

  it('creates a job and puts that job in the queue without clobbering the list', async () => {
    const store = useSyncStore()
    api.createSyncJob.mockResolvedValue({
      message: 'stocks sync job created',
      job_id: 'job-9',
      status: 'pending',
    })
    api.getSyncJob.mockResolvedValue(makeJob({ id: 'job-9' }))
    api.listSyncJobs.mockResolvedValue({ jobs: [makeJob({ id: 'job-9' })], count: 1 })
    const id = await store.createJob({ type: 'stocks' })
    expect(id).toBe('job-9')
    expect(api.createSyncJob).toHaveBeenCalledWith({ type: 'stocks' })
    expect(store.jobs[0].id).toBe('job-9')
    // A-08 审查修正：动作只回读那一条。重读整张列表会静默冲掉队列面板的筛选与页宽
    // （run-now 那条先被抓到，create/cancel/retry 是同一个病，一起收）。
    expect(api.listSyncJobs).not.toHaveBeenCalled()
  })

  it('maps the import form onto L0 job types', async () => {
    const store = useSyncStore()
    api.createSyncJob.mockResolvedValue({
      message: 'ok',
      job_id: 'job-x',
      status: 'pending',
    })
    api.getSyncJob.mockResolvedValue(makeJob({ id: 'job-x' }))
    api.listSyncJobs.mockResolvedValue({ jobs: [], count: 0 })

    await store.importData({
      symbols: ['600519'],
      start_date: '2024-01-01',
      end_date: '',
      data_type: 'ohlcv',
    })
    expect(api.createSyncJob).toHaveBeenCalledWith({
      type: 'ohlcv',
      params: { symbols: ['600519'], start_date: '2024-01-01' },
    })

    api.createSyncJob.mockClear()
    await store.importData({
      symbols: ['600519'],
      start_date: '',
      end_date: '',
      data_type: 'fundamental',
    })
    expect(api.createSyncJob).toHaveBeenCalledWith({
      type: 'fundamentals',
      params: { symbols: ['600519'] },
    })

    api.createSyncJob.mockClear()
    await store.importData({
      symbols: [],
      start_date: '',
      end_date: '',
      data_type: 'all',
    })
    expect(api.createSyncJob).toHaveBeenCalledTimes(2)
    expect(api.createSyncJob.mock.calls[0][0].type).toBe('ohlcv')
    expect(api.createSyncJob.mock.calls[1][0].type).toBe('fundamentals')
  })

  it('clears errors', async () => {
    const store = useSyncStore()
    api.getDataSourceStatus.mockRejectedValue(new Error('boom'))
    await expect(store.fetchDataSourceStatus()).rejects.toThrow()
    expect(store.error).toBe('boom')
    store.clearError()
    expect(store.error).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// A-08 步骤 2 — schedules + read-outs.
//
// URL/方法 那一层已由 src/api/sync.test.ts 逐条钉住；这里 mock 掉整个 api 模块，
// 只看编排：谁在什么之后被调、错误落到哪个桶。
// ---------------------------------------------------------------------------

describe('fetchSchedules', () => {
  it('把排程行放进 schedules，并在成功后关掉 loading', async () => {
    api.listSyncSchedules.mockResolvedValue({ count: 2, schedules: [makeSchedule(), makeSchedule({ id: 2 })] })
    const store = useSyncStore()
    await store.fetchSchedules()
    expect(store.schedules.map((s) => s.id)).toEqual([1, 2])
    expect(store.schedulesLoading).toBe(false)
    expect(store.schedulesError).toBeNull()
  })

  it('activeOnly 透传给 api 层', async () => {
    api.listSyncSchedules.mockResolvedValue({ count: 0, schedules: [] })
    const store = useSyncStore()
    await store.fetchSchedules(true)
    expect(api.listSyncSchedules).toHaveBeenCalledWith(true)
  })

  it('后端返回缺字段时不炸成 undefined 列表（fail-closed 到空数组）', async () => {
    api.listSyncSchedules.mockResolvedValue({ count: 0 })
    const store = useSyncStore()
    await store.fetchSchedules()
    expect(store.schedules).toEqual([])
  })

  it('失败进 schedulesError，不污染作业队列的 error 桶', async () => {
    api.listSyncSchedules.mockRejectedValue(new Error('排程读取失败'))
    const store = useSyncStore()
    await expect(store.fetchSchedules()).rejects.toThrow('排程读取失败')
    expect(store.schedulesError).toBe('排程读取失败')
    expect(store.error).toBeNull()
    expect(store.schedulesLoading).toBe(false)
  })

  it('schedulesLoaded 初始为 false：没读过就不能被当成"读到空表"', async () => {
    const store = useSyncStore()
    expect(store.schedulesLoaded).toBe(false)
  })

  it('成功读到空表也算已读取（空表与没读是两件事，界面文案靠这个旗标分叉）', async () => {
    api.listSyncSchedules.mockResolvedValue({ count: 0, schedules: [] })
    const store = useSyncStore()
    await store.fetchSchedules()
    expect(store.schedules).toEqual([])
    expect(store.schedulesLoaded).toBe(true)
  })

  it('读取失败时旗标不置真 —— 不然失败会被显示成"0 条排程"', async () => {
    api.listSyncSchedules.mockRejectedValue(new Error('boom'))
    const store = useSyncStore()
    await expect(store.fetchSchedules()).rejects.toThrow('boom')
    expect(store.schedulesLoaded).toBe(false)
  })
})

describe('排程变更动作的编排（断言 2）', () => {
  it('createSchedule 返回后端回填的 id，并重读列表 + 读数', async () => {
    api.createSyncSchedule.mockResolvedValue(makeSchedule({ id: 42 }))
    api.listSyncSchedules.mockResolvedValue({ count: 1, schedules: [makeSchedule({ id: 42 })] })
    api.getWorkerStats.mockResolvedValue({ num_workers: 3, registered_types: [], is_running: true })
    api.getSchedulerStats.mockResolvedValue({ active_schedules: 1, total_entries: 1 })
    const store = useSyncStore()
    const id = await store.createSchedule({ name: 'x', job_type: 'ohlcv', cron_expression: '@hourly', is_active: true })
    expect(id).toBe(42)
    expect(api.listSyncSchedules).toHaveBeenCalledTimes(1)
    expect(api.getSchedulerStats).toHaveBeenCalledTimes(1)
  })

  it('toggleSchedule 会带动 scheduler/stats 重读（toggle 改的就是 cron 登记数）', async () => {
    api.toggleSyncSchedule.mockResolvedValue({ message: 'schedule updated', id: 1, active: false })
    api.listSyncSchedules.mockResolvedValue({ count: 1, schedules: [makeSchedule({ is_active: false })] })
    api.getWorkerStats.mockResolvedValue({ num_workers: 3, registered_types: [], is_running: true })
    api.getSchedulerStats.mockResolvedValue({ active_schedules: 0, total_entries: 0 })
    const store = useSyncStore()
    await store.toggleSchedule(1, false)
    expect(api.toggleSyncSchedule).toHaveBeenCalledWith(1, false)
    expect(store.schedules[0].is_active).toBe(false)
    expect(store.schedulerStats).toEqual({ active_schedules: 0, total_entries: 0 })
  })

  it('cron 非法时后端措辞原样抛出，不在前端猜合法性', async () => {
    api.createSyncSchedule.mockRejectedValue(new Error('invalid cron expression: failed to parse spec'))
    const store = useSyncStore()
    await expect(
      store.createSchedule({ name: 'x', job_type: 'ohlcv', cron_expression: 'not a cron', is_active: true }),
    ).rejects.toThrow('invalid cron expression: failed to parse spec')
    expect(store.schedulesError).toBe('invalid cron expression: failed to parse spec')
  })

  it('deleteSchedule / updateSchedule 失败都落 schedulesError 并重抛', async () => {
    api.deleteSyncSchedule.mockRejectedValue(new Error('boom'))
    const store = useSyncStore()
    await expect(store.deleteSchedule(9)).rejects.toThrow('boom')
    expect(store.schedulesError).toBe('boom')

    api.updateSyncSchedule.mockRejectedValue(new Error('nah'))
    await expect(
      store.updateSchedule(9, { name: 'a', job_type: 'ohlcv', cron_expression: '@daily', is_active: true }),
    ).rejects.toThrow('nah')
    expect(store.schedulesError).toBe('nah')
  })
})

describe('runScheduleNow（断言 2 的可证伪腿）', () => {
  it('返回 job_id，把那条新作业 upsert 进队列，并只开一条作业进度 SSE 腿', async () => {
    api.runSyncScheduleNow.mockResolvedValue({ message: 'schedule triggered', job_id: 'scheduled-7', status: 'pending' })
    api.getSyncJob.mockResolvedValue(makeJob({ id: 'scheduled-7', status: 'pending' }))
    const store = useSyncStore()
    const id = await store.runScheduleNow(7)
    expect(id).toBe('scheduled-7')
    expect(api.getSyncJob).toHaveBeenCalledWith('scheduled-7')
    expect(store.jobs.map((j) => j.id)).toEqual(['scheduled-7'])
    // 全站唯一 SSE 腿：排程区不得另开通道（A-08 断言 4）。
    expect(FakeEventSource.instances.map((e) => e.url)).toEqual(['/api/sync/jobs/scheduled-7/progress'])
  })

  it('不重读整张列表 —— 否则用户看到的队列会从 50 行缩回默认页（2026-10-14 浏览器实测抓到的形状）', async () => {
    api.listSyncJobs.mockResolvedValue({ jobs: [makeJob({ id: 'existing' })], count: 1 })
    api.runSyncScheduleNow.mockResolvedValue({ message: 'schedule triggered', job_id: 'scheduled-8', status: 'pending' })
    api.getSyncJob.mockResolvedValue(makeJob({ id: 'scheduled-8', status: 'pending' }))
    const store = useSyncStore()
    await store.fetchSyncJobs(undefined, 50)
    api.listSyncJobs.mockClear()
    await store.runScheduleNow(8)
    expect(api.listSyncJobs).not.toHaveBeenCalled()
    // 原有行仍在，新行在队首
    expect(store.jobs.map((j) => j.id)).toEqual(['scheduled-8', 'existing'])
  })

  it('新作业单条读不到时不谎报：run-now 仍返回 id，队列保持原样', async () => {
    api.runSyncScheduleNow.mockResolvedValue({ message: 'schedule triggered', job_id: 'scheduled-9', status: 'pending' })
    api.getSyncJob.mockRejectedValue(new Error('job not found: scheduled-9'))
    const store = useSyncStore()
    await expect(store.runScheduleNow(9)).resolves.toBe('scheduled-9')
    expect(store.jobs).toEqual([])
  })
})

describe('cancel / retry 也不冲掉列表（与 run-now 同一条口径）', () => {
  it('cancel 之后只回读那一条，队列的筛选与页宽保持不变', async () => {
    api.listSyncJobs.mockResolvedValue({ jobs: [makeJob({ id: 'a', status: 'running' })], count: 1 })
    const store = useSyncStore()
    await store.fetchSyncJobs('running', 50)
    api.listSyncJobs.mockClear()

    api.cancelSyncJob.mockResolvedValue({ message: 'job cancelled', job_id: 'a' })
    api.getSyncJob.mockResolvedValue(makeJob({ id: 'a', status: 'cancelled' }))
    await store.cancelJob('a')

    expect(api.getSyncJob).toHaveBeenCalledWith('a')
    expect(api.listSyncJobs).not.toHaveBeenCalled()
    expect(store.jobs[0].status).toBe('cancelled')
  })

  it('retry 之后同样只回读，并且仍只开那条唯一的进度流', async () => {
    api.listSyncJobs.mockResolvedValue({ jobs: [makeJob({ id: 'b', status: 'failed' })], count: 1 })
    const store = useSyncStore()
    await store.fetchSyncJobs(undefined, 50)
    api.listSyncJobs.mockClear()

    api.retrySyncJob.mockResolvedValue({ message: 'job queued for retry', job_id: 'b', status: 'pending' })
    api.getSyncJob.mockResolvedValue(makeJob({ id: 'b', status: 'pending', retry_count: 1 }))
    await store.retryJob('b')

    expect(api.listSyncJobs).not.toHaveBeenCalled()
    expect(store.jobs[0].status).toBe('pending')
    expect(FakeEventSource.instances.map((e) => e.url)).toEqual(['/api/sync/jobs/b/progress'])
  })

  it('回读失败不吞掉动作本身：取消成功了就报成功，行状态维持后端最后给的样子', async () => {
    api.listSyncJobs.mockResolvedValue({ jobs: [makeJob({ id: 'c', status: 'running' })], count: 1 })
    const store = useSyncStore()
    await store.fetchSyncJobs()
    api.cancelSyncJob.mockResolvedValue({ message: 'job cancelled', job_id: 'c' })
    api.getSyncJob.mockRejectedValue(new Error('read back failed'))
    await expect(store.cancelJob('c')).resolves.toBeUndefined()
    expect(store.error).toBeNull()
  })
})

describe('single-flight：并发同请求只打一趟', () => {
  it('两个面板同时 fetchSchedules ⇒ api 层只被调一次', async () => {
    const store = useSyncStore()
    let resolveList: (v: unknown) => void = () => {}
    api.listSyncSchedules.mockImplementation(
      () => new Promise((r) => { resolveList = r }),
    )
    const p1 = store.fetchSchedules()
    const p2 = store.fetchSchedules()
    resolveList({ count: 1, schedules: [makeSchedule()] })
    await Promise.all([p1, p2])
    expect(api.listSyncSchedules).toHaveBeenCalledTimes(1)
    expect(store.schedules.map((s) => s.id)).toEqual([1])
  })

  it('同时 fetchStats ⇒ workers 与 scheduler/stats 各打一次', async () => {
    const store = useSyncStore()
    api.getWorkerStats.mockResolvedValue({ num_workers: 3, registered_types: [], is_running: true })
    api.getSchedulerStats.mockResolvedValue({ active_schedules: 0, total_entries: 0 })
    await Promise.all([store.fetchStats(), store.fetchStats(), store.fetchStats()])
    expect(api.getWorkerStats).toHaveBeenCalledTimes(1)
    expect(api.getSchedulerStats).toHaveBeenCalledTimes(1)
  })

  it('去重只针对**同时在路上**的请求，完成后再点刷新仍会真打（不是缓存）', async () => {
    const store = useSyncStore()
    api.listSyncSchedules.mockResolvedValue({ count: 0, schedules: [] })
    await store.fetchSchedules()
    await store.fetchSchedules()
    expect(api.listSyncSchedules).toHaveBeenCalledTimes(2)
  })

  it('共享同一条请求时，失败对两个调用方都可见（不复用成功值）', async () => {
    const store = useSyncStore()
    api.listSyncSchedules.mockRejectedValue(new Error('boom'))
    const results = await Promise.allSettled([store.fetchSchedules(), store.fetchSchedules()])
    expect(results.every((r) => r.status === 'rejected')).toBe(true)
    expect(store.schedulesError).toBe('boom')
  })
})

describe('fetchStats 的两腿独立性（断言 3 的失败面）', () => {
  it('一腿红不影响另一腿赋值，且不抛', async () => {
    api.getWorkerStats.mockRejectedValue(new Error('workers 500'))
    api.getSchedulerStats.mockResolvedValue({ active_schedules: 2, total_entries: 2 })
    const store = useSyncStore()
    await expect(store.fetchStats()).resolves.toBeUndefined()
    expect(store.workerStats).toBeNull()
    expect(store.schedulerStats).toEqual({ active_schedules: 2, total_entries: 2 })
    expect(store.statsError).toBe('workers 500')
  })

  it('两腿都绿时清空 statsError', async () => {
    api.getWorkerStats.mockResolvedValue({ num_workers: 3, registered_types: ['ohlcv'], is_running: true })
    api.getSchedulerStats.mockResolvedValue({ active_schedules: 0, total_entries: 0 })
    const store = useSyncStore()
    store.statsError = 'stale'
    await store.fetchStats()
    expect(store.statsError).toBeNull()
    expect(store.workerStats?.num_workers).toBe(3)
  })
})

describe('enabledScheduleRows 与 cron 登记数是两个数（不合并）', () => {
  it('只数行，不冒充 cron 已登记', async () => {
    api.listSyncSchedules.mockResolvedValue({
      count: 3,
      schedules: [makeSchedule({ id: 1 }), makeSchedule({ id: 2, is_active: false }), makeSchedule({ id: 3 })],
    })
    const store = useSyncStore()
    await store.fetchSchedules()
    expect(store.enabledScheduleRows.map((s) => s.id)).toEqual([1, 3])
    // 后端读数可以是另一个值（启动失败时 0），二者并存才可诊断。
    expect(store.schedulerStats).toBeNull()
  })
})

describe('refreshJob（动作后回读的单条腿，A-08 步骤 3）', () => {
  it('回读结果覆盖列表里同 id 的那条，而不是追加一行', async () => {
    api.listSyncJobs.mockResolvedValue({ jobs: [makeJob({ id: 'a', status: 'running' })], count: 1 })
    api.getSyncJob.mockResolvedValue(makeJob({ id: 'a', status: 'cancelled' }))
    const store = useSyncStore()
    await store.fetchSyncJobs()
    const job = await store.refreshJob('a')
    expect(store.jobs).toHaveLength(1)
    expect(job.status).toBe('cancelled')
    expect(store.jobs[0].status).toBe('cancelled')
  })

  it('列表里还没有这条时（run-now 刚建的），回读把它补进队首', async () => {
    api.listSyncJobs.mockResolvedValue({ jobs: [], count: 0 })
    api.getSyncJob.mockResolvedValue(makeJob({ id: 'scheduled-9', status: 'pending' }))
    const store = useSyncStore()
    await store.fetchSyncJobs()
    await store.refreshJob('scheduled-9')
    expect(store.jobs.map((j) => j.id)).toEqual(['scheduled-9'])
  })
})

describe('fetchSyncJobs 的状态筛选走后端参数（不是前端挑）', () => {
  it('status/limit 原样透传给 api 层', async () => {
    api.listSyncJobs.mockResolvedValue({ jobs: [], count: 0 })
    const store = useSyncStore()
    await store.fetchSyncJobs('failed', 50)
    expect(api.listSyncJobs).toHaveBeenCalledWith('failed', 50)
    await store.fetchSyncJobs()
    expect(api.listSyncJobs).toHaveBeenLastCalledWith(undefined, undefined)
  })

  it('空队列的真实回包是 {"count":0,"jobs":null}（2026-10-14 curl 实测），队列得塌成空数组', async () => {
    // Go 侧 `Jobs []*SyncJob` 为 nil 时 json 编码出 null 而不是 []，前端类型却写着
    // SyncJob[]。按 null 存进去，queueLength 的 .filter 立刻 TypeError —— 整块队列
    // 面板白屏，而这恰恰是"筛一个没有活作业的状态"这种最常见的空态。
    api.listSyncJobs.mockResolvedValue({ count: 0, jobs: null as unknown as [] })
    const store = useSyncStore()
    await store.fetchSyncJobs('pending', 50)
    expect(store.jobs).toEqual([])
    expect(store.queueLength).toBe(0)
    expect(store.activeJob).toBeNull()
  })

  it('jobsLoaded：读到空表算已读取，读取失败不算（空态文案分这两句）', async () => {
    api.listSyncJobs.mockResolvedValue({ count: 0, jobs: null as unknown as [] })
    const store = useSyncStore()
    expect(store.jobsLoaded).toBe(false)
    await store.fetchSyncJobs()
    expect(store.jobsLoaded).toBe(true)

    setActivePinia(createPinia())
    api.listSyncJobs.mockRejectedValue(new Error('队列读取失败'))
    const failed = useSyncStore()
    await expect(failed.fetchSyncJobs()).rejects.toThrow('队列读取失败')
    expect(failed.jobsLoaded).toBe(false)
  })
})

describe('visibleNextRun（core SYNC-03 的前端防御）', () => {
  it('停用排程即使带着残留 next_run_at 也不显示', () => {
    expect(visibleNextRun(makeSchedule({ is_active: false, next_run_at: '2026-10-15T09:00:00Z' }))).toBeNull()
  })

  it('启用且有下次执行时间才显示', () => {
    expect(visibleNextRun(makeSchedule({ is_active: true, next_run_at: '2026-10-15T09:00:00Z' }))).toBe(
      '2026-10-15T09:00:00Z',
    )
  })

  it('启用但没有值时返回 null，而不是空串（空串会被渲染成一个空白格）', () => {
    expect(visibleNextRun(makeSchedule({ is_active: true }))).toBeNull()
  })
})
