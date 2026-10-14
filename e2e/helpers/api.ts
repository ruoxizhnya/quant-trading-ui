import { request, APIRequestContext, APIResponse, expect } from '@playwright/test';

const BACKEND = process.env.BACKEND_URL || 'http://localhost:8085';
const DATA = process.env.DATA_SERVICE_URL || 'http://localhost:8081';

export async function apiRequest(): Promise<APIRequestContext> {
  return await request.newContext({
    baseURL: BACKEND,
    extraHTTPHeaders: { 'Content-Type': 'application/json' },
  });
}

export async function dataApiRequest(): Promise<APIRequestContext> {
  return await request.newContext({
    baseURL: DATA,
    extraHTTPHeaders: { 'Content-Type': 'application/json' },
  });
}

export const API = {
  async health(ctx: APIRequestContext) {
    return ctx.get('/health');
  },

  async stocksCount(ctx: APIRequestContext) {
    return ctx.get('/api/stocks/count');
  },

  async marketIndex(ctx: APIRequestContext) {
    return ctx.get('/api/market/index');
  },

  async strategies(ctx: APIRequestContext) {
    return ctx.get('/api/strategies');
  },

  async runBacktest(ctx: APIRequestContext, payload: any) {
    return ctx.post('/api/backtest', { data: payload });
  },

  async getBacktestReport(ctx: APIRequestContext, id: string) {
    return ctx.get(`/api/backtest/${id}/report`);
  },

  async listBacktestJobs(ctx: APIRequestContext, limit = 20) {
    return ctx.get(`/api/backtest?limit=${limit}`);
  },

  async getBacktestJob(ctx: APIRequestContext, id: string) {
    return ctx.get(`/api/backtest/${id}`);
  },

  async getBacktestTrades(ctx: APIRequestContext, id: string) {
    return ctx.get(`/api/backtest/${id}/trades`);
  },

  async getBacktestEquity(ctx: APIRequestContext, id: string) {
    return ctx.get(`/api/backtest/${id}/equity`);
  },

  async copilotGenerate(ctx: APIRequestContext, prompt: string) {
    return ctx.post('/api/copilot/generate', { data: { prompt } });
  },

  async screen(ctx: APIRequestContext, params: Record<string, number>) {
    return ctx.post('/api/screen', { data: params });
  },

  async ohlcv(ctx: APIRequestContext, symbol: string, start: string, end: string) {
    return ctx.get(`/api/ohlcv/${symbol}?start_date=${start}&end_date=${end}`);
  },
};

/**
 * GET 一个 JSON 端点，**只对 429 退避重试**，其他状态码原样返回。
 *
 * 为什么需要：本地 analysis-service 的限流桶是**全进程共享**的 —— 并行的
 * spec、别的终端里的 curl、甚至同一个 worker 里上一条用例都会抽同一个桶。
 * 实测一次全量套件里 `GET /api/backtest` 直接 429，于是断言 `res.ok()` 的
 * 用例在**与自己改动无关**的地方变红（那种红会把人训练成忽略红灯）。
 *
 * 三条边界，都是刻意的：
 * - **只认 429**。404/500 是真坏了，重试只会把缺陷藏起来。
 * - **重试预算必须远小于 test timeout**（默认 30s）：预算铺满就变成
 *   "超时红"而不是"429 红"，归因更难（我自己踩过：8×5s=40s > 30s）。
 * - 返回的是**最后一次的响应**，调用方照常断言；耗尽后仍 429 也会红，
 *   只是消息里带得出末次状态码。
 */
export async function getJsonWithBackoff(
  ctx: APIRequestContext,
  path: string,
  opts: { tries?: number; baseDelayMs?: number; timeoutMs?: number } = {}
): Promise<APIResponse> {
  const tries = opts.tries ?? 4;
  const base = opts.baseDelayMs ?? 1500;
  let res = await ctx.get(path, { timeout: opts.timeoutMs ?? 10000 });
  for (let i = 1; i < tries && res.status() === 429; i++) {
    await new Promise(r => setTimeout(r, base * i)); // 线性退避：429 是配额问题，不是故障
    res = await ctx.get(path, { timeout: opts.timeoutMs ?? 10000 });
  }
  return res;
}

export async function waitForBackendReady(timeoutMs = 60000): Promise<boolean> {
  const ctx = await apiRequest();
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await ctx.get('/health', { timeout: 5000 });
      if (res.ok()) {
        const body = await res.json();
        if (body.status === 'healthy') {
          await ctx.dispose();
          return true;
        }
      }
    } catch {}
    await new Promise(r => setTimeout(r, 2000));
  }
  await ctx.dispose();
  return false;
}
