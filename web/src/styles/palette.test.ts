import { readFileSync, readdirSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { palette } from './palette'

/**
 * 漂移守卫：DESIGN.md（规定） ↔ variables.css（自定义 CSS） ↔ palette.ts（组件库/图表）
 *
 * 三处此前各自为政，是「改了 token 图表不变」的根因。本测试把后两者钉死：
 * 任何一侧单独改动都会在这里变红。
 *
 * 破坏验证（AGENTS.md §8.5.3-2）：把 palette.ts 或 variables.css 里任一值改一位，
 * 本文件对应断言必须红；还原后必须绿。
 */

const cssSource = readFileSync(resolve(__dirname, 'variables.css'), 'utf8')

/**
 * 解析 :root 里的 `--q-xxx: value;`。
 * 先整体剥掉注释再跨行匹配 —— 逐行匹配会被**多行声明**骗过（`--q-font` 的字体栈
 * 就跨了两行，逐行正则吃不到值，会把它误报成"悬空引用"）。守卫不能被排版格式牵着走。
 */
function cssVars(source: string): Record<string, string> {
  const stripped = source.replace(/\/\*[\s\S]*?\*\//g, '')
  const out: Record<string, string> = {}
  for (const m of stripped.matchAll(/(--q-[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    out[m[1]] = m[2].replace(/\s+/g, ' ').trim()
  }
  return out
}

const css = cssVars(cssSource)

/** palette 键 → CSS 变量名。只列**应当**一致的语义色，布局/字体不在此约束内 */
const pairs: Array<[keyof typeof palette, string]> = [
  ['canvas', '--q-bg'],
  ['surface1', '--q-surface'],
  ['surface2', '--q-surface2'],
  ['surface3', '--q-surface3'],
  ['border', '--q-border'],
  ['hairline', '--q-border-light'],
  ['text', '--q-text'],
  ['text2', '--q-text2'],
  ['text3', '--q-text3'],
  ['primary', '--q-primary'],
  ['primaryFill', '--q-primary-dark'],
  ['primaryLight', '--q-primary-light'],
  ['ai', '--q-ai'],
  ['aiText', '--q-ai-text'],
  ['success', '--q-success'],
  ['warning', '--q-warning'],
  ['danger', '--q-danger'],
  ['dangerText', '--q-danger-text'],
  ['series1', '--q-series-1'],
  ['series2', '--q-series-2'],
  ['series3', '--q-series-3'],
  ['series4', '--q-series-4'],
  ['series5', '--q-series-5'],
  ['series6', '--q-series-6'],
]

describe('design token 漂移守卫', () => {
  it('variables.css 里每个受约束的变量都存在', () => {
    const missing = pairs.map(([, cssName]) => cssName).filter((n) => !(n in css))
    expect(missing).toEqual([])
  })

  it.each(pairs)('palette.%s 与 %s 逐字相等', (key, cssName) => {
    expect(css[cssName].toLowerCase()).toBe(palette[key].toLowerCase())
  })

  it('CSS 侧不得出现已被废弃的旧调色板值', () => {
    // 这些是 v1.0 调色板，留着说明有人绕过 DESIGN.md 改值。
    // 只比对**解析后的值** —— 注释里提到旧值（如"旧 #484f58 已废"）不算漂移。
    const retired = ['#0d1117', '#161b22', '#1c2333', '#21262d', '#30363d', '#e6edf3', '#8b949e', '#484f58', '#58a6ff', '#1f6feb', '#79c0ff', '#3fb950', '#f85149', '#d29922']
    const live = new Set(Object.values(css).map((v) => v.toLowerCase()))
    const found = retired.filter((hex) => live.has(hex))
    expect(found).toEqual([])
  })
})

// —— 对比度不变量 ——
// DESIGN.md §7 的实测依据。token 值一旦改动使下列任一对跌破阈值，这里立刻红。
function luminance(hex: string): number {
  const h = hex.replace('#', '')
  const chan = (i: number) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * chan(0) + 0.7152 * chan(2) + 0.0722 * chan(4)
}

function contrast(a: string, b: string): number {
  const la = luminance(a)
  const lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

describe('对比度不变量（WCAG）', () => {
  it('文字三级在 elevation 1 上均 ≥4.5:1', () => {
    for (const key of ['text', 'text2', 'text3'] as const) {
      expect(contrast(palette[key], palette.surface1), key).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('主序列/状态色在 elevation 1 上 ≥4.5:1', () => {
    for (const key of ['primary', 'aiText', 'success', 'warning'] as const) {
      expect(contrast(palette[key], palette.surface1), key).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('实心按钮上的白字 ≥4.5:1', () => {
    for (const key of ['primaryFill', 'ai'] as const) {
      expect(contrast('#ffffff', palette[key]), key).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('danger 在浮层(elevation 3)上用小字号时走 dangerText', () => {
    // #ef4444 在 e3 上只有 4.02:1，故另立 dangerText
    expect(contrast(palette.danger, palette.surface3)).toBeLessThan(4.5)
    expect(contrast(palette.dangerText, palette.surface3)).toBeGreaterThanOrEqual(4.5)
  })

  it('组件边框在画布上 ≥3:1（非文本对比度）', () => {
    expect(contrast(palette.border, palette.canvas)).toBeGreaterThanOrEqual(3)
  })

  it('每条系列色在画布上 ≥3:1（图表线条可见性）', () => {
    for (const key of ['series1', 'series2', 'series3', 'series4', 'series5', 'series6'] as const) {
      expect(contrast(palette[key], palette.canvas), key).toBeGreaterThanOrEqual(3)
    }
  })

  it('系列色不与状态色撞义', () => {
    // 策略系列若等于 success/warning/danger/ai，读者会把"策略 C"误读成"无效/AI 产出"
    const status = new Set([
      palette.success, palette.successHover, palette.successPressed,
      palette.warning, palette.warningHover, palette.warningPressed,
      palette.danger, palette.dangerHover, palette.dangerPressed,
      palette.ai, palette.aiText, palette.aiLight,
    ].map((c) => c.toLowerCase()))
    const collided = (['series1', 'series2', 'series3', 'series4', 'series5', 'series6'] as const)
      .filter((k) => status.has(palette[k].toLowerCase()))
    expect(collided).toEqual([])
  })
})

/**
 * 变量引用完整性：src 下每一处 `var(--q-*)` 必须在 variables.css 里有定义。
 *
 * 存在的理由：扫页把 `color="#58a6ff"` 改成 `var(--q-primary)` 时，**打错一个字母不会
 * 报错，只会静默回落到继承色** —— 而 CSS 变量拼错正是这类重构最常见的失败模式。
 * 本条把"引用得到吗"从人眼检查变成机器检查，覆盖后续所有扫页任务。
 */
describe('CSS 变量引用完整性', () => {
  const srcRoot = resolve(__dirname, '..')

  function walk(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = join(dir, e.name)
      if (e.isDirectory()) return e.name === 'node_modules' ? [] : walk(p)
      // 排除测试文件：本守卫管的是会渲染的样式，测试里的示例字符串不算引用
      return /\.(vue|ts|css)$/.test(e.name) && !/\.test\.ts$/.test(e.name) ? [p] : []
    })
  }

  const rel = (file: string) => file.replace(srcRoot, '').split('\\').join('/')

  function findDangling(): string[] {
    const defined = new Set(Object.keys(css))
    const hits: string[] = []
    for (const file of walk(srcRoot)) {
      for (const m of readFileSync(file, 'utf8').matchAll(/var\(\s*(--q-[a-z0-9-]+)/g)) {
        if (!defined.has(m[1])) hits.push(`${m[1]} ← ${rel(file)}`)
      }
    }
    return [...new Set(hits)].sort()
  }

  /** 带旧调色板兜底值的写法：兜底永不生效（变量总有定义），却把旧色留在仓库里 */
  function findFallbacks(): string[] {
    const hits: string[] = []
    for (const file of walk(srcRoot)) {
      for (const m of readFileSync(file, 'utf8').matchAll(/var\(\s*--q-[a-z0-9-]+\s*,\s*#[0-9a-fA-F]{3,8}\s*\)/g)) {
        hits.push(`${rel(file)}: ${m[0]}`)
      }
    }
    return [...new Set(hits)].sort()
  }

  /**
   * 棘轮基线：**A-03 已清零，此后恒为空数组**（2026-10-14）。
   *
   * 断言取集合相等，所以两个方向都会红：新增欠债 → 红；改动基线却不改代码 → 也红。
   * 空基线意味着这三类静默失败从此是**永久门禁**而非待办清单 —— 放宽它需要显式改这里，
   * 改这里就是"故意引入缺陷"，评审时一眼可见。
   */
  const DANGLING_BASELINE: string[] = []

  const FALLBACK_BASELINE: string[] = []

  it('悬空 var(--q-*) 引用与基线集合相等', () => {
    expect(findDangling()).toEqual(DANGLING_BASELINE)
  })

  it('带旧调色板兜底值的 var() 与基线集合相等', () => {
    expect(findFallbacks()).toEqual(FALLBACK_BASELINE)
  })

  /**
   * rgba() 形式的旧调色板。
   *
   * 为什么单独一条：此前所有扫页判据都按 **hex** 抓，而 `rgba(88,166,255,0.12)` 这类
   * 半透明旧色**一个 hex 都不含** —— 侧栏激活态（每页都渲染）就是这么漏过去的。
   * 这是我在 A-01 刚批评过 Chart.js 库默认色之后的第二个同类盲点，故升级为机器断言而非备忘。
   *
   * 做法：把废弃 hex 表转成 RGB 三元组，再匹配任意 `rgba?(r, g, b, …)` —— 不手写颜色正则。
   */
  const RETIRED_HEXES = [
    '#0d1117', '#161b22', '#1c2333', '#21262d', '#30363d', '#484f58', '#8b949e',
    '#e6edf3', '#58a6ff', '#1f6feb', '#79c0ff', '#3fb950', '#f85149', '#d29922',
    '#f0883e', '#238636', '#da3633', '#85e89d', '#ffab70', '#f97583', '#ff7b72',
    '#b392f0', '#79b8ff', '#e1e4e8', '#d03050', '#f56c6c', '#a371f7', '#2a2a2a', '#888888',
    '#f78166', '#ffa657', '#db61a2',
  ]

  function retiredRgbTriples(): Set<string> {
    const out = new Set<string>()
    for (const h of RETIRED_HEXES) {
      const s = h.slice(1)
      const full = s.length === 3 ? s.split('').map((c) => c + c).join('') : s.slice(0, 6)
      const r = parseInt(full.slice(0, 2), 16)
      const g = parseInt(full.slice(2, 4), 16)
      const b = parseInt(full.slice(4, 6), 16)
      out.add(`${r},${g},${b}`)
    }
    return out
  }

  function findRetiredRgba(): string[] {
    const triples = retiredRgbTriples()
    const hits: string[] = []
    for (const file of walk(srcRoot)) {
      for (const m of readFileSync(file, 'utf8').matchAll(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,[^)]*)?\)/g)) {
        if (triples.has(`${m[1]},${m[2]},${m[3]}`)) hits.push(`${rel(file)}: ${m[0]}`)
      }
    }
    return [...new Set(hits)].sort()
  }

  /**
   * 棘轮基线：**A-03 已把 7 处全部清零，此后恒为空数组**（2026-10-14）。
   *
   * 原先这份清单由脚本枚举 src 得到，**不是手抄 grep 结果**。第一版我按 grep 手抄成 6 条，
   * 实际是 7 条（漏了 `EmergencyFlatten.vue` 的 `rgba(245,108,108,.04)`）—— 而"手抄"正是
   * 本守卫要防的那类错误，所以清单本身也必须机器生成。
   *
   * 换色时 alpha **不是照搬**的：新主色比旧 `#58a6ff` 亮得多，同透明度会得到更重的视觉
   * 重量。逐条按"合成后 ΔL 相等"解出新 alpha，过程与结果记在 DESIGN.md §0.2.2。
   */
  const RETIRED_RGBA_BASELINE: string[] = []

  it('rgba() 形式的旧调色板与基线集合相等（A-03 清零）', () => {
    expect(findRetiredRgba()).toEqual(RETIRED_RGBA_BASELINE)
  })
})
