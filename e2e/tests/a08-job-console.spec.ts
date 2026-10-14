import { test, expect } from '@playwright/test';
import { apiRequest, postJsonWithBackoff, waitForBackendReady } from '../helpers/api';
import { isolateTestEnvironment } from '../helpers/isolation';

/**
 * A-08 作业控制台（断言 1 / 2 / 3 / 6）的浏览器侧取证。
 *
 * **真后端与拦截的分界，逐条写明**（工单 ⑤ 要求标清哪条用真数据、哪条只能 mock）：
 *
 *  - 真后端（只读）：队列列表 + 详情回读 + worker 读数 —— 一条用例一次页面加载、
 *    两次 GET。网关限流是**每 ClientIP 每分钟 100**（config/analysis-service.yaml
 *    的 rate_limit.per_minute），而页面自己每次加载就要打 8 条左右，所以真后端腿
 *    合并成一条而不是拆成两条；拆开的那版在 2026-10-14 的实测里被 429 打死过。
 *  - 真后端（写一次）：cancel 一条真作业。优先在库里找现成的非终态行（零新负载），
 *    找不到才 POST 造 2 条 —— 工单 ⑤ 明确授权"取不到就造一条真作业"。
 *    代价明写：`sync_jobs` 多 2 行，并真的打一次数据源取一个票 3 天的日线。
 *  - 路由拦截：空队列回包、按钮三态判据、排程 CRUD 的**调用序列**。
 *    排程那串走拦截不是因为真写不行，而是真写会在 `sync_schedules` 留行、并让
 *    cron 在 09:00 真的触发一次取数 —— 那是给这台环境排一次没有人要的定时任务，
 *    比这条腿能证的东西贵。七条端点各自的 URL/方法已由 `web/src/api/sync.test.ts`
 *    逐条钉住在 API 层，这里补的是"点按钮真的按那个顺序打到那些端点"。
 */

const STATUS_TEXT: Record<string, string> = {
  pending: '排队中',
  running: '同步中',
  retrying: '重试中',
  completed: '已完成',
  failed: '失败',
  cancelled: '已取消',
};

function scheduleRow(over: Record<string, unknown> = {}) {
  return {
    id: 7101,
    name: 'a08-e2e-row',
    job_type: 'ohlcv',
    cron_expression: '0 9 * * *',
    params: { symbols: ['600000.SH'] },
    is_active: true,
    created_at: '2026-10-14T20:00:00Z',
    updated_at: '2026-10-14T20:00:00Z',
    next_run_at: '2026-10-15T09:00:00Z',
    ...over,
  };
}

function jobRow(over: Record<string, unknown> = {}) {
  return {
    id: 'a08_fixture_0',
    job_type: 'ohlcv_all',
    status: 'completed',
    params: { symbols: ['600000.SH'] },
    progress_percent: 100,
    total_items: 1,
    processed_items: 1,
    failed_items: 0,
    created_at: '2026-10-14T20:00:00Z',
    retry_count: 0,
    max_retries: 3,
    ...over,
  };
}

/**
 * 只拦作业/排程/读数这四条 API 面，其余（datasource、stocks/count）打真后端 ——
 * 拦截面越窄，"界面在撒谎"这件事越难被我的 mock 掩盖。
 */
