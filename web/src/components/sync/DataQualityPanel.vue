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
          二是通道：本应给出这三个时刻的历史接口，在网关上没有转发（实测网关 404，
          数据服务侧返回的 history 为空），且它的总数接口里声明的行情最新日实测从不返回 ——
          两个形状问题登记为 core 工单 DATA-03。任何一条不补，这块就只能显示空态。
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
 * 为什么整块几乎都是空态（2026-10-14 实测，不是引用文档）：
 *  - `GET :8085/api/stocks/count` → `{count: 5908}`，只有总数，且类型里声明的
 *    `latest_date` 实测从不出现（handler 把 Scan 的错误丢掉了）；
 *  - `GET :8085/api/fundamentals/:symbol/history` → 404（网关没有转发这条），
 *    直连数据服务是 200 但 `{"history":null}`；
 *  - 库里 `delist_date` 其实有 339 条非空（`stocks` 表实测），但没有 HTTP 面能拿到拆分。
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
