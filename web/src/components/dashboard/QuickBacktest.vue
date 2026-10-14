<template>
  <n-card title="快速回测">
    <n-form inline label-placement="left" label-width="auto" size="small">
      <n-form-item label="策略">
        <n-select :value="strategy" :options="strategyOptions" size="small" style="width: 140px" @update:value="$emit('update:strategy', $event)" />
      </n-form-item>
      <n-form-item label="标的">
        <n-input :value="stock" placeholder="600000.SH" size="small" style="width: 130px" @update:value="$emit('update:stock', $event)" />
      </n-form-item>
      <n-form-item label="起止">
        <n-date-picker :formatted-value="startDate" type="date" value-format="yyyy-MM-dd" size="small" style="width: 120px" @update:formatted-value="$emit('update:startDate', $event)" />
        <span style="margin: 0 4px; line-height: 28px;">~</span>
        <n-date-picker :formatted-value="endDate" type="date" value-format="yyyy-MM-dd" size="small" style="width: 120px" @update:formatted-value="$emit('update:endDate', $event)" />
      </n-form-item>
      <n-form-item>
        <n-button type="primary" size="small" :loading="running" @click="$emit('run')">运行</n-button>
      </n-form-item>
    </n-form>
    <!-- A-07：三值各有独立形态。判据是 status 本身 —— 有 id、有数字都不构成
         "这次成功"。invalid 必须**警示样式 + 列出 invalid_reasons**，
         failed 必须**不显示指标**（那些字段是零值或垃圾值，摆出来就是伪造观测）。 -->
    <div v-if="quickResult" class="quick-result">
      <template v-if="quickResult.status === 'invalid'">
        <n-tag round :bordered="false" type="warning" size="small" data-testid="quick-invalid">
          无效运行
        </n-tag>
        <n-text class="quick-reasons quick-invalid-reasons" data-testid="quick-invalid-reasons">
          {{ invalidReasonsText }}
        </n-text>
      </template>
      <template v-else-if="quickResult.status === 'failed'">
        <n-tag round :bordered="false" type="error" size="small" data-testid="quick-failed">
          回测失败
        </n-tag>
        <n-text class="quick-reasons" data-testid="quick-failed-error">
          {{ quickResult.error || '后端未给出原因' }}
        </n-text>
      </template>
      <!-- completed 是**显式匹配**，不是 else。写成 else 的话，status 缺失或
           出现第四种值都会默认落进"成功"那一支，摆出两个指标 —— 那等于用
           "没说不行"当"行"，正是 K9 要收掉的那类默认。 -->
      <template v-else-if="quickResult.status === 'completed'">
        <n-tag round :bordered="false" :type="(quickResult.total_return ?? 0) >= 0 ? 'success' : 'error'" size="small">
          收益 {{ fmtPercent(quickResult.total_return) }}
        </n-tag>
        <n-tag round :bordered="false" size="small">
          夏普 {{ fmtNumber(quickResult.sharpe_ratio, 2) }}
        </n-tag>
      </template>
      <template v-else>
        <n-tag round :bordered="false" :type="unknownTag.type" size="small" data-testid="quick-unknown-status">
          {{ unknownTag.label }}
        </n-tag>
        <n-text class="quick-reasons" data-testid="quick-unknown-status-detail">
          这次运行没有报出可识别的状态（收到 {{ String(quickResult.status ?? '（空）') }}），
          因此不显示任何指标 —— 不拿"没说不行"当"行"。
        </n-text>
      </template>
      <n-button quaternary size="tiny" type="primary" @click="$emit('view-report', quickResult.id)">查看报告</n-button>
    </div>
  </n-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { NCard, NForm, NFormItem, NSelect, NInput, NDatePicker, NButton, NTag, NText } from 'naive-ui'
import { fmtPercent, fmtNumber } from '@/utils/format'
import { invalidReasonsText as reasonsText, statusTagFor } from '@/utils/runStatus'
import type { BacktestResult } from '@/types/api'

/**
 * 快速回测的结果直接用 `BacktestResult`，不再投影成三字段的小对象。
 *
 * 原先这里和 `pages/Dashboard.vue` 各写了一份 `interface QuickResult { id;
 * total_return?; sharpe_ratio? }` —— 两份同构、都**没有 status**。投影掉
 * status 的代价不是少显示一个标签，而是 `status=invalid` 的运行会带着
 * 0 / 垃圾指标进到这个卡片，被渲染成一枚绿色"收益 +0.00%"，与一次真成功的
 * 回测**逐像素相同**。K9 要的正是"判据是 status 本身"，字段被投影丢掉之后
 * 判据就不存在了。
 */
const props = defineProps<{
  strategy: string
  stock: string
  startDate: string
  endDate: string
  running: boolean
  strategies: string[]
  quickResult: BacktestResult | null
}>()

const emit = defineEmits<{
  'update:strategy': [value: string]
  'update:stock': [value: string]
  'update:startDate': [value: string]
  'update:endDate': [value: string]
  run: []
  'view-report': [id: string]
}>()

const strategyOptions = computed(() =>
  props.strategies.map(s => ({ label: s, value: s }))
)

/** 无效原因的人话化走全站唯一口径（`utils/runStatus`），不在组件里另写一份 */
const invalidReasonsText = computed(() => reasonsText(props.quickResult?.invalid_reasons))

/**
 * 未知态的措辞与颜色也从同一张表取（`statusTagFor`）—— 这个分支只在
 * status 缺失或是第四种值时才可达，所以拿到的必然是"未知状态"那一格。
 * 原先这里自己写了一句「状态未知」，与列表/详情页的「未知状态」是同一概念
 * 两种写法，正是 A-07 要收的东西。
 */
const unknownTag = computed(() => statusTagFor(props.quickResult?.status))
</script>

<style scoped>
.quick-result {
  display: flex;
  gap: 8px;
  align-items: center;
  /* 无效原因是一句话，窄卡里需要换行，否则和标签挤在同一行读不全 */
  flex-wrap: wrap;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--q-border-light);
}

.quick-reasons {
  font-size: 12px;
  color: var(--q-text2);
  min-width: 0;
}

/* A-07 断言 6：invalid 的原因行走站点给 invalid 定的那个色。
   说准确一点：那枚"无效运行"标签**本来就已经**是这个色了 —— `palette.ts`
   把 `warning: '#f59e0b'` 经 `App.vue` 的 themeOverrides 喂给 naive-ui
   （variables.css 与 palette.ts 是同一个值的两副面孔：组件库读不了 CSS 变量）。
   真正缺这一步的是**原因文本**：它原先跟着次级灰 `--q-text2`，而"为什么无效"
   恰恰是这一态里最该被看见的一句话。e2e 断的是浏览器里的**计算色**，
   不是"源码里 grep 得到 var(--q-warning)"。 */
.quick-invalid-reasons {
  color: var(--q-warning);
}
</style>
