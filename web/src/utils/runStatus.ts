import type { RunStatus } from '@/types/api'

/**
 * K9 三值的展示口径 —— 全站唯一一份。
 *
 * 为什么要有这个文件：断言 2 要求 `completed / invalid / failed` 在
 * 类型、组件、文案三处**同口径**。组件这一层此前是 `BacktestHistory.vue` 里
 * 一个本地 `statusTag()`，控制台的历史列表根本没接这个口径 —— 于是同一条
 * 无效运行在回测页显示"无效运行"，在控制台显示成一枚绿色"多"，
 * 差别只取决于用户从哪看。文案与颜色一旦各写各的，"同口径"就是句空话。
 */
export type StatusTagType = 'success' | 'warning' | 'error' | 'default'

export interface StatusTag {
  type: StatusTagType
  label: string
}

/**
 * 三值的规范呈现，**全站只有这一份**。
 *
 * 为什么要收成表而不是两处 switch：`BacktestEngine.vue` 原先自己写了一份
 * `statusTagType` / `statusTagLabel` switch，措辞与这里逐字相同（"无效运行"、
 * "失败"）—— 两份同义代码意味着任何一次改文案只会改到一半，
 * 而"同口径"要靠人记得去另一处改，那不叫口径。
 */
const COMPLETED: StatusTag = { type: 'success', label: '已完成' }
const UNKNOWN: StatusTag = { type: 'default', label: '未知状态' }

const KNOWN: Record<string, StatusTag> = {
  completed: COMPLETED,
  invalid: { type: 'warning', label: '无效运行' },
  failed: { type: 'error', label: '失败' },
}

/**
 * 给每个 status 一个**看得见**的呈现。
 *
 * 认出来的态按规范表；`status` 有值但不认识（后端将来加态）→ 未知状态，
 * 而不是沉默 —— 沉默等于替用户宣布"这次没问题"。
 */
export function statusTagFor(status?: string | null): StatusTag {
  if (status === undefined || status === null || status === '') return UNKNOWN
  return KNOWN[status] ?? UNKNOWN
}

/**
 * 列表视角的标识：**completed 返回 null**（成功不需要自证，加一枚绿标只会把
 * 真正要看见的两态淹掉）。
 *
 * `status` 缺失也返回 null，但这是**有意的**：历史列表里有 localStorage
 * 存来的旧条目，那次改动之前写的，本来就没有这个字段。给它编一个状态
 * 才是撒谎。注意这与快速回测相反 —— 那是一次**刚跑完**的运行，
 * 后端今天一定会发 status，缺了就是契约破了，必须响（见 QuickBacktest.vue）。
 *
 * 但"有值却不认识"**不**归入这条豁免：那是后端明确说了一个我们不懂的态，
 * 必须显示"未知状态"。
 */
export function runStatusTag(status?: RunStatus | null): StatusTag | null {
  const key: string = status ?? ''
  if (key === '') return null
  const tag = KNOWN[key]
  return tag === COMPLETED ? null : (tag ?? UNKNOWN)
}

/** 无效原因 Code → 人话。没见过的 Code 原样显示，不猜、不编。 */
const REASON_LABELS: Record<string, string> = {
  empty_universe: '股票池为空',
  zero_trades: '一次成交都没有',
  garbage_metric: '指标是不可用值',
  insufficient_data: '数据不足',
}

export function invalidReasonLabel(code: string): string {
  return REASON_LABELS[code] ?? code
}

export function invalidReasonsText(codes?: string[]): string {
  if (!codes?.length) return '后端判定无效，但未给出原因'
  return codes.map(invalidReasonLabel).join(' · ')
}

/**
 * AI 流水线产物里那次回测的**有效性说法**（Copilot 气泡在用）。
 *
 * 输入是 `job.backtest_result` —— 后端把它裸着序列化成 JSON，前端没有对应
 * interface，所以这里只能是 `Record<string, unknown>`；但正因如此，措辞更不能
 * 留在页面里自说自话：它说的同样是 K9 那三值，写第二份就等着两处漂移。
 *
 * 为什么不能只读 `total_return`：一次空票池的无效运行照样带数字回来，
 * 对着 0 笔成交播报"回测总收益 0.00%"正是 K9 要拦的形状。
 *
 * 判据顺序是刻意的：
 * 1. `status` 认得就按三值说。
 * 2. 认不出时**不默认成有效**，退回后端给这条链路的真实判据 `invalid_reasons`
 *    —— `pkg/backtest/engine.go:924` 每次返回前都跑 `CheckValidity` 并挂上
 *    这组 Code（有效 = 空数组），`quant-trading-agent` 的 AI 循环
 *    （`pkg/ai/loop/loop.go:223`）用的也是同一条。这不是前端发明的判据。
 *
 * 已登记的缺口：`pkg/ai/client/backtest_client.go:47` 的 `RunBacktest` 解出了
 * `BacktestResponse.Status`（同文件 :43）却只返回 `*domain.BacktestResult`，
 * 三值被丢在客户端边界上；`domain.BacktestResult` 本身没有 Status 字段。
 * 补上之后第 1 条会自己接管，这里无需改动。
 */
export function backtestValidityNote(result?: Record<string, unknown>): string {
  if (!result) return ''
  const ret =
    typeof result.total_return === 'number'
      ? `，回测总收益 ${(result.total_return * 100).toFixed(2)}%`
      : ''
  switch (result.status) {
    case 'completed':
      return ret
    case 'invalid':
      return `，但那次回测被判无效（${invalidReasonsText(result.invalid_reasons as string[] | undefined)}）`
    case 'failed':
      return '，但那次回测失败，没有可用结果'
    default: {
      // status 没到 ⇒ 用后端自己的判据，并把判据说出来，让"凭什么算有效"可质问
      const reasons = Array.isArray(result.invalid_reasons) ? (result.invalid_reasons as string[]) : []
      if (reasons.length > 0) {
        return `，但那次回测被判无效（${invalidReasonsText(reasons)}）`
      }
      return ret
        ? `${ret}（有效性判据：invalid_reasons 为空）`
        : '（这次回测没有产出指标；有效性判据：invalid_reasons 为空）'
    }
  }
}
