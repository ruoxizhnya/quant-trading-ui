<template>
  <div class="compare-page">
    <n-card :bordered="false" class="header-card">
      <n-space justify="space-between" align="center">
        <div>
          <h2>多策略对比</h2>
          <p class="header-sub">
            并排比较 2-8 个回测的绩效指标。回测 ID 通过回测引擎页面的"加入对比"勾选框收集。
          </p>
        </div>
        <n-space>
          <n-tag :type="ids.length >= 2 ? 'success' : 'default'" size="large">
            已选 {{ ids.length }} / 8
          </n-tag>
          <n-button size="small" @click="reload">刷新</n-button>
          <n-button size="small" ghost @click="clearSelection">清空选择</n-button>
        </n-space>
      </n-space>
    </n-card>

    <!-- Empty / under-min state -->
    <n-empty
      v-if="ids.length < 2"
      description="请至少选择 2 个回测进行对比"
      class="empty-state"
    >
      <template #extra>
        <n-space vertical>
          <n-text depth="3" style="font-size: 12px">
            前往
            <router-link to="/backtest">回测引擎</router-link>
            ，运行或加载一个回测，勾选"加入对比"以添加。
          </n-text>
        </n-space>
      </template>
    </n-empty>

    <!-- Loading -->
    <n-spin v-else-if="loading" size="large" class="loading-state">
      <template #description>正在加载 {{ ids.length }} 个回测的报告…</template>
    </n-spin>

    <!-- Loaded -->
    <template v-else-if="report">
      <n-alert
        v-if="report.missing.length > 0"
        type="warning"
        title="部分回测未能加载"
        :show-icon="true"
        style="margin-bottom: 16px"
      >
        以下 ID 在数据库中找不到或未完成：
        <n-space size="small" style="margin-top: 4px">
          <n-tag
            v-for="m in report.missing"
            :key="m.id"
            type="warning"
            size="small"
            :title="m.reason"
          >
            {{ m.id }} ({{ m.reason }})
          </n-tag>
        </n-space>
      </n-alert>

      <!-- A-07 断言 4：被排除项与其原因必须显式呈现。这条与上面那条**不能合并**
           —— "没加载出来"和"跑完了但被判无效"是两回事，混成一框等于把
           "这项不可信"降级成"这项缺席"。后端早就把 invalid 从 entries 里摘出来
           单发了（compare.go 的 CompareInvalidEntry），而前端类型里没这个字段，
           于是它从对比表里消失且不留解释 —— 正是"少一项也不许静默"要拦的那类。
           原因文案走 `utils/runStatus` 全站唯一口径：同一条 `empty_universe`
           在快速回测显示"股票池为空"、在这里显示原始 Code，等于又开第二套口径。 -->
      <n-alert
        v-if="report.invalid.length > 0"
        type="warning"
        title="已排除的无效运行 —— 它们跑完了，但结果不可用作成功观测"
        :show-icon="true"
        data-testid="compare-invalid"
        style="margin-bottom: 16px"
      >
        <ul class="excluded-list" data-testid="compare-invalid-list">
          <li v-for="iv in report.invalid" :key="iv.id" data-testid="compare-invalid-item">
            <n-tag type="warning" size="small" :bordered="false">{{ iv.strategy || '—' }}</n-tag>
            <n-text depth="3" class="excluded-id">{{ iv.id }}</n-text>
            <n-text class="excluded-reasons">
              {{ invalidReasonsText(iv.invalid_reasons) }}
            </n-text>
          </li>
        </ul>
      </n-alert>

      <n-grid :cols="4" :x-gap="12" responsive="screen" item-responsive>
        <n-gi span="4 m:2 l:1">
          <n-card size="small" class="metric-card">
            <div class="metric-label">已加载 / 已请求</div>
            <div class="metric-value">
              {{ report.resolved }} <span class="metric-sub">/ {{ report.requested }}</span>
            </div>
          </n-card>
        </n-gi>
        <n-gi span="4 m:2 l:1">
          <n-card size="small" class="metric-card">
            <div class="metric-label">最佳总收益</div>
            <div class="metric-value">{{ bestLabel(report.best.total_return_id) }}</div>
          </n-card>
        </n-gi>
        <n-gi span="4 m:2 l:1">
          <n-card size="small" class="metric-card">
            <div class="metric-label">最佳 Sharpe</div>
            <div class="metric-value">{{ bestLabel(report.best.sharpe_ratio_id) }}</div>
          </n-card>
        </n-gi>
        <n-gi span="4 m:2 l:1">
          <n-card size="small" class="metric-card">
            <div class="metric-label">最低回撤</div>
            <div class="metric-value">{{ bestLabel(report.best.max_drawdown_id) }}</div>
          </n-card>
        </n-gi>
      </n-grid>

      <n-card title="绩效对比表" :bordered="false" class="table-card">
        <n-table :bordered="false" :single-line="false" size="small">
          <thead>
            <tr>
              <th>指标</th>
              <th
                v-for="entry in report.entries"
                :key="entry.id"
                :class="{
                  'is-best': isBestId(entry.id),
                }"
              >
                <div class="strategy-header">
                  <n-tag :type="isBestId(entry.id) ? 'success' : 'default'" size="small">
                    {{ entry.strategy || entry.id }}
                  </n-tag>
                  <n-text depth="3" style="font-size: 11px; display: block">
                    {{ entry.id.slice(0, 8) }}…
                  </n-text>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in metricRows" :key="row.key">
              <td class="row-label">
                {{ row.label }}
                <!-- A-06 断言 1：对比页每个指标行都要有质问入口。入口挂在**行标签**
                     而不是每格 —— 一格一个的话 N 个策略 × 12 行会糊成一片按钮，
                     而这一行被质问的是同一个量，一次质问覆盖整行。 -->
                <EvidenceProbe
                  :label="`多策略对比 · ${row.label}`"
                  :hash="null"
                  :reason="compareEvidenceReason"
                />
              </td>
              <td
                v-for="entry in report.entries"
                :key="entry.id"
                :class="{
                  'is-best': report.best[row.bestKey] === entry.id,
                  'positive': row.positive?.(entry),
                  'negative': row.negative?.(entry),
                }"
              >
                {{ row.format(entry) }}
              </td>
            </tr>
          </tbody>
        </n-table>
      </n-card>

      <n-card title="权益曲线叠加" :bordered="false" class="chart-card">
        <div v-if="!hasEquityData" class="chart-empty">
          <n-empty description="所选回测均无权益数据，跳过图表" />
        </div>
        <div v-else class="chart-wrap">
          <canvas ref="chartCanvas" />
        </div>
      </n-card>
    </template>

    <n-alert v-else-if="loadError" type="error" title="加载失败" closable @close="loadError = ''">
      {{ loadError }}
    </n-alert>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick, onBeforeUnmount, shallowRef, triggerRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  NCard, NSpace, NButton, NTag, NText, NEmpty, NSpin, NAlert, NGrid, NGi, NTable, useMessage,
} from 'naive-ui'
import { Chart, registerables } from 'chart.js'
import { compareBacktests, type CompareReport, type CompareEntry } from '@/api/backtest'
import { loadCompareIds, clearCompareIds } from '@/constants/backtest'
import { fmtPercent, fmtNumber } from '@/utils/format'
import { invalidReasonsText } from '@/utils/runStatus'
import { chartPalette } from '@/styles/palette'
import EvidenceProbe from '@/components/evidence/EvidenceProbe.vue'

