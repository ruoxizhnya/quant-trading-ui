import { test, expect } from '@playwright/test';
import { apiRequest, getJsonWithBackoff, waitForBackendReady } from '../helpers/api';
import { isolateTestEnvironment } from '../helpers/isolation';

/**
 * A-06 证据质问内嵌 —— 三条断言用**真实后端**验，两条用 mock 补。
 *
 * 分工不是偷懒，是照着"哪条断言今天真的有真数据"划的：
 *
 * - 真数据能覆盖的：`ingest.raw` 有 11952 条真记录（命中态 / 404 未摄取态）、
 *   `backtest_jobs` 有完成的回测（无坐标 → 无法回溯）、深链 `?content_hash=` 仍在。
 * - 真数据**覆盖不到**的：抽屉里的命中态。带坐标的数字只有因子侧有，而
 *   `factor_cache` 今天 0 行（实测 `GET /api/factors/... → 404 factor cache
 *   entry not found`）。不往那张表里塞假行 —— 引擎启动时会 warm 它
 *   （日志里就有 "factor cache warming enabled"），一条假因子可能悄悄进真回测。
 *   所以那两条走 mock，并在名字里写清楚它是 mock。
 */

const REAL_HASH = 'fc14d53f9773e3aa95977e7035ca3948becb7b2c41706b1897d545010320d114';
const ABSENT_HASH = '0'.repeat(64);

/** 拿一条真完成的回测 id；拿不到就让测试红，不静默 skip */
async function aCompletedBacktestID(): Promise<string> {
  const ctx = await apiRequest();
  // 只对 429 退避（本地限流桶是全进程共享的，见 helpers/api.ts 的注记）；
  // 其他状态码原样交给下面的断言去红。body 必须在 dispose 之前读。
  const res = await getJsonWithBackoff(ctx, '/api/backtest?limit=20');
  const body = res.ok()
    ? ((await res.json()) as { jobs?: { id: string; status: string }[] })
    : null;
  await ctx.dispose();
  expect(body, `GET /api/backtest 未成功（末次状态码 ${res.status()}）`).toBeTruthy();
  const hit = (body!.jobs ?? []).find((j) => j.status === 'completed');
  expect(hit, '本地库里没有 completed 回测，A-06 的回测报告用例无法取证').toBeTruthy();
  return hit!.id;
}

