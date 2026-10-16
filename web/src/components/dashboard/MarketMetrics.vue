<template>
  <n-card title="市场概览">
    <div class="market-header">
      <span class="greeting">{{ greeting }}</span>
      <n-space align="center" :size="12">
        <!-- DATA-11 自审补的一处：这个日期框原来**可以清空**（naive-ui 的
             n-date-picker 默认 clearable），清空后 formatted-value 变成 null，
             `getMarketIndex` 里的 `if (date)` 就把参数省掉 ⇒ 屏上仍是最新一期，
             而框里什么日期都没有 —— 一个说不清「这一格是哪一天的」的形状。
             参数化之前它本来就不影响读数，看不出问题；现在影响了，所以关掉清空。
             顺手按 vue/max-attributes-per-line 把这一枚标签拆成多行（同条警告 −4）。 -->
        <n-date-picker
          :formatted-value="selectedDate"
          :clearable="false"
          type="date"
          value-format="yyyy-MM-dd"
          size="small"
          @update:formatted-value="$emit('update:selectedDate', $event)"
        />
        <n-select :value="selectedIndex" :options="indexOptions" size="small" style="width: 120px" @update:value="$emit('update:selectedIndex', $event)" />
        <n-button quaternary size="tiny" @click="$emit('refresh')">
          <template #icon><n-icon><RefreshOutline /></n-icon></template>
        </n-button>
      </n-space>
    </div>

    <n-spin :show="loading">
      <!-- DATA-07（2026-10-16）：没有读数时给**显式空态 + 指名工单**，并且两种成因分开说：
           「这次请求没成功」与「接口确实回了空数组」不是同一件事，共用一句文案就等于
           在失败时谎称"今天没有行情"。旧形状是四格各回一个 '-'，谁都分不清；口径照
           A-08 对 DataQualityPanel 的裁决与作业控制台那条「空态分句」——缺口用显式空态
           表达，不造一行数，也不把 '-' 说成数据。 -->
      <div
        v-if="!metrics"
        class="metrics-empty"
      >
        <n-space
          align="center"
          :size="8"
        >
          <n-tag
            :type="fetchFailed ? 'error' : 'warning'"
            size="small"
          >
            {{ emptyTag }}
          </n-tag>
          <n-text class="empty-text">
            {{ emptyText }}
          </n-text>
        </n-space>
        <n-text
          depth="3"
          class="empty-note"
        >
          {{ emptyNote }}
        </n-text>
      </div>
      <div
        v-else
        class="metrics-row"
      >
        <div class="metric-item">
          <span class="metric-label">收盘价</span>
          <span class="metric-val">{{ fmtNumber(metrics.close, 2) }}</span>
        </div>
        <div class="metric-item">
          <span class="metric-label">涨跌幅</span>
          <span class="metric-val" :class="pctClass(metrics)">{{ pctText(metrics) }}</span>
        </div>
        <div class="metric-item">
          <span class="metric-label">成交量</span>
          <span class="metric-val">{{ fmtVolume(metrics.volume) }}</span>
        </div>
        <div class="metric-item">
          <span class="metric-label">成交额</span>
          <span class="metric-val">{{ metrics.amount == null ? '未读取' : `${fmtAmount(metrics.amount)}亿` }}</span>
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
import { MARKET_INDEX_OPTIONS } from '@/utils/marketReadout'
import type { MarketIndex } from '@/types/api'

/**
 * `metrics` 现在是一条真读数，或 `null`（库里没有指数日线 / 接口回空数组 / 请求失败）。
 *
 * 旧签名是 `metrics: Record<string, any>`：`any` 把「后端从来没给 volume/amount」
 * 和「后端给了但你没接住」两种情况压成同一个形状，界面于是恒显示 '-' 而没人报错
 * （DATA-07 的缺陷本体）。改成 `MarketIndex | null` 后，字段名与可空性由
 * `types/api.ts` 与 core 的实测契约共同把关。
 *
 * `fetchFailed` 把 `null` 的两种成因分开：**这次请求没成功**（后端不可达、回包不合
 * 形状、或没给回点名的那一个指数）与**接口确实回了空数组**（库里那个指数代码 0 行）。共用一句文案就等于在
 * 失败时谎称「今天没有行情」，而调用方是知道这两件事的（`Dashboard.vue` 分别置位），
 * 所以这个信息不该在组件里被抹平。默认按「空数组」讲：没传这个 prop 的调用方，
 * 最坏的误读是"数据还没有"，而不是把一个坏掉的后端说成"今天没行情"以外的东西。
 */
const props = defineProps<{
  selectedDate: string
  selectedIndex: string
  loading: boolean
  metrics: MarketIndex | null
  fetchFailed?: boolean
}>()

const emit = defineEmits<{
  'update:selectedDate': [value: string]
  'update:selectedIndex': [value: string]
  refresh: []
}>()

/**
 * 空态三句（标签 / 事实 / 下一步），随「失败」与「确实没有」切换。
 *
 * 「失败」这一支在 DATA-11 之后多了一种成因：回包里有条目，但**没有点名的那一条**
 * —— core 答应按 `?symbol` 给数却没给，那是契约违约，跟「库里 0 行」不是一件事，
 * 所以归到"没读到"这一句里，不让它借用「确实没有」那句诚实读数（口径同 DATA-07）。
 */
const emptyTag = computed(() => (props.fetchFailed ? '读数失败' : '无指数数据'))
const emptyText = computed(() =>
  props.fetchFailed
    ? '这次请求没成功：后端不可达、回包不合形状，或没给回你点名的那一个指数，不是今天没有行情'
    : `接口对 ${props.selectedIndex} 回了空数组：这个指数代码在日线表里 0 行`,
)
const emptyNote = computed(() =>
  props.fetchFailed
    ? '重试或看后端日志。前端不拿上一帧旧数据顶上去，也不把失败写成"今天没行情"。'
    : '补指数 bar 需要新数据源（tushare index_daily）与建表，已登记为 core 工单 DATA-12（2026-10-16 主任已批准新源与建表）。前端不造数据，也不拿别处的数凑这一格。',
)

/**
 * 涨跌幅按**百分数刻度**渲染（core 的 `pct` 已经是 1.23 == +1.23%）。
 *
 * 这里刻意不走 `fmtPercent`：那个函数假定入参是小数比例、自己再乘 100，
 * 拿它接 `pct` 会把 +1.23% 显示成 +123.00%。旧代码读的根本不是 `pct` 而是
 * `metrics.change_pct`（后端从来没发过这个键），所以这个 100 倍错配一直没暴露。
 * null 显示「未读取」：没有上一期收盘时涨跌幅无从算起，不是 0%。
 * 入参只可能是非 null（模板里这条分支在 `v-else`，metrics 已被收窄）；
 * 也不防 NaN —— JSON 里带不出 NaN（Go 侧 marshal 直接报错），加那个分支是防空转。
 */
function pctText(metrics: MarketIndex): string {
  const pct = metrics.pct
  if (pct == null) return '未读取'
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`
}

function pctClass(metrics: MarketIndex): string {
  const pct = metrics.pct
  if (pct == null) return ''
  return pct >= 0 ? 'up' : 'down'
}

// 下拉候选 = core 的服务集，收在 utils/marketReadout.ts 一处（理由与已知代价见那里）。
const indexOptions = MARKET_INDEX_OPTIONS

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