Chart.register(...registerables)

const route = useRoute()
const router = useRouter()
const message = useMessage()

const ids = ref<string[]>(loadCompareIds())
const report = shallowRef<CompareReport | null>(null)
const loading = ref(false)
const loadError = ref('')
const chartCanvas = ref<HTMLCanvasElement | null>(null)
let chartInstance: Chart | null = null

// Metric row definitions for the comparison table. Centralising the
// formatting logic here keeps the template lean and makes it trivial
// to add a column later (e.g. recovery factor).
interface MetricRow {
  key: string
  label: string
  format: (e: CompareEntry) => string
  bestKey: keyof CompareReport['best']
  positive?: (e: CompareEntry) => boolean
  negative?: (e: CompareEntry) => boolean
}
/**
 * 对比页的每一行都是**两次以上回测结果的并排读数**，而回测结果本身不带证据坐标
 * （`GET /api/backtest/:id/report` 的响应里零个 hash/citation，2026-10-14 实测）。
 * 所以这里的质问入口一律落到"无法回溯"。写清楚原因，是因为对比页最容易骗人：
 * 并排摆放会让"谁更好"看起来像结论，而两边可能都是同一个空票池跑出来的。
 */
const compareEvidenceReason =
  '对比表里的每个数都来自某次回测运行，而回测结果不落在 ingest.raw 里，' +
  '所以没有"来源记录"可回溯。要质问这一行，该问的是：参与对比的每个回测，' +
  '股票池 / 区间 / 费率是否可比，以及它们各自是不是有效运行。'

