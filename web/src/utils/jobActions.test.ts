import { describe, expect, it } from 'vitest'
import {
  canCancel,
  canRetry,
  JOB_STATUS_OPTIONS,
  isTerminalJob,
  jobStatusTagType,
  jobStatusText,
} from '@/utils/jobActions'
import type { SyncJob } from '@/types/sync'

/**
 * 作业状态与动作判据的唯一口径（A-08 步骤 3）。
 *
 * 判据镜像 quant-trading:pkg/sync/types/types.go 的 IsTerminal(:73) / CanRetry(:78)，
 * 其中两条**违反直觉**，所以各占一条测试：
 *   - `cancelled` 不可重试（直觉会说能）；
 *   - `pending` 可重试（直觉会说还没跑过重试什么）。
 * 照抄后端而不是照抄直觉，界面上「这条能不能点」才等于后端「这条能不能做」。
 */

const j = (over: Partial<SyncJob> = {}): SyncJob => ({
  id: 'j-1',
  job_type: 'ohlcv',
  status: 'running',
  progress_percent: 50,
  total_items: 10,
  processed_items: 5,
  failed_items: 0,
  created_at: '2026-10-14T00:00:00Z',
  retry_count: 0,
  max_retries: 3,
  ...over,
})

describe('jobStatusText / jobStatusTagType', () => {
  it('六种后端状态都有人话标签，不出现裸枚举值', () => {
    expect(['pending', 'running', 'retrying', 'completed', 'failed', 'cancelled'].map(jobStatusText)).toEqual([
      '排队中',
      '同步中',
      '重试中',
      '已完成',
      '失败',
      '已取消',
    ])
  })

  it('未知状态显示原值而不是崩或空白', () => {
    expect(jobStatusText('paused' as SyncJob['status'])).toBe('paused')
    expect(jobStatusTagType('paused' as SyncJob['status'])).toBe('default')
  })

  it('终态三种配色一致：成功绿、失败与取消红', () => {
    expect(jobStatusTagType('completed')).toBe('success')
    expect(jobStatusTagType('failed')).toBe('error')
    expect(jobStatusTagType('cancelled')).toBe('error')
  })
})

describe('isTerminalJob / canCancel（镜像后端 IsTerminal）', () => {
  it('completed / failed / cancelled 是终态，不可取消', () => {
    for (const status of ['completed', 'failed', 'cancelled'] as const) {
      expect(isTerminalJob(j({ status }))).toBe(true)
      expect(canCancel(j({ status }))).toBe(false)
    }
  })

  it('pending / running / retrying 可取消', () => {
    for (const status of ['pending', 'running', 'retrying'] as const) {
      expect(isTerminalJob(j({ status }))).toBe(false)
      expect(canCancel(j({ status }))).toBe(true)
    }
  })
})

describe('canRetry（镜像后端 CanRetry，含两条反直觉）', () => {
  it('failed 且未超预算可重试', () => {
    expect(canRetry(j({ status: 'failed', retry_count: 1, max_retries: 3 }))).toBe(true)
  })

  it('pending 可重试 —— 后端就是这么定的，不是笔误', () => {
    expect(canRetry(j({ status: 'pending', retry_count: 0, max_retries: 3 }))).toBe(true)
  })

  it('cancelled 不可重试 —— 直觉会以为取消后能直接重来', () => {
    expect(canRetry(j({ status: 'cancelled', retry_count: 0, max_retries: 3 }))).toBe(false)
  })

  it('running / retrying / completed 不可重试', () => {
    expect(canRetry(j({ status: 'running' }))).toBe(false)
    expect(canRetry(j({ status: 'retrying' }))).toBe(false)
    expect(canRetry(j({ status: 'completed' }))).toBe(false)
  })

  it('重试预算用完就到底：retry_count == max_retries ⇒ 不可重试', () => {
    expect(canRetry(j({ status: 'failed', retry_count: 3, max_retries: 3 }))).toBe(false)
    expect(canRetry(j({ status: 'failed', retry_count: 2, max_retries: 3 }))).toBe(true)
  })

  it('max_retries=0 的作业永远不可重试（后端零预算，不是缺省 3）', () => {
    expect(canRetry(j({ status: 'failed', retry_count: 0, max_retries: 0 }))).toBe(false)
  })
})

describe('JOB_STATUS_OPTIONS', () => {
  it('六个值齐全，顺序按流程而非字母序', () => {
    expect(JOB_STATUS_OPTIONS.map((o) => o.value)).toEqual([
      'pending',
      'running',
      'retrying',
      'completed',
      'failed',
      'cancelled',
    ])
    expect(JOB_STATUS_OPTIONS.every((o) => o.label !== o.value)).toBe(true)
  })
})
