import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import SyncReadoutPanel from './SyncReadoutPanel.vue'
import { useSyncStore } from '@/stores/sync'
import { ApiError } from '@/api/client'

/**
 * 读数区（A-08 断言 3）的口径判据。
 *
 * 最要紧的一条不是"数字对"，而是**读不到与读到空必须是两句不同的话**：
 * 0 是合法的调度器读数、空表是合法的排程状态，把它们当"没读到"的占位符，
 * 就等于把接口失败说成"这个环境确实一条都没排"；反过来把空表说成"未读取"，
 * 就是把一次成功的读取伪装成故障。
 *
 * 一个数据集一个自动触发点：挂载只取自己那两条（workers + scheduler/stats），
 * 排程行由排程面板 own；用例里要看排程行数时显式调 fetchSchedules，走真实 store 路径。
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

const scheduleRow = (over = {}) => ({
  id: 1,
  name: 'a',
  job_type: 'ohlcv',
  cron_expression: '0 9 * * *',
  is_active: true,
  created_at: '2026-09-25T20:41:18Z',
  updated_at: '2026-09-25T20:41:18Z',
  ...over,
})

async function mountReadout(worker: unknown, scheduler: unknown) {
  api.getWorkerStats.mockResolvedValue(worker)
  api.getSchedulerStats.mockResolvedValue(scheduler)
  const w = mount(SyncReadoutPanel)
  await flushPromises()
  return w
}

/** 排程行走真实加载路径（不是 $patch），这样 loaded 旗标的语义也被测到。 */
async function loadSchedules(schedules: unknown[]) {
  api.listSyncSchedules.mockResolvedValue({ count: schedules.length, schedules })
  await useSyncStore().fetchSchedules()
  await flushPromises()
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  FakeEventSource.instances = []
  vi.stubGlobal('EventSource', FakeEventSource)
})

describe('worker 读数', () => {
  it('显示后端真值：消费者数、运行状态、注册类型逐条列出', async () => {
    const w = await mountReadout(
      { num_workers: 3, registered_types: ['ohlcv', 'stocks', 'fundamentals'], is_running: true },
      { active_schedules: 0, total_entries: 0 },
    )
    expect(w.find('[data-testid="readout-worker-count"]').text()).toBe('3 个消费者')
    // 同一个数在同一个块里只出现一次：第一版把"3 个消费者"在大字和小字里各印了一遍。
    expect(w.find('[data-testid="readout-running"]').text()).toBe('运行中')
    expect(w.find('[data-testid="readout-workers"]').text().match(/3 个消费者/g)).toHaveLength(1)
    expect(w.find('[data-testid="readout-types"]').text()).toContain('ohlcv')
    expect(w.find('[data-testid="readout-types"]').text()).toContain('fundamentals')
  })

  it('worker 池停了就用 error 色说"已停止"，不写"运行中"', async () => {
    const w = await mountReadout(
      { num_workers: 3, registered_types: [], is_running: false },
      { active_schedules: 0, total_entries: 0 },
    )
    expect(w.find('[data-testid="readout-running"]').text()).toBe('已停止')
  })

  it('一腿红时另一腿照常显示，红的那条写明失败而不是 0', async () => {
    api.getWorkerStats.mockRejectedValue(new ApiError(500, '服务暂时不可用，请稍后重试'))
    api.getSchedulerStats.mockResolvedValue({ active_schedules: 2, total_entries: 2 })
    const w = mount(SyncReadoutPanel)
    await flushPromises()
    expect(w.find('[data-testid="readout-worker-count"]').text()).toBe('未读取')
    expect(w.find('[data-testid="readout-scheduler-values"]').text()).toContain('active 2 · entries 2')
    expect(w.find('[data-testid="readout-error"]').exists()).toBe(true)
  })
})

