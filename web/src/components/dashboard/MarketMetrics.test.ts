import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { NSelect } from 'naive-ui'
import MarketMetrics from './MarketMetrics.vue'
import { MARKET_INDEX_OPTIONS } from '@/utils/marketReadout'
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

function mountCard(metrics: MarketIndex | null, fetchFailed = false) {
  return mount(MarketMetrics, {
    props: {
      selectedDate: '2026-09-24',
      selectedIndex: '000300.SH',
      loading: false,
      metrics,
      fetchFailed,
    },
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
    expect(w.text()).toContain('DATA-12')
    expect(w.text()).not.toMatch(/NaN|undefined|\[object Object]/)
  })

  it('空态里不出现任何数字格，避免把"没读数"看成"读数为 0"', () => {
    const text = mountCard(null).text()
    expect(text).not.toContain('+0.00%')
    expect(text).not.toMatch(/4,439/)
  })

  it('「这次没读到」与「确实没有」分两句：失败帧上不许说 0 行', () => {
    // Dashboard 把请求失败也置 metrics=null。若空态只有一句"接口回了空数组、0 行"，
    // 失败时界面就在替后端编一个诚实读数 —— 与 A-08 作业控制台那条「空态分句」冲突，
    // 也正是 core 台账里对本单的描述（"不把失败显示成今天没行情"）要求的那件事。
    const failed = mountCard(null, true)
    const text = failed.text()
    expect(text).toContain('读数失败')
    expect(text).toContain('这次请求没成功')
    expect(text).not.toContain('0 行')
    expect(text).not.toContain('无指数数据')
    expect(failed.findAll('.metric-item')).toHaveLength(0)

    // 对照腿：同一句"0 行"只在空数组那一帧成立
    const empty = mountCard(null, false).text()
    expect(empty).toContain('0 行')
    expect(empty).not.toContain('这次请求没成功')
  })
})

describe('市场概览的下拉与空态话说得准（DATA-11）', () => {
  it('下拉候选绑的就是那份服务集，组件里没有第二份清单', () => {
    // 旧形状在这里另写一份含 399001.SZ 的数组：选它 ⇒ core 400，想要 000300.SH ⇒ 选不到。
    const sel = mountCard(bar()).findComponent(NSelect)
    expect(sel.props('options')).toEqual(MARKET_INDEX_OPTIONS)
    expect(sel.props('value')).toBe('000300.SH')
  })

  it('空态点名的是**选中的那一个**代码，不是「三个代码」', () => {
    // (a1) 之后一条请求只问一个指数；还说「三个指数代码 0 行」就把用户没选的那两个
    // 的账也算进了这一格 —— 读数与要的那一天/那一个指数对齐，正是本单的判据。
    const w = mount(MarketMetrics, {
      props: {
        selectedDate: '2026-09-24',
        selectedIndex: '399006.SZ',
        loading: false,
        metrics: null,
        fetchFailed: false,
      },
    })
    expect(w.text()).toContain('399006.SZ')
    expect(w.text()).not.toContain('三个指数代码')
  })

  it('失败帧要说清第三种成因：回包没有点名的那一条也算没读到', () => {
    const text = mountCard(null, true).text()
    expect(text).toContain('没给回你点名的那一个指数')
  })
})
