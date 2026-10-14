import api from './client'
import type {
  CreateSyncJobRequest,
  CreateSyncJobResponse,
  DeleteScheduleResponse,
  DataSourceHealth,
  DataSourceStatus,
  RunScheduleNowResponse,
  SchedulerStats,
  SyncJob,
  SyncJobListResponse,
  SyncJobStatus,
  SyncSchedule,
  SyncScheduleListResponse,
  ToggleScheduleResponse,
  UpsertScheduleRequest,
  WorkerStats,
} from '@/types/sync'

// Data source (read-only observation, implemented locally on analysis).
export async function getDataSourceStatus(): Promise<DataSourceStatus> {
  return api.get<DataSourceStatus>('/api/datasource/status')
}

export async function getDataSourceHealth(): Promise<DataSourceHealth> {
  return api.get<DataSourceHealth>('/api/datasource/health')
}

// Sync jobs — the L0 job API (/api/sync/jobs*) reached through the analysis
// gateway proxy (ODR-062 S-B). The old /api/sync/status|import|stream
// endpoints never existed on any backend (ODR-062 取证 a).
export async function createSyncJob(request: CreateSyncJobRequest): Promise<CreateSyncJobResponse> {
  return api.post<CreateSyncJobResponse>('/api/sync/jobs', request)
}

export async function listSyncJobs(status?: SyncJobStatus, limit?: number): Promise<SyncJobListResponse> {
  const params = new URLSearchParams()
  if (status) params.set('status', status)
  if (limit) params.set('limit', String(limit))
  const qs = params.toString()
  return api.get<SyncJobListResponse>(`/api/sync/jobs${qs ? '?' + qs : ''}`)
}

export async function getSyncJob(jobId: string): Promise<SyncJob> {
  return api.get<SyncJob>(`/api/sync/jobs/${encodeURIComponent(jobId)}`)
}

export async function cancelSyncJob(jobId: string): Promise<{ message: string; job_id: string }> {
  return api.post(`/api/sync/jobs/${encodeURIComponent(jobId)}/cancel`)
}

export async function retrySyncJob(jobId: string): Promise<{ message: string; job_id: string; status: SyncJobStatus }> {
  return api.post(`/api/sync/jobs/${encodeURIComponent(jobId)}/retry`)
}

// SSE progress stream for one job — EventSource is constructed by the sync
// store (needs the raw URL); this builder keeps the endpoint contract in the
// API layer.
export function syncJobProgressStreamPath(jobId: string): string {
  return `/api/sync/jobs/${encodeURIComponent(jobId)}/progress`
}

// ---------------------------------------------------------------------------
// Schedules (A-08 断言 2) — seven legs, all served by the data service and
// reached through the analysis gateway's catch-all proxy
// (quant-trading: cmd/analysis/handlers_proxy.go:43 `router.Any("/api/sync/*path")`).
//
// `id` is a plain integer here (sync_schedules.id is a bigserial), unlike job
// ids which are strings — do not "unify" the two.
// ---------------------------------------------------------------------------

export async function listSyncSchedules(activeOnly?: boolean): Promise<SyncScheduleListResponse> {
  return api.get<SyncScheduleListResponse>(
    `/api/sync/schedules${activeOnly ? '?active_only=true' : ''}`,
  )
}

export async function getSyncSchedule(id: number): Promise<SyncSchedule> {
  return api.get<SyncSchedule>(`/api/sync/schedules/${id}`)
}

// 201 Created. The handler echoes the bound struct *after* the store has
// back-filled id/created_at/updated_at via RETURNING, so the created row's id
// really is in this response (verified against pkg/storage/sync_jobs.go:228).
export async function createSyncSchedule(request: UpsertScheduleRequest): Promise<SyncSchedule> {
  return api.post<SyncSchedule>('/api/sync/schedules', request)
}

export async function updateSyncSchedule(id: number, request: UpsertScheduleRequest): Promise<SyncSchedule> {
  return api.put<SyncSchedule>(`/api/sync/schedules/${id}`, request)
}

export async function deleteSyncSchedule(id: number): Promise<DeleteScheduleResponse> {
  return api.delete<DeleteScheduleResponse>(`/api/sync/schedules/${id}`)
}

export async function toggleSyncSchedule(id: number, active: boolean): Promise<ToggleScheduleResponse> {
  return api.post<ToggleScheduleResponse>(`/api/sync/schedules/${id}/toggle`, { active })
}

// 202 Accepted, and the job row exists by the time it returns. This is the
// falsifiable "the schedule really produces work" leg: a cron fire time can
// only be observed at 09:00, run-now can be observed now.
export async function runSyncScheduleNow(id: number): Promise<RunScheduleNowResponse> {
  return api.post<RunScheduleNowResponse>(`/api/sync/schedules/${id}/run`)
}

// Read-outs (A-08 断言 3). Both are pool/scheduler introspection, not job data:
// `workers` answers "how many consumers are there and what can they run",
// `scheduler/stats` answers "how many schedules did cron actually take".
export async function getWorkerStats(): Promise<WorkerStats> {
  return api.get<WorkerStats>('/api/sync/workers')
}

export async function getSchedulerStats(): Promise<SchedulerStats> {
  return api.get<SchedulerStats>('/api/sync/scheduler/stats')
}
