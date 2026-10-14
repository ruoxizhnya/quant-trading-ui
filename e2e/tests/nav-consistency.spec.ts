import { test, expect } from '@playwright/test'
import { waitForBackendReady } from '../helpers/api'

/**
 * A-04 侧栏与顶栏统一 —— 可执行取证（TASKS.md A-04 断言 1/3/4/6）。
 *
 * 为什么用 e2e 而不是单测：这三条断言测的是**渲染结果**，不是源码。
 * 本轮已经栽过四次"grep 到 0 命中 ≠ 页面上真的生效"（Chart.js 库默认色、rgba 形式旧色、
 * NavTiles 的 scoped 死规则、BacktestHistory 的死复制），所以导航这种"每页都渲染"的东西
 * 必须在真实页面上量。
 */

const ROUTES = [
  '/',
  '/backtest',
  '/backtest/compare',
  '/screener',
  '/copilot',
  '/explore',
  '/strategy-lab',
  '/strategy-builder',
  '/data-sync',
  '/evidence',
  '/factors',
  '/alerts',
]

test.describe('A-04 导航与顶栏统一', () => {
  test.beforeAll(async () => {
    expect(await waitForBackendReady(60000)).toBe(true)
  })

  /** 断言 1：12 个页面渲染出的侧栏条目集合完全相同 */
  test('全部路由的侧栏条目数组逐字相同', async ({ page }) => {
    let baseline: string[] | null = null
    for (const route of ROUTES) {
      await page.goto(route)
      const labels = page.locator('.nav-item .nav-label')
      // 等**条件**而不是等时长：goto 之后 Vue 还要渲染，直接读会拿到 0 个（首跑即如此）
      await expect(labels).not.toHaveCount(0, { timeout: 10000 })
      const texts = (await labels.allTextContents()).map((s) => s.trim())
      if (baseline === null) {
        baseline = texts
        expect(texts.length).toBeGreaterThanOrEqual(9)
      }
      expect(texts, `${route} 的侧栏与首页不一致`).toEqual(baseline)
    }
  })

  /**
   * 高亮唯一：旧实现 `route.path.startsWith(item.path)` 让 /backtest/compare 上
   * 「回测引擎」与「多策略对比」同时高亮。这条断言把"恰好一个 active"钉住。
   */
  test('每条路由恰好一个高亮项，且与路由匹配', async ({ page }) => {
    for (const route of ROUTES) {
      await page.goto(route)
      const active = page.locator('.nav-item.active')
      await expect(active, `${route} 上高亮项数应为 1`).toHaveCount(1)
      const href = await active.getAttribute('href')
      expect(href, `${route} 高亮了 ${href}`).toBe(route)
    }
  })

  /** 断言 4：顶栏不得出现行情/L2/集群字样（ODR-066 B3 判删项） */
  test('顶栏无 SSE / L2 / probe/h / iter/h / QUEUE 字样', async ({ page }) => {
    await page.goto('/')
    const header = page.locator('header.app-header')
    await expect(header.getByText(/\bSSE\b|\bL2\b|probe\/h|iter\/h|HERMES|DETERMINISTIC STABLE|\bQUEUE\b/i)).toHaveCount(0)
  })

  /**
   * 断言 6：键盘 Tab 可达 + 焦点环用 --q-focus 且 ≥3:1。
   *
   * 必须用**真键盘事件**：`:focus-visible` 按交互方式判定，`el.focus()` 程序化聚焦拿不到
   * 焦点环（本轮就因此误判过一次"焦点环没生效"）。
   */
  test('Tab 进入侧栏时焦点环为 --q-focus 且对比度 ≥3:1', async ({ page }) => {
    await page.goto('/')
    const focusVar = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--q-focus').trim())
    expect(focusVar).toBe('#b4c5ff')

    let onNavItem = false
    for (let i = 0; i < 20 && !onNavItem; i++) {
      await page.keyboard.press('Tab')
      onNavItem = await page.evaluate(() =>
        document.activeElement?.classList?.contains('nav-item') === true)
    }
    expect(onNavItem, '20 次 Tab 内未到达侧栏任何入口').toBe(true)

    /**
     * 必须 poll 而不是读完就走：`.nav-item` 上有 `transition: all`，而
     * `outline-color` / `outline-width` 是**可动画**属性（`outline-style` 是离散的，立刻生效）。
     * 聚焦后立刻取 computed 会读到动画起点（currentColor / 3px），看起来就像规则没生效 ——
     * 本轮排查焦点环时正是被这个假象带偏了一次。等条件成立，不猜时长。
     */
    await expect
      .poll(() => page.evaluate(() => {
        const cs = getComputedStyle(document.activeElement as Element)
        return `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor}`
      }), { timeout: 3000 })
      .toBe('solid 2px rgb(180, 197, 255)')
  })
})
