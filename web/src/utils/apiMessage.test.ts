import { describe, expect, it } from 'vitest'
import { apiMessage } from '@/utils/apiMessage'
import { ApiError } from '@/api/client'

/**
 * 错误文案的读取顺序：后端原话 > 前端通用文案 > 兜底串。
 *
 * 这组用例的形状是从真实响应抄的（2026-10-14 curl POST /api/sync/schedules，
 * body {"code":"bad_request","error":"invalid cron expression: expected exactly
 * 6 fields, found 3: [99 99 99]"}，而 client.ts 给 ApiError.message 填的是
 * 「请求参数有误」）—— 只用 `new Error('…')` 造的那批用例证明不了这条腿，
 * 因为浏览器里真正丢原话的是 ApiError，不是 Error。
 */

describe('apiMessage', () => {
  it('4xx：ApiError.body 里的后端原话压过前端通用文案', () => {
    const err = new ApiError(400, '请求参数有误', {
      code: 'bad_request',
      error: 'invalid cron expression: expected exactly 6 fields, found 3: [99 99 99]',
    })
    expect(apiMessage(err)).toBe('invalid cron expression: expected exactly 6 fields, found 3: [99 99 99]')
  })

  it('body 没有可用文本时退回 ApiError.message', () => {
    expect(apiMessage(new ApiError(404, '请求的资源不存在', { code: 'not_found' }))).toBe('请求的资源不存在')
  })

  it('body 完全没有时同样退回通用文案（不编造原因）', () => {
    expect(apiMessage(new ApiError(409, '资源冲突，请刷新后重试'))).toBe('资源冲突，请刷新后重试')
  })

  it('普通 Error 走 message（既有 store 用例的形状）', () => {
    expect(apiMessage(new Error('boom'))).toBe('boom')
  })

  it('非 Error 的抛出物也不炸', () => {
    expect(apiMessage('raw string')).toBe('raw string')
    expect(apiMessage(undefined)).toBe('请求失败')
    expect(apiMessage(null, '排程读取失败')).toBe('排程读取失败')
    expect(apiMessage({ nope: 1 }, '排程读取失败')).toBe('排程读取失败')
  })

  it('error 字段是空串时不算原话（否则界面显示一片空白）', () => {
    expect(apiMessage(new ApiError(400, '请求参数有误', { error: '   ' }))).toBe('请求参数有误')
  })

  it('message 形状的 body 也认（部分老端点用 message）', () => {
    expect(apiMessage(new ApiError(422, '数据验证失败', { message: 'symbols 不能为空' }))).toBe('symbols 不能为空')
  })
})
