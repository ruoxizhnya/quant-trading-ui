<template>
  <div class="dashboard-page">
    <MarketMetrics
      v-model:selected-date="selectedDate"
      v-model:selected-index="selectedIndex"
      :loading="marketLoading"
      :metrics="marketMetrics"
      :fetch-failed="marketFetchFailed"
      @refresh="fetchMarketData"
    />

    <QuickBacktest
      v-model:strategy="quickForm.strategy"
      v-model:stock="quickForm.stock"
      v-model:start-date="quickForm.startDate"
      v-model:end-date="quickForm.endDate"
      :running="quickRunning"
      :strategies="strategiesCache"
      :quick-result="quickResult"
      @run="runQuickBacktest"
      @view-report="(id: string) => router.push({ path: '/backtest', query: { id } })"
    />

    <NavTiles />

    <ConsoleHistory
      :history="backtestStore.history"
      @clear="backtestStore.clearHistory()"
      @view-report="(id: string) => router.push({ path: '/backtest', query: { id } })"
    />

    <!-- AUD-19（2026-09-22）：紧急平仓（kill-switch）原先挂在 PaperTrading.vue 上，
         那个页面连同 /api/paper/* 整条线已删除。它打的是**活的**
         /api/execution/emergency-flatten（双因子：bearer token + confirmation_token），
         所以保留并移到这里 —— 放在页尾，与「危险操作不放显眼处」的惯例一致。
         @flattened 原本用来让父页面刷新持仓/订单；控制台没有持仓视图，故不监听
         （组件内部已用 useMessage 提示结果）。 -->
    <EmergencyFlatten />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useMessage } from 'naive-ui'
import { useBacktestStore } from '@/stores/backtest'
import { getMarketIndex } from '@/api/market'
import { getStrategies } from '@/api/strategy'
import { runBacktest as apiRunBacktest } from '@/api/backtest'
import type { Strategy, MarketIndex, BacktestResult } from '@/types/api'
import MarketMetrics from '@/components/dashboard/MarketMetrics.vue'
import QuickBacktest from '@/components/dashboard/QuickBacktest.vue'
import NavTiles from '@/components/dashboard/NavTiles.vue'
import ConsoleHistory from '@/components/dashboard/ConsoleHistory.vue'
import EmergencyFlatten from '@/components/paper/EmergencyFlatten.vue'

const router = useRouter()
const message = useMessage()
const backtestStore = useBacktestStore()

const selectedDate = ref(new Date().toISOString().split('T')[0])
const selectedIndex = ref('000001.SH')
const marketLoading = ref(false)
const marketMetrics = ref<MarketIndex | null>(null)
// `metrics` 为 null 的**成因**：请求失败/回包不合形状 = true，接口回了空数组 = false。
// 界面两种都没有格子，但说的话必须不同（见 MarketMetrics 的 fetchFailed）。
const marketFetchFailed = ref(false)
const strategiesCache = ref<string[]>([])
const quickRunning = ref(false)
const quickResult = ref<BacktestResult | null>(null)

const quickForm = reactive({
  strategy: 'momentum',
  stock: '600000.SH',
  startDate: '2024-01-01',
  endDate: '2024-03-31',
})

onMounted(async () => {
  backtestStore.loadHistory()
  backtestStore.loadHistoryFromDB()
  try {
    const res = await getStrategies()
    strategiesCache.value = (res.strategies || []).map((s: Strategy) => (s.name || s.id || s.description))
  } catch { /* best-effort; ignore failure */ }
  fetchMarketData()
})

async function fetchMarketData() {
  marketLoading.value = true
  try {
    const res = await getMarketIndex(selectedIndex.value, selectedDate.value)
    // 三种状态分开表达：读到条目 / 接口回了空数组（诚实读数，库里那三个指数代码 0 行）/
    // 回包不合形状（没有 indices 数组）。后两者都没有格子可显示，但说的话不同 ——
    // 把"这次没读到"讲成"今天没有行情"，就是 DATA-07 收口前那四格 '-' 换了个地方。
    marketFetchFailed.value = !Array.isArray(res.indices)
    marketMetrics.value = Array.isArray(res.indices) && res.indices.length > 0
      ? res.indices[res.indices.length - 1]
      : null
    // 取最后一条也**不代表**选中项生效：core 的 /market/index 现在忽略 ?symbol/?date，
    // 参数化取数登记为 core 工单 DATA-11，不在这里悄悄冒充 PIT。
  } catch (e) {
    // 失败也不留旧帧：读不到就是读不到，且界面要说"这次没读到"而不是"没有行情"。
    marketFetchFailed.value = true
    marketMetrics.value = null
    console.warn('市场数据获取失败:', e)
  } finally {
    marketLoading.value = false
  }
}

async function runQuickBacktest() {
  if (!quickForm.stock) return
  quickRunning.value = true
  quickResult.value = null
  try {
    const res = await apiRunBacktest({
      strategy: quickForm.strategy,
      stock_pool: [quickForm.stock],
      start_date: quickForm.startDate,
      end_date: quickForm.endDate,
      initial_capital: 1000000,
      commission_rate: 0.0003,
      slippage_rate: 0.0001,
    })
    // 这里**不判成功**：只确认响应认得出自己（id 是身份，不是结论）。
    // 成功与否由 status 决定，交给 QuickBacktest 按三值分别渲染 ——
    // 包括 status 缺失/不认识的情况，那种时候不许默认成"已完成"。
    if (!res?.id) {
      throw new Error('回测响应缺少 id，无法定位这次运行')
    }
    quickResult.value = res
    backtestStore.addToHistory(res)
  } catch (e: unknown) {
    message.error('快速回测失败: ' + (e instanceof Error ? e.message : String(e)))
  } finally {
    quickRunning.value = false
  }
}
</script>

<style scoped>
.dashboard-page {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
</style>
