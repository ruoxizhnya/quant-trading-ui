<template>
  <NCard title="作业队列" size="small" data-testid="queue-panel">
    <template #header-extra>
      <NSpace align="center" :size="8">
        <NTag v-if="store.sseConnected" type="success" size="small" data-testid="queue-sse-live">
          实时连接
        </NTag>
        <NButton
          v-if="store.watchedJobId"
          size="tiny"
          quaternary
          data-testid="queue-sse-disconnect"
          @click="store.unwatchJob()"
        >
          断开实时
        </NButton>
        <NButton size="tiny" :loading="store.isLoading" data-testid="queue-refresh" @click="reload()">
          刷新
        </NButton>
      </NSpace>
    </template>

    <NSpace align="center" :size="12" class="queue-filters" data-testid="queue-filters">
      <NSelect
        v-model:value="statusFilter"
        :options="JOB_STATUS_OPTIONS"
        clearable
        placeholder="按状态筛选"
        size="small"
        class="queue-filter-status"
        data-testid="queue-filter-status"
        @update:value="onStatusFilter"
      />
      <NSelect
        v-model:value="typeFilter"
        :options="typeOptions"
        clearable
        placeholder="按类型筛选"
        size="small"
        class="queue-filter-type"
        data-testid="queue-filter-type"
      />
      <NText depth="3" class="queue-filter-note" data-testid="queue-filter-note">
        状态由后端过滤；类型只在已加载的 {{ store.jobs.length }} 条内过滤
      </NText>
    </NSpace>

    <NAlert v-if="store.error" type="error" class="queue-error" closable data-testid="queue-error" @close="store.clearError()">
      {{ store.error }}
    </NAlert>

    <NEmpty
      v-if="visibleJobs.length === 0 && !store.isLoading"
      description="当前筛选条件下没有作业"
      data-testid="queue-empty"
    />

    <table v-else class="queue-table" data-testid="queue-table">
      <thead>
        <tr>
          <th>状态</th>
          <th>类型</th>
          <th>进度</th>
          <th>处理量</th>
          <th>创建时间</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="job in visibleJobs"
          :key="job.id"
          :data-testid="`queue-row-${job.id}`"
          :class="{ 'queue-row--selected': selectedId === job.id }"
        >
          <td>
            <NTag :type="jobStatusTagType(job.status)" size="small" :data-testid="`queue-status-${job.id}`">
              {{ jobStatusText(job.status) }}
            </NTag>
          </td>
          <td>{{ job.job_type }}</td>
          <td class="queue-cell-progress">
            <NProgress
              type="line"
              :percentage="job.progress_percent"
              :status="progressStatus(job)"
              :show-indicator="false"
              :height="6"
              data-testid="queue-progress"
            />
            <span class="queue-percent">{{ job.progress_percent }}%</span>
          </td>
          <td>
            {{ job.processed_items }}/{{ job.total_items }}
            <span v-if="job.failed_items > 0" class="queue-failed-count">· 失败 {{ job.failed_items }}</span>
          </td>
          <td class="queue-cell-time">{{ formatTime(job.created_at) }}</td>
          <td>
            <NSpace :size="6">
              <NButton size="tiny" :data-testid="`queue-detail-${job.id}`" @click="openDetail(job.id)">
                详情
              </NButton>
              <NButton
                v-if="canCancel(job)"
                size="tiny"
                type="warning"
                :loading="pendingId === job.id"
                :data-testid="`queue-cancel-${job.id}`"
                @click="act('cancel', job.id)"
              >
                取消
              </NButton>
              <NButton
                v-if="canRetry(job)"
                size="tiny"
                :loading="pendingId === job.id"
                :data-testid="`queue-retry-${job.id}`"
                @click="act('retry', job.id)"
              >
                重试
              </NButton>
            </NSpace>
          </td>
        </tr>
      </tbody>
    </table>

    <NDrawer :show="drawerOpen" :width="420" data-testid="queue-detail-drawer" @update:show="drawerOpen = $event">
      <NDrawerContent :title="`作业 ${selectedId}`" closable>
        <template v-if="selectedJob">
          <NDescriptions :column="1" label-placement="left" bordered size="small">
            <NDescriptionsItem label="状态">
              <NTag :type="jobStatusTagType(selectedJob.status)" size="small">
                {{ jobStatusText(selectedJob.status) }}
              </NTag>
            </NDescriptionsItem>
            <NDescriptionsItem label="类型">{{ selectedJob.job_type }}</NDescriptionsItem>
            <NDescriptionsItem label="进度">{{ selectedJob.progress_percent }}%</NDescriptionsItem>
            <NDescriptionsItem label="处理量">
              {{ selectedJob.processed_items }}/{{ selectedJob.total_items }}，失败 {{ selectedJob.failed_items }}
            </NDescriptionsItem>
            <NDescriptionsItem label="重试">
              {{ selectedJob.retry_count }}/{{ selectedJob.max_retries }}
            </NDescriptionsItem>
            <NDescriptionsItem label="执行者">{{ selectedJob.worker_id || '未分配' }}</NDescriptionsItem>
            <NDescriptionsItem label="创建">{{ formatTime(selectedJob.created_at) }}</NDescriptionsItem>
            <NDescriptionsItem label="开始">{{ formatTime(selectedJob.started_at) }}</NDescriptionsItem>
            <NDescriptionsItem label="结束">{{ formatTime(selectedJob.completed_at) }}</NDescriptionsItem>
          </NDescriptions>

          <NAlert v-if="selectedJob.error_message" type="error" class="queue-detail-error" data-testid="queue-detail-error">
            {{ selectedJob.error_message }}
          </NAlert>

          <NDivider />
          <NText strong>参数</NText>
          <pre class="queue-detail-json" data-testid="queue-detail-params">{{ pretty(selectedJob.params) }}</pre>
          <NText strong>结果</NText>
          <pre class="queue-detail-json" data-testid="queue-detail-result">{{ pretty(selectedJob.result) }}</pre>
        </template>
        <NEmpty v-else description="这条作业已从当前列表里消失（后端仍在跑，刷新可重新取回）" />
      </NDrawerContent>
    </NDrawer>
  </NCard>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import {
  NAlert,
  NButton,
  NCard,
  NDescriptions,
  NDescriptionsItem,
  NDivider,
  NDrawer,
  NDrawerContent,
  NEmpty,
  NProgress,
  NSelect,
  NSpace,
  NTag,
  NText,
} from 'naive-ui'
import { useSyncStore } from '@/stores/sync'
import {
  canCancel,
  canRetry,
  isTerminalJob,
  JOB_STATUS_OPTIONS,
  jobStatusTagType,
  jobStatusText,
} from '@/utils/jobActions'
import type { SyncJob, SyncJobStatus } from '@/types/sync'