describe('scheduler 读数（并存不合并）', () => {
  it('表里的行数与 cron 收下的条目数同时显示 —— 分叉就是 SYNC-01 那类故障的现场线索', async () => {
    const w = await mountReadout(
      { num_workers: 3, registered_types: [], is_running: true },
      { active_schedules: 0, total_entries: 0 },
    )
    await loadSchedules([scheduleRow({ id: 1 }), scheduleRow({ id: 2 })])
    expect(w.find('[data-testid="readout-scheduler-rows"]').text()).toBe('2 条启用中的排程行')
    expect(w.find('[data-testid="readout-scheduler-values"]').text()).toContain('active 0 · entries 0')
  })

  it('排程行还没读到时说"未读取"，不拿"0 条"冒充读到了空表', async () => {
    const w = await mountReadout(
      { num_workers: 1, registered_types: [], is_running: true },
      { active_schedules: 0, total_entries: 0 },
    )
    expect(w.find('[data-testid="readout-scheduler-rows"]').text()).toBe('排程行未读取')
    expect(api.listSyncSchedules).not.toHaveBeenCalled()
  })

  it('读到空表就说「0 条启用中的排程行」，不改口成"未读取"', async () => {
    const w = await mountReadout(
      { num_workers: 1, registered_types: [], is_running: true },
      { active_schedules: 0, total_entries: 0 },
    )
    await loadSchedules([])
    expect(w.find('[data-testid="readout-scheduler-rows"]').text()).toBe('0 条启用中的排程行')
  })

  it('停用中的行不计入「启用中的排程行」，但列表本身仍算已读取', async () => {
    const w = await mountReadout(
      { num_workers: 1, registered_types: [], is_running: true },
      { active_schedules: 0, total_entries: 0 },
    )
    await loadSchedules([scheduleRow({ id: 1, is_active: false }), scheduleRow({ id: 2, is_active: false })])
    expect(w.find('[data-testid="readout-scheduler-rows"]').text()).toBe('0 条启用中的排程行')
  })

  it('next_runs 只数条数，不渲染后端从不赋值的 name（实测恒为空串）', async () => {
    const w = await mountReadout(
      { num_workers: 1, registered_types: [], is_running: true },
      {
        active_schedules: 2,
        total_entries: 2,
        next_runs: [
          { schedule_id: 1, name: '', next_run: '2026-10-15T03:00:00Z' },
          { schedule_id: 2, name: '', next_run: '2026-10-15T09:00:00Z' },
        ],
      },
    )
    await loadSchedules([scheduleRow({ id: 1 }), scheduleRow({ id: 2 })])
    expect(w.find('[data-testid="readout-scheduler-values"]').text()).toContain('有下次执行 2 条')
    expect(w.find('[data-testid="readout-scheduler-values"]').text()).not.toMatch(/\s{2,}\s{2,}/)
  })

  it('明写 0/0 的两种成因，不编诊断文案', async () => {
    const w = await mountReadout(
      { num_workers: 1, registered_types: [], is_running: true },
      { active_schedules: 0, total_entries: 0 },
    )
    await loadSchedules([scheduleRow({ id: 1 })])
    expect(w.find('[data-testid="readout-ambiguity"]').text()).toContain('有两种成因')
    expect(w.find('[data-testid="readout-ambiguity"]').text()).toContain('不区分')
  })
})

describe('刷新按钮是唯一的"拉全"入口', () => {
  it('点一次刷新：三个数据集各一次请求，不多打', async () => {
    const w = await mountReadout(
      { num_workers: 3, registered_types: [], is_running: true },
      { active_schedules: 0, total_entries: 0 },
    )
    api.listSyncSchedules.mockResolvedValue({ count: 0, schedules: [] })
    api.getWorkerStats.mockClear()
    api.getSchedulerStats.mockClear()
    await w.find('[data-testid="readout-refresh"]').trigger('click')
    await flushPromises()
    expect(api.getWorkerStats).toHaveBeenCalledTimes(1)
    expect(api.getSchedulerStats).toHaveBeenCalledTimes(1)
    expect(api.listSyncSchedules).toHaveBeenCalledTimes(1)
  })
})

describe('读数区不开第二条推送（A-08 断言 4）', () => {
  it('面板整个生命周期不建 EventSource，也不请求任何没登记的端点', async () => {
    await mountReadout(
      { num_workers: 3, registered_types: [], is_running: true },
      { active_schedules: 0, total_entries: 0 },
    )
    expect(FakeEventSource.instances).toHaveLength(0)
    const called = (Object.keys(api) as (keyof typeof api)[]).filter((k) => api[k].mock.calls.length > 0)
    expect(called.sort()).toEqual(['getSchedulerStats', 'getWorkerStats'])
  })
})
