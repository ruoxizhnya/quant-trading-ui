import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type {
  CreateSyncJobRequest,
  DataImportRequest,
  DataSourceHealth,
  DataSourceStatus,
  SchedulerStats,
  SyncJob,
  SyncJobStatus,
  SyncSchedule,
  UpsertScheduleRequest,
  WorkerStats,
} from '@/types/sync'
import {
  cancelSyncJob,
  createSyncJob,
  createSyncSchedule,
  deleteSyncSchedule,
  getSchedulerStats,
  getDataSourceHealth,
  getDataSourceStatus,
  getSyncJob,
  getWorkerStats,
  listSyncJobs,
  listSyncSchedules,
  retrySyncJob,
  runSyncScheduleNow,
  syncJobProgressStreamPath,
  toggleSyncSchedule,
  updateSyncSchedule,
} from '@/api/sync'
import { apiMessage } from '@/utils/apiMessage'

function isJobActive(job: SyncJob): boolean {
  return job.status === 'pending' || job.status === 'running' || job.status === 'retrying'
}

/**
 * The one place that decides whether a schedule's next run may be shown.
 *
 * The backend does not clear `next_run_at` when a schedule is toggled off
 * (measured 2026-10-14: is_active=false still carried
 * next_run_at="2026-10-15T09:00:00Z"; real fix filed as core SYNC-03). Showing
 * it anyway would put a future that can never happen on screen — so the gate
 * lives here, once, rather than in every row template.
 */
export function visibleNextRun(schedule: SyncSchedule): string | null {
  if (!schedule.is_active) return null
  return schedule.next_run_at ?? null
}

