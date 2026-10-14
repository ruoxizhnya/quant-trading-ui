import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import JobQueuePanel from './JobQueuePanel.vue'
import { NSelect } from 'naive-ui'
import type { SyncJob } from '@/types/sync'

/**
 * 队列区（A-08 断言 1）的组件级判据：列表 / 筛选 / 详情 / 取消 / 重试。
 *
 * 关键的一条是 **动作后回读**：点「取消」之后界面显示的状态必须来自
 * `GET /api/sync/jobs/:id`，而不是前端自己写的"已取消"。后端在读写之间可能
 * 已经把这行改成 completed（CancelJob 的 UpdateSyncJobIfStatus 就是这个语义），
 * 乐观更新会把那次拒绝显示成一次成功。
 */
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

class FakeEventSource {
  static instances: FakeEventSource[] = []
  url: string
  constructor(url: string) {
    this.url = url
    FakeEventSource.instances.push(this)
  }
  addEventListener() {}
  close() {}
}

function j(over: Partial<SyncJob> = {}): SyncJob {
  return {
    id: 'job-1',
    job_type: 'ohlcv',
    status: 'running',
    progress_percent: 40,
    total_items: 10,
    processed_items: 4,
    failed_items: 0,
    created_at: '2026-10-14T08:00:00Z',
    retry_count: 0,
    max_retries: 3,
    ...over,
  }
}

/**
 * NDrawer 的内容挂在 teleport 上，默认不落进 wrapper 的 DOM 树里 —— 不 stub 掉
 * teleport，抽屉里的断言全打在空节点上（表现是"找不到元素"而不是"内容错"）。
 */
const mountOptions = { global: { stubs: { teleport: true } } }

async function mountPanel(jobs: SyncJob[]) {
  api.listSyncJobs.mockResolvedValue({ jobs, count: jobs.length })
  const wrapper = mount(JobQueuePanel, mountOptions)
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  FakeEventSource.instances = []
  vi.stubGlobal('EventSource', FakeEventSource)
})

describe('队列列表', () => {
  it('每条作业一行，状态用人话而不是裸枚举', async () => {
    const w = await mountPanel([j({ id: 'a', status: 'running' }), j({ id: 'b', status: 'completed' })])
    expect(w.find('[data-testid="queue-row-a"]').exists()).toBe(true)
    expect(w.find('[data-testid="queue-row-b"]').exists()).toBe(true)
    expect(w.find('[data-testid="queue-status-a"]').text()).toBe('同步中')
    expect(w.find('[data-testid="queue-status-b"]').text()).toBe('已完成')
    expect(w.text()).not.toContain('retrying')
    w.unmount()
  })

  it('筛选后无命中显示空态，而不是表格残骸', async () => {
    const w = await mountPanel([])
    expect(w.find('[data-testid="queue-empty"]').exists()).toBe(true)
    expect(w.find('[data-testid="queue-table"]').exists()).toBe(false)
    w.unmount()
  })

  it('类型筛选在前端做，且明写它的作用域（状态筛选才是后端参数）', async () => {
    const w = await mountPanel([j({ id: 'a', job_type: 'ohlcv' }), j({ id: 'b', job_type: 'stocks' })])
    const note = w.find('[data-testid="queue-filter-note"]').text()
    expect(note).toContain('状态由后端过滤')
    expect(note).toContain('2 条内过滤')

    const selects = w.findAllComponents(NSelect)
    await selects[1].vm.$emit('update:value', 'stocks')
    expect(w.find('[data-testid="queue-row-a"]').exists()).toBe(false)
    expect(w.find('[data-testid="queue-row-b"]').exists()).toBe(true)
    w.unmount()
  })

  it('状态筛选走后端参数（不是在前端挑），且不假称全站', async () => {
    const w = await mountPanel([j({ id: 'a' })])
    const selects = w.findAllComponents(NSelect)
    await selects[0].vm.$emit('update:value', 'failed')
    await flushPromises()
    expect(api.listSyncJobs).toHaveBeenLastCalledWith('failed', 50)
    w.unmount()
  })
})

describe('空态的三句话（读到空 / 没读到 / 被筛掉）', () => {
  it('首屏就读不到时说"队列未读取"，不能说"没有作业"', async () => {
    // 这是 A-08 断言 3 那条纪律在队列区的反面：0/空是合法读数，
    // 拿它当"没读到"的占位，等于把一次接口失败说成这个环境一条作业都没有。
    api.listSyncJobs.mockRejectedValue(new Error('connection refused'))
    const w = mount(JobQueuePanel, mountOptions)
    await flushPromises()
    expect(w.find('[data-testid="queue-empty"]').text()).toBe('队列未读取')
    w.unmount()
  })

  it('读到空列表时说"当前筛选条件下没有作业"，不改口成"未读取"', async () => {
    const w = await mountPanel([])
    expect(w.find('[data-testid="queue-empty"]').text()).toBe('当前筛选条件下没有作业')
    w.unmount()
  })

  it('被类型筛选挡掉时说清挡掉的是哪个类型、在多少条里找的', async () => {
    const w = await mountPanel([j({ id: 'a', job_type: 'ohlcv' })])
    const selects = w.findAllComponents(NSelect)
    await selects[1].vm.$emit('update:value', 'ohlcv_all')
    await flushPromises()
    expect(w.find('[data-testid="queue-empty"]').text()).toContain('1 条里没有 ohlcv_all 类型')
    w.unmount()
  })
})