/**
 * 队列区（A-08 断言 1）：列表 + 筛选 + 详情 + cancel/retry 四个动作各一次真实调用。
 *
 * 三条现场口径：
 *  - **动作后回读单条**：读在 store 的动作内部（cancelJob/retryJob → refreshJob），
 *    面板不再各读一次——两处各读会多打一趟，且将来只改一处就分叉。乐观更新则会把
 *    「取消请求被后端拒绝」显示成「已经取消了」。
 *  - 状态筛选走后端 `?status=`，类型筛选只能在前端做（后端没有这个参数）。两者混在一个
 *    控件里会谎称同一口径，所以明写各自范围。
 *  - 轮询只在**有活作业时**开（QUEUE_POLL_MS），且只有一条；共享限流桶是进程级的
 *    （见 core 记忆），空队列定时打接口只会挤掉真实请求的预算。
 */

const QUEUE_POLL_MS = 8000

const store = useSyncStore()

const statusFilter = ref<SyncJobStatus | null>(null)
const typeFilter = ref<string | null>(null)
const drawerOpen = ref(false)
const selectedId = ref<string | null>(null)
const pendingId = ref<string | null>(null)

let timer: number | undefined

const typeOptions = computed(() =>
  [...new Set(store.jobs.map((job) => job.job_type))].sort().map((value) => ({ label: value, value })),
)

