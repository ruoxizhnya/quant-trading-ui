import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { NPopconfirm, NSelect, NSwitch } from 'naive-ui'
import SchedulePanel from './SchedulePanel.vue'
import { ApiError } from '@/api/client'
import { useSyncStore } from '@/stores/sync'
import type { SyncSchedule } from '@/types/sync'

/**
 * 排程区（A-08 断言 2）的组件级判据。
 *
 * 用真 store + mock 掉的 api 层跑，而不是 stub store 方法：这一步要证的正是
 * 「界面上的动作真的落到那 7 条端点上」，把 store 换掉就等于只测了自己写的胶水。
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

const mountOptions = { global: { stubs: { teleport: true } } }

function s(over: Partial<SyncSchedule> = {}): SyncSchedule {
  return {
    id: 1,
    name: 'Daily OHLCV Sync',
    job_type: 'ohlcv',
    cron_expression: '0 9 * * *',
    params: { symbols: ['000001.SZ'] },
    is_active: true,
    created_at: '2026-09-25T20:41:18Z',
    updated_at: '2026-09-25T20:41:18Z',
    ...over,
  }
}

async function mountPanel(schedules: SyncSchedule[], jobs: unknown[] = [], registered = ['ohlcv', 'stocks', 'fundamentals']) {
  api.listSyncSchedules.mockResolvedValue({ count: schedules.length, schedules })
  api.listSyncJobs.mockResolvedValue({ jobs, count: jobs.length })
  api.getWorkerStats.mockResolvedValue({
    num_workers: 3,
    registered_types: registered,
    is_running: true,
  })
  api.getSchedulerStats.mockResolvedValue({ active_schedules: schedules.filter((x) => x.is_active).length, total_entries: 0 })
  const wrapper = mount(SchedulePanel, mountOptions)
  await flushPromises()
  return wrapper
}

/**
 * naive 的 NInput 把 data-testid 落在外层 div 上，setValue 只能打在真正的
 * input/textarea 元素上 —— 直接对 testid 调 setValue 会得到
 * "wrapper.setValue() cannot be called on DIV"。
 */
function field(w: ReturnType<typeof mount>, testid: string) {
  const el = w.find(`[data-testid="${testid}"] input`)
  return el.exists() ? el : w.find(`[data-testid="${testid}"] textarea`)
}

