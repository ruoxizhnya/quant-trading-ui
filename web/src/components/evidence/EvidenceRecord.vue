<script setup lang="ts">
import { computed } from 'vue'
import {
  NDescriptions,
  NDescriptionsItem,
  NCode,
  NDivider,
} from 'naive-ui'
import type { RawIngest } from '@/types/evidence'

/**
 * 一条 ingest.raw 原始记录的展示 —— `/evidence` 页与质问抽屉共用同一份。
 *
 * 抽出来的理由不是"少写几行"，而是这两处必须**逐字段一致**：同一个 hash 在
 * 抽屉里看到的来源/键/时点，和完整页看到的不是同一个东西的话，F6 的整个
 * 信任机制就作废了 —— 而这类分叉只会在一边改字段时静默发生。
 */
const props = defineProps<{ record: RawIngest }>()

const payloadText = computed(() => JSON.stringify(props.record.payload, null, 2))
</script>

<template>
  <div data-testid="evidence-record">
    <NDivider />
    <NDescriptions label-placement="left" :column="1" size="small" bordered>
      <NDescriptionsItem label="content_hash">
        {{ record.content_hash }}
      </NDescriptionsItem>
      <NDescriptionsItem label="来源">
        {{ record.source }}
      </NDescriptionsItem>
      <NDescriptionsItem label="数据集">
        {{ record.dataset }}
      </NDescriptionsItem>
      <NDescriptionsItem label="键">
        {{ record.key }}
      </NDescriptionsItem>
      <NDescriptionsItem label="数据时点">
        {{ record.as_of || '—' }}
      </NDescriptionsItem>
      <NDescriptionsItem label="归档时间">
        {{ record.fetched_at }}
      </NDescriptionsItem>
    </NDescriptions>

    <NCode :code="payloadText" language="json" word-wrap />
  </div>
</template>
