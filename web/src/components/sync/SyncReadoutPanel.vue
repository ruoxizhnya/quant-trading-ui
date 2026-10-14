<template>
  <NCard title="同步读数" size="small" data-testid="readout-panel">
    <template #header-extra>
      <NButton size="tiny" :loading="loading" data-testid="readout-refresh" @click="refresh">刷新</NButton>
    </template>

    <NAlert v-if="store.statsError" type="error" class="readout-error" closable data-testid="readout-error">
      {{ store.statsError }}
    </NAlert>

    <NSpace :size="20" align="start" class="readout-grid">
      <div class="readout-block" data-testid="readout-workers">
        <NText depth="3" class="readout-label">Worker 池</NText>
        <div class="readout-value" data-testid="readout-worker-count">
          {{ workerText }}
        </div>
        <div class="readout-sub" data-testid="readout-running">
          <NTag :type="runningTag.type" size="small">{{ runningTag.text }}</NTag>
          <span>消费者 {{ store.workerStats?.num_workers ?? '—' }} 个</span>
        </div>
        <div class="readout-types" data-testid="readout-types">
          <template v-if="store.workerStats">
            <NTag
              v-for="t in store.workerStats.registered_types"
              :key="t"
              size="small"
              :bordered="false"
            >
              {{ t }}
            </NTag>
          </template>
          <span v-else class="readout-none">未读取</span>
        </div>
      </div>

      <div class="readout-block" data-testid="readout-scheduler">
        <NText depth="3" class="readout-label">调度器</NText>
        <div class="readout-value" data-testid="readout-scheduler-values">
          {{ schedulerText }}
        </div>
        <div class="readout-sub">
          <!-- 两个数**并存不合并**：行数与 cron 登记数不等恰恰是"调度器没起来"的
               唯一现场线索（core SYNC-01 的缺陷形状）。 -->
          <span>启用中的排程行 {{ store.enabledScheduleRows.length }}</span>
          <span>· cron 已登记 {{ store.schedulerStats?.total_entries ?? '—' }}</span>
          <span v-if="nextRunCount !== null"> · 有下次执行 {{ nextRunCount }} 条</span>
        </div>
        <NText depth="3" class="readout-ambiguity" data-testid="readout-ambiguity">
          0 / 0 有两种成因：调度器启动失败，或确实没有启用中的排程。后端目前不区分，
          这里就只报这两个数，不编诊断。
        </NText>
      </div>
    </NSpace>
  </NCard>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { NAlert, NButton, NCard, NSpace, NTag, NText } from 'naive-ui'
import { useSyncStore } from '@/stores/sync'

/**
 * 读数区（A-08 断言 3）：worker 与 scheduler 的后端真值。
 *
 * 三条口径：
 *  - 数字只来自 `GET /api/sync/workers` 与 `GET /api/sync/scheduler/stats`，读不到就
 *    显示「未读取」，不用 0 冒充"读到了 0"（A-07 的 UNKNOWN 同一条纪律）。
 *  - 「排程行」和「cron 已登记」是两个数，**不合并**：前者是表里的行，后者是调度器
 *    真的接下的条目，两者分叉就是 SYNC-01 那类故障的现场证据。
 *  - `next_runs[].name` 后端从不赋值（Go 侧没填，实测恒为空串），所以这里不渲染它，
 *    只数条数。
 */
const store = useSyncStore()
const loading = ref(false)

const workerText = computed(() =>
  store.workerStats ? `${store.workerStats.num_workers} 个消费者` : '未读取',
)

const schedulerText = computed(() => {
  const s = store.schedulerStats
  if (!s) return '未读取'
  return `active ${s.active_schedules} · entries ${s.total_entries}`
})

const nextRunCount = computed(() =>
  store.schedulerStats?.next_runs ? store.schedulerStats.next_runs.length : null,
)

const runningTag = computed<{ type: 'success' | 'error' | 'default'; text: string }>(() => {
  if (!store.workerStats) return { type: 'default', text: '未读取' }
  return store.workerStats.is_running
    ? { type: 'success', text: '运行中' }
    : { type: 'error', text: '已停止' }
})

async function refresh() {
  loading.value = true
  await store.fetchStats()
  await store.fetchSchedules().catch(() => undefined)
  loading.value = false
}

onMounted(refresh)
</script>

<style scoped>
.readout-error {
  margin-bottom: 12px;
}

.readout-grid {
  width: 100%;
}

.readout-block {
  min-width: 220px;
}

.readout-label {
  display: block;
  font-size: 12px;
  margin-bottom: 4px;
}

.readout-value {
  font-size: 20px;
  font-variant-numeric: tabular-nums;
  color: var(--q-text);
}

.readout-sub {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
  margin-top: 6px;
  font-size: 12px;
  color: var(--q-text2);
}

.readout-types {
  margin-top: 8px;
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.readout-none {
  color: var(--q-text3);
  font-size: 12px;
}

.readout-ambiguity {
  display: block;
  margin-top: 8px;
  font-size: 12px;
  max-width: 420px;
}
</style>
