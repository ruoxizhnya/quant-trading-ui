import type { MarketData, MarketIndex } from '@/types/api'

/**
 * 「市场概览」那一格的读数怎么从 `/api/market/index` 的回包里取（DATA-11）。
 *
 * 旧形状是 `indices[indices.length - 1]`：不看选中项，谁排在最后就显示谁。
 * core 当时忽略 `?symbol`，回包恒是三个代码 ⇒ 下拉框选了「上证指数」，
 * 屏上给的却是列表末尾那条 —— 控件不影响读数，界面在撒谎（工单 ①）。
 * core 参数化之后，取值仍然按 `code` 命中：回包里有几条不重要，
 * **显示的必须是被点名的那一条**，这样「core 又不管参数了」这件事
 * 至多让界面多说几条，不会把别的指数说成用户选的那一个。
 *
 * `fetchFailed` 是把 `metrics: null` 的成因分开的第三态（DATA-07 已分「没读到 /
 * 确实没有」两句，本单把「没读到」再拆细一格）：
 *   - 回包不是形状内的对象、没有 `indices` 数组 ⇒ 没读到；
 *   - `indices` 是空数组 ⇒ 确实没有（诚实读数，界面说「0 行」那一方）；
 *   - 有条目但**没有点名的那一条** ⇒ 也没读到：这条端点答应按 symbol 给数，
 *     给出来的却不是被点名的那个，是契约违约，不是「今天没有行情」。
 */
export interface MarketReadout {
  metrics: MarketIndex | null
  fetchFailed: boolean
}

export function readMarketIndex(res: MarketData | null | undefined, requestedCode: string): MarketReadout {
  if (!res || !Array.isArray(res.indices)) {
    return { metrics: null, fetchFailed: true }
  }
  if (res.indices.length === 0) {
    return { metrics: null, fetchFailed: false }
  }
  const hit = res.indices.find((entry) => entry.code === requestedCode)
  if (!hit) {
    return { metrics: null, fetchFailed: true }
  }
  return { metrics: hit, fetchFailed: false }
}

/**
 * 「市场概览」下拉的候选 = core `GET /market/index` 的**服务集**（DATA-11）。
 *
 * core 对服务集外的 `?symbol` 明确回 400（不透传：`ohlcv_daily_qfq` 里全是股票，
 * 透传等于把一只股票当指数卖），所以下拉里出现任何一个选不得的代码都是界面在撒谎 ——
 * 这正是原来 `399001.SZ 深证成指` 的处境，也是 `000300.SH 沪深300` 原来不在列的处境。
 *
 * 这份清单收在 ui 的一处（`MarketMetrics.vue` 只绑它），⚠️ 但它仍是 core
 * `marketIndexCodes` 的**手抄副本**：中文名 core 也在响应里发一份，两处真相。
 * 彻底解法是让 core 把服务集发出来（响应带一个 `served` 字段或单开只读面），
 * 已随本单记在 core 台账；在那之前改一边必须改另一边，SPEC §1 是两边共同口径。
 */
export const MARKET_INDEX_OPTIONS = [
  { label: '沪深300', value: '000300.SH' },
  { label: '上证指数', value: '000001.SH' },
  { label: '创业板指', value: '399006.SZ' },
]
