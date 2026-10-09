import api from './client'
import type { CopilotRequest, CopilotJobStarted, CopilotJobStatus } from '@/types/api'

// S7-P2-7: removed pipeline-related functions (runPipeline,
// getPipelineJob, getPipelineJobs, submitPipelineReview) and the
// saveStrategy / getCopilotStats stubs. None of these had any live
// consumers after the AI Research dead-code deletion — only the now-
// deleted components/ai/* used them. Kept only generateStrategy, which
// is wired into the Copilot page (router:/copilot → Copilot.vue).
// types/pipeline.ts was also deleted (no remaining consumers).
//
// OBS-12 (2026-10-09): 后端契约是**异步 job**（POST 受理 202 {job_id,status}，
// GET /generate/{job_id} 轮询产物）——此前前端把它当同步 RPC 用，响应类型
// CopilotResponse 从未与真实响应对上过（res.explanation 恒 undefined，
// 兜底文案「策略已生成」是谎言）。现在类型对齐 + 补轮询。

export function generateStrategy(req: CopilotRequest): Promise<CopilotJobStarted> {
  return api.post<CopilotJobStarted>('/api/copilot/generate', req, { timeout: 120000 })
}

export function getCopilotJob(jobId: string): Promise<CopilotJobStatus> {
  return api.get<CopilotJobStatus>(`/api/copilot/generate/${jobId}`)
}

// 终态集合：与后端 pkg/strategy/copilot.go 的状态机同步（改后端状态先改这里）。
// 刻意用**白名单**而不是「非 pending 即终态」：后端将来加中间态时，误判为
// 终态会把半成品当结果展示（静默错误）；白名单的错误方向是轮询超时（可见），
// 符合 fail-loud。
const TERMINAL_STATUSES = new Set([
  'generated',
  'backtest_complete',
  'llm_failed',
  'sandbox_rejected',
  'build_failed',
  'backtest_failed',
])

export function isCopilotJobTerminal(status: string): boolean {
  return TERMINAL_STATUSES.has(status)
}

// pollCopilotJob 轮询 job 直到终态。
// 默认超时 5 分钟：LLM 生成（数十秒）+ 沙箱 staticcheck/go build（分钟级）
// + 可选回测。超时不是静默放弃——抛错点名 job_id 与最后已知状态。
export async function pollCopilotJob(
  jobId: string,
  opts: { intervalMs?: number; timeoutMs?: number } = {},
): Promise<CopilotJobStatus> {
  const intervalMs = opts.intervalMs ?? 2000
  const timeoutMs = opts.timeoutMs ?? 300_000
  const deadline = Date.now() + timeoutMs

  for (;;) {
    const job = await getCopilotJob(jobId)
    if (isCopilotJobTerminal(job.status)) {
      return job
    }
    if (Date.now() > deadline) {
      throw new Error(
        `生成超时（${Math.round(timeoutMs / 1000)}s）：job ${jobId} 停留在 "${job.status}"`,
      )
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
}
