<template>
  <NCard title="排程管理" size="small" data-testid="schedule-panel">
    <template #header-extra>
      <NSpace :size="8">
        <NButton size="tiny" :loading="store.schedulesLoading" data-testid="schedule-refresh" @click="reload">
          刷新
        </NButton>
        <NButton size="tiny" type="primary" data-testid="schedule-create" @click="openCreate">新建排程</NButton>
      </NSpace>
    </template>

    <NAlert
      v-if="store.schedulesError"
      type="error"
      class="schedule-error"
      closable
      data-testid="schedule-error"
      @close="store.schedulesError = null"
    >
      {{ store.schedulesError }}
    </NAlert>

    <NEmpty
      v-if="store.schedules.length === 0 && !store.schedulesLoading"
      description="还没有排程"
      data-testid="schedule-empty"
    />

    <table v-else class="schedule-table" data-testid="schedule-table">
      <thead>
        <tr>
          <th>名称</th>
          <th>类型</th>
          <th>Cron</th>
          <th>状态</th>
          <th>下次执行</th>
          <th>上次运行</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in store.schedules" :key="row.id" :data-testid="`schedule-row-${row.id}`">
          <td>{{ row.name }}</td>
          <td>{{ row.job_type }}</td>
          <td class="schedule-cron">{{ row.cron_expression }}</td>
          <td>
            <NTag :type="row.is_active ? 'success' : 'default'" size="small" :data-testid="`schedule-state-${row.id}`">
              {{ row.is_active ? '启用中' : '已停用' }}
            </NTag>
          </td>
          <td class="schedule-next">{{ formatNext(row) }}</td>
          <td>
            <template v-if="row.last_run_at">{{ formatTime(row.last_run_at) }}</template>
            <template v-else>—</template>
            <NTag
              v-if="row.last_run_status"
              :type="jobStatusTagType(row.last_run_status)"
              size="small"
              class="schedule-last-status"
            >
              {{ jobStatusText(row.last_run_status) }}
            </NTag>
          </td>
          <td>
            <NSpace :size="6">
              <NButton size="tiny" :data-testid="`schedule-toggle-${row.id}`" @click="toggle(row)">
                {{ row.is_active ? '停用' : '启用' }}
              </NButton>
              <NButton size="tiny" :data-testid="`schedule-run-${row.id}`" @click="runNow(row)">立即运行</NButton>
              <NButton size="tiny" :data-testid="`schedule-edit-${row.id}`" @click="openEdit(row)">编辑</NButton>
              <NPopconfirm @positive-click="remove(row)">
                <template #trigger>
                  <NButton size="tiny" type="error" :data-testid="`schedule-delete-${row.id}`">删除</NButton>
                </template>
                删除排程「{{ row.name }}」？此操作不可撤销。
              </NPopconfirm>
            </NSpace>
          </td>
        </tr>
      </tbody>
    </table>

    <NText depth="3" class="schedule-note" data-testid="schedule-note">
      「下次执行」取后端 next_run_at，仅启用中的排程显示；cron 合法性由后端判定，界面上出现的
      400 原文就是后端的原话。
    </NText>

    <NModal
      :show="formOpen"
      preset="card"
      :title="editingId === null ? '新建排程' : `编辑排程 ${editingId}`"
      class="schedule-modal"
      style="width: 520px"
      data-testid="schedule-form"
      @update:show="formOpen = $event"
    >
      <NForm label-placement="top">
        <NFormItem label="名称（全站唯一，重名由后端拒绝）">
          <NInput v-model:value="formState.name" placeholder="daily ohlcv sync" data-testid="schedule-input-name" />
        </NFormItem>

        <NFormItem label="说明">
          <NInput v-model:value="formState.description" placeholder="可选" />
        </NFormItem>

        <NFormItem label="作业类型">
          <NSelect
            v-model:value="formState.job_type"
            :options="jobTypeOptions"
            data-testid="schedule-input-type"
          />
        </NFormItem>

        <NFormItem label="Cron 表达式">
          <NInput
            v-model:value="formState.cron_expression"
            placeholder="0 2 * * *（标准 5 段，或 @daily / @every 1h）"
            data-testid="schedule-input-cron"
          />
        </NFormItem>

        <NFormItem label="参数（JSON 对象，按作业类型取字段）">
          <NInput
            v-model:value="formState.paramsText"
            type="textarea"
            :rows="3"
            placeholder='{"symbols": ["000001.SZ"], "start_date": "2024-01-01", "end_date": "2024-03-31"}'
            data-testid="schedule-input-params"
          />
        </NFormItem>

        <NFormItem label="创建后立即启用">
          <NSwitch v-model:value="formState.is_active" data-testid="schedule-input-active" />
        </NFormItem>

        <NAlert v-if="formError" type="warning" class="schedule-form-error" data-testid="schedule-form-error">
          {{ formError }}
        </NAlert>

        <NSpace>
          <NButton
            type="primary"
            :loading="saving"
            data-testid="schedule-submit"
            @click="submit"
          >
            {{ editingId === null ? '创建' : '保存' }}
          </NButton>
          <NButton quaternary data-testid="schedule-cancel" @click="formOpen = false">取消</NButton>
        </NSpace>
      </NForm>
    </NModal>
  </NCard>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import {
  NAlert,
  NButton,
  NCard,
  NEmpty,
  NForm,
  NFormItem,
  NInput,
  NModal,
  NPopconfirm,
  NSelect,
  NSpace,
  NSwitch,
  NTag,
  NText,
} from 'naive-ui'
import { useSyncStore, visibleNextRun } from '@/stores/sync'
import { apiMessage } from '@/utils/apiMessage'
import { jobStatusTagType, jobStatusText } from '@/utils/jobActions'
import type { SyncSchedule, UpsertScheduleRequest } from '@/types/sync'

