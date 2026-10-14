import { ApiError } from '@/api/client'

/**
 * 把「后端自己说的话」捞回界面（A-08 步骤 4）。
 *
 * 起因是浏览器实测：表单填一个非法 cron，告警条显示的是「请求参数有误」，而后端
 * 实际返回的是 `{"code":"bad_request","error":"invalid cron expression: expected
 * exactly 6 fields, found 3: [99 99 99]"}` —— 原话到了浏览器，被 `api/client.ts`
 * 的 `getStatusMessage()` 换成了按状态码查表的通用文案（`ApiError.body` 里仍带着）。
 *
 * 于是有了这个读取顺序：**后端原话 > 前端通用文案 > 兜底串**。
 * 为什么不在这里改 client.ts：那会一次改掉全站每一页的错误文案，还有三条既有测试
 * 钉着旧口径（`client.test.ts:115/127/142`），属需要单独裁决的整体改判，已登记工单；
 * 本单只保证 A-08 这几块面板说的是真话。
 *
 * `ApiError.status >= 500` 时后端**故意**不给细节（`pkg/httpserver/errors.go:163`
 * 只在 4xx 透传 err.Error()，5xx 返回人话 + code），所以这里不做任何"猜 5xx 原因"的事。
 */
export function apiMessage(err: unknown, fallback = '请求失败'): string {
  if (err instanceof ApiError) {
    const fromBody = bodyText(err.body)
    if (fromBody) return fromBody
    if (err.message) return err.message
  }
  if (err instanceof Error && err.message) return err.message
  if (typeof err === 'string' && err) return err
  return fallback
}

function bodyText(body: Record<string, unknown> | undefined): string {
  if (!body) return ''
  // 后端 4xx 的形状是 {"error": "...", "code": "..."}；少数老端点用 message。
  for (const key of ['error', 'message', 'detail'] as const) {
    const value = body[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}