describe('详情抽屉', () => {
  it('点详情会回读那一条作业（GET /api/sync/jobs/:id），不是只用列表里的缓存', async () => {
    api.getSyncJob.mockResolvedValue(
      j({ id: 'a', status: 'failed', error_message: 'tushare timeout', params: { symbols: ['000001.SZ'] } }),
    )
    const w = await mountPanel([j({ id: 'a', status: 'running' })])
    await w.find('[data-testid="queue-detail-a"]').trigger('click')
    await flushPromises()
    expect(api.getSyncJob).toHaveBeenCalledWith('a')
    expect(w.find('[data-testid="queue-detail-error"]').text()).toContain('tushare timeout')
    expect(w.find('[data-testid="queue-detail-params"]').text()).toContain('000001.SZ')
    w.unmount()
  })
})

describe('取消 / 重试（断言 1 的后两腿）', () => {
  it('按钮可见性 = 后端判据：running 可取消不可重试，cancelled 两者都不可', async () => {
    const w = await mountPanel([
      j({ id: 'run', status: 'running' }),
      j({ id: 'canc', status: 'cancelled' }),
      j({ id: 'fail', status: 'failed' }),
    ])
    expect(w.find('[data-testid="queue-cancel-run"]').exists()).toBe(true)
    expect(w.find('[data-testid="queue-retry-run"]').exists()).toBe(false)
    // 后端的 CanRetry 不含 cancelled（types.go:78），界面就不给这个按钮
    expect(w.find('[data-testid="queue-cancel-canc"]').exists()).toBe(false)
    expect(w.find('[data-testid="queue-retry-canc"]').exists()).toBe(false)
    expect(w.find('[data-testid="queue-retry-fail"]').exists()).toBe(true)
    w.unmount()
  })

  it('取消之后回读该作业，行上显示的是后端返回的状态', async () => {
    api.cancelSyncJob.mockResolvedValue({ message: 'job cancelled', job_id: 'run' })
    // 列表里它还在 running，动作后后端说它是 cancelled
    api.listSyncJobs.mockResolvedValue({ jobs: [j({ id: 'run', status: 'running' })], count: 1 })
    api.getSyncJob.mockResolvedValue(j({ id: 'run', status: 'cancelled', completed_at: '2026-10-14T08:05:00Z' }))
    const w = mount(JobQueuePanel, mountOptions)
    await flushPromises()
    await w.find('[data-testid="queue-cancel-run"]').trigger('click')
    await flushPromises()

    expect(api.cancelSyncJob).toHaveBeenCalledWith('run')
    expect(api.getSyncJob).toHaveBeenCalledWith('run')
    expect(w.find('[data-testid="queue-status-run"]').text()).toBe('已取消')
    w.unmount()
  })

  it('重试之后同样回读，并骑上唯一的 SSE 腿', async () => {
    api.retrySyncJob.mockResolvedValue({ message: 'job queued for retry', job_id: 'fail', status: 'pending' })
    api.listSyncJobs.mockResolvedValue({ jobs: [j({ id: 'fail', status: 'failed' })], count: 1 })
    api.getSyncJob.mockResolvedValue(j({ id: 'fail', status: 'pending', retry_count: 1 }))
    const w = mount(JobQueuePanel, mountOptions)
    await flushPromises()
    await w.find('[data-testid="queue-retry-fail"]').trigger('click')
    await flushPromises()

    expect(api.retrySyncJob).toHaveBeenCalledWith('fail')
    expect(api.getSyncJob).toHaveBeenCalledWith('fail')
    expect(w.find('[data-testid="queue-status-fail"]').text()).toBe('排队中')
    // 断言 4：唯一的进度流路径
    expect(FakeEventSource.instances.map((e) => e.url)).toEqual(['/api/sync/jobs/fail/progress'])
    w.unmount()
  })

  it('后端拒绝取消时不粉饰：错误进告警条，行状态不变', async () => {
    api.cancelSyncJob.mockRejectedValue(new Error('job is already in terminal state: completed'))
    api.getSyncJob.mockResolvedValue(j({ id: 'run', status: 'running' }))
    const w = await mountPanel([j({ id: 'run', status: 'running' })])
    await w.find('[data-testid="queue-cancel-run"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="queue-error"]').text()).toContain('already in terminal state')
    expect(w.find('[data-testid="queue-status-run"]').text()).toBe('同步中')
    w.unmount()
  })
})

describe('实时腿（A-08 断言 4 的现场）', () => {
  it('有活作业时只开一条作业进度流，路径命中 jobs/:id/progress', async () => {
    const w = await mountPanel([j({ id: 'live', status: 'running' })])
    expect(FakeEventSource.instances).toHaveLength(1)
    expect(FakeEventSource.instances[0].url).toBe('/api/sync/jobs/live/progress')
    expect(w.find('[data-testid="queue-sse-disconnect"]').exists()).toBe(true)
    w.unmount()
  })
})
