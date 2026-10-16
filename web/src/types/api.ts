export interface BacktestRequest {
  strategy: string
  stock_pool: string[]
  start_date: string
  end_date: string
  initial_capital?: number
  commission_rate?: number
  slippage_rate?: number
}

export interface PortfolioPoint {
  date: string
  total_value: number
  cash: number
  positions: number
}

// Trade as returned by backend engine (raw format from domain.Trade)
export interface Trade {
  id: string
  symbol: string
  direction: 'long' | 'short' | 'close'
  quantity: number
  price: number              // execution price (entry for long/short, exit for close)
  commission: number
  transfer_fee: number
  stamp_tax: number
  timestamp: string          // ISO date when trade executed
  pending_qty: number
  filled_qty: number

  // Computed/display fields (not from backend, derived in UI)
  entry_date?: string        // = timestamp for long/short trades
  exit_date?: string | null  // = timestamp for close trades
  entry_price?: number       // = price for long/short
  exit_price?: number | null // = price for close
  pnl?: number               // computed from trade pair
  pnl_pct?: number           // computed from trade pair
}

// K9（ResultSpec 冻结）：运行 status 三值 —— 与后端 contracts.Status* 常量同源。
// **判据是 status 本身**，不得用 id 是否存在推断成功 —— invalid / failed
// 的运行同样带 id。
export type RunStatus = 'completed' | 'invalid' | 'failed'

export interface BacktestResult {
  id: string
  status: RunStatus
  // 仅 status='invalid' 时有：无效裁定的稳定 Code 列表（OBS-01）。
  invalid_reasons?: string[]
  // 仅 status='failed' 时有：真实错误。无效**不**装在这里。
  error?: string
  strategy?: string
  stock_pool?: string[]
  start_date?: string
  end_date?: string
  total_return: number
  annual_return: number
  sharpe_ratio: number
  sortino_ratio: number
  max_drawdown: number
  max_drawdown_date: string
  calmar_ratio: number
  started_at: string
  completed_at: string | null
  created_at?: string
  portfolio_values: PortfolioPoint[]
  trades: Trade[]
  metrics?: Record<string, number>
  initial_capital?: number
}

export interface BacktestJob {
  id: string
  strategy_id: string
  // CR-08 (ODR-012): `params: Record<string, any>` is too permissive. Strategy
  // parameter values are always one of: number, string, boolean, or null
  // (per pkg/strategy/strategy.go Parameter.Default). Constraining the value
  // type lets IDEs auto-complete the param map and prevents accidental
  // embedding of complex objects.
  params: Record<string, number | string | boolean | null>
  universe: string
  start_date: string
  end_date: string
  status: string
  result?: BacktestResult
  error?: string
  created_at: string
  started_at?: string
  completed_at?: string
}

export interface Strategy {
  id: string
  name: string
  description: string
  category: string
  parameters?: StrategyParam[]
}

export interface StrategyParam {
  name: string
  type: 'number' | 'string' | 'boolean' | 'select'
  default: number | string | boolean | null
  min?: number
  max?: number
  description: string
  options?: { label: string; value: number | string | boolean }[] // For select type
}

/**
 * 「市场概览」的一条指数读数 —— 形状以 core 的 `GET /market/index` 实测为准
 * （DATA-07，2026-10-16；契约登记在 core `docs/SPEC.md` §1 与 openapi.yaml）。
 *
 * 三处刻意与旧类型不同，都是「声明了但后端从来没给」的字段：
 *  - 去掉 `open`/`high`/`low`：core 的 `marketIndexPayload` 从不发这三个键。
 *  - 去掉 `MarketData.updated_at`：响应里只有 `indices`，没有更新时间。
 *  - `change`/`pct`/`amount` 可空：没有上一期收盘时涨跌幅**无从算起**，
 *    `turnover` 列可空时成交额没有读数。core 给 null 而不是 0，因为
 *    「+0.00%」「成交额 0 元」是假数字。
 *
 * `pct` 是**百分数刻度**（1.23 == +1.23%），所以这里不能过 `fmtPercent`
 * （它自己会再乘 100，会把 1.23% 显示成 123%）。单位：volume 股、amount CNY，
 * 展示层换算（亿/万）不改单位口径本身。
 */
export interface MarketIndex {
  code: string
  name: string
  close: number
  change: number | null
  pct: number | null
  volume: number
  amount: number | null
}

export interface MarketData {
  indices: MarketIndex[]
}

/**
 * `GET /api/stocks/count` 的读数（DATA-02 的拆分 + DATA-03 的最新行情日期）。
 *
 * `by_status` 与 `latest_date` 都是后端**恒发**的键：前者空表时是 `{}`，
 * 后者在库里还没有行情时是 `null`（不是缺席）。旧类型只声明 `count` 与
 * `latest_date: string`，而 `latest_date` 实测从不出现 —— 那是 DATA-03 关闭的缺陷。
 */
export interface StockCount {
  count: number
  by_status: Record<string, number>
  latest_date: string | null
}

export interface HealthStatus {
  status: string
  version: string
  uptime_seconds: number
}

export interface ScreenResult {
  symbols: string[]
  total: number
  factors: Record<string, number>[]
}

// ── Copilot（OBS-12：对齐后端异步 job 契约，cmd/analysis/handlers_copilot.go）──
// 旧契约 {prompt} / {code,language,explanation,strategy_name} 是**从未对上过的
// 同步版遗留**——后端活契约自始就是异步 job（POST 受理 202 + GET 轮询）。

export interface CopilotRequest {
  description: string
  universe?: string
  start_date?: string
  end_date?: string
}

// POST /api/copilot/generate 的响应（202 = job 已受理）。
export interface CopilotJobStarted {
  job_id: string
  status: string
}

// GET /api/copilot/generate/{job_id} 的响应。
// status 状态机与后端 pkg/strategy/copilot.go 同步——终态：
//   generated / backtest_complete（成功）
//   llm_failed / sandbox_rejected / build_failed / backtest_failed（失败）
// 非终态只有 pending。前端轮询到终态即返回（见 api/copilot.ts）。
export interface CopilotJobStatus {
  job_id: string
  status: string
  generated_code?: string
  build_error?: string
  strategy_name?: string
  backtest_error?: string
  backtest_result?: Record<string, unknown>
}

export interface HistoryEntry {
  id: string
  // 运行 status（K9 三值）：历史条目须能区分无效运行，不得当成功观测陈列。
  // 旧版历史数据无此字段，读取方按「无标识」兜底。
  status?: RunStatus
  strategy?: string
  stock_pool?: string[]
  start_date?: string
  end_date?: string
  total_return: number
  sharpe_ratio?: number
  max_drawdown?: number
  created_at?: string
  trades?: TradeDisplay[]
}

export interface TradeDisplay {
  id: string
  symbol: string
  direction: string
  timestamp: string
  price: number | null
  quantity: number | null
  commission?: number
  pnl?: number
  pnl_pct?: number
  entry_date?: string
  exit_date?: string | null
  entry_price?: number | null
  exit_price?: number | null
}