/**
 * 排程区（A-08 断言 2）：CRUD + toggle + run-now，七条端点全部可达。
 *
 * 三条不在直觉里的口径，都来自 2026-10-14 的实测而不是猜：
 *  1. **next_run_at 停用后不清**（core SYNC-03）⇒ 显示与否只走 store 的
 *     `visibleNextRun`，一行代码一个闸门，不在行模板里各自 `v-if`。
 *  2. **is_active 省略 = 建出来就是停用的**：后端绑整个 Schedule 结构体，省略即
 *     Go 零值 false，尽管数据库列默认 true。表单因此永远显式发送它。
 *  3. **name 有唯一约束**（`sync_schedules_name_uniq`）⇒ 重名是真实失败路径，
 *     错误原样显示（同 cron 非法一样透传），不做前端预检去猜后端的库状态。
 *
 * run-now 之后不是弹一句"已触发"就算：store 把那条新作业 upsert 进队列（不重读
 * 整张列表，免得把用户选的筛选与页宽冲掉），这里再把视图滚到那一行上——
 * 判据是"队列里出现了它"，不是"接口返回了 202"。
 */
const store = useSyncStore()

const formOpen = ref(false)
const saving = ref(false)
const formError = ref('')
const editingId = ref<number | null>(null)

const formState = reactive({
  name: '',
  description: '',
  job_type: 'ohlcv',
  cron_expression: '',
  paramsText: '',
  is_active: true,
})

const jobTypeOptions = computed(() => {
  const registered = store.workerStats?.registered_types ?? []
  const known = registered.length ? registered : ['ohlcv', 'stocks', 'fundamentals', 'calendar']
  return [...new Set(known)].sort().map((value) => ({ label: value, value }))
})

function formatTime(value?: string | null): string {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString()
}

/** 停用排程即使带着残留 next_run_at 也显示「—」，闸门在 store 的 visibleNextRun。 */
function formatNext(row: SyncSchedule): string {
  const next = visibleNextRun(row)
  return next ? formatTime(next) : '—'
}

async function reload() {
  await store.fetchSchedules().catch(() => undefined)
  // fetchStats 设计上不抛（两腿独立，失败进 statsError），所以这里不挂 catch。
  await store.fetchStats()
}