test.describe('A-06 证据质问内嵌', () => {
  test.beforeAll(async () => {
    expect(await waitForBackendReady(60000)).toBe(true);
  });

  test.beforeEach(async ({ page }) => {
    await isolateTestEnvironment(page);
  });

  test('断言 6：/evidence 深链仍是兜底，且真能取回原始记录', async ({ page }) => {
    await page.goto(`/evidence?content_hash=${REAL_HASH}`);
    // 真数据：这条来自 ingest.raw 的 akshare 记录
    await expect(page.locator('main')).toContainText('akshare.stock_financial_abstract');
    await expect(page.locator('main')).toContainText(REAL_HASH);
    await expect(page.locator('main')).not.toContainText('未摄取');
  });

  test('断言 5：404 是「未摄取」警示态，不是查询失败（真后端）', async ({ page }) => {
    await page.goto(`/evidence?content_hash=${ABSENT_HASH}`);
    await expect(page.locator('main')).toContainText('未摄取');
    await expect(page.locator('main')).not.toContainText('查询失败');
  });

  test('断言 1+4：回测报告的每个指标都挂着质问入口，且「无法回溯」不点也看得见', async ({ page }) => {
    const id = await aCompletedBacktestID();
    await page.goto(`/backtest?id=${id}`);

    const probes = page.locator('[data-testid="ev-probe-trigger"]');
    await expect(probes).toHaveCount(5);

    // 关键：文案是**渲染出来的**，不是 hover 才出现的 title
    for (const probe of await probes.all()) {
      await expect(probe).toContainText('无法回溯');
    }

    // 为什么是 5 而不是"页面上所有数字"：同页还有个「详细指标」区块
    // （DetailMetrics.vue），但 `GET /api/backtest/:id/report` 的响应里
    // **没有 metrics 这个键**，前端也从不给它赋值 ⇒ 它的 v-if 恒假、整块永不渲染。
    // 那是个死组件，已另记（见 TASKS.md A-06 节）。给死代码加质问入口是
    // 为不存在的场景写代码，所以这里只覆盖真的会渲染出来的那 5 个。
    await expect(page.locator('.metrics-detail-grid')).toHaveCount(0);
  });

  test('断言 2：点质问入口开抽屉，URL 逐字不变（真后端）', async ({ page }) => {
    const id = await aCompletedBacktestID();
    await page.goto(`/backtest?id=${id}`);
    const before = page.url();

    await page.locator('[data-testid="ev-probe-trigger"]').first().click();
    await expect(page.locator('.n-drawer')).toBeVisible();

    // 抽屉里说的是"为什么回溯不了"，而不是一个空壳
    await expect(page.locator('.n-drawer')).toContainText('没有携带证据坐标');
    expect(page.url()).toBe(before);
  });

  test('断言 3（mock）：有坐标时一次点击就取到原始记录，且深链按钮在', async ({ page }) => {
    // mock 的理由见文件头：factor_cache 空，真坐标取不到。
    await page.route('**/api/evidence/**', (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          content_hash: REAL_HASH,
          source: 'akshare',
          dataset: 'akshare.stock_financial_abstract',
          key: '600519.SH/2024Q1',
          as_of: '2024-09-30T00:00:00Z',
          fetched_at: '2026-09-25T09:04:45Z',
          payload: { instrument: '600519.SH' },
        }),
      }),
    );
    await page.route('**/api/factors/**', (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          id: 1,
          symbol: '600000.SH',
          trade_date: '2024-06-28T00:00:00Z',
          factor_name: 'momentum',
          raw_value: 1.25,
          z_score: 0.5,
          percentile: 0.69,
          citation: [
            {
              content_hash: REAL_HASH,
              source: 'akshare',
              dataset: 'akshare.stock_financial_abstract',
              key: '600519.SH/2024Q1',
              as_of: '2024-09-30T00:00:00Z',
            },
          ],
        }),
      }),
    );

    await page.goto('/factors');
    await page.locator('input[placeholder^="因子"]').fill('momentum');
    await page.locator('input[placeholder^="标的"]').fill('600000.SH');
    await page.locator('input[placeholder^="交易日"]').fill('20240628');
    await page.getByRole('button', { name: /查询/ }).click();

    const trigger = page.locator('[data-testid="ev-probe-trigger"]').first();
    await expect(trigger).toBeVisible();
    // 有坐标时入口不叫"无法回溯"
    await expect(trigger).not.toContainText('无法回溯');

    const before = page.url();
    // 第 1 击：开抽屉并自动解析 → 原始记录直接出现，不再需要第 2 击
    await trigger.click();
    await expect(page.locator('[data-testid="evidence-record"]')).toBeVisible();
    await expect(page.locator('.n-drawer')).toContainText('600519.SH/2024Q1');
    expect(page.url()).toBe(before);

    // 断言 6：完整页作为**主动**选择仍在
    await page.locator('[data-testid="ev-probe-deeplink"]').click();
    await expect(page).toHaveURL(/\/evidence\?content_hash=/);
  });

  test('断言 5（mock）：抽屉里 404 也走「未摄取」，与 /evidence 同一份三态机', async ({ page }) => {
    await page.route('**/api/evidence/**', (route) =>
      route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"not found"}' }),
    );
    await page.route('**/api/factors/**', (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          id: 2,
          symbol: '600000.SH',
          trade_date: '2024-06-28T00:00:00Z',
          factor_name: 'momentum',
          raw_value: 0.4,
          z_score: 0.1,
          percentile: 0.52,
          citation: [{ content_hash: ABSENT_HASH }],
        }),
      }),
    );

    await page.goto('/factors');
    await page.locator('input[placeholder^="因子"]').fill('momentum');
    await page.locator('input[placeholder^="标的"]').fill('600000.SH');
    await page.locator('input[placeholder^="交易日"]').fill('20240628');
    await page.getByRole('button', { name: /查询/ }).click();

    await page.locator('[data-testid="ev-probe-trigger"]').first().click();
    await expect(page.locator('[data-testid="ev-probe-not-ingested"]')).toBeVisible();
    await expect(page.locator('[data-testid="ev-probe-failed"]')).toHaveCount(0);
  });
});
