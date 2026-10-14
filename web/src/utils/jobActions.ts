import type { SyncJob, SyncJobStatus } from '@/types/sync'

/**
 * 作业状态口径 + 动作可行性判据（A-08 步骤 3）。
 *
 * 为什么单独成模块：队列表格、详情抽屉、操作按钮三处都要同一套标签与配色。
 * 原先 `SyncStatusPanel.vue` 把 `jobStatusText`/`jobTagType` 写在组件内部，别的组件
 * 只能各抄一份 —— A-07 已经为这种"同口径靠运气"付过代价（同一个 invalid 状态
 * 在四处显示成四种样子）。该面板已随 A-08 步骤 3 删除，能力并入 JobQueuePanel。
 *
 * 动作判据镜像后端规则，逐条对齐 quant-trading:pkg/sync/types/types.go：
 *   - IsTerminal (:73) = completed | failed | cancelled ⇒ 终态一律不可取消
 *   - CanRetry   (:78) = retry_count < max_retries && (failed | pending)
 *
 * 注意 `cancelled` **不在** CanRetry 里，而 `pending` 在 —— 直觉正好相反
 * （"取消了的当然能重来"），所以这里照抄后端而不是照抄直觉，并各留一条测试钉住。
 * 前端把按钮判错不会造成数据损坏（后端仍会 400 拒绝），但会把"这条不能重试"
 * 表现成一次莫名其妙的失败 —— 那正是愿景原则 4 要避免的质问。
 */

export type SeverityType = 'default' | 'success' | 'warning' | 'error'

const STATUS_LABELS: Record<SyncJobStatus, string> = {
  pending: '排队中',
  running: '同步中',
  retrying: '重试中',
  completed: '已完成',
  failed: '失败',
  cancelled: '已取消',
}

const STATUS_TAGS: Record<SyncJobStatus, SeverityType> = {
  pending: 'warning',
  running: 'warning',
  retrying: 'warning',
  completed: 'success',
  failed: 'error',
  cancelled: 'error',
}

/** 未知状态不粉饰：后端将来加值时，界面显示原值而不是崩或显示空白。 */
export function jobStatusText(status: SyncJobStatus | string): string {
  return STATUS_LABELS[status as SyncJobStatus] ?? String(status)
}

export function jobStatusTagType(status: SyncJobStatus | string): SeverityType {
  return STATUS_TAGS[status as SyncJobStatus] ?? 'default'
}

const TERMINAL: SyncJobStatus[] = ['completed', 'failed', 'cancelled']

export function isTerminalJob(job: Pick<SyncJob, 'status'>): boolean {
  return TERMINAL.includes(job.status)
}

export function canCancel(job: Pick<SyncJob, 'status'>): boolean {
  return !isTerminalJob(job)
}

export function canRetry(job: Pick<SyncJob, 'status' | 'retry_count' | 'max_retries'>): boolean {
  return job.retry_count < job.max_retries && (job.status === 'failed' || job.status === 'pending')
}

/** 队列筛选的下拉项：顺序即后端语义顺序，不是字母序。 */
export const JOB_STATUS_OPTIONS: { label: string; value: SyncJobStatus }[] = (
  ['pending', 'running', 'retrying', 'completed', 'failed', 'cancelled'] as SyncJobStatus[]
).map((value) => ({ value, label: STATUS_LABELS[value] }))
