import { test, expect } from '@playwright/test';
import { apiRequest, getJsonWithBackoff, waitForBackendReady } from '../helpers/api';
import { isolateTestEnvironment } from '../helpers/isolation';

/**
 * A-07 状态三值全站收口（K9 横切）—— 对比页的浏览器侧取证。
 *
 * 快速回测与控制台历史列表的三态在单测里覆盖（`QuickBacktest.test.ts` /
 * `ConsoleHistory.test.ts` / `runStatus.test.ts`），本 spec 只管对比页那条
 * "被排除项与其原因必须可见"的路 —— 它依赖后端真实返回的 partition 结果。
 *
 * 真后端能验的是 `missing` 通道（用一个不存在的 id，见下面那条用例的理由）；
 * `invalid` 通道只能 mock：后端 `CompareReports` 确实单发 `invalid` 数组
 * （`pkg/backtest/reporting/compare.go`），但本地 `backtest_jobs` 里
 * **0 条 invalid**（实测 `group by status` 只有 completed 123 / failed 17）。
 * 造一条真无效运行要往库里塞假行，不值当 —— 所以那条走 mock 并写明。
 */

const COMPARE_KEY = 'quantlab:backtest:compare_ids';

async function aCompletedID(): Promise<string> {
  return pickJob('completed');
}

/** 从真后端拿一条指定状态的作业；取不到就让测试红，不静默 skip */
async function pickJob(status: string): Promise<string> {
  const ctx = await apiRequest();
  // 只对 429 退避（共享限流），其他状态码原样交给下面的断言去红。
  const res = await getJsonWithBackoff(ctx, '/api/backtest?limit=100');
  // 必须在 dispose **之前**读 body —— 响应体挂在 context 上，
  // 先 dispose 再 json() 会得到 "Response has been disposed"（我踩过）。
  const body = res.ok()
    ? ((await res.json()) as { jobs?: { id: string; status: string }[] })
    : null;
  await ctx.dispose();
  expect(body, `GET /api/backtest 未成功（末次状态码 ${res.status()}）`).toBeTruthy();
  const hit = (body!.jobs ?? []).find((j) => j.status === status);
  expect(hit, `本地库里没有 ${status} 的回测，A-07 无法取证`).toBeTruthy();
  return hit!.id;
}

test.describe('A-07 状态三值全站收口', () => {
  test.beforeAll(async () => {
    expect(await waitForBackendReady(60000)).toBe(true);
  });

  test.beforeEach(async ({ page }) => {
    await isolateTestEnvironment(page);
  });

  test('对比页：被排除项与其原因可见（真后端，走 missing 通道）', async ({ page }) => {
    const good = await aCompletedID();
    /**
     * 用一个**故意不存在**的 id，而不是去库里捞一条 failed。
     *
     * 试过捞 failed：本地那 17 条全躺在 2026-09-25（最老的一批），而
     * `GET /api/backtest?limit=` 只有 `ORDER BY created_at DESC LIMIT n`、
     * **没有 offset**，limit 顶到接口上限 100 也捞不到它们。
     * 断言 4 要的是"被排除项 + 原因都看得见"，不存在的 id 走的就是同一条
     * missing 通道，而且不依赖库里历史怎么分布 —— 比捞一条老数据更稳。
     */
    const absent = '00000000-0000-4000-8000-000000000000';
    await page.addInitScript(
      ([key, ids]) => localStorage.setItem(key, JSON.stringify(ids)),
      [COMPARE_KEY, [good, absent]] as const,
    );
    await page.goto('/backtest/compare');

    const banner = page.locator('.n-alert').filter({ hasText: '未能加载' });
    await expect(banner).toBeVisible();
    // 原因必须是**一句人话**，不能只有 id —— 光看见一串 uuid 消失等于没说
    await expect(banner).toContainText('not completed');
    await expect(banner).toContainText(absent.slice(0, 8));
  });

  test('对比页（mock）：invalid 运行单列成"已排除的无效运行"并带原因', async ({ page }) => {
    const good = await aCompletedID();
    const badId = 'invalid-demo-0001';
    await page.addInitScript(
      ([key, ids]) => localStorage.setItem(key, JSON.stringify(ids)),
      [COMPARE_KEY, [good, badId]] as const,
    );
    await page.route('**/api/backtest/compare**', (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          generated_at: '2026-10-14T00:00:00Z',
          requested: 2,
          resolved: 1,
          reports: [],
          entries: [
            {
              id: good,
              strategy: 'momentum',
              total_return: 0.03,
              annual_return: 0.08,
              sharpe_ratio: 1.2,
              sortino_ratio: 1.9,
              max_drawdown: -0.02,
              calmar_ratio: 4,
              win_rate: 0.55,
              total_trades: 12,
              win_trades: 7,
              lose_trades: 5,
              avg_holding_days: 3,
              initial_capital: 1000000,
              has_equity_data: false,
            },
          ],
          // 后端把"跑完但无效"从 entries 里摘出来单发 —— 前端此前连这个字段
          // 都没声明，于是它从表里消失且不留解释。
          invalid: [
            { id: badId, strategy: 'value', invalid_reasons: ['empty_universe', 'zero_trades'] },
          ],
          missing: [],
          best: {},
        }),
      }),
    );

    await page.goto('/backtest/compare');
    const box = page.locator('[data-testid="compare-invalid"]');
    await expect(box).toBeVisible();
    await expect(box).toContainText('已排除的无效运行');
    // 策略名 + 原因都要在，光有一个 id 等于没说。
    // 原因是**人话**且与全站同一口径（utils/runStatus）——把 Code 原样贴出来
    // 在这一页算回归：同一份 invalid_reasons 在快速回测显示"股票池为空"，
    // 在这里显示 empty_universe，用户就得自己猜两个页面是不是同一件事。
    await expect(box).toContainText('value');
    await expect(box).toContainText('股票池为空');
    await expect(box).toContainText('一次成交都没有');
    await expect(box).not.toContainText('empty_universe');
    await expect(page.locator('[data-testid="compare-invalid-item"]')).toHaveCount(1);
    // 断言 6 的**渲染层**取证：--q-warning (#f59e0b) 必须真是用户在这条 invalid
    // 原因上看到的眼色。只 grep "源码里出现过 var(--q-warning)" 不算 —— 那既能
    // 匹配死规则也能匹配写在永远不会命中的选择器上的声明。
    await expect(box.locator('.excluded-reasons')).toHaveCSS('color', 'rgb(245, 158, 11)');
  });
});
