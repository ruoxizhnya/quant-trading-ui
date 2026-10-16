<template>
  <n-card title="市场概览">
    <div class="market-header">
      <span class="greeting">{{ greeting }}</span>
      <n-space align="center" :size="12">
        <n-date-picker :formatted-value="selectedDate" type="date" value-format="yyyy-MM-dd" size="small" @update:formatted-value="$emit('update:selectedDate', $event)" />
        <n-select :value="selectedIndex" :options="indexOptions" size="small" style="width: 120px" @update:value="$emit('update:selectedIndex', $event)" />
        <n-button quaternary size="tiny" @click="$emit('refresh')">
          <template #icon><n-icon><RefreshOutline /></n-icon></template>
        </n-button>
      </n-space>
    </div>

    <n-spin :show="loading">
      <!-- DATA-07（2026-10-16）：库里没有指数日线时给**显式空态 + 指名工单**。
           旧形状是四格各回一个 '-'，读的人分不清「今天没行情」「接口没实现」
           「前端没接上」——与 A-08 对 DataQualityPanel 的裁决同一口径：
           缺口的正确表现是显式空态，不是造一行数、也不是把 '-' 说成数据。 -->
      <div
        v-if="!metrics"
        class="metrics-empty"
      >
        <n-space
          align="center"
          :size="8"
        >
          <n-tag
            type="warning"
            size="small"
          >
            无指数数据
          </n-tag>
          <n-text class="empty-text">
            接口实测回空数组：三个指数代码在日线表里 0 行
          </n-text>
        </n-space>
        <n-text
          depth="3"
          class="empty-note"
        >
          补指数 bar 需要新数据源（tushare index_daily）与建表，待主任批准后另立工单；
          前端不造数据，也不拿别处的数凑这一格。
        </n-text>
      </div>
      <div
        v-else
        class="metrics-row"
      >
        <div class="metric-item">
          <span class="metric-label">收盘价</span>
          <span class="metric-val">{{ fmtNumber(metrics!.close, 2) }}</span>
        </div>
        <div class="metric-item">
          <span class="metric-label">涨跌幅</span>
          <span class="metric-val" :class="pctClass(metrics)">{{ pctText(metrics) }}</span>
        </div>
        <div class="metric-item">
          <span class="metric-label">成交量</span>
          <span class="metric-val">{{ metrics!.volume == null ? '未读取' : fmtVolume(metrics!.volume) }}</span>
        </div>
        <div class="metric-item">
          <span class="metric-label">成交额</span>
          <span class="metric-val">{{ metrics!.amount == null ? '未读取' : `${fmtAmount(metrics!.amount)}亿` }}</span>
        </div>
      </div>
    </n-spin>
  </n-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { NCard, NSpace, NDatePicker, NSelect, NButton, NSpin, NIcon, NTag, NText } from 'naive-ui'
import { RefreshOutline } from '@vicons/ionicons5'
import { fmtVolume, fmtAmount, fmtNumber } from '@/utils/format'
import type { MarketIndex } from '@/types/api'

/**
 * `metrics` 现在是一条真读数，或 `null`（库里没有指数日线 / 接口回空数组）。
 *
 * 旧签名是 `metrics: Record<string, any>`：`any` 把「后端从来没给 volume/amount」
 * 和「后端给了但你没接住」两种情况压成同一个形状，界面于是恒显示 '-' 而没人报错
 * （DATA-07 的缺陷本体）。改成 `MarketIndex | null` 后，字段名与可空性由
 * `types/api.ts` 与 core 的实测契约共同把关。
 */
const props = defineProps<{
  selectedDate: string
  selectedIndex: string
  loading: boolean
  metrics: MarketIndex | null
}>()

const emit = defineEmits<{
  'update:selectedDate': [value: string]
  'update:selectedIndex': [value: string]
  refresh: []
}>()

// Expose formatters to template

/**
 * 涨跌幅按**百分数刻度**渲染（core 的 `pct` 已经是 1.23 == +1.23%）。
 *
 * 这里刻意不走 `fmtPercent`：那个函数假定入参是小数比例、自己再乘 100，
 * 拿它接 `pct` 会把 +1.23% 显示成 +123.00%。旧代码读的根本不是 `pct` 而是
 * `metrics.change_pct`（后端从来没发过这个键），所以这个 100 倍错配一直没暴露。
 * null 显示「未读取」：没有上一期收盘时涨跌幅无从算起，不是 0%。
 */
function pctText(metrics: MarketIndex | null): string {
  const pct = metrics?.pct
  if (pct == null || isNaN(pct)) return '未读取'
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`
}

function pctClass(metrics: MarketIndex | null): string {
  const pct = metrics?.pct
  if (pct == null || isNaN(pct)) return ''
  return pct >= 0 ? 'up' : 'down'
}

const indexOptions = [
  { label: '上证指数', value: '000001.SH' },
  { label: '深证成指', value: '399001.SZ' },
  { label: '创业板指', value: '399006.SZ' },
]

const greeting = computed(() => {
  const h = new Date().getHours()
  if (h < 11) return '早上好 👋'
  if (h < 14) return '中午好 ☀️'
  return '下午好 🌤'
})
</script>

<style scoped>
.market-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.greeting { font-size: 18px; font-weight: 700; color: var(--q-text); }
.metrics-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.metric-item {
  background: var(--q-surface2);
  border-radius: var(--q-radius-sm);
  padding: 14px 10px;
  text-align: center;
}
.metric-label { font-size: 11px; color: var(--q-text3); display: block; margin-bottom: 4px; }
.metric-val { font-size: 20px; font-weight: 700; color: var(--q-text); }
.metric-val.up { color: var(--q-success); }
.metric-val.down { color: var(--q-danger); }

/* 显式空态（DATA-07）：占位而不是四格 '-'，并留一行「为什么没有」的判读。 */
.metrics-empty {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 18px 14px;
  background: var(--q-surface2);
  border-radius: var(--q-radius-sm);
}
.empty-text { font-size: 13px; color: var(--q-text2); }
.empty-note { font-size: 12px; line-height: 1.6; }

@media (max-width: 768px) {
  .market-header { flex-direction: column; gap: 8px; align-items: flex-start; }
  .metrics-row { grid-template-columns: repeat(2, 1fr); }
}
</style>