function openCreate() {
  editingId.value = null
  formError.value = ''
  Object.assign(formState, {
    name: '',
    description: '',
    // 默认值取 ohlcv（这是这台实验室最常用的排程），而不是注册表排序后的第一个
    // —— 后者会跟着后端注册类型变化把默认项悄悄改掉，用户没动它却建出别的类型。
    job_type: jobTypeOptions.value.some((o) => o.value === 'ohlcv')
      ? 'ohlcv'
      : (jobTypeOptions.value[0]?.value ?? 'ohlcv'),
    cron_expression: '',
    paramsText: '',
    is_active: true,
  })
  formOpen.value = true
}

function openEdit(row: SyncSchedule) {
  editingId.value = row.id
  formError.value = ''
  Object.assign(formState, {
    name: row.name,
    description: row.description ?? '',
    job_type: row.job_type,
    cron_expression: row.cron_expression,
    paramsText: row.params ? JSON.stringify(row.params, null, 2) : '',
    is_active: row.is_active,
  })
  formOpen.value = true
}

function buildRequest(): UpsertScheduleRequest | null {
  if (!formState.name.trim() || !formState.cron_expression.trim() || !formState.job_type) {
    formError.value = '名称、Cron、作业类型都不能为空（后端同样会拒，这里只是少跑一趟）'
    return null
  }
  let params: Record<string, unknown> = {}
  const raw = formState.paramsText.trim()
  if (raw) {
    try {
      const parsed = JSON.parse(raw)
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        formError.value = '参数必须是 JSON 对象，例如 {"symbols": ["000001.SZ"]}'
        return null
      }
      params = parsed as Record<string, unknown>
    } catch {
      // JSON 语法只能在这里判——送不出去的东西谈不上后端校验。
      formError.value = '参数不是合法 JSON，请检查引号与逗号'
      return null
    }
  }
  return {
    name: formState.name.trim(),
    description: formState.description.trim() || undefined,
    job_type: formState.job_type,
    cron_expression: formState.cron_expression.trim(),
    params,
    // 永远显式发送：省略会被后端绑成 Go 零值 false，建出来就是停用的。
    is_active: formState.is_active,
  }
}

async function submit() {
  const request = buildRequest()
  if (!request) return
  formError.value = ''
  saving.value = true
  try {
    if (editingId.value === null) {
      await store.createSchedule(request)
    } else {
      await store.updateSchedule(editingId.value, request)
    }
    formOpen.value = false
  } catch (err) {
    // cron 非法 / 重名 / 任何后端 4xx：显示原话，不改写、不翻译。
    // （client.ts 会把 ApiError.message 换成按状态码查表的通用文案，
    //   原话只剩在 ApiError.body 里 —— apiMessage 就是去把它捞回来。）
    formError.value = apiMessage(err, '保存失败')
  } finally {
    saving.value = false
  }
}

async function toggle(row: SyncSchedule) {
  await store.toggleSchedule(row.id, !row.is_active).catch(() => undefined)
}

async function runNow(row: SyncSchedule) {
  try {
    const jobId = await store.runScheduleNow(row.id)
    // 判据是队列里真的出现了这条作业。
    const el = document.querySelector(`[data-testid="queue-row-${jobId}"]`)
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'center' })
  } catch {
    // store.schedulesError 已在告警条里
  }
}

async function remove(row: SyncSchedule) {
  await store.deleteSchedule(row.id).catch(() => undefined)
}

onMounted(reload)
</script>

<style scoped>
/* token 只用 variables.css 里真实存在的（--q-font-micro / --q-weight-medium 是幻影）。 */
.schedule-error {
  margin-bottom: 12px;
}

.schedule-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.schedule-table th,
.schedule-table td {
  text-align: left;
  padding: 6px 8px;
  border-bottom: 1px solid var(--q-border);
  vertical-align: middle;
}

.schedule-table th {
  color: var(--q-text3);
  font-weight: 600;
  font-size: 12px;
}

.schedule-cron {
  font-family: var(--q-mono);
  color: var(--q-text2);
  white-space: nowrap;
}

.schedule-next {
  color: var(--q-text2);
  white-space: nowrap;
}

.schedule-last-status {
  margin-left: 6px;
}

.schedule-note {
  display: block;
  margin-top: 12px;
  font-size: 12px;
}

.schedule-form-error {
  margin-bottom: 12px;
}
</style>
