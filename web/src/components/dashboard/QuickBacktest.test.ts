import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { NTag } from 'naive-ui'
import QuickBacktest from './QuickBacktest.vue'
import type { BacktestResult } from '@/types/api'

/**
 * 快速回测的三值渲染（A-07 断言 2/3/5）。
 *
 * 这个组件是断言 1 那个缺陷的**现场**：它原先收的是本地投影的
 * `interface QuickResult { id; total_return?; sharpe_ratio? }` —— 投影把
 * status 丢了，于是 `status=invalid` 的运行在这里被渲染成一枚绿色
 * "收益 +0.00%"，与一次真成功的回测**逐像素相同**。
 *
 * 三条用例各自独立（不是参数化），因为要防的正是"默认落在哪一支"。
 */
function result(over: Partial<BacktestResult> = {}): BacktestResult {
  return {
    id: 'bt-1',
    status: 'completed',
    strategy: 'momentum',
    stock_pool: ['600000.SH'],
    total_return: 0.0312,
    annual_return: 0.08,
    sharpe_ratio: 1.42,
    sortino_ratio: 2.1,
    max_drawdown: -0.02,
    max_drawdown_date: '2024-03-01',
    calmar_ratio: 4,
    started_at: '2026-10-14T00:00:00Z',
    completed_at: '2026-10-14T00:05:00Z',
    portfolio_values: [],
    trades: [],
    ...over,
  }
}

/** 按文案找到那枚状态标签组件，好断它的 type prop（DOMWrapper 没有 props()） */
function statusTagOf(w: ReturnType<typeof mount>, label: string) {
  const hit = w.findAllComponents(NTag).find((t) => t.text().includes(label))
  if (!hit) throw new Error(`没找到文案含「${label}」的 NTag`)
  return hit
}

function mounted(over: Partial<BacktestResult> = {}) {
  return mount(QuickBacktest, {
    props: {
      strategy: 'momentum',
      stock: '600000.SH',
      startDate: '2024-01-01',
      endDate: '2024-06-30',
      running: false,
      strategies: ['momentum'],
      quickResult: result(over),
    },
  })
}

describe('QuickBacktest — completed', () => {
  it('显示收益与夏普，且不打任何状态标签', () => {
    const w = mounted()
    expect(w.text()).toContain('收益')
    expect(w.text()).toContain('3.12%')
    expect(w.text()).toContain('1.42')
    expect(w.find('[data-testid="quick-invalid"]').exists()).toBe(false)
    expect(w.find('[data-testid="quick-failed"]').exists()).toBe(false)
  })
})

describe('QuickBacktest — invalid', () => {
  it('警示样式**且**列出 invalid_reasons（缺一即断言为假）', () => {
    const w = mounted({ status: 'invalid', invalid_reasons: ['empty_universe', 'zero_trades'] })
    const tag = statusTagOf(w, '无效运行')
    // naive-ui 的 NTag 不加 type 修饰类（走 CSS 变量），所以断组件 prop 而不是
    // class —— 断 class 会得到一个恒不匹配的**空断言**，看着在测颜色其实什么都没测。
    expect(tag.props('type')).toBe('warning')
    expect(tag.text()).toContain('无效运行')
    // 原因要落到人话，不是把 Code 甩给用户
    expect(w.get('[data-testid="quick-invalid-reasons"]').text()).toContain('股票池为空')
    expect(w.get('[data-testid="quick-invalid-reasons"]').text()).toContain('一次成交都没有')
  })

  it('绝不显示"收益 +0.00%"这种看起来像成功的数', () => {
    const w = mounted({ status: 'invalid', total_return: 0, sharpe_ratio: 0, invalid_reasons: ['empty_universe'] })
    expect(w.text()).not.toContain('收益')
    expect(w.text()).not.toContain('夏普')
  })

  it('后端判了无效却没给原因时，如实说"没给原因"', () => {
    const w = mounted({ status: 'invalid' })
    expect(w.get('[data-testid="quick-invalid-reasons"]').text()).toContain('未给出原因')
  })
})

describe('QuickBacktest — failed', () => {
  it('错误样式 + 点名原因，且不显示指标', () => {
    const w = mounted({ status: 'failed', error: 'strategy load failed' } as Partial<BacktestResult>)
    const tag = statusTagOf(w, '回测失败')
    expect(tag.props('type')).toBe('error')
    expect(tag.text()).toContain('回测失败')
    expect(w.get('[data-testid="quick-failed-error"]').text()).toContain('strategy load failed')
    expect(w.text()).not.toContain('收益')
  })

  it('failed 与 invalid 措辞不同 —— 一个是没跑成，一个是跑完了但不可用', () => {
    const failed = mounted({ status: 'failed' }).text()
    const invalid = mounted({ status: 'invalid', invalid_reasons: ['zero_trades'] }).text()
    expect(failed).toContain('回测失败')
    expect(failed).not.toContain('无效运行')
    expect(invalid).toContain('无效运行')
    expect(invalid).not.toContain('回测失败')
  })
})

describe('QuickBacktest — status 缺失或不认识', () => {
  /**
   * 这一条是本轮最要紧的一条。写成 `v-else` 显示指标的话，
   * status 一旦缺失就**默认成成功** —— 那正是 K9 要收掉的"没说不行就算行"。
   */
  it('不显示任何指标，并明说有效性不可判', () => {
    const w = mounted({ status: undefined } as Partial<BacktestResult>)
    expect(w.text()).not.toContain('收益')
    expect(w.text()).not.toContain('夏普')
    expect(w.get('[data-testid="quick-unknown-status"]').text()).toContain('未知状态')
    expect(w.get('[data-testid="quick-unknown-status-detail"]').text()).toContain('不拿"没说不行"当"行"')
  })

  it('第四种值（后端将来加态）同样不默认成成功', () => {
    const w = mounted({ status: 'cancelled' as BacktestResult['status'] })
    expect(w.find('[data-testid="quick-unknown-status"]').exists()).toBe(true)
    expect(w.text()).not.toContain('收益')
  })
})

describe('QuickBacktest — 三态都保留深链', () => {
  for (const s of ['completed', 'invalid', 'failed'] as const) {
    it(`${s} 仍能查看报告（要质问才更需要看明细）`, () => {
      const w = mounted({ status: s, invalid_reasons: s === 'invalid' ? ['zero_trades'] : undefined })
      expect(w.text()).toContain('查看报告')
    })
  }
})