const visibleJobs = computed(() =>
  store.jobs.filter((job) => !typeFilter.value || job.job_type === typeFilter.value),
)

const selectedJob = computed<SyncJob | null>(
  () => store.jobs.find((job) => job.id === selectedId.value) ?? null,
)

function progressStatus(job: SyncJob): 'default' | 'success' | 'error' {
  if (job.status === 'failed' || job.status === 'cancelled') return 'error'
  if (job.status === 'completed') return 'success'
  return 'default'
}

function formatTime(value?: string | null): string {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString()
}

function pretty(value: unknown): string {
  if (value === null || value === undefined || value === '') return '（无）'
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

async function reload() {
  await store.fetchSyncJobs(statusFilter.value ?? undefined, 50).catch(() => undefined)
  scheduleWatch()
}

/** 有活作业就骑上那条唯一的 SSE 腿（断言 4：全站只有这一处 EventSource）。 */
function scheduleWatch() {
  const active = store.jobs.find((job) => !isTerminalJob(job))
  if (active && store.watchedJobId !== active.id) store.watchJob(active.id)
}

function onStatusFilter() {
  reload()
}

async function openDetail(jobId: string) {
  selectedId.value = jobId
  drawerOpen.value = true
  try {
    await store.refreshJob(jobId)
  } catch {
    // store.error 已被写入，告警条会显示；抽屉保留上一次读到的内容
  }
}

async function act(kind: 'cancel' | 'retry', jobId: string) {
  pendingId.value = jobId
  try {
    // store 的动作内部会回读那一条作业（后端说了算），并在 retry 时开那条唯一的
    // 进度流；这里不再各读一次——两处各读会多打一趟接口，且将来只改一处就分叉。
    if (kind === 'cancel') await store.cancelJob(jobId)
    else await store.retryJob(jobId)
  } catch {
    // store.error 由 store 记，告警条显示的是后端原话
  } finally {
    pendingId.value = null
  }
}

function tick() {
  // 只在有活作业时打接口。空转轮询不只是浪费：限流桶是进程级共享的
  // （见 core 侧记忆与 OPS-01），一个空队列定时戳会把真实请求挤到 429。
  if (!store.jobs.some((job) => !isTerminalJob(job))) return
  reload()
}

onMounted(() => {
  reload()
  timer = window.setInterval(tick, QUEUE_POLL_MS)
})

onUnmounted(() => {
  if (timer !== undefined) window.clearInterval(timer)
  store.unwatchJob()
})
</script>

<style scoped>
/* 只用 variables.css 里真实存在的 token。
   仓里另有组件在引用 --q-font-micro / --q-weight-medium —— 那两个在本仓
   **没有定义**（幻影 token，声明等于没写），已登记，不跟。 */
.queue-filters {
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.queue-filter-status,
.queue-filter-type {
  min-width: 150px;
}

.queue-filter-note {
  font-size: 12px;
}

.queue-error {
  margin-bottom: 12px;
}

.queue-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.queue-table th,
.queue-table td {
  text-align: left;
  padding: 6px 8px;
  border-bottom: 1px solid var(--q-border);
  vertical-align: middle;
}

.queue-table th {
  color: var(--q-text3);
  font-weight: 600;
  font-size: 12px;
}

.queue-row--selected td {
  background: var(--q-surface2);
}

.queue-cell-progress {
  min-width: 120px;
}

.queue-percent {
  margin-left: 6px;
  font-variant-numeric: tabular-nums;
  color: var(--q-text3);
}

.queue-failed-count {
  color: var(--q-danger);
  margin-left: 4px;
}

.queue-cell-time {
  color: var(--q-text3);
  white-space: nowrap;
}

.queue-detail-error {
  margin-top: 12px;
}

.queue-detail-json {
  background: var(--q-surface2);
  border: 1px solid var(--q-border);
  border-radius: var(--q-radius);
  padding: 8px;
  margin: 6px 0 12px;
  white-space: pre-wrap;
  word-break: break-all;
  font-size: 12px;
  font-family: var(--q-mono);
}
</style>
