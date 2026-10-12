// BacktestHistory.test.ts —— 钉住「无效 / 失败运行不得当成功观测陈列」（K9 审查修复 3）。
//
// 历史列表此前只按 total_return 染色，status 三值进不了 UI：invalid 运行会
// 和成功运行一样挂着绿色收益标签。这里测的是组件渲染而非抽离 helper ——
// 破坏腿：statusTag 的 switch 改回只认 completed（或不渲染该 tag），立刻红。

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BacktestHistory from './BacktestHistory.vue'
import type { HistoryEntry } from '@/types/api'

function makeEntry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    id: 'bt-1',
    strategy: 'momentum',
    stock_pool: ['600000.SH'],
    total_return: 0.15,
    sharpe_ratio: 1.5,
    max_drawdown: -0.08,
    ...overrides,
  }
}

function render(history: HistoryEntry[]) {
  return mount(BacktestHistory, { props: { history } })
}

describe('BacktestHistory.vue — status 三值标识', () => {
  it('invalid 运行 ⇒ 显示「无效运行」警示标识', () => {
    const wrapper = render([makeEntry({ status: 'invalid' })])
    const tag = wrapper.find('[data-testid="history-status-tag"]')
    expect(tag.exists()).toBe(true)
    expect(tag.text()).toContain('无效运行')
  })

  it('failed 运行 ⇒ 显示「失败」标识', () => {
    const wrapper = render([makeEntry({ status: 'failed' })])
    const tag = wrapper.find('[data-testid="history-status-tag"]')
    expect(tag.exists()).toBe(true)
    expect(tag.text()).toContain('失败')
  })

  it('completed 运行 ⇒ 不加状态标识（不制造噪音）', () => {
    const wrapper = render([makeEntry({ status: 'completed' })])
    expect(wrapper.find('[data-testid="history-status-tag"]').exists()).toBe(false)
  })

  it('旧数据无 status ⇒ 按无标识兜底，不误判', () => {
    const wrapper = render([makeEntry()])
    expect(wrapper.find('[data-testid="history-status-tag"]').exists()).toBe(false)
  })

  it('混合集 ⇒ 仅 invalid/failed 条目带标识', () => {
    const wrapper = render([
      makeEntry({ id: 'ok', status: 'completed' }),
      makeEntry({ id: 'bad', status: 'invalid' }),
      makeEntry({ id: 'dead', status: 'failed' }),
    ])
    expect(wrapper.findAll('[data-testid="history-status-tag"]')).toHaveLength(2)
  })
})