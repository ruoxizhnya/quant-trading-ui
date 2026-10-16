import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import MarketMetrics from './MarketMetrics.vue'
import type { MarketIndex } from '@/types/api'

/**
 * DATA-07（2026-10-16）「市场概览」的判据：**界面不再有恒为 '-' 的指标**。
 *
 * 缺陷本体是两层：
 *  1. core 的 `/market/index` 响应里从来没有 volume/amount，而 ui 那两格在读
 *     `metrics.volume` / `metrics.amount` —— 读的键后端从来没发过，
 *     `fmtAmount(undefined)` 走 falsy 分支恒 '-'。
 *  2. 涨跌幅那格读的是 `metrics.change_pct`，后端发的键叫 `pct`：字段名对不上，
 *     同样是恒 '-'。而且 `pct` 是**百分数刻度**，若改读它却仍走 `fmtPercent`
 *     （内部再乘 100），会把 +1.23% 显示成 +123.00% —— 本文件的第 3 条用例
 *     专门钉这个 100 倍错配，因为它在旧代码里被"恒 '-'"完全遮住了。
 *
 * 与 A-08 对 DataQualityPanel 的裁决同口径：**没有读数就显式说没有**，
 * 不拿 '-' 冒充数据，也不在前端造数。
 */

function bar(over: Partial<MarketIndex> = {}): MarketIndex {
  return {
    code: '000300.SH',
    name: '沪深300',
    close: 4439.1443,
    change: 38.6443,
    pct: 0.8782, // 百分数刻度：0.8782 == +0.88%
    volume: 151965787, // 股
    amount: 375461676.1428, // CNY
    ...over,
  }
}

function mountCard(metrics: MarketIndex | null) {
  return mount(MarketMetrics, {
    props: { selectedDate: '2026-09-24', selectedIndex: '000300.SH', loading: false, metrics },
  })
}

describe('市场概览：有读数时逐格显示真值', () => {
  it('四格都显示读到的数，且不再有 \'-\'', () => {
    const w = mountCard(bar())
    const text = w.text()

    expect(text).not.toContain('-')
    expect(text).not.toMatch(/NaN|undefined|\[object Object]/)
    expect(w.findAll('.metric-item')).toHaveLength(4)

    const values = w.findAll('.metric-val').map((n) => n.text())
    // 收盘价 4439.14（fmtNumber 保留 2 位）
    expect(values[0]).toBe('4,439.14')
    // 涨跌幅按百分数刻度渲染
    expect(values[1]).toBe('+0.88%')
    // 成交量 151,965,787 股 → 1.5亿（fmtVolume 除以 1e8）
    expect(values[2]).toBe('1.5亿')
    // 成交额 375,461,676.1428 CNY → 3.8亿（fmtAmount 除以 1e8，界面补「亿」）
    expect(values[3]).toBe('3.8亿')
  })

  it('下跌时带 down 类，上涨时带 up 类', () => {
    expect(mountCard(bar({ pct: -1.5, change: -60 })).find('.metric-val.down').exists()).toBe(true)
    expect(mountCard(bar({ pct: 1.5 })).find('.metric-val.up').exists()).toBe(true)
  })
})

describe('市场概览：刻度与字段名单点（旧缺陷的两种复发形状）', () => {
  it('pct 不再被乘 100（1.23 就是 +1.23%，不是 +123.00%）', () => {
    const values = mountCard(bar({ pct: 1.23, change: 54 })).findAll('.metric-val').map((n) => n.text())
    expect(values[1]).toBe('+1.23%')
  })

  it('读数来自 core 实际发的键：change_pct 这种不存在的键不参与渲染', () => {
    // 用**契约内**的字段构造，渲染结果必须由 pct 决定。
    // 旧代码读 metrics.change_pct —— 那个键从来没被后端发过，所以这格恒 '-'；
    // 若有人改回读它，本条会拿到空态而不是 +2.00%。
    const values = mountCard(bar({ pct: 2 })).findAll('.metric-val').map((n) => n.text())
    expect(values[1]).toBe('+2.00%')
  })

  it('没有上一期收盘 / turnover 为 NULL 时显示"未读取"，不是 0 也不是 \'-\'', () => {
    const w = mountCard(bar({ pct: null, change: null, amount: null }))
    const values = w.findAll('.metric-val').map((n) => n.text())

    expect(values[1]).toBe('未读取')
    expect(values[3]).toBe('未读取')
    expect(values.join('|')).not.toContain('0.00%')
    expect(values.join('|')).not.toContain('0亿')
    // 没有上一期收盘时不着色（null 既不是涨也不是跌）
    expect(w.find('.metric-val.up').exists()).toBe(false)
    expect(w.find('.metric-val.down').exists()).toBe(false)
  })
})

describe('市场概览：没有指数日线时走显式空态', () => {
  it('metrics 为 null 时不渲染四格，改为指名缺口的空态', () => {
    const w = mountCard(null)

    expect(w.findAll('.metric-item')).toHaveLength(0)
    expect(w.find('.metrics-empty').exists()).toBe(true)
    expect(w.text()).toContain('无指数数据')
    // 空态要能说清"为什么没有"，否则只是一个新的装饰性占位
    expect(w.text()).toContain('0 行')
    expect(w.text()).not.toMatch(/NaN|undefined|\[object Object]/)
  })

  it('空态里不出现任何数字格，避免把"没读数"看成"读数为 0"', () => {
    const text = mountCard(null).text()
    expect(text).not.toContain('+0.00%')
    expect(text).not.toMatch(/4,439/)
  })
})