export const useSyncStore = defineStore('sync', () => {
  // State
  const dataSourceStatus = ref<DataSourceStatus | null>(null)
  const dataSourceHealth = ref<DataSourceHealth | null>(null)
  const jobs = ref<SyncJob[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const sseConnected = ref(false)
  const watchedJobId = ref<string | null>(null)

  // A-08: schedules + pool/scheduler read-outs get their OWN loading/error
  // flags. Reusing `isLoading`/`error` would make a queue poll flicker the
  // schedule table (and let a stats failure be reported as "job queue broke").
  const schedules = ref<SyncSchedule[]>([])
  const schedulesLoading = ref(false)
  const schedulesError = ref<string | null>(null)
  const workerStats = ref<WorkerStats | null>(null)
  const schedulerStats = ref<SchedulerStats | null>(null)
  const statsError = ref<string | null>(null)

  let eventSource: EventSource | null = null

  // Getters
  const isDataSourceEnabled = computed(() => dataSourceStatus.value?.enabled ?? false)
  const primaryDataSource = computed(() => dataSourceStatus.value?.primary ?? 'unknown')

  // Most recent active job; falls back to the most recent job overall so a
  // just-finished run stays visible.
  const activeJob = computed<SyncJob | null>(() => {
    if (jobs.value.length === 0) return null
    return jobs.value.find(isJobActive) ?? jobs.value[0]
  })

  const isSyncRunning = computed(() => activeJob.value !== null && isJobActive(activeJob.value))
  const queueLength = computed(() => jobs.value.filter((j) => j.status === 'pending').length)
  const progressPercent = computed(() => activeJob.value?.progress_percent ?? 0)

  // Rows in the schedule table that are switched on. **Not** the same number as
  // schedulerStats.active_schedules: that one counts what cron actually took.
  // The two may diverge (a schedule row can be is_active=true while the process
  // never registered it), and keeping both visible is exactly how that divergence
  // becomes a diagnosable fact instead of a silent 0.
  const enabledScheduleRows = computed(() => schedules.value.filter((s) => s.is_active))

  // Actions
  async function fetchDataSourceStatus() {
    isLoading.value = true
    error.value = null
    try {
      dataSourceStatus.value = await getDataSourceStatus()
    } catch (err) {
      error.value = apiMessage(err, 'Failed to fetch data source status')
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function fetchDataSourceHealth() {
    try {
      dataSourceHealth.value = await getDataSourceHealth()
    } catch (err) {
      error.value = apiMessage(err, 'Failed to fetch data source health')
      throw err
    }
  }

  async function fetchSyncJobs(status?: SyncJobStatus, limit?: number) {
    isLoading.value = true
    error.value = null
    try {
      const resp = await listSyncJobs(status, limit)
      jobs.value = resp.jobs
    } catch (err) {
      error.value = apiMessage(err, 'Failed to fetch sync jobs')
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 动作后的单条回读（A-08 步骤 3「不靠乐观更新」的落点）。
   *
   * cancel/retry 之后整表重读太粗：抽屉里正看着这条作业，列表刷新不会保证
   * 抽屉内容与后端一致。回读单条 + applyJobUpdate 才让"我点了取消之后看到的
   * 状态"是后端写成的状态，而不是前端猜的。
   */
  async function refreshJob(jobId: string): Promise<SyncJob> {
    const job = await getSyncJob(jobId)
    applyJobUpdate(job)
    return job
  }

  // Upsert one job — the merge point for SSE progress events and polling.
  // Exposed as an action so it is testable without an EventSource.
  function applyJobUpdate(job: SyncJob) {
    const idx = jobs.value.findIndex((j) => j.id === job.id)
    if (idx === -1) {
      jobs.value = [job, ...jobs.value]
    } else {
      jobs.value = jobs.value.map((j) => (j.id === job.id ? job : j))
    }
  }

  async function createJob(request: CreateSyncJobRequest): Promise<string> {
    isLoading.value = true
    error.value = null
    try {
      const resp = await createSyncJob(request)
      await fetchSyncJobs()
      watchJob(resp.job_id)
      return resp.job_id
    } catch (err) {
      error.value = apiMessage(err, 'Failed to create sync job')
      throw err
    } finally {
      isLoading.value = false
    }
  }

  // Map the import form model onto L0 job types. 'all' fans out into one
  // OHLCV job plus one fundamentals job; the door accepts both ISO
  // YYYY-MM-DD (what the form yields) and YYYYMMDD.
  async function importData(request: DataImportRequest): Promise<string[]> {
    const params: Record<string, unknown> = { symbols: request.symbols }
    if (request.start_date) params.start_date = request.start_date
    if (request.end_date) params.end_date = request.end_date
    const jobTypes =
      request.data_type === 'all'
        ? ['ohlcv', 'fundamentals']
        : [request.data_type === 'fundamental' ? 'fundamentals' : 'ohlcv']
    const ids: string[] = []
    for (const type of jobTypes) {
      ids.push(await createJob({ type, params }))
    }
    return ids
  }

  async function cancelJob(jobId: string) {
    error.value = null
    try {
      await cancelSyncJob(jobId)
      await fetchSyncJobs()
    } catch (err) {
      error.value = apiMessage(err, 'Failed to cancel sync job')
      throw err
    }
  }

  async function retryJob(jobId: string) {
    error.value = null
    try {
      await retrySyncJob(jobId)
      await fetchSyncJobs()
      watchJob(jobId)
    } catch (err) {
      error.value = apiMessage(err, 'Failed to retry sync job')
      throw err
    }
  }

  // SSE — per-job progress stream (GET /api/sync/jobs/:id/progress). The old
  // global /api/sync/stream never existed on any backend (ODR-062 取证 a).
  function watchJob(jobId: string) {
    unwatchJob()
    if (typeof EventSource === 'undefined') return // non-browser test env
    eventSource = new EventSource(syncJobProgressStreamPath(jobId))
    watchedJobId.value = jobId
    eventSource.onopen = () => {
      sseConnected.value = true
    }
    eventSource.addEventListener('progress', (event) => {
      try {
        applyJobUpdate(JSON.parse((event as MessageEvent).data) as SyncJob)
      } catch (err) {
        console.warn('Failed to parse SSE progress message:', err)
      }
    })
    eventSource.addEventListener('complete', (event) => {
      try {
        applyJobUpdate(JSON.parse((event as MessageEvent).data) as SyncJob)
      } catch {
        // ignore malformed terminal events
      }
      unwatchJob()
    })
    eventSource.onerror = () => {
      sseConnected.value = false
      // EventSource auto-reconnects; watchedJobId stays so the UI shows
      // which stream is being retried.
    }
  }

  function unwatchJob() {
    if (eventSource) {
      try {
        eventSource.close()
      } catch {
        // ignore close errors
      }
      eventSource = null
    }
    watchedJobId.value = null
    sseConnected.value = false
  }

  // ---------------------------------------------------------------------
  // Schedules (A-08 断言 2) + read-outs (A-08 断言 3).
  //
  // Mutation actions rethrow: the form must show the backend's own words
  // verbatim (an invalid cron comes back as 400 with ErrInvalidCron's
  // message), and a swallowed error there is a silent no-op.
  // ---------------------------------------------------------------------

  async function fetchSchedules(activeOnly?: boolean) {
    schedulesLoading.value = true
    schedulesError.value = null
    try {
      const resp = await listSyncSchedules(activeOnly)
      schedules.value = resp.schedules ?? []
    } catch (err) {
      schedulesError.value = apiMessage(err, 'Failed to fetch schedules')
      throw err
    } finally {
      schedulesLoading.value = false
    }
  }

  async function createSchedule(request: UpsertScheduleRequest): Promise<number> {
    schedulesError.value = null
    try {
      const created = await createSyncSchedule(request)
      await fetchSchedules()
      // Only an active row is taken by cron, so a create can move the stats.
      await fetchStats()
      return created.id
    } catch (err) {
      schedulesError.value = apiMessage(err, 'Failed to create schedule')
      throw err
    }
  }

  async function updateSchedule(id: number, request: UpsertScheduleRequest) {
    schedulesError.value = null
    try {
      await updateSyncSchedule(id, request)
      await fetchSchedules()
      await fetchStats()
    } catch (err) {
      schedulesError.value = apiMessage(err, 'Failed to update schedule')
      throw err
    }
  }

  async function deleteSchedule(id: number) {
    schedulesError.value = null
    try {
      await deleteSyncSchedule(id)
      await fetchSchedules()
      await fetchStats()
    } catch (err) {
      schedulesError.value = apiMessage(err, 'Failed to delete schedule')
      throw err
    }
  }

  async function toggleSchedule(id: number, active: boolean) {
    schedulesError.value = null
    try {
      await toggleSyncSchedule(id, active)
      await fetchSchedules()
      await fetchStats()
    } catch (err) {
      schedulesError.value = apiMessage(err, 'Failed to toggle schedule')
      throw err
    }
  }

  /**
   * run-now is the falsifiable leg: it creates the job row synchronously and
   * returns its id, so the queue — not a toast — is where the result is shown.
   * `watchJob` then rides the same single SSE leg the jobs already use; the
   * schedule area does **not** get its own stream (A-08 断言 4).
   *
   * 这里**不重读整张列表**：浏览器实测（2026-10-14）原先的做法让队列从 50 行缩回
   * 20 行、用户选的筛选也一并掉了 —— 排程面板不该知道自己没有的队列筛选状态，
   * 正确形状是把新作业这一条 upsert 进去（refreshJob 走同一条 upsert 口径）。
   */
  async function runScheduleNow(id: number): Promise<string> {
    schedulesError.value = null
    try {
      const resp = await runSyncScheduleNow(id)
      await refreshJob(resp.job_id).catch(() => undefined)
      watchJob(resp.job_id)
      return resp.job_id
    } catch (err) {
      schedulesError.value = apiMessage(err, 'Failed to trigger schedule')
      throw err
    }
  }

  /**
   * Worker + scheduler read-outs, settled independently.
   *
   * Deliberately allSettled and non-throwing: these two are background gauges.
   * A dead `/workers` must not blank out a live `/scheduler/stats`, and neither
   * failure should look like "the job queue is broken" (that is `error`'s job).
   */
  async function fetchStats() {
    statsError.value = null
    const [workers, scheduler] = await Promise.allSettled([getWorkerStats(), getSchedulerStats()])
    if (workers.status === 'fulfilled') workerStats.value = workers.value
    if (scheduler.status === 'fulfilled') schedulerStats.value = scheduler.value
    const failed = [workers, scheduler].find((r) => r.status === 'rejected') as
      | PromiseRejectedResult
      | undefined
    if (failed) {
      statsError.value = apiMessage(failed.reason, 'Failed to fetch sync stats')
    }
  }

  function clearError() {
    error.value = null
  }

  return {
    // State
    dataSourceStatus,
    dataSourceHealth,
    jobs,
    isLoading,
    error,
    sseConnected,
    watchedJobId,
    schedules,
    schedulesLoading,
    schedulesError,
    workerStats,
    schedulerStats,
    statsError,
    // Getters
    isDataSourceEnabled,
    primaryDataSource,
    activeJob,
    isSyncRunning,
    queueLength,
    progressPercent,
    enabledScheduleRows,
    // Actions
    fetchDataSourceStatus,
    fetchDataSourceHealth,
    fetchSyncJobs,
    refreshJob,
    applyJobUpdate,
    createJob,
    importData,
    cancelJob,
    retryJob,
    fetchSchedules,
    createSchedule,
    updateSchedule,
    deleteSchedule,
    toggleSchedule,
    runScheduleNow,
    fetchStats,
    watchJob,
    unwatchJob,
    clearError,
  }
})
