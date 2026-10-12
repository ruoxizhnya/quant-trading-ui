// BacktestEngine.test.ts —— K9：UI 的成功判据必须是 result.status 三值本身。
//
// 这是「废除 result.id 存在判成功」的用户可见那一半：
//   - invalid  ⇒ 显式警示 + invalid_reasons 列表（不是绿色成功标签）；
//   - failed   ⇒ 显式错误呈现（error 文本可见）；
//   - completed ⇒ 正常结果区。
//
// 破坏腿：把判据改回 `result.id` 存在 —— 无论是模板里的
// `result.id ? 'success' : ...` 还是 runSyncBacktest 的 `!res.id` throw ——
// 这里立刻红。原因：invalid / failed 的运行同样带 id（甚至可以无 id），
// 按 id 猜会把无效观测渲染成「成功」、把合法结果误判为失败。

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { NMessageProvider } from 'naive-ui'
import type { BacktestResult } from '@/types/api'

// vi.mock 会被提升到 import 之前，共享状态用 vi.hoisted 起。
const holder = vi.hoisted(() => ({
  routeQuery: {} as Record<string, string>,
  apiRun: vi.fn(),
  getReport: vi.fn(),
  getOHLCV: vi.fn(),
  exportHtml: vi.fn(),
  getStrategies: vi.fn(),
  addToHistory: vi.fn(),
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: holder.routeQuery }),
  useRouter: () => ({ push: vi.fn().mockResolvedValue(undefined) }),
}))

vi.mock('@/api/backtest', () => ({
  runBacktest: (...args: unknown[]) => holder.apiRun(...args),
  getBacktestReport: (...args: unknown[]) => holder.getReport(...args),
  getOHLCV: (...args: unknown[]) => holder.getOHLCV(...args),
  exportHtml: (...args: unknown[]) => holder.exportHtml(...args),
}))

vi.mock('@/api/strategy', () => ({
  getStrategies: (...args: unknown[]) => holder.getStrategies(...args),
}))

vi.mock('@/stores/backtest', () => ({
  useBacktestStore: () => ({
    history: [],
    loadHistory: vi.fn(),
    loadHistoryFromDB: vi.fn(),
    addToHistory: holder.addToHistory,
    clearHistory: vi.fn(),
  }),
}))

vi.mock('@/composables/useAsyncBacktest', async () => {
  const { ref } = await import('vue')
  return {
    useAsyncBacktest: () => ({
      state: ref({ status: 'idle', progress: 0, error: null, result: null }),
      submit: vi.fn(),
      cancel: vi.fn(),
    }),
  }
})

import BacktestEngine from './BacktestEngine.vue'

function makeResult(overrides: Partial<BacktestResult> = {}): BacktestResult {
  return {
    id: 'bt-1',
    status: 'completed',
    total_return: 0.1,
    annual_return: 0.2,
    sharpe_ratio: 1.2,
    sortino_ratio: 1.4,
    max_drawdown: -0.1,
    max_drawdown_date: '2024-04-15',
    calmar_ratio: 1.5,
    started_at: '2024-01-01T00:00:00Z',
    completed_at: '2024-01-01T00:01:00Z',
    portfolio_values: [],
    trades: [],
    ...overrides,
  }
}

// BacktestForm 用可触发 submit 的桩 —— 同步回测判据腿要真的走 runBacktest。
const BacktestFormStub = defineComponent({
  name: 'BacktestForm',
  emits: ['submit'],
  template: '<div><button data-testid="form-submit" @click="$emit(\'submit\')">go</button></div>',
})

async function render() {
  const wrapper = mount(
    defineComponent({
      components: { BacktestEngine, NMessageProvider },
      template: '<n-message-provider><BacktestEngine /></n-message-provider>',
    }),
    {
      global: {
        stubs: {
          BacktestForm: BacktestFormStub,
          MetricsCards: true,
          EquityChart: true,
          TradeTable: true,
          DetailMetrics: true,
          BacktestHistory: true,
          BacktestProgress: true,
        },
      },
    },
  )
  await flushPromises()
  return wrapper
}

async function runSync(wrapper: ReturnType<typeof mount>) {
  const syncBtn = wrapper.findAll('button').find((b) => b.text() === '同步')
  if (!syncBtn) throw new Error('同步模式按钮没找到')
  await syncBtn.trigger('click')
  await wrapper.find('[data-testid="form-submit"]').trigger('click')
  await flushPromises()
}

describe('BacktestEngine.vue — status 三值判据', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    holder.routeQuery = {}
    holder.getStrategies.mockResolvedValue({ strategies: [] })
    holder.getOHLCV.mockResolvedValue({})
  })

  it('invalid：显式警示 + invalid_reasons 列表，不是成功标签', async () => {
    holder.routeQuery = { id: 'bt-inv' }
    holder.getReport.mockResolvedValue(
      makeResult({ id: 'bt-inv', status: 'invalid', invalid_reasons: ['empty_universe', 'zero_trades'] }),
    )
    const wrapper = await render()

    expect(wrapper.find('[data-testid="result-invalid"]').exists()).toBe(true)
    const items = wrapper.findAll('[data-testid="invalid-reason-item"]')
    expect(items.length).toBe(2)
    expect(items[0].text()).toBe('empty_universe')
    expect(items[1].text()).toBe('zero_trades')
    expect(wrapper.find('[data-testid="result-failed"]').exists()).toBe(false)
    // 状态标签由 status 决定：「无效运行」，不是 result.id 推出来的绿色成功。
    expect(wrapper.find('[data-testid="result-status-tag"]').text()).toContain('无效运行')
  })

  it('failed：显式呈现错误与 error 文本', async () => {
    holder.routeQuery = { id: 'bt-fail' }
    holder.getReport.mockResolvedValue(makeResult({ id: 'bt-fail', status: 'failed', error: 'provider down' }))
    const wrapper = await render()

    const alert = wrapper.find('[data-testid="result-failed"]')
    expect(alert.exists()).toBe(true)
    expect(alert.text()).toContain('provider down')
    expect(wrapper.find('[data-testid="result-invalid"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="result-status-tag"]').text()).toContain('失败')
  })

  it('completed：两个警示都不出现', async () => {
    holder.routeQuery = { id: 'bt-ok' }
    holder.getReport.mockResolvedValue(makeResult({ id: 'bt-ok', status: 'completed' }))
    const wrapper = await render()

    expect(wrapper.find('[data-testid="result-invalid"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="result-failed"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="result-status-tag"]').text()).toContain('已完成')
  })

  it('同步回测：无 id 的 invalid 结果按 status 呈现（破坏腿：判据改回 result.id ⇒ 红）', async () => {
    holder.apiRun.mockResolvedValue(
      makeResult({ id: '', status: 'invalid', invalid_reasons: ['zero_trades'] }),
    )
    const wrapper = await render()
    await runSync(wrapper)

    expect(wrapper.find('[data-testid="result-invalid"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="invalid-reason-item"]').length).toBe(1)
  })

  it('同步回测：failed 显式呈现，不因缺 id 被吞成 toast', async () => {
    holder.apiRun.mockResolvedValue(makeResult({ id: '', status: 'failed', error: 'provider down' }))
    const wrapper = await render()
    await runSync(wrapper)

    const alert = wrapper.find('[data-testid="result-failed"]')
    expect(alert.exists()).toBe(true)
    expect(alert.text()).toContain('provider down')
  })
})
