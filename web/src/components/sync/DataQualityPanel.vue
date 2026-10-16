<template>
  <NCard title="研究质量读数（PIT / 幸存者偏差）" size="small" data-testid="quality-panel">
    <NAlert v-if="error" type="error" class="quality-error" closable data-testid="quality-error">
      {{ error }}
    </NAlert>

    <div class="quality-block" data-testid="survivorship-block">
      <NText strong class="quality-title">幸存者偏差</NText>
      <div class="quality-row" data-testid="surv-total">
        <span class="quality-label">票池记录（含已退市）</span>
        <span class="quality-value">{{ poolCount === null ? '未读取' : poolCount }}</span>
      </div>
      <div class="quality-gap" data-testid="surv-gap">
        <NTag type="warning" size="small">缺读数通道</NTag>
        <span>
          在市 / 退市拆分没有只读接口：SPA 能走到的只有票池总数，退市日期与状态在数据服务
          的列表接口里，但网关没有转发它。所以这块不显示退市占比，也不在前端自算 ——
          那等于在客户端重建后端语义，两处真相。已登记为 core 工单 DATA-02。
        </span>
      </div>
    </div>

    <NDivider />

    <div class="quality-block" data-testid="pit-block">
      <NText strong class="quality-title">PIT 三时刻</NText>
      <div class="quality-row" data-testid="pit-financial-end">
        <span class="quality-label">财务期末（report_date）</span>
        <NTag type="default" size="small">无通道</NTag>
      </div>
      <div class="quality-row" data-testid="pit-ann-date">
        <span class="quality-label">公告披露（ann_date）</span>
        <NTag type="default" size="small">无通道</NTag>
      </div>
      <div class="quality-row" data-testid="pit-tradeable">
        <span class="quality-label">因子可交易起始</span>
        <NTag type="default" size="small">无通道</NTag>
      </div>
      <div class="quality-gap" data-testid="pit-gap">
        <NTag type="warning" size="small">缺口有两层</NTag>
        <span>
          一是数据：逐字段财务表已建但没有摄取链路，表内 0 行（core 已知项 EQD-P1-2）。
          二是通道：给出这三个时刻的历史接口只在数据服务上，网关不转发（实测 404）——
          这是 core 工单 DATA-03 裁决后的形状：明写不对 SPA 开放，护栏已钉住，不是遗漏。
          两层里任何一层不补，这块就只能显示空态。
        </span>
      </div>
    </div>
  </NCard>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { NAlert, NCard, NDivider, NTag, NText } from 'naive-ui'
import { getStockCount } from '@/api/market'
import { apiMessage } from '@/utils/apiMessage'

/**
 * PIT 与幸存者偏差两块（A-08 断言 6）：**保留，但只显示真读到的东西**。
 *
 * 为什么整块几乎都是空态（2026-10-16 复测；原始实测 2026-10-14）：
 *  - `GET :8085/api/stocks/count` 现在恒发 `{count, by_status, latest_date}`：
 *    在市/退市拆分是 DATA-02、行情最新日是 DATA-03（2026-10-16 关闭 —— 原形状把
 *    date 扫进 `**string` 且丢弃 error，那个键因此从来没出现过）。**本面板仍只取
 *    `count`**，那两格还没接上屏：文案与读数一起重写登记为 UI-01。
 *  - `GET :8085/api/fundamentals/:symbol/history` → 404。这条不是漏转发：DATA-03 已
 *    裁决它属数据服务内部面、网关不开放（护栏在 core 的 `cmd/analysis/deps_test.go`）；
 *    直连数据服务是 200 但 `fundamentals_detail` 0 行 ⇒ `history` 恒空（EQD-P1-2）。
 *  - `delist_date` 在库里有 339 条非空（`stocks` 表实测），HTTP 面的拆分读数已由
 *    DATA-02 给出（`by_status.delisted`），缺的只是这块界面把它接进来（UI-01）。
 *
 * 缺口的正确表现是**显式空态 + 指名工单**，不是造一行数据、也不是把总数换个说法
 * 显示成"在市股票数"。同 A-06 对 factor_cache 的裁决：摄取与通道是 core 的事，
 * 前端不填这个洞。
 */

const poolCount = ref<number | null>(null)
const error = ref('')

async function load() {
  error.value = ''
  try {
    const resp = await getStockCount()
    poolCount.value = resp.count
  } catch (err) {
    error.value = apiMessage(err, '票池读数获取失败')
  }
}

onMounted(load)
</script>

<style scoped>
.quality-error {
  margin-bottom: 12px;
}

.quality-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.quality-title {
  font-size: 13px;
}

.quality-row {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
}

.quality-label {
  color: var(--q-text2);
  min-width: 180px;
}

.quality-value {
  font-variant-numeric: tabular-nums;
  color: var(--q-text);
}

.quality-gap {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  margin-top: 6px;
  font-size: 12px;
  color: var(--q-text2);
  max-width: 720px;
}
</style>