async function mockConsoleApis(
  page: import('@playwright/test').Page,
  state: { schedules: ReturnType<typeof scheduleRow>[]; jobs: ReturnType<typeof jobRow>[] },
  calls: string[],
) {
  await page.route('**/api/sync/jobs**', (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    const method = req.method();
    // EventSource 的请求也带 Accept: text/event-stream —— 单独记，断言 4 要看的就是它
    const isStream = (req.headers()['accept'] ?? '').includes('text/event-stream');
    calls.push(`${method} ${path}${isStream ? ' (stream)' : ''}`);

    const json = (obj: unknown) =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(obj) });

    if (method === 'GET' && path === '/api/sync/jobs') {
      return json({ count: state.jobs.length, jobs: state.jobs });
    }
    const one = /^\/api\/sync\/jobs\/([^/]+)$/.exec(path);
    if (method === 'GET' && one) {
      const hit = state.jobs.find((j) => j.id === one[1]);
      return hit ? json(hit) : json({ error: 'job not found' });
    }
    const cancel = /^\/api\/sync\/jobs\/([^/]+)\/cancel$/.exec(path);
    if (method === 'POST' && cancel) {
      state.jobs = state.jobs.map((j) => (j.id === cancel[1] ? { ...j, status: 'cancelled' } : j));
      return json({ message: 'job cancelled', job_id: cancel[1] });
    }
    const retry = /^\/api\/sync\/jobs\/([^/]+)\/retry$/.exec(path);
    if (method === 'POST' && retry) {
      state.jobs = state.jobs.map((j) => (j.id === retry[1] ? { ...j, status: 'retrying' } : j));
      return json({ message: 'job retried', job_id: retry[1], status: 'retrying' });
    }
    if (isStream) {
      // 进度流在测试里不必真的流：断言 4 只关心"开了几条、开在谁身上"。
      return route.fulfill({ status: 501, contentType: 'text/plain', body: 'a08 e2e: stream not served' });
    }
    return json({ error: 'a08 e2e: 未登记的作业请求形状', path, method });
  });

  await page.route('**/api/sync/schedules**', (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    const method = req.method();
    calls.push(`${method} ${path}`);
    const json = (obj: unknown) =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(obj) });
    const body = req.postData() ? JSON.parse(req.postData() as string) : {};

    if (method === 'GET' && path === '/api/sync/schedules') {
      return json({ count: state.schedules.length, schedules: state.schedules });
    }
    const one = /^\/api\/sync\/schedules\/(\d+)$/.exec(path);
    if (method === 'GET' && one) {
      const hit = state.schedules.find((s) => s.id === Number(one[1]));
      return hit ? json(hit) : json({ error: 'schedule not found' });
    }
    if (method === 'POST' && path === '/api/sync/schedules') {
      state.schedules = [scheduleRow({ ...body, id: 7101 })];
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(state.schedules[0]),
      });
    }
    if (method === 'PUT' && one) {
      state.schedules = state.schedules.map((s) => (s.id === Number(one[1]) ? { ...s, ...body } : s));
      return json(state.schedules[0]);
    }
    const toggle = /^\/api\/sync\/schedules\/(\d+)\/toggle$/.exec(path);
    if (method === 'POST' && toggle) {
      const active = body.active === true;
      state.schedules = state.schedules.map((s) =>
        s.id === Number(toggle[1]) ? { ...s, is_active: active } : s,
      );
      return json({ message: 'schedule updated', id: Number(toggle[1]), active });
    }
    const run = /^\/api\/sync\/schedules\/(\d+)\/run$/.exec(path);
    if (method === 'POST' && run) {
      // 真后端这条是 202 + job_id，且**作业行此时已存在**（实测 2026-10-14）
      const jobId = `scheduled-${run[1]}`;
      state.jobs = [
        jobRow({ id: jobId, job_type: 'ohlcv', status: 'pending', progress_percent: 0, processed_items: 0, total_items: 1 }),
        ...state.jobs,
      ];
      return route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'schedule triggered', job_id: jobId, status: 'pending' }),
      });
    }
    if (method === 'DELETE' && one) {
      state.schedules = state.schedules.filter((s) => s.id !== Number(one[1]));
      return json({ message: 'schedule deleted', id: Number(one[1]) });
    }
    return json({ error: 'a08 e2e: 未登记的排程请求形状', path, method });
  });

  await page.route('**/api/sync/workers', (route) => {
    calls.push('GET /api/sync/workers');
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ num_workers: 3, registered_types: ['ohlcv', 'stocks'], is_running: true }),
    });
  });
  await page.route('**/api/sync/scheduler/stats', (route) => {
    calls.push('GET /api/sync/scheduler/stats');
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        active_schedules: state.schedules.filter((s) => s.is_active).length,
        total_entries: 1,
      }),
    });
  });
}

