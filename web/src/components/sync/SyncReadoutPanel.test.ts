import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import SyncReadoutPanel from './SyncReadoutPanel.vue'
import { ApiError } from '@/api/client'

/**
 * 读数区（A-08 断言 3）的口径判据。
 *
 * 最要紧的一条不是"数字对"，而是**读不到时不许显示 0**：0 是一个合法的调度器读数，
 * 用它当"没读到"的占位，就等于把接口失败说成"这个环境确实一条都没排"。
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

async function mountPanel(worker: unknown, scheduler: unknown, schedules: unknown[] = []) {
  api.getWorkerStats.mockResolvedValue(worker)
  api.getSchedulerStats.mockResolvedValue(scheduler)
  api.listSyncSchedules.mockResolvedValue({ count: schedules.length, schedules })
  const w = mount(SyncReadoutPanel)
  await flushPromises()
  return w
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  FakeEventSource.instances = []
  vi.stubGlobal('EventSource', FakeEventSource)
})

describe('worker 读数', () => {
  it('显示后端真值：消费者数、运行状态、注册类型逐条列出', async () => {
    const w = await mountPanel(
      { num_workers: 3, registered_types: ['ohlcv', 'stocks', 'fundamentals'], is_running: true },
      { active_schedules: 0, total_entries: 0 },
    )
    expect(w.find('[data-testid="readout-worker-count"]').text()).toBe('3 个消费者')
    expect(w.find('[data-testid="readout-running"]').text()).toContain('运行中')
    expect(w.find('[data-testid="readout-types"]').text()).toContain('ohlcv')
    expect(w.find('[data-testid="readout-types"]').text()).toContain('fundamentals')
  })

  it('worker 池停了就用 error 色说"已停止"，不写"运行中"', async () => {
    const w = await mountPanel(
      { num_workers: 3, registered_types: [], is_running: false },
      { active_schedules: 0, total_entries: 0 },
    )
    expect(w.find('[data-testid="readout-running"]').text()).toContain('已停止')
  })

  it('一腿红时另一腿照常显示，红的那条写明失败而不是 0', async () => {
    api.getWorkerStats.mockRejectedValue(new ApiError(500, '服务暂时不可用，请稍后重试'))
    api.getSchedulerStats.mockResolvedValue({ active_schedules: 2, total_entries: 2 })
    api.listSyncSchedules.mockResolvedValue({ count: 0, schedules: [] })
    const w = mount(SyncReadoutPanel)
    await flushPromises()
    expect(w.find('[data-testid="readout-worker-count"]').text()).toBe('未读取')
    expect(w.find('[data-testid="readout-scheduler-values"]').text()).toBe('active 2 · entries 2')
    expect(w.find('[data-testid="readout-error"]').exists()).toBe(true)
  })
})

describe('scheduler 读数（并存不合并）', () => {
  it('排程行数与 cron 登记数同时显示 —— 两者分叉就是 SYNC-01 那类故障的现场线索', async () => {
    const w = await mountPanel(
      { num_workers: 3, registered_types: [], is_running: true },
      { active_schedules: 0, total_entries: 0 },
      [scheduleRow({ id: 1 }), scheduleRow({ id: 2 })],
    )
    const sub = w.find('[data-testid="readout-scheduler"]').text()
    expect(sub).toContain('启用中的排程行 2')
    expect(sub).toContain('cron 已登记 0')
  })

  it('next_runs 只数条数，不渲染后端从不赋值的 name（实测恒为空串）', async () => {
    const w = await mountPanel(
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
    expect(w.find('[data-testid="readout-scheduler-values"]').text()).toBe('active 2 · entries 2')
    expect(w.find('[data-testid="readout-scheduler"]').text()).toContain('有下次执行 2 条')
  })

  it('明写 0/0 的两种成因，不编诊断文案', async () => {
    const w = await mountPanel(
      { num_workers: 1, registered_types: [], is_running: true },
      { active_schedules: 0, total_entries: 0 },
    )
    expect(w.find('[data-testid="readout-ambiguity"]').text()).toContain('有两种成因')
    expect(w.find('[data-testid="readout-ambiguity"]').text()).toContain('不区分')
  })
})

describe('读数区不开第二条推送（A-08 断言 4）', () => {
  it('面板整个生命周期不建 EventSource，也不请求任何没登记的端点', async () => {
    await mountPanel(
      { num_workers: 3, registered_types: [], is_running: true },
      { active_schedules: 0, total_entries: 0 },
    )
    expect(FakeEventSource.instances).toHaveLength(0)
    const called = (Object.keys(api) as (keyof typeof api)[]).filter((k) => api[k].mock.calls.length > 0)
    expect(called.sort()).toEqual(['getSchedulerStats', 'getWorkerStats', 'listSyncSchedules'])
  })
})
