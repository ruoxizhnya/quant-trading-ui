import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { waitForBackendReady } from '../helpers/api';
import { isolateTestEnvironment } from '../helpers/isolation';

/**
 * P2-26: Visual regression tests — screenshot comparison for key pages.
 *
 * Uses Playwright's toHaveScreenshot() for pixel-diff comparison.
 * First run generates baseline screenshots; subsequent runs compare.
 * Update baselines with: npx playwright test --update-snapshots
 */

/**
 * 冻结挂钟，但**只冻结 Date，不冻结定时器**。
 *
 * 页头有 `setInterval(updateClock, 1000)` 的秒级时钟，全页快照因此永远不可复现：
 * 实测 12 张基线里 5 张在**刚生成完立刻重跑**就红，diff 图显示唯一差异像素就在页头
 * 时间上（30–57 px）。用 setFixedTime 而不是 clock.install —— 后者会让待触发的
 * setTimeout 永不执行，把依赖轮询/延迟渲染的页面打成空态，那是"为了变绿而破坏被测行为"。
 *
 * ⚠️ 响应式两例自己 `browser.newContext()` 造页，拿不到 `beforeEach({ page })` 的注入，
 * 必须各自调用本函数 —— 漏掉的表现是基线里烙进真实时间，下次跑必红。
 */
const FROZEN_CLOCK = new Date('2026-05-06T10:30:00');
async function freezeClock(page: Page): Promise<void> {
  await page.clock.setFixedTime(FROZEN_CLOCK);
}

test.describe('Visual Regression — Key Pages', () => {

  test.beforeAll(async () => {
    const ready = await waitForBackendReady(60000);
    expect(ready).toBe(true);
  });

  test.beforeEach(async ({ page }) => {
    await freezeClock(page);
    await isolateTestEnvironment(page);
  });

  // ─── Dashboard ────────────────────────────────────────────

  test('dashboard renders correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('.dashboard-page', { timeout: 15000 });
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('dashboard.png');
  });

  test('dashboard sidebar visible', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('.dashboard-page', { timeout: 15000 });
    await page.waitForSelector('.nav-item', { timeout: 10000 });
    await page.waitForTimeout(300);
    const sidebar = page.locator('.n-layout-sider, .sidebar, nav').first();
    await expect(sidebar).toHaveScreenshot('dashboard-sidebar.png');
  });

  test('dashboard metric cards render', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('.dashboard-page', { timeout: 15000 });
    const cards = page.locator('.metric-card, .quick-bt-card, .nav-tile');
    if (await cards.count() > 0) {
      await expect(cards.first()).toHaveScreenshot('dashboard-metric-card.png');
    }
  });

  // ─── Backtest Engine ──────────────────────────────────────

  test('backtest page renders correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('.dashboard-page', { timeout: 15000 });
    await page.locator('[data-nav-path="/backtest"]').click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('.bt-page', { timeout: 20000 });
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('backtest.png');
  });

  test('backtest form visible', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('.dashboard-page', { timeout: 15000 });
    await page.locator('[data-nav-path="/backtest"]').click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('.bt-page', { timeout: 20000 });
    const form = page.locator('.n-card').first();
    await expect(form).toHaveScreenshot('backtest-form.png');
  });

  // ─── AI Research ──────────────────────────────────────────

  test('ai research factor lab renders', async ({ page }) => {
    await page.goto('/ai-research/factor-lab');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('.factor-lab-page, .ai-research-page', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('ai-factor-lab.png');
  });

  test('ai research strategy workshop renders', async ({ page }) => {
    await page.goto('/ai-research/strategy-workshop');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('.strategy-workshop-page, .ai-research-page', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('ai-strategy-workshop.png');
  });

  test('ai research evolution renders', async ({ page }) => {
    await page.goto('/ai-research/evolution');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('.ai-research-page', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('ai-evolution.png');
  });

  // ─── Stock Screener ───────────────────────────────────────

  test('stock screener renders correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('.dashboard-page', { timeout: 15000 });
    await page.locator('[data-nav-path="/screener"]').click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('stock-screener.png');
  });

  // ─── Data Sync ────────────────────────────────────────────

  test('data sync page renders correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('.dashboard-page', { timeout: 15000 });
    await page.locator('[data-nav-path="/data-sync"]').click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('data-sync.png');
  });

  // ─── Responsive Layout ────────────────────────────────────

  test('dashboard responsive on mobile viewport', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 375, height: 667 } });
    const page = await context.newPage();
    await freezeClock(page);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('.dashboard-page', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('dashboard-mobile.png');
    await context.close();
  });

  test('backtest responsive on tablet viewport', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 768, height: 1024 } });
    const page = await context.newPage();
    await freezeClock(page);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('.dashboard-page', { timeout: 15000 });
    await page.locator('[data-nav-path="/backtest"]').click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('.bt-page', { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('backtest-tablet.png');
    await context.close();
  });
});
