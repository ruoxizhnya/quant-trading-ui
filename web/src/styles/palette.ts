/**
 * 设计 token —— 代码侧唯一字面量源
 *
 * 真相源：docs/design/stitch_quantlab_ux_redesign/obsidian_precision_quant/DESIGN.md (v2.0)
 *
 * 为什么需要这个文件：Chart.js 与 Naive UI 的 themeOverrides 都**吃不了 CSS 自定义属性**，
 * 只能收字面量。此前这些字面量散在 12 个组件里各写各的（67 处），改 token 时它们不动，
 * 于是出现「页面底色换了、图表还是旧色」的分裂。
 *
 * 三处必须一致，由 styles/palette.test.ts 机器钉住：
 *   DESIGN.md（规定）  ↔  variables.css（自定义 CSS 用）  ↔  本文件（组件库与图表用）
 *
 * 新增颜色请先加到 DESIGN.md，再同步到这里与 variables.css；不要在本文件另立颜色。
 */

export const palette = {
  // 画布与表面阶梯
  canvas: '#090a0c',
  surface1: '#111620',
  surface2: '#171e2c',
  surface3: '#1e2638',
  border: '#5a6070',
  hairline: '#2a3449',

  // 文字三级（全部 ≥4.5:1）
  text: '#e1e2eb',
  text2: '#c3c6d7',
  text3: '#94a3b8',

  // 确定性通道
  primary: '#b4c5ff',
  primaryFill: '#2563eb',
  primaryFillHover: '#3b76f0',
  primaryFillPressed: '#1d4ed8',
  primaryLight: '#dbe1ff',

  // 概率性 / AI 通道
  ai: '#7c3aed',
  aiText: '#d0bcff',
  aiLight: '#a78bfa',

  // 状态三值（K9）
  success: '#10b981',
  successHover: '#34d399',
  successPressed: '#059669',
  warning: '#f59e0b',
  warningHover: '#fbbf24',
  warningPressed: '#d97706',
  danger: '#ef4444',
  dangerHover: '#f87171',
  dangerPressed: '#dc2626',
  dangerText: '#f87171',

  // 多序列图表色带（DESIGN.md §0.2）—— 刻意**低饱和**，避免与状态色混淆
  series1: '#b4c5ff',
  series2: '#7fb0b8',
  series3: '#d9b98a',
  series4: '#8fb8a8',
  series5: '#9aa7d6',
  series6: '#e1e2eb',

  // 状态色软底（三值芯片与高亮行用，DESIGN.md §4）
  successSoft: 'rgba(16, 185, 129, 0.08)',
} as const

/**
 * 图表系列色 —— 只取已有 token，不新立色相。
 *
 * 语义纪律：系列色**不承载**状态含义。基准/参考价这类「上下文序列」用中性的
 * text3 而非 amber —— amber 是 invalid 的专用色，借来画股价会让「无效」在
 * 图表里被误读。买卖点用 success/danger，因为那确实是状态语义。
 */
export const chartPalette = {
  /** 主序列：策略净值 */
  seriesPrimary: palette.primary,
  seriesPrimaryFill: 'rgba(180, 197, 255, 0.07)',
  /** 参照序列：基准指数 / 股价等上下文线 */
  seriesReference: palette.text3,
  seriesReferenceFill: 'rgba(148, 163, 184, 0.07)',
  /**
   * 多序列轮转色带（多策略对比等）。
   * 只用 series* 而**不用** aiText/success/warning —— 后者是状态与 AI 语义色，
   * 借给"策略 A/B/C"会让读者把系列误读成状态（原则 1：确定性 vs 概率性可分辨）。
   */
  seriesCycle: [
    palette.series1,
    palette.series2,
    palette.series3,
    palette.series4,
    palette.series5,
    palette.series6,
  ] as const,

  buy: palette.success,
  sell: palette.danger,
  /** 成交点（深一档，与买卖三角区分） */
  tradeBuy: palette.successPressed,
  tradeSell: palette.dangerPressed,

  grid: palette.hairline,
  tick: palette.text3,
  legend: palette.text3,
  axisTitle: palette.text3,
} as const
