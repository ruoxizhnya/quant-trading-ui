import { test, expect } from '@playwright/test';
import { waitForBackendReady } from '../helpers/api';
import { isolateTestEnvironment } from '../helpers/isolation';

/**
 * A-05 观察台的回归护栏。fixture 不是编的：verdict 载荷逐字段抄自
 * 2026-10-14 浏览器实测时 `experiments.verdict` 里真实落库的那一条
 * （run c46fa2ad，attempt #1）。
 *
 * 两条测试各守一个当天真实发生过的故障：
 *
 *  1. 观察循环被一次 429 打死。页面原先 1 秒一跳，把 analysis-service 每人
 *     100 次/分钟的预算吃掉 60 次，实测撞到 `rate_limited`；而 catch 里
 *     跟着 stopTimer() —— 于是窗口永久停在最后一帧，用户看到的是"AI 卡住了"，
 *     实际是"我看不见了"。这一条比渲染正确性更致命：一个瞎掉的观察页
 *     等于这个功能没有。
 *
 *  2. 裁决消息里的 markdown 星号直接上屏（`股票池按**今天**的上市名单取`）。
 */

const REAL_VERDICT = {
  dimensions: { bias: 0.130384048104053, robustness: 0 },
  unassessed: ['statistical', 'economic', 'redundancy', 'causal'],
  probability: 0,
  weakest: 'robustness',
  blocking: 2,
  challenges: [
    {
      dimension: 'robustness',
      severity: 'blocking',
      message: '稳健校验无法进行：回测结果为空或净值曲线不足 2 点（0）。',
    },
    {
      dimension: 'bias',
      severity: 'blocking',
      message: '股票池按**今天**的上市名单取（0 只）—— 期间退市的票根本不在池子里。',
    },
    {
      dimension: 'economic',
      severity: 'note',
      message: '经济维未评估：回测没有成交，算不出换手率，也就算不出成本。',
    },
  ],
};

function attempt(seq: number, withVerdict: boolean) {
  return {
    seq,
    hypothesis: 'TPE 起步：还没有成功观测，先随机铺点',
    params: { lookback_days: 147 + seq },
    experiment_id: 1117 + seq,
    sharpe: 0,
    ok: withVerdict,
    verdict: withVerdict ? REAL_VERDICT : null,
  };
}

const status = (attempts: ReturnType<typeof attempt>[], running = true) => ({
  run_id: 'c46fa2ad-b6a7-403b-9de0-6e63dfd8c153',
  running,
  attempts,
  best_seq: null,
});

/** 让 /api/explore/* 走假数据：responses[i] 是第 i 次 GET 的答复 */
async function mockExplore(page: import('@playwright/test').Page, responses: unknown[]) {
  let gets = 0;
  await page.route('**/api/explore/runs**', async (route) => {
    const req = route.request();
    if (req.method() === 'POST') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ run_id: 'c46fa2ad-b6a7-403b-9de0-6e63dfd8c153', max_tries: 2 }),
      });
      return;
    }
    const i = gets++;
    if (i >= responses.length) {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(responses.at(-1)) });
      return;
    }
    const r = responses[i];
    if (r === 429) {
      await route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'rate_limited', error: 'rate limit exceeded' }),
      });
      return;
    }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(r) });
  });
  return { pollCount: () => gets };
}

test.describe('A-05 探索观察台', () => {
  test.beforeAll(async () => {
    expect(await waitForBackendReady(60000)).toBe(true);
  });

  test.beforeEach(async ({ page }) => {
    await isolateTestEnvironment(page);
  });

  test('一次 429 不许打死观察循环 —— 后续尝试仍然上屏', async ({ page }) => {
    await page.goto('/explore');

    // 第 1 次 GET 是点"开始探索"时的立即轮询，第 2 次故意 429，第 3 次给出新尝试。
    const { pollCount } = await mockExplore(page, [
      status([attempt(0, true)], true),
      429,
      status([attempt(0, true), attempt(1, true)], false),
    ]);

    await page.getByRole('button', { name: '开始探索' }).click();

    await expect(page.locator('.vp-challenge-msg').nth(1)).toContainText('按今天的上市名单');

    // 关键判据：429 之后循环还活着 —— 至少轮询到第 3 次，且 attempt #1 上了屏。
    await expect.poll(pollCount, { timeout: 20000 }).toBeGreaterThanOrEqual(3);
    await expect(page.getByTestId('vp-dims')).toBeVisible();
    // "第 N 次" 在 NCard 的 header-extra 里，是 h2 的兄弟节点，不在 h2 内部
    await expect(page.locator('.verdict-card')).toContainText('第 1 次');
  });

  test('真实裁决载荷：六行齐全、未评估显式成文字、最弱一环标出来', async ({ page }) => {
    await page.goto('/explore');
    await mockExplore(page, [status([attempt(0, true)], false)]);

    await page.getByRole('button', { name: '开始探索' }).click();
    await expect(page.getByTestId('vp-dims')).toBeVisible();

    // 断言 1：恒为六行，顺序是统计/经济/稳健/偏差/冗余/因果
    const keys = ['statistical', 'economic', 'robustness', 'bias', 'redundancy', 'causal'];
    await expect(page.locator('.vp-dim')).toHaveCount(6);
    for (const k of keys) {
      await expect(page.getByTestId(`vp-dim-${k}`)).toHaveCount(1);
    }

    // 断言 2：后端说 4 维未评估，屏幕上就得有 4 个"未评估"，而不是空着
    await expect(page.locator('.vp-dim.is-unassessed')).toHaveCount(4);
    await expect(page.getByTestId('vp-dim-statistical')).toContainText('未评估');
    await expect(page.locator('.vp-unassessed-note')).toContainText('4 个维度未评估');

    // 断言 4：最弱一环 = 已评估里最小的那个（robustness 0 < bias 0.13）
    await expect(page.getByTestId('vp-dim-robustness')).toContainText('最弱一环');
    await expect(page.getByTestId('vp-dim-bias')).not.toContainText('最弱一环');

    // 断言 3 + 审查修复：结果流上的 "P x.xx" 与面板综合概率是同一个数
    const prob = page.getByTestId('vp-probability');
    await expect(prob).toHaveText('0.00');
    await expect(page.locator('text=P 0.00')).toHaveCount(1);

    // 阻断级排在备注前面
    await expect(page.locator('.vp-challenge-group').first()).toHaveAttribute('data-severity', 'blocking');
  });

  test('失败的尝试没有裁决 —— 不拿零填充出一个看起来可信的数', async ({ page }) => {
    await page.goto('/explore');
    await mockExplore(page, [status([{ ...attempt(0, false), error: 'Strategy load failed' }], false)]);

    await page.getByRole('button', { name: '开始探索' }).click();

    await expect(page.locator('main')).toContainText('这一条没有裁决');
    await expect(page.getByTestId('vp-dims')).toHaveCount(0);
  });
});
