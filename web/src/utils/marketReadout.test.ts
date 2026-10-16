import { describe, expect, it } from 'vitest'
import { readMarketIndex, MARKET_INDEX_OPTIONS } from './marketReadout'
import type { MarketIndex } from '@/types/api'

/**
 * DATA-11 (a1) 的 ui 半边：卡片显示的必须是**被点名的那一个指数**。
 *
 * 旧形状 `indices[indices.length - 1]` 在 core 忽略 `?symbol` 的年代等价于
 * 「永远显示列表末尾那条」，而下拉框让用户以为自己在选。工单 ③ 的裁决是
 * 「(a1) 落地后 ui 侧取值须一并改为按 selectedIndex 命中（否则控件仍不生效——
 * 这是本单『诚实』判据的另一半）」，本文件钉的就是这一半。
 */

function bar(over: Partial<MarketIndex> = {}): MarketIndex {
  return {
    code: '000300.SH',
    name: '沪深300',
    close: 4439.1443,
    change: 38.6443,
    pct: 0.8782,
    volume: 151965787,
    amount: 375461676.1428,
    ...over,
  }
}

// 三条都给时，末尾那条是创业板指 —— 旧代码会显示它，与本单要钉的形状正好相反。
const allThree = [
  bar({ code: '000001.SH', name: '上证指数', close: 3000.5 }),
  bar({ code: '000300.SH', name: '沪深300', close: 4439.1443 }),
  bar({ code: '399006.SZ', name: '创业板指', close: 1800.75 }),
]

describe('市场概览按选中项取数（DATA-11 的 ui 半边）', () => {
  it('回包给了三条时，取的是点名的那一条，不是末尾那条', () => {
    const hit = readMarketIndex({ indices: allThree }, '000001.SH').metrics

    expect(hit?.code).toBe('000001.SH')
    expect(hit?.close).toBe(3000.5)
    // 反证腿：旧形状indices[length-1] 在此刻会给 1800.75（创业板指）
    expect(hit?.close).not.toBe(allThree[2].close)
  })

  it('core 按参数只回一条时同样命中（这是参数化之后的常态形状）', () => {
    const single = [{ ...allThree[1] }]
    const read = readMarketIndex({ indices: single }, '000300.SH')

    expect(read.fetchFailed).toBe(false)
    expect(read.metrics?.code).toBe('000300.SH')
  })

  it('有条目但没有点名的那一条 ⇒ 说「没读到」，不拿别人的读数冒充', () => {
    // 契约违约那一帧：这条端点答应按 symbol 给数，给出的却不是被点名的那个。
    // 显示 399006.SZ 的读数（或任何一条）都等于替用户编一个他没要的数。
    const read = readMarketIndex({ indices: [allThree[2]] }, '000001.SH')

    expect(read.metrics).toBeNull()
    expect(read.fetchFailed).toBe(true)
  })

  it('空数组是诚实读数：null 但 fetchFailed=false（界面说「确实没有」那一方）', () => {
    const read = readMarketIndex({ indices: [] }, '000300.SH')

    expect(read.metrics).toBeNull()
    expect(read.fetchFailed).toBe(false)
  })

  it('回包不合形状（没有 indices 数组 / 整个回包为空）⇒ 没读到，不是「今天没行情」', () => {
    expect(readMarketIndex({ indices: undefined as unknown as MarketIndex[] }, '000300.SH').fetchFailed).toBe(true)
    expect(readMarketIndex(undefined, '000300.SH').fetchFailed).toBe(true)
    expect(readMarketIndex(null, '000300.SH').fetchFailed).toBe(true)
  })
})

describe('下拉候选 = core 的服务集（DATA-11）', () => {
  it('三个可选代码与 core marketIndexCodes 同集，且不含 core 不供给的深证成指', () => {
    // core 侧那份清单在 cmd/data/handlers_stocks.go 的 marketIndexCodes，
    // SPEC §1 是两边的共同口径。这里钉的是 ui 这一份：多一个（选不得的）少一个
    // （想要的）都算界面在撒谎 —— 原来 399001.SZ 在列而 000300.SH 不在，两头都错。
    expect(MARKET_INDEX_OPTIONS.map((o) => o.value)).toEqual(['000300.SH', '000001.SH', '399006.SZ'])
    expect(MARKET_INDEX_OPTIONS.map((o) => o.label)).toEqual(['沪深300', '上证指数', '创业板指'])
    expect(MARKET_INDEX_OPTIONS.some((o) => o.value === '399001.SZ')).toBe(false)
  })

  it('默认选中项必须在服务集里', () => {
    // Dashboard.vue 的 selectedIndex 初值 '000001.SH' 在这里对着同一份清单核对：
    // 初值不在集合里就等于一进页面就打一条 400（core 对服务集外明确拒）。
    // ⚠️ 这条钉的是「初值与服务集相容」，钉不了「Dashboard 真的用了这个初值」——
    // 后者由上面那条 + 渲染腿守，改初值的人必须回来同步这个字面量。
    expect(MARKET_INDEX_OPTIONS.map((o) => o.value)).toContain('000001.SH')
  })
})