test.describe('A-08 作业控制台', () => {
  test.beforeAll(async () => {
    expect(await waitForBackendReady(60000)).toBe(true);
  });

  test.beforeEach(async ({ page }) => {
    await isolateTestEnvironment(page);
  });

  test('真后端：队列列表、详情回读与 worker 读数和接口一致（断言 1+3 的只读腿）', async ({ page }) => {
    /**
     * 两个数都取自**页面自己吃下的那条响应**（监听器在 goto 之前挂），测试不另打 GET：
     * 网关限流是每 ClientIP 每分钟 100 的共享桶，测试再打一条就是在挤页面自己的预算，
     * 而 429 会把"读数对不对"变成"谁先抢到桶" —— 上一版就是这么红的（2026-10-14）。
     */
    let listJobs: { id: string; status: string }[] | null = null;
    let workersRes: import('@playwright/test').Response | null = null;
    page.on('response', (r) => {
      const u = new URL(r.url());
      if (u.pathname === '/api/sync/jobs' && r.status() === 200 && !listJobs) {
        void r
          .json()
          .then((b) => (listJobs = b.jobs ?? []))
          .catch(() => undefined);
      }
      if (!workersRes && u.pathname === '/api/sync/workers') workersRes = r;
    });

    await page.goto('/data-sync');
    await expect
      .poll(() => (listJobs ? listJobs.length : 0), { timeout: 15000 })
      .toBeGreaterThan(0);
    const target = listJobs![0];
    await expect(page.locator(`[data-testid="queue-row-${target.id}"]`)).toBeVisible();

    // 详情抽屉必须是刚点的那条，且状态与后端一致（拿"列表第一行"当"详情第一条"是另一类串数据）
    await page.locator(`[data-testid="queue-detail-${target.id}"]`).click();
    const drawer = page.locator('[data-testid="queue-detail-drawer"]');
    await expect(drawer).toBeVisible();
    await expect(drawer).toContainText(target.id);
    await expect(page.locator(`[data-testid="queue-status-${target.id}"]`)).toHaveText(
      STATUS_TEXT[target.status] ?? target.status,
    );

    // 读数区那格必须是**页面那条响应**里的同一个数（不是测试另打一次拿到的数）
    expect(workersRes, '页面加载时没有请求 /api/sync/workers，读数区那条腿没跑').not.toBeNull();
    expect(workersRes!.ok(), `页面那条 workers 响应不是 200（${workersRes!.status()}）`).toBe(true);
    const w = await workersRes!.json();
    await expect(page.locator('[data-testid="readout-worker-count"]')).toHaveText(
      `${w.num_workers} 个消费者`,
    );
    // 注册类型逐条上屏：后端给 7 类就显示 7 类，前端不硬编码清单。
    for (const t of w.registered_types ?? []) {
      await expect(page.locator('[data-testid="readout-types"]')).toContainText(t);
    }
  });

  test('空队列的真实回包（jobs:null）走空态而不是白屏', async ({ page }) => {
    /**
     * Go 侧 `Jobs []*SyncJob` 为 nil 时 json 出来是 `null`，而前端类型写的是
     * `SyncJob[]`。按 null 存进 store，`queueLength` 的 `.filter` 当场 TypeError ——
     * 整块队列白屏，而这恰恰是"筛一个没有活作业的状态"这种最常见的空态。
     * 这条钉的是**真形状**（curl 抄下来的 body），不是我以为的形状。
     */
    await page.route('**/api/sync/jobs**', (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ count: 0, jobs: null }),
      }),
    );
    await page.goto('/data-sync');
    await expect(page.locator('[data-testid="queue-empty"]')).toBeVisible();
    await expect(page.locator('[data-testid="queue-panel"]')).toContainText('作业队列');
  });

  test('取消/重试按钮按后端规则出现，终态行一个都不给', async ({ page }) => {
    const state = {
      schedules: [] as ReturnType<typeof scheduleRow>[],
      jobs: [
        jobRow({ id: 'a08_running', status: 'running', progress_percent: 40 }),
        jobRow({ id: 'a08_failed', status: 'failed', retry_count: 1 }),
        jobRow({ id: 'a08_cancelled', status: 'cancelled' }),
        jobRow({ id: 'a08_completed', status: 'completed' }),
      ],
    };
    await mockConsoleApis(page, state, []);
    await page.goto('/data-sync');

    // running：非终态 ⇒ 可取消，不可重试（后端 CanRetry 只认 failed|pending）
    await expect(page.locator('[data-testid="queue-cancel-a08_running"]')).toBeVisible();
    await expect(page.locator('[data-testid="queue-retry-a08_running"]')).toHaveCount(0);
    // failed：可重试
    await expect(page.locator('[data-testid="queue-retry-a08_failed"]')).toBeVisible();
    // cancelled / completed：终态 ⇒ 两个按钮都没有
    await expect(page.locator('[data-testid="queue-cancel-a08_completed"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="queue-retry-a08_cancelled"]')).toHaveCount(0);
  });

  test('取消走真后端：点下去之后界面显示的是后端写回的那条状态', async ({ page }) => {
    /**
     * 判据不是"界面显示已取消"，而是**界面那一格 == 后端回包里的状态**。
     * 后端拒绝取消（那行刚好跑完了）时，乐观更新会把"被拒绝"显示成"已取消"，
     * 那正是要防的形状。
     *
     * 全程不额外打 GET：非终态那条从**页面自己那条列表响应**里挑，回读的状态从
     * **页面点完之后自己发的那条单条 GET** 里取。原因不是省事 —— 网关限流是每
     * ClientIP 每分钟 100 的共享桶，测试再打一条就是在挤页面的预算；上一版就是
     * 这么在 429 上红的（2026-10-14），而 429 红会把人训练成忽略红灯。
     */
    let listJobs: { id: string; status: string }[] | null = null;
    let readBackId = '';
    let readBackStatus = '';
    page.on('response', (r) => {
      const u = new URL(r.url());
      if (u.pathname === '/api/sync/jobs' && r.status() === 200 && !listJobs) {
        void r
          .json()
          .then((b) => (listJobs = b.jobs ?? []))
          .catch(() => undefined);
      }
      const one = /^\/api\/sync\/jobs\/([^/]+)$/.exec(u.pathname);
      if (one && r.status() === 200 && !readBackStatus) {
        void r
          .json()
          .then((b) => {
            readBackId = decodeURIComponent(one[1]);
            readBackStatus = String(b.status ?? '');
          })
          .catch(() => undefined);
      }
    });

    await page.goto('/data-sync');
    await expect
      .poll(() => (listJobs ? listJobs.length : 0), { timeout: 15000 })
      .toBeGreaterThan(0);

    // 页面上有取消按钮的那一行就是非终态行 —— 按钮判据本身也是断言 1 的一条腿
    const cancellable = page.locator('[data-testid^="queue-cancel-"]').first();
    let target = '';
    if ((await cancellable.count()) > 0) {
      target = (await cancellable.getAttribute('data-testid'))!.replace('queue-cancel-', '');
    } else {
      /**
       * 库里没有非终态作业 ⇒ 按工单 ⑤ 造一条真的（真实 API 调用，不是往库里塞假行）。
       * 代价明写：`sync_jobs` 多一行，并真的打一次数据源重取票池清单。
       * 选 `stocks` 不选 `ohlcv`：单票三条日线实测 1.6 秒就进终态，按钮等不到点。
       */
      const ctx = await apiRequest();
      const res = await postJsonWithBackoff(ctx, '/api/sync/jobs', {
        type: 'stocks',
        params: { source: 'tushare' },
      });
      const text = await res.text();
      await ctx.dispose();
      expect(res.ok(), `POST /api/sync/jobs 造真作业失败（${res.status()}）：${text}`).toBe(true);
      target = JSON.parse(text).job_id;
      await page.reload();
      await expect(page.locator(`[data-testid="queue-cancel-${target}"]`)).toBeVisible({
        timeout: 20000,
      });
    }
    expect(target, '页面上没有任何非终态作业可取消，也没能造出一条真的').toBeTruthy();

    await page.locator(`[data-testid="queue-cancel-${target}"]`).click();

    // 点完之后 store 回读那一条（refreshJob）—— 等**页面自己那条 GET** 落地
    await expect
      .poll(() => (readBackId === target ? readBackStatus : ''), {
        timeout: 15000,
        message: `点取消后没等到 /api/sync/jobs/${target} 的回读：不靠乐观更新那条腿没跑`,
      })
      .toBeTruthy();

    await expect(page.locator(`[data-testid="queue-status-${target}"]`)).toHaveText(
      STATUS_TEXT[readBackStatus] ?? readBackStatus,
    );
    test.info().annotations.push({
      type: 'a08-cancel-leg',
      description: `真 cancel 已执行：job ${target} 后端回读 ${readBackStatus}`,
    });
  });

  test('CRUD + toggle + run-now 按序打到各自那条端点，界面跟着后端写的值走', async ({ page }) => {
    const calls: string[] = [];
    const state = { schedules: [] as ReturnType<typeof scheduleRow>[], jobs: [] as ReturnType<typeof jobRow>[] };
    await mockConsoleApis(page, state, calls);

    await page.goto('/data-sync');
    await expect(page.locator('[data-testid="schedule-empty"]')).toBeVisible();
    calls.length = 0;

    // 新建 → POST /api/sync/schedules
    await page.locator('[data-testid="schedule-create"]').click();
    await page.locator('[data-testid="schedule-input-name"] input').fill('a08-e2e-row');
    await page.locator('[data-testid="schedule-input-cron"] input').fill('0 9 * * *');
    await page.locator('[data-testid="schedule-submit"]').click();
    await expect(page.locator('[data-testid="schedule-row-7101"]')).toBeVisible();

    // 编辑 → PUT（表单从列表那一行取初值，不再回后端取单条）
    await page.locator('[data-testid="schedule-edit-7101"]').click();
    await page.locator('[data-testid="schedule-input-cron"] input').fill('30 1 * * *');
    await page.locator('[data-testid="schedule-submit"]').click();
    await expect(page.locator('[data-testid="schedule-row-7101"]')).toContainText('30 1 * * *');

    // toggle → POST /toggle，界面按回读的值翻面
    await page.locator('[data-testid="schedule-toggle-7101"]').click();
    await expect(page.locator('[data-testid="schedule-state-7101"]')).toHaveText('已停用');
    // 停用后带着残留 next_run_at 也不显示未来（core SYNC-03 的前端防御）
    await expect(page.locator('[data-testid="schedule-row-7101"]')).not.toContainText('2026-10-15');

    // run-now → POST /run，然后**队列里出现那条作业**（判据是行，不是 toast）
    await page.locator('[data-testid="schedule-run-7101"]').click();
    await expect(page.locator('[data-testid="queue-row-scheduled-7101"]')).toBeVisible();

    // 删除经 NPopconfirm：确认之后才发 DELETE
    await page.locator('[data-testid="schedule-delete-7101"]').click();
    await page.getByRole('button', { name: '确认' }).click();
    await expect(page.locator('[data-testid="schedule-empty"]')).toBeVisible();

    expect(calls.filter((c) => c === 'POST /api/sync/schedules')).toHaveLength(1);
    expect(calls.filter((c) => c === 'PUT /api/sync/schedules/7101')).toHaveLength(1);
    expect(calls.filter((c) => c === 'POST /api/sync/schedules/7101/toggle')).toHaveLength(1);
    expect(calls.filter((c) => c === 'POST /api/sync/schedules/7101/run')).toHaveLength(1);
    expect(calls.filter((c) => c === 'DELETE /api/sync/schedules/7101')).toHaveLength(1);
    expect(calls.filter((c) => c === 'GET /api/sync/schedules').length).toBeGreaterThan(0);
    /**
     * 第 7 条（`GET /api/sync/schedules/:id`）**不由页面驱动**：编辑表单填的是列表里
     * 那一行的数据。这里明写成"页面不调它"而不是假装调过 —— 它的 URL/方法由
     * `web/src/api/sync.test.ts` 逐条钉住（断言 2 的"七条端点可达"由那一层负责）。
     */
    expect(calls.filter((c) => /^GET \/api\/sync\/schedules\/\d+$/.test(c))).toEqual([]);

    /**
     * 断言 4：全站唯一允许的推送是**单作业进度流**，且只开在刚被 run-now 出来的那条上。
     * 排程区不得另起一条（既没有 /api/sync/stream，也不得有两不同的流 URL）。
     */
    const streams = calls.filter((c) => c.endsWith('(stream)'));
    expect(streams.filter((c) => c.includes('/api/sync/stream'))).toEqual([]);
    // 恰好一条，且只开在刚 run-now 出来的那条作业上（两条不同 URL 就说明开了第二条腿）
    expect(new Set(streams)).toEqual(
      new Set(['GET /api/sync/jobs/scheduled-7101/progress (stream)']),
    );
  });

  test('PIT 与幸存者两块明写缺通道，不造数也不在前端自算', async ({ page }) => {
    await page.route('**/api/stocks/count', (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ count: 5908, latest_date: '2026-10-14' }),
      }),
    );
    await page.goto('/data-sync');
    const survivorship = page.locator('[data-testid="survivorship-block"]');
    await expect(survivorship).toContainText('5908');
    // 标签必须写"含已退市"：把 5908 叫"在市股票数"就是假数字。
    await expect(survivorship).toContainText('含已退市');
    await expect(page.locator('[data-testid="surv-gap"]')).toContainText('DATA-02');
    for (const id of ['pit-financial-end', 'pit-ann-date', 'pit-tradeable']) {
      await expect(page.locator(`[data-testid="${id}"]`)).toContainText('无通道');
    }
    await expect(page.locator('[data-testid="pit-gap"]')).toContainText('DATA-03');
    // 前端不自算退市占比（那等于在客户端重建后端语义，两处真相）。
    await expect(survivorship).not.toContainText(/339|5569|5\.7/);
  });
});