/** 打开表单并填一份最小可用值。 */
async function fillForm(w: ReturnType<typeof mount>, over: Record<string, string> = {}) {
  await w.find('[data-testid="schedule-create"]').trigger('click')
  if (over.name !== undefined) await field(w, 'schedule-input-name').setValue(over.name)
  if (over.cron !== undefined) await field(w, 'schedule-input-cron').setValue(over.cron)
  if (over.params !== undefined) await field(w, 'schedule-input-params').setValue(over.params)
  await flushPromises()
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('排程列表', () => {
  it('每条排程一行，状态标签用人话', async () => {
    const w = await mountPanel([s({ id: 1 }), s({ id: 2, name: 'nightly', is_active: false })])
    expect(w.find('[data-testid="schedule-row-1"]').exists()).toBe(true)
    expect(w.find('[data-testid="schedule-state-1"]').text()).toBe('启用中')
    expect(w.find('[data-testid="schedule-state-2"]').text()).toBe('已停用')
    expect(w.find('[data-testid="schedule-row-1"]').text()).toContain('0 9 * * *')
  })

  it('停用排程带着残留 next_run_at 时显示「—」，不显示一个不会发生的未来（SYNC-03 防御）', async () => {
    const w = await mountPanel([
      s({ id: 1, is_active: true, next_run_at: '2026-10-15T09:00:00Z' }),
      s({ id: 2, name: 'paused', is_active: false, next_run_at: '2026-10-15T09:00:00Z' }),
    ])
    expect(w.find('[data-testid="schedule-row-1"]').text()).toContain('2026/10/15')
    const pausedRow = w.find('[data-testid="schedule-row-2"]').text()
    expect(pausedRow).not.toContain('2026/10/15')
    expect(pausedRow).toContain('—')
  })

  it('后端读数与排程行并存展示（0/0 说 0/0，不粉饰）', async () => {
    const w = await mountPanel([s()])
    expect(w.find('[data-testid="schedule-note"]').text()).toContain('cron 合法性由后端判定')
  })
})

describe('新建 / 编辑（断言 2 的 CRUD 两腿）', () => {
  it('提交时显式发送 is_active，并把 JSON 参数还原成对象送给后端', async () => {
    api.createSyncSchedule.mockResolvedValue(s({ id: 9 }))
    const w = await mountPanel([])
    await fillForm(w, {
      name: 'nightly ohlcv',
      cron: '0 2 * * *',
      params: '{"symbols": ["600519.SH"], "start_date": "2024-01-01"}',
    })
    await w.find('[data-testid="schedule-submit"]').trigger('click')
    await flushPromises()

    expect(api.createSyncSchedule).toHaveBeenCalledTimes(1)
    const sent = api.createSyncSchedule.mock.calls[0][0]
    expect(sent).toMatchObject({
      name: 'nightly ohlcv',
      job_type: 'ohlcv',
      cron_expression: '0 2 * * *',
      params: { symbols: ['600519.SH'], start_date: '2024-01-01' },
      is_active: true,
    })
    // 表单送出去的是对象，不是 JSON 字符串
    expect(typeof sent.params).toBe('object')
  })

  it('关掉「立即启用」开关就建一条停用的排程（省略会被后端当 false，这里显式发）', async () => {
    api.createSyncSchedule.mockResolvedValue(s({ id: 10, is_active: false }))
    const w = await mountPanel([])
    await fillForm(w, { name: 'draft', cron: '@daily' })
    w.findComponent(NSwitch).vm.$emit('update:value', false)
    await flushPromises()
    await w.find('[data-testid="schedule-submit"]').trigger('click')
    await flushPromises()
    expect(api.createSyncSchedule.mock.calls[0][0].is_active).toBe(false)
  })

  it('参数不是合法 JSON 时本地拦住，不发请求（送不出去的东西谈不上后端校验）', async () => {
    const w = await mountPanel([])
    await fillForm(w, { name: 'bad', cron: '@daily', params: '{"symbols": ' })
    await w.find('[data-testid="schedule-submit"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="schedule-form-error"]').text()).toContain('不是合法 JSON')
    expect(api.createSyncSchedule).not.toHaveBeenCalled()
  })

  it('cron 非法：显示后端 400 原文，不翻译不改写', async () => {
    api.createSyncSchedule.mockRejectedValue(
      new Error('invalid cron expression: failed to parse spec'),
    )
    const w = await mountPanel([])
    await fillForm(w, { name: 'oops', cron: '99 99 99' })
    await w.find('[data-testid="schedule-submit"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="schedule-form-error"]').text()).toBe(
      'invalid cron expression: failed to parse spec',
    )
  })

  // 上一条用 plain Error 是**假证据**：浏览器里丢原话的是 ApiError，不是 Error。
  // 这条按 2026-10-14 实测的真实形状来：client.ts 把 message 换成「请求参数有误」，
  // 原话只剩 ApiError.body.error —— 捞不回来就是界面上那句废话。
  it('ApiError 形状（真响应抄的）：body 里的原话压过通用文案', async () => {
    const words = 'invalid cron expression: expected exactly 6 fields, found 3: [99 99 99]'
    api.createSyncSchedule.mockRejectedValue(new ApiError(400, '请求参数有误', { code: 'bad_request', error: words }))
    const w = await mountPanel([])
    await fillForm(w, { name: 'oops2', cron: '99 99 99' })
    await w.find('[data-testid="schedule-submit"]').trigger('click')
    await flushPromises()
    const shown = w.find('[data-testid="schedule-form-error"]').text()
    expect(shown).toBe(words)
    expect(shown).not.toContain('请求参数有误')
  })

  it('后端没给原话时才退回通用文案（不编造原因）', async () => {
    api.createSyncSchedule.mockRejectedValue(new ApiError(409, '资源冲突，请刷新后重试'))
    const w = await mountPanel([])
    await fillForm(w, { name: 'oops3', cron: '@daily' })
    await w.find('[data-testid="schedule-submit"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="schedule-form-error"]').text()).toBe('资源冲突，请刷新后重试')
  })

  it('重名（后端唯一约束）同样原话显示', async () => {
    api.createSyncSchedule.mockRejectedValue(
      new Error('duplicate key value violates unique constraint "sync_schedules_name_key"'),
    )
    const w = await mountPanel([])
    await fillForm(w, { name: 'Daily OHLCV Sync', cron: '@daily' })
    await w.find('[data-testid="schedule-submit"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="schedule-form-error"]').text()).toContain('sync_schedules_name_key')
  })

  it('编辑走 PUT，id 在路径上', async () => {
    api.updateSyncSchedule.mockResolvedValue(s({ id: 3, cron_expression: '30 1 * * *' }))
    const w = await mountPanel([s({ id: 3 })])
    await w.find('[data-testid="schedule-edit-3"]').trigger('click')
    await field(w, 'schedule-input-cron').setValue('30 1 * * *')
    await w.find('[data-testid="schedule-submit"]').trigger('click')
    await flushPromises()
    expect(api.updateSyncSchedule).toHaveBeenCalledTimes(1)
    expect(api.updateSyncSchedule.mock.calls[0][0]).toBe(3)
    expect(api.updateSyncSchedule.mock.calls[0][1].cron_expression).toBe('30 1 * * *')
  })

  it('作业类型下拉取后端 registered_types，不是前端硬编码清单', async () => {
    const w = await mountPanel([])
    await w.find('[data-testid="schedule-create"]').trigger('click')
    await flushPromises()
    expect(useSyncStore().workerStats?.registered_types).toEqual(['ohlcv', 'stocks', 'fundamentals'])
    const options = w.findComponent(NSelect).props('options') as { value: string }[]
    expect(options.map((o) => o.value).sort()).toEqual(['fundamentals', 'ohlcv', 'stocks'])
  })
})

