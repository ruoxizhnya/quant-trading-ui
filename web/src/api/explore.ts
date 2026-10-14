import api from './client'

// P1-3 观察页的数据源。后端见 cmd/analysis/handlers_explore.go。
//
// 一次「探索」= 一轮研究：AI 连续试若干组参数，每试一次落一行实验日志。
// 这里的三个接口对应「启动 / 看进度 / 叫停」—— 叫停是一等公民，因为
// 一轮被叫停的探索和跑满的探索，其结论可信度完全不同。

// P2-9 验证器链的裁决。后端见 pkg/ai/validation/aggregate.go。
//
// 关键语义（别在前端改掉）：它不是通过/不通过，而是**概率估计 + 质疑清单**。
// 决策权在人手里 —— 所以这里要把「没评估的维度」也显示出来，
// 「没查」不等于「没问题」。
export interface Challenge {
  dimension: string
  severity: 'blocking' | 'warning' | 'note'
  message: string
}

/** 因果维（六维里唯一需要模型的一维）：机制 + 可证伪预测的验证结果 */
export interface CausalResult {
  mechanism?: string
  /** 可证伪的预测条数；只有这些才算数，讲得出但验不了的不算 */
  testable: number
  passed: number
  failed: number
  probability: number
}

export interface Verdict {
  /** 各维概率；缺的那一维不在 map 里（= 未评估，不是 0 分） */
  dimensions: Record<string, number>
  unassessed?: string[]
  /** 综合概率 = 已评估维度的最小值：结论受限于最弱的那一环 */
  probability: number
  weakest?: string
  geometric_mean: number
  blocking: number
  challenges: Challenge[]
  /** 只对最终候选做（一次模型调用不便宜），其余尝试为 undefined */
  causal?: CausalResult | null
}

export const DIMENSION_LABELS: Record<string, string> = {
  statistical: '统计',
  economic: '经济',
  robustness: '稳健',
  bias: '偏差',
  redundancy: '冗余',
  causal: '因果',
}

/**
 * 六维的**固定展示顺序**（A-05 断言 1）。
 *
 * 为什么不靠 DIMENSION_LABELS 的键序：那是对象属性顺序，虽然现代引擎稳定，但"六维恒为
 * 六行"是契约级要求，不该挂在一个语言特性的巧合上。
 */
export const DIMENSION_ORDER: string[] = [
  'statistical',
  'economic',
  'robustness',
  'bias',
  'redundancy',
  'causal',
]

export function dimensionLabel(d: string): string {
  return DIMENSION_LABELS[d] ?? d
}

/**
 * 综合概率 = **已评估**维度的最小值；一维都没评估时返回 null（不是 0）。
 *
 * 为什么放在 api 层而不是组件里：结果流上的 "P 0.42" 与裁决面板里的"综合概率"是
 * **同一个数**，两处各写一遍算法就会有一天不一致 —— 而用户看到的是同一个 attempt。
 *
 * `unassessed` 有否决权：被列为未评估的维度即使混进了数值也不参与。契约上二者不该
 * 冲突，真冲突时只能往"没查"那侧失败安全 —— 把未评估维度算进可信度等于替 AI 编造。
 */
export function assessedProbability(v: Verdict | null | undefined): number | null {
  if (!v) return null
  const skipped = new Set(v.unassessed ?? [])
  const assessed = Object.entries(v.dimensions)
    .filter(([k, p]) => !skipped.has(k) && typeof p === 'number')
    .map(([, p]) => p)
  return assessed.length ? Math.min(...assessed) : null
}

/** 最弱一环的维度键；与 assessedProbability 同一套口径，同样不采信后端 weakest 字段 */
export function weakestDimension(v: Verdict | null | undefined): string | null {
  if (!v) return null
  const skipped = new Set(v.unassessed ?? [])
  const entries = Object.entries(v.dimensions).filter(([k, p]) => !skipped.has(k) && typeof p === 'number')
  if (!entries.length) return null
  return entries.reduce((a, b) => (a[1] <= b[1] ? a : b))[0]
}

export interface AttemptView {
  seq: number
  hypothesis: string
  params: Record<string, unknown>
  experiment_id: number
  sharpe: number
  ok: boolean
  error?: string
  /** 失败的尝试没有裁决 —— 没有回测结果就没有可被证伪的东西 */
  verdict?: Verdict | null
}

export interface ExploreStatus {
  run_id: string
  running: boolean
  stopped?: string
  attempts: AttemptView[]
  best_seq?: number | null
}

export interface StartExploreRequest {
  description: string
  max_tries?: number
  lookback_min?: number
  lookback_max?: number
}

export interface StartExploreResponse {
  run_id: string
  max_tries: number
}

export function startExplore(req: StartExploreRequest): Promise<StartExploreResponse> {
  return api.post<StartExploreResponse>('/api/explore/runs', req)
}

export function getExploreStatus(runID: string): Promise<ExploreStatus> {
  return api.get<ExploreStatus>(`/api/explore/runs/${encodeURIComponent(runID)}`)
}

export function stopExplore(runID: string): Promise<{ run_id: string; stopping: boolean }> {
  return api.post<{ run_id: string; stopping: boolean }>(
    `/api/explore/runs/${encodeURIComponent(runID)}/stop`,
    {},
  )
}
