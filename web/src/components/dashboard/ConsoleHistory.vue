<template>
  <n-card title="控制台历史">
    <template #header-extra>
      <n-button quaternary size="tiny" @click="$emit('clear')">清除</n-button>
    </template>
    <n-list v-if="validHistory.length > 0" bordered>
      <n-list-item v-for="(item, i) in validHistory" :key="item.id || i">
        <template #prefix>
          <!-- A-07：非 completed 时**先显示状态**，不显示"多/空"。
               "多/空"是从 total_return 的正负推出来的方向标签，而一次无效运行
               的 total_return 是 0 或垃圾值 —— 于是它会被渲染成一枚绿色的"多"，
               和一次真成功的回测逐像素相同。方向在这里不是被忽略，是**无意义**。 -->
          <n-tag
            v-if="statusTag(item)"
            :type="statusTag(item)!.type"
            size="small"
            round
            :bordered="false"
            data-testid="console-history-status"
          >
            {{ statusTag(item)!.label }}
          </n-tag>
          <n-tag v-else :type="(item.total_return ?? 0) >= 0 ? 'success' : 'error'" size="small" round :bordered="false">
            {{ (item.total_return ?? 0) >= 0 ? '多' : '空' }}
          </n-tag>
        </template>
        <n-thing :title="itemTitle(item)" :description="itemDesc(item)"></n-thing>
        <template #suffix>
          <n-button quaternary size="tiny" type="primary" @click="$emit('view-report', item.id)">查看</n-button>
        </template>
      </n-list-item>
    </n-list>
    <n-empty v-else description="暂无历史记录"></n-empty>
  </n-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { NCard, NList, NListItem, NThing, NTag, NButton, NEmpty } from 'naive-ui'
import { fmtPercent, fmtNumber } from '@/utils/format'
import { runStatusTag } from '@/utils/runStatus'
import type { HistoryEntry } from '@/types/api'

const props = defineProps<{ history: HistoryEntry[] }>()

/** 全站唯一口径的三值标识（见 utils/runStatus） */
const statusTag = (item: HistoryEntry) => runStatusTag(item.status)

const emit = defineEmits<{
  clear: []
  'view-report': [id: string]
}>()

const validHistory = computed(() =>
  (props.history || []).filter((item: HistoryEntry) => item && item.id)
)

function itemTitle(item: HistoryEntry): string {
  return `${Array.isArray(item.stock_pool) ? item.stock_pool.join(',') : (item.stock_pool || '')} · ${item.strategy || ''}`
}

function itemDesc(item: HistoryEntry): string {
  // failed 的指标字段是零值（ResultSpec 冻结：那次运行根本没算出结果），
  // 摆出来就是伪造观测。invalid **保留这一行**，但 2026-10-14 实测过它的实情：
  // 无效响应的指标键是**缺席**的（`POST /api/backtest` 用 csi300 当票池跑一次，
  // 返回里没有 total_return / sharpe_ratio，却带着 sortino_ratio=1.8e+308 这个
  // MaxFloat64 垃圾值）⇒ 这里渲染成"收益: - | 夏普: -"。所以保留的不是数字，
  // 是"这条运行确实到了列表里"这一行；数字本身格式化器不给就不编。
  if (item.status === 'failed') return '这次运行失败，没有产出指标'
  const ret = fmtPercent(item.total_return)
  const sharpe = fmtNumber(item.sharpe_ratio, 2)
  return `收益: ${ret} | 夏普: ${sharpe}`
}
</script>
