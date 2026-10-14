export interface DataSourceStatus {
  enabled: boolean
  primary?: string
  stopped?: boolean
  mode?: string
  source?: string
}

export interface DataSourceHealth {
  status: string
  primary?: string
  mode?: string
  error?: string
}

// Job status — mirrors pkg/sync/types/types.go JobStatus.
export type SyncJobStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'retrying'

// Mirrors pkg/sync/types/types.go Job JSON tags (single source of truth:
// the L0 sync-job API at POST/GET /api/sync/jobs, ODR-062).
export interface SyncJob {
  id: string
  job_type: string
  status: SyncJobStatus
  params?: unknown
  progress_percent: number
  total_items: number
  processed_items: number
  failed_items: number
  error_message?: string
  result?: unknown
  created_at: string
  started_at?: string
  completed_at?: string
  retry_count: number
  max_retries: number
  scheduled_at?: string
  worker_id?: string
}

// POST /api/sync/jobs request body.
export interface CreateSyncJobRequest {
  type: string
  params?: Record<string, unknown>
}

export interface CreateSyncJobResponse {
  message: string
  job_id: string
  status: SyncJobStatus
}

// GET /api/sync/jobs response.
export interface SyncJobListResponse {
  jobs: SyncJob[]
  count: number
}

// UI-level form model for the DataSync import form — mapped onto
// CreateSyncJobRequest by the sync store (not an API contract).
export interface DataImportRequest {
  symbols: string[]
  start_date: string
  end_date: string
  data_type: 'ohlcv' | 'fundamental' | 'all'
}

// ---------------------------------------------------------------------------
// Schedules + pool/scheduler read-outs (A-08).
//
// Every field below mirrors a Go struct's JSON tags, one-to-one, in
// quant-trading: pkg/sync/types/types.go (Schedule) / pkg/sync/worker.go
// (WorkerStats) / pkg/sync/scheduler.go (SchedulerStats, NextRun). Nothing
// here is invented: the shapes were read from the handlers' c.JSON calls and
// then confirmed against live 200 bodies on :8085 (2026-10-14).
// ---------------------------------------------------------------------------

// Mirrors pkg/sync/types/types.go Schedule. `params` is `json.RawMessage` on
// the backend, i.e. an arbitrary JSON object keyed by job type — the schedule
// form sends exactly what `createSyncJob` sends for the same `job_type`.
export interface SyncSchedule {
  id: number
  name: string
  description?: string
  job_type: string
  cron_expression: string
  params?: Record<string, unknown>
  is_active: boolean
  last_run_at?: string
  last_run_status?: string
  last_run_job_id?: string
  // next_run_at is only meaningful while is_active is true. The backend does
  // NOT clear it when a schedule is toggled off (measured 2026-10-14, filed as
  // core SYNC-03), so callers must gate on is_active before displaying it.
  next_run_at?: string
  created_at: string
  updated_at: string
  created_by?: string
}

// POST/PUT request body. The backend binds the whole `sync.Schedule` struct
// and rejects an empty name / cron_expression / job_type with 400
// ("name, cron_expression, and job_type are required"), and maps
// ErrInvalidCron to 400 as well — the form passes those messages through
// instead of guessing cron legality client-side.
export interface UpsertScheduleRequest {
  name: string
  description?: string
  job_type: string
  cron_expression: string
  params?: Record<string, unknown>
  // Required in practice: the handler binds the full struct, so an omitted
  // is_active arrives as Go's zero value (false) and the row is created
  // paused even though the DB column defaults to true.
  is_active: boolean
}

// GET /api/sync/schedules response (`active_only=true` filters server-side).
export interface SyncScheduleListResponse {
  count: number
  schedules: SyncSchedule[]
}

export interface ToggleScheduleRequest {
  active: boolean
}

export interface ToggleScheduleResponse {
  message: string
  id: number
  active: boolean
}

export interface DeleteScheduleResponse {
  message: string
  id: number
}

// POST /api/sync/schedules/:id/run — 202 Accepted. It creates the job row
// synchronously, which is what makes it the only falsifiable "this schedule
// really produces work" check inside a test window (a cron fire time is not).
export interface RunScheduleNowResponse {
  message: string
  job_id: string
  status: SyncJobStatus
}

// GET /api/sync/workers — mirrors pkg/sync/worker.go WorkerStats.
export interface WorkerStats {
  num_workers: number
  registered_types: string[]
  is_running: boolean
}

// GET /api/sync/scheduler/stats — mirrors SchedulerStats. Note Stats() only
// fills ScheduleID + NextRun; `name` is present in the Go struct but never
// assigned, so the live payload carries `""` (measured) — do not render it.
export interface SchedulerNextRun {
  schedule_id: number
  name?: string
  next_run: string
}

export interface SchedulerStats {
  active_schedules: number
  total_entries: number
  next_runs?: SchedulerNextRun[]
}
