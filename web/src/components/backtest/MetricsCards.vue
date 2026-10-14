<template>
  <div class="metrics-grid">
    <div v-for="m in metrics" :key="m.label" class="metric-box">
      <div class="metric-head">
        <div class="metric-label">{{ m.label }}</div>
        <!-- A-06：可质问数字统一带质问入口。回测指标今天一律没有坐标，
             所以这里恒显示"无法回溯" —— 那是如实标注，不是占位。 -->
        <EvidenceProbe
          v-if="m.evidence"
          :label="m.label"
          :hash="m.evidence.hash"
          :reason="m.evidence.reason"
          :value="m.value"
        />
      </div>
      <div class="metric-val" :class="m.cls">{{ m.value }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import EvidenceProbe from '@/components/evidence/EvidenceProbe.vue'

interface MetricItem {
  label: string
  value: string
  cls: string
  /** 证据坐标。null = 这条数字没有原始记录可回溯，界面必须如实说出来 */
  evidence?: { hash: string | null; reason?: string }
}

defineProps<{ metrics: MetricItem[] }>()
</script>

<style scoped>
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
}
.metric-box {
  background: var(--q-surface2);
  border-radius: var(--q-radius-sm);
  padding: 16px 14px;
  transition: transform var(--q-transition);
}
.metric-box:hover { transform: translateY(-1px); }
.metric-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}
.metric-label {
  font-size: 11px;
  color: var(--q-text3);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.metric-val {
  font-size: 20px;
  font-weight: 700;
  color: var(--q-primary);
  margin-top: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.metric-val.positive { color: var(--q-success); }
.metric-val.negative { color: var(--q-danger); }

@media (max-width: 1200px) {
  .metrics-grid { grid-template-columns: repeat(3, 1fr); }
}
@media (max-width: 900px) {
  .metrics-grid { grid-template-columns: repeat(2, 1fr); }
  .metric-val { font-size: 17px; }
}
@media (max-width: 640px) {
  .metrics-grid { grid-template-columns: repeat(2, 1fr); gap: 8px; }
  .metric-box { padding: 12px 10px; }
  .metric-val { font-size: 16px; }
}
</style>