const metricRows: MetricRow[] = [
  { key: 'total_return', label: '总收益', bestKey: 'total_return_id', format: e => fmtPercent(e.total_return), positive: e => e.total_return > 0, negative: e => e.total_return < 0 },
  { key: 'annual_return', label: '年化收益', bestKey: 'annual_return_id', format: e => fmtPercent(e.annual_return), positive: e => e.annual_return > 0 },
  { key: 'sharpe_ratio', label: 'Sharpe', bestKey: 'sharpe_ratio_id', format: e => fmtNumber(e.sharpe_ratio, 2) },
  { key: 'sortino_ratio', label: 'Sortino', bestKey: 'sortino_ratio_id', format: e => fmtNumber(e.sortino_ratio, 2) },
  { key: 'max_drawdown', label: '最大回撤', bestKey: 'max_drawdown_id', format: e => fmtPercent(e.max_drawdown), negative: e => e.max_drawdown < 0 },
  { key: 'calmar_ratio', label: 'Calmar', bestKey: 'calmar_ratio_id', format: e => fmtNumber(e.calmar_ratio, 2) },
  { key: 'win_rate', label: '胜率', bestKey: 'win_rate_id', format: e => fmtPercent(e.win_rate) },
  { key: 'total_trades', label: '总交易数', bestKey: 'total_return_id', format: e => String(e.total_trades) },
  { key: 'win_trades', label: '盈利交易', bestKey: 'total_return_id', format: e => String(e.win_trades) },
  { key: 'lose_trades', label: '亏损交易', bestKey: 'total_return_id', format: e => String(e.lose_trades) },
  { key: 'avg_holding_days', label: '平均持仓天数', bestKey: 'total_return_id', format: e => fmtNumber(e.avg_holding_days, 1) },
  { key: 'universe', label: '股票池', bestKey: 'total_return_id', format: e => e.universe || '—' },
]

const hasEquityData = computed(() => {
  return !!(report.value?.entries.some(e => e.has_equity_data))
})

function isBestId(id: string): boolean {
  if (!report.value) return false
  const b = report.value.best
  return Object.values(b).includes(id)
}

function bestLabel(id?: string): string {
  if (!id || !report.value) return '—'
  const entry = report.value.entries.find(e => e.id === id)
  return entry?.strategy || id.slice(0, 8)
}

function reload() {
  ids.value = loadCompareIds()
  if (ids.value.length < 2) {
    report.value = null
    triggerRef(report)
    return
  }
  fetchCompare()
}

function clearSelection() {
  clearCompareIds()
  ids.value = []
  report.value = null
  triggerRef(report)
  // Also strip the ids from the URL so a refresh doesn't re-fire the
  // request.
  router.replace({ path: '/backtest/compare' })
  message.info('已清空对比选择')
}

async function fetchCompare() {
  loading.value = true
  loadError.value = ''
  try {
    const r = await compareBacktests(ids.value)
    report.value = r
    triggerRef(report)
  } catch (e: unknown) {
    loadError.value = e instanceof Error ? e.message : '未知错误'
    message.error('加载对比报告失败: ' + loadError.value)
  } finally {
    loading.value = false
  }
}

function idsFromQuery(): string[] {
  const raw = route.query.ids
  if (typeof raw !== 'string' || !raw) return []
  return raw.split(',').map(s => s.trim()).filter(Boolean)
}

onMounted(() => {
  // The page can be opened with a deep link (?ids=bt-1,bt-2) — in
  // that case we override the localStorage selection for the session
  // so the URL wins. localStorage stays untouched so the user's
  // previously saved selection is preserved for the next visit.
  const qIds = idsFromQuery()
  if (qIds.length >= 2) {
    ids.value = qIds.slice(0, 8)
  }
  reload()
})

