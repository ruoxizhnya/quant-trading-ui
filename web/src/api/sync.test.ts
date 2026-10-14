import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  cancelSyncJob,
  createSyncJob,
  createSyncSchedule,
  deleteSyncSchedule,
  getSchedulerStats,
  getSyncJob,
  getSyncSchedule,
  getWorkerStats,
  listSyncJobs,
  listSyncSchedules,
  retrySyncJob,
  runSyncScheduleNow,
  syncJobProgressStreamPath,
  toggleSyncSchedule,
  updateSyncSchedule,
} from '@/api/sync'
import type { UpsertScheduleRequest } from '@/types/sync'

/**
 * A-08 断言 2 的机械腿：排程 7 条 + workers + scheduler/stats 的 **URL 与方法**。
 *
 * 为什么单独测这一层：页面只调 store，store 只调这里；端点路径/动词写错时，
 * 后端返回的是 404 或 405，界面表现为"排程加载失败"——归因会一路漂到前端逻辑上。
 * 逐条钉住 URL，等于把「契约错」和「渲染错」分开。
 *
 * 每条请求都能指到注册行（quant-trading: cmd/data/main.go:150-173），
 * 经网关 catch-all 代理（cmd/analysis/handlers_proxy.go:43）—— 没有一条是假设出来的端点。
 */

interface Captured {
  url: string
  method: string
  body?: string
}

function captureFetch(responseBody: unknown = {}): Captured[] {
  const calls: Captured[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: unknown, init?: { method?: string; body?: string }) => {
      calls.push({ url: String(input), method: init?.method ?? 'GET', body: init?.body })
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () => Promise.resolve(responseBody),
      } as Response
    }),
  )
  return calls
}

const base: UpsertScheduleRequest = {
  name: 'nightly ohlcv',
  job_type: 'ohlcv',
  cron_expression: '0 2 * * *',
  params: { symbols: ['000001.SZ'] },
  is_active: true,
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('sync schedule API — one real call per endpoint (A-08 断言 2)', () => {
  it('listSyncSchedules: GET /api/sync/schedules, active_only 只在显式要求时出现', async () => {
    const calls = captureFetch({ count: 0, schedules: [] })
    await listSyncSchedules()
    await listSyncSchedules(true)
    expect(calls.map(c => `${c.method} ${c.url}`)).toEqual([
      'GET /api/sync/schedules',
      'GET /api/sync/schedules?active_only=true',
    ])
  })

  it('getSyncSchedule: GET /api/sync/schedules/{id}', async () => {
    const calls = captureFetch({ id: 7 })
    await getSyncSchedule(7)
    expect(calls[0]).toMatchObject({ method: 'GET', url: '/api/sync/schedules/7' })
  })

  it('createSyncSchedule: POST + 原样送 body（name 唯一约束由后端报，不在前端预检）', async () => {
    const calls = captureFetch({ id: 8 })
    await createSyncSchedule(base)
    expect(calls[0].method).toBe('POST')
    expect(calls[0].url).toBe('/api/sync/schedules')
    expect(JSON.parse(calls[0].body ?? '{}')).toEqual(base)
  })

  it('updateSyncSchedule: PUT（全站唯一一条 PUT 腿），id 走路径不进 body', async () => {
    const calls = captureFetch({ id: 8 })
    await updateSyncSchedule(8, base)
    expect(calls[0].method).toBe('PUT')
    expect(calls[0].url).toBe('/api/sync/schedules/8')
    expect(JSON.parse(calls[0].body ?? '{}')).toEqual(base)
  })

  it('deleteSyncSchedule: DELETE /api/sync/schedules/{id}', async () => {
    const calls = captureFetch({ message: 'schedule deleted', id: 8 })
    await deleteSyncSchedule(8)
    expect(calls[0]).toMatchObject({ method: 'DELETE', url: '/api/sync/schedules/8' })
  })

  it('toggleSyncSchedule: POST …/toggle，body 形状是 {active}（不是 {is_active}）', async () => {
    const calls = captureFetch({ message: 'schedule updated', id: 8, active: false })
    await toggleSyncSchedule(8, false)
    expect(calls[0].url).toBe('/api/sync/schedules/8/toggle')
    // 后端绑定的字段名是 `active`（cmd/data/sync_handlers.go 的匿名 req 结构）。
    // 写成 is_active 会被 ShouldBindJSON 静默忽略 ⇒ toggle 变成 no-op 且返回 200。
    expect(JSON.parse(calls[0].body ?? '{}')).toEqual({ active: false })
  })

  it('runSyncScheduleNow: POST …/run，无 body', async () => {
    const calls = captureFetch({ message: 'schedule triggered', job_id: 'scheduled-1', status: 'pending' })
    await runSyncScheduleNow(8)
    expect(calls[0]).toMatchObject({ method: 'POST', url: '/api/sync/schedules/8/run' })
    expect(calls[0].body).toBeUndefined()
  })
})

describe('sync read-out API (A-08 断言 3)', () => {
  it('getWorkerStats: GET /api/sync/workers', async () => {
    const calls = captureFetch({ num_workers: 3, registered_types: ['ohlcv'], is_running: true })
    const stats = await getWorkerStats()
    expect(calls[0]).toMatchObject({ method: 'GET', url: '/api/sync/workers' })
    expect(stats).toEqual({ num_workers: 3, registered_types: ['ohlcv'], is_running: true })
  })

  it('getSchedulerStats: GET /api/sync/scheduler/stats（注意路径段是 scheduler，不是 schedules）', async () => {
    const calls = captureFetch({ active_schedules: 1, total_entries: 1, next_runs: [] })
    await getSchedulerStats()
    expect(calls[0].url).toBe('/api/sync/scheduler/stats')
  })
})

describe('既有作业腿不退化（A-08 断言 1 的 API 层）', () => {
  it('四个作业端点各自的 URL/方法保持原样', async () => {
    const calls = captureFetch({ jobs: [], count: 0 })
    await createSyncJob({ type: 'ohlcv', params: {} })
    await listSyncJobs('failed', 20)
    await getSyncJob('aud49_1')
    await cancelSyncJob('aud49_1')
    await retrySyncJob('aud49_1')
    expect(calls.map(c => `${c.method} ${c.url}`)).toEqual([
      'POST /api/sync/jobs',
      'GET /api/sync/jobs?status=failed&limit=20',
      'GET /api/sync/jobs/aud49_1',
      'POST /api/sync/jobs/aud49_1/cancel',
      'POST /api/sync/jobs/aud49_1/retry',
    ])
  })

  it('单作业进度流仍是全站唯一的 SSE 腿（路径不含 schedules）', () => {
    expect(syncJobProgressStreamPath('a/b')).toBe('/api/sync/jobs/a%2Fb/progress')
  })
})