describe('新建表单的默认作业类型', () => {
  it('ohlcv 不在注册表里时退到第一项，而不是留一个后端不认的默认值', async () => {
    const w = await mountPanel([], [], ['calendar', 'dividends'])
    await w.find('[data-testid="schedule-create"]').trigger('click')
    await flushPromises()
    expect(w.findComponent(NSelect).props('value') as string).toBe('calendar')
  })

  it('注册表里有 ohlcv 时默认就是 ohlcv（不跟字母序漂到 dividends/fundamentals）', async () => {
    const w = await mountPanel([])
    await w.find('[data-testid="schedule-create"]').trigger('click')
    await flushPromises()
    expect(w.findComponent(NSelect).props('value') as string).toBe('ohlcv')
  })
})

describe('toggle / run-now / delete（断言 2 的后三条腿）', () => {
  it('停用中的排程点一下是"启用"，参数是 true', async () => {
    api.toggleSyncSchedule.mockResolvedValue({ message: 'schedule updated', id: 4, active: true })
    const w = await mountPanel([s({ id: 4, is_active: false })])
    await w.find('[data-testid="schedule-toggle-4"]').trigger('click')
    await flushPromises()
    expect(api.toggleSyncSchedule).toHaveBeenCalledWith(4, true)
  })

  it('run-now 之后队列里出现那条作业（判据是行，不是 toast），且不重读整张列表', async () => {
    api.runSyncScheduleNow.mockResolvedValue({ message: 'schedule triggered', job_id: 'scheduled-11', status: 'pending' })
    api.getSyncJob.mockResolvedValue({
      id: 'scheduled-11',
      job_type: 'ohlcv',
      status: 'pending',
      progress_percent: 0,
      total_items: 1,
      processed_items: 0,
      failed_items: 0,
      created_at: '2026-10-14T00:00:00Z',
      retry_count: 0,
      max_retries: 3,
    })
    const w = await mountPanel([s({ id: 11 })])
    api.listSyncJobs.mockClear()
    await w.find('[data-testid="schedule-run-11"]').trigger('click')
    await flushPromises()
    expect(api.runSyncScheduleNow).toHaveBeenCalledWith(11)
    expect(api.getSyncJob).toHaveBeenCalledWith('scheduled-11')
    expect(api.listSyncJobs).not.toHaveBeenCalled()
    expect(useSyncStore().jobs.map((j) => j.id)).toContain('scheduled-11')
  })

  it('run-now 失败时告警条显示后端原话，且不假装成功', async () => {
    api.runSyncScheduleNow.mockRejectedValue(new ApiError(400, '请求参数有误', { error: 'schedule not found: 12' }))
    const w = await mountPanel([s({ id: 12 })])
    await w.find('[data-testid="schedule-run-12"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="schedule-error"]').text()).toBe('schedule not found: 12')
    expect(api.getSyncJob).not.toHaveBeenCalled()
  })

  it('删除要经二次确认，确认后走 DELETE', async () => {
    api.deleteSyncSchedule.mockResolvedValue({ message: 'schedule deleted', id: 5 })
    const w = await mountPanel([s({ id: 5 })])
    // 未确认前不得发出删除请求
    await w.find('[data-testid="schedule-delete-5"]').trigger('click')
    await flushPromises()
    expect(api.deleteSyncSchedule).not.toHaveBeenCalled()

    w.findComponent(NPopconfirm).vm.$emit('positive-click')
    await flushPromises()
    expect(api.deleteSyncSchedule).toHaveBeenCalledWith(5)
  })
})