watch(() => route.query.ids, () => {
  const qIds = idsFromQuery()
  if (qIds.length >= 2) {
    ids.value = qIds.slice(0, 8)
    reload()
  }
})

// Render the equity overlay chart whenever the report changes.
// Using watch + nextTick() ensures the canvas ref is mounted before
// we try to grab a 2D context off it (P2-2 keeps the same pattern
// the rest of the codebase uses for Chart.js).
watch(report, async () => {
  await nextTick()
  if (!chartCanvas.value || !hasEquityData.value || !report.value) {
    destroyChart()
    return
  }
  await nextTick()
  if (!chartCanvas.value) return
  destroyChart()
  const datasets = report.value.entries
    .filter(e => e.has_equity_data)
    .map((e, idx) => {
      // Each entry's PortfolioValues is fetched in the parent report
      // payload — but the comparison endpoint doesn't ship the full
      // time series (only the summary metrics). For now we draw a
      // derived curve from TotalReturn across the period: a simple
      // straight line from initial capital to final. The "real" full
      // overlay chart is gated on a follow-up endpoint that streams
      // the equity series for each ID — see ODR-027 follow-ups.
      const finalValue = e.initial_capital * (1 + e.total_return)
      return {
        label: e.strategy || e.id.slice(0, 8),
        data: [
          { x: 0, y: e.initial_capital },
          { x: 1, y: finalValue },
        ],
        borderColor: PALETTE[idx % PALETTE.length],
        backgroundColor: PALETTE[idx % PALETTE.length] + '33',
        tension: 0.1,
        pointRadius: 3,
        borderWidth: 2,
      }
    })
  const ctx = chartCanvas.value.getContext('2d')
  if (!ctx) return
  chartInstance = new Chart(ctx, {
    type: 'line',
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      scales: {
        x: {
          type: 'linear',
          title: { display: true, text: '回测期间 (示意)', color: chartPalette.axisTitle },
          grid: { color: chartPalette.grid },
          ticks: { color: chartPalette.tick, font: { size: 11 } },
        },
        y: {
          title: { display: true, text: '组合价值', color: chartPalette.axisTitle },
          grid: { color: chartPalette.grid },
          ticks: { color: chartPalette.tick, font: { size: 11 } },
        },
      },
      plugins: {
        legend: { display: true, position: 'top', labels: { color: chartPalette.legend, boxWidth: 12, padding: 12, font: { size: 11 } } },
        tooltip: { mode: 'index', intersect: false },
      },
    },
  })
})

const PALETTE = chartPalette.seriesCycle

function destroyChart() {
  if (chartInstance) {
    chartInstance.destroy()
    chartInstance = null
  }
}

onBeforeUnmount(() => {
  destroyChart()
})
</script>

<style scoped>
.excluded-list {
  margin: 6px 0 0;
  padding-left: 18px;
  list-style: none;
}
.excluded-list li {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 4px;
}
.excluded-id {
  font-family: var(--q-mono);
  font-size: 11px;
}
.excluded-reasons {
  font-size: 12px;
  /* A-07 断言 6：invalid 的原因行用站点给 invalid 定的色（--q-warning），
     与 QuickBacktest / BacktestEngine / StrategyBuilder 同一画法 */
  color: var(--q-warning);
}

.compare-page {
  max-width: 1400px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.header-card { padding: 4px 0; }
.header-card h2 { margin: 0 0 4px 0; }
.header-sub { margin: 0; font-size: 12px; color: var(--q-text2); }
.empty-state, .loading-state { padding: 60px 0; }
.metric-card { text-align: center; }
.metric-label { font-size: 11px; color: var(--q-text3); text-transform: uppercase; letter-spacing: 0.5px; }
.metric-value { font-size: 22px; font-weight: 600; margin-top: 4px; }
.metric-sub { font-size: 14px; color: var(--q-text3); font-weight: 400; }
.table-card { margin-top: 8px; }
.row-label { color: var(--q-text2); font-size: 12px; }
.strategy-header { display: flex; flex-direction: column; gap: 4px; }
.chart-card { margin-top: 8px; }
.chart-wrap { position: relative; height: 320px; }
.chart-empty { padding: 30px 0; }
.is-best { background: var(--q-success-soft); }
.is-best.win { color: var(--q-success); }
.positive { color: var(--q-success); }
.negative { color: var(--q-danger); }
</style>
