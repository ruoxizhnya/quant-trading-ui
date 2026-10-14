<script setup lang="ts">
import { computed } from 'vue'
import { DIMENSION_ORDER, dimensionLabel, type Challenge, type Verdict } from '@/api/explore'

/**
 * 验证器裁决 —— F5 横切组件（TASKS.md A-05）。
 *
 * 展示契约（F5 原文，不得改动的语义）：输出是**概率估计 + 质疑清单**，不是通过/不通过。
 * 三条最容易做错的，都在这里钉死：
 * 1. 六维恒为六行。后端少给一维时，那一行显示"未评估"而不是消失 —— "没查"不等于"没问题"。
 * 2. 综合概率取已评估维度的**最小值**，且**从屏幕上的六个数当场推出来**，不读后端的
 *    聚合字段。理由是可质问性（原则 4）：用户能拿看到的数验算出这个结论；若显示一个
 *    来路不同的聚合值，它就变成一个不能质问的数字。
 * 3. 失败的尝试没有裁决 —— 没有回测结果就没有可被证伪的东西，不渲染成 0 分。
 *
 * 本面板整体属**概率性通道**（AI 产出），故配色用 --q-ai-text 且带"AI 评估"文字标注
 * —— DESIGN.md §3 硬规则：颜色不得是唯一线索。
 */
const props = defineProps<{ verdict: Verdict | null }>()

/** 一维的展示态： assessed 与否都必须占一行 */
interface DimRow {
  key: string
  label: string
  assessed: boolean
  p: number | null
  isWeakest: boolean
}

/**
 * 先取规范六维，再追加后端给出的**未知维度**。
 * 追加这一步是刻意的：若只渲染白名单，将来后端加第七维时它会静默不见 ——
 * 那正好违反本组件要守的那条"少一维也不许静默"。
 *
 * `unassessed` 具有**否决权**：一维若被列为未评估，即使 dimensions 里混进了数也不显示它。
 * 契约上二者不该冲突，但真冲突时只能往"没查"那侧失败安全 —— 把一个未评估维度标成
 * 概率，等于替 AI 编造可信度。
 */
const dims = computed<DimRow[]>(() => {
  const v = props.verdict
  const given = v ? v.dimensions : {}
  const unassessed = new Set(v?.unassessed ?? [])
  const keys = [...DIMENSION_ORDER]
  for (const k of Object.keys(given)) if (!keys.includes(k)) keys.push(k)
  for (const k of unassessed) if (!keys.includes(k)) keys.push(k)

  const has = (k: string) => typeof given[k] === 'number' && !unassessed.has(k)
  const assessed = keys.filter(has)
  const weakest = assessed.length ? assessed.reduce((a, b) => (given[a] <= given[b] ? a : b)) : null

  return keys.map((k) => ({
    key: k,
    label: dimensionLabel(k),
    assessed: has(k),
    p: has(k) ? given[k] : null,
    isWeakest: k === weakest,
  }))
})

/** 屏幕上的最小值即综合概率；一维都没评估时不给数（0 会被读成"零可信"） */
const probability = computed<number | null>(() => {
  const assessed = dims.value.filter((d) => d.assessed && d.p !== null)
  return assessed.length ? Math.min(...assessed.map((d) => d.p as number)) : null
})

const weakestLabel = computed(() => dims.value.find((d) => d.isWeakest)?.label ?? null)

const unassessedCount = computed(() => dims.value.filter((d) => !d.assessed).length)

const SEVERITY_ORDER: Challenge['severity'][] = ['blocking', 'warning', 'note']
const SEVERITY_LABEL: Record<Challenge['severity'], string> = {
  blocking: '阻断级质疑',
  warning: '需留意',
  note: '备注',
}

/** 按严重度分组，组内保持后端顺序 */
const grouped = computed(() =>
  SEVERITY_ORDER.map((sev) => ({
    severity: sev,
    label: SEVERITY_LABEL[sev],
    items: (props.verdict?.challenges ?? []).filter((c) => c.severity === sev),
  })).filter((g) => g.items.length > 0),
)
</script>

<template>
  <section class="verdict-panel" data-testid="verdict-panel">
    <!-- 断言 5：失败的尝试不渲染裁决，也不出现 0 分 -->
    <p v-if="!verdict" class="vp-empty" data-testid="vp-no-verdict">
      这一条没有裁决 —— 失败的尝试没有可被证伪的东西
    </p>

    <template v-else>
      <div class="vp-head">
        <div class="vp-prob-block">
          <span class="vp-kicker">AI 评估</span>
          <span v-if="probability !== null" class="vp-prob" data-testid="vp-probability">{{
            probability.toFixed(2)
          }}</span>
          <span v-else class="vp-prob vp-prob-none" data-testid="vp-probability">无已评估维度</span>
        </div>
        <p class="vp-explain">
          综合概率 = 已评估各维的<b>最小值</b>，由上面六个数当场算出 —— 结论受限于最弱的
          那一环。它不是平均，也不是"通过与否"。
        </p>
      </div>

      <ul class="vp-dims" data-testid="vp-dims">
        <li
          v-for="d in dims"
          :key="d.key"
          class="vp-dim"
          :class="{ 'is-weakest': d.isWeakest, 'is-unassessed': !d.assessed }"
          :data-testid="`vp-dim-${d.key}`"
        >
          <span class="vp-dim-label">{{ d.label }}</span>
          <!-- 断言 2：未评估必须显式成文字，折叠或省略即红 -->
          <span class="vp-dim-value">{{ d.assessed ? d.p?.toFixed(2) : '未评估' }}</span>
          <!-- 断言 4：最弱一环不能只靠颜色区分 -->
          <span v-if="d.isWeakest" class="vp-dim-flag">最弱一环</span>
        </li>
      </ul>

      <p v-if="unassessedCount > 0" class="vp-unassessed-note">
        {{ unassessedCount }} 个维度未评估 —— 未评估不等于没问题
      </p>
      <p v-else-if="weakestLabel" class="vp-weakest-note">最弱一环：{{ weakestLabel }}</p>

      <!-- 因果维：机制是人要读的，但旁边必须写着它赌中了几条 -->
      <div v-if="verdict.causal" class="vp-causal" data-testid="vp-causal">
        <div class="vp-causal-head">
          <span class="vp-kicker">因果维（模型给的）</span>
          <span class="vp-bet">
            可证伪预测 {{ verdict.causal.testable }} 条 · 应验
            {{ verdict.causal.passed }} · 被证伪 {{ verdict.causal.failed }}
          </span>
        </div>
        <p class="vp-mechanism">{{ verdict.causal.mechanism || '模型未给出机制说明' }}</p>
      </div>

      <div v-if="grouped.length" class="vp-challenges" data-testid="vp-challenges">
        <div v-for="g in grouped" :key="g.severity" class="vp-challenge-group" :data-severity="g.severity">
          <h4 class="vp-group-title">{{ g.label }}（{{ g.items.length }}）</h4>
          <ul>
            <li v-for="(c, i) in g.items" :key="i" class="vp-challenge">
              <span class="vp-challenge-dim">{{ dimensionLabel(c.dimension) }}</span>
              <span class="vp-challenge-msg">{{ c.message }}</span>
            </li>
          </ul>
        </div>
      </div>
      <p v-else class="vp-no-challenges">本轮没有提出质疑条目</p>
    </template>
  </section>
</template>

<style scoped>
.verdict-panel {
  font-size: 13px;
  color: var(--q-text);
}

.vp-empty {
  margin: 0;
  color: var(--q-text3);
  font-size: 13px;
}

.vp-head {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  flex-wrap: wrap;
}

.vp-prob-block {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/* 概率性通道的文字标识（DESIGN.md §3：颜色不得是唯一线索，故"AI 评估"四字必在） */
.vp-kicker {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--q-ai-text);
}

.vp-prob {
  font-family: var(--q-mono);
  font-variant-numeric: tabular-nums;
  font-size: 24px;
  font-weight: 600;
  line-height: 1.2;
  color: var(--q-ai-text);
}

.vp-prob-none {
  font-size: 14px;
  font-weight: 500;
  color: var(--q-text3);
}

.vp-explain {
  margin: 0;
  flex: 1;
  min-width: 220px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--q-text2);
}

.vp-dims {
  list-style: none;
  margin: 14px 0 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.vp-dim {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border: 1px solid var(--q-border);
  border-radius: var(--q-radius-xs);
  background: var(--q-surface2);
}

.vp-dim-label {
  font-size: 12px;
  color: var(--q-text2);
}

.vp-dim-value {
  font-family: var(--q-mono);
  font-variant-numeric: tabular-nums;
  font-size: 12px;
  font-weight: 600;
}

.vp-dim.is-unassessed {
  border-style: dashed;
  background: transparent;
}

.vp-dim.is-unassessed .vp-dim-value {
  color: var(--q-text3);
  font-weight: 500;
}

/* 最弱一环：边框 + 文字双通道，不依赖颜色单义 */
.vp-dim.is-weakest {
  border-color: var(--q-warning);
  box-shadow: inset 0 0 0 1px var(--q-warning-soft);
}

.vp-dim-flag {
  font-size: 11px;
  color: var(--q-warning);
}

.vp-unassessed-note,
.vp-weakest-note {
  margin: 10px 0 0;
  font-size: 12px;
  color: var(--q-text3);
}

.vp-causal {
  margin-top: 14px;
  padding: 10px 12px;
  border: 1px solid var(--q-border-light);
  border-radius: var(--q-radius-sm);
  background: var(--q-surface);
}

.vp-causal-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
}

.vp-bet {
  font-size: 12px;
  color: var(--q-text2);
  font-variant-numeric: tabular-nums;
}

.vp-mechanism {
  margin: 6px 0 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--q-text2);
}

.vp-challenges {
  margin-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.vp-group-title {
  margin: 0 0 4px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--q-text3);
}

.vp-challenges ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.vp-challenge {
  display: flex;
  gap: 8px;
  padding: 6px 8px;
  border-left: 3px solid var(--q-border);
  background: var(--q-surface2);
  border-radius: 0 var(--q-radius-xs) var(--q-radius-xs) 0;
}

.vp-challenge-group[data-severity='blocking'] .vp-challenge {
  border-left-color: var(--q-danger);
}

.vp-challenge-group[data-severity='warning'] .vp-challenge {
  border-left-color: var(--q-warning);
}

.vp-challenge-dim {
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--q-text2);
}

.vp-challenge-msg {
  font-size: 12px;
  line-height: 1.6;
  color: var(--q-text);
}

.vp-no-challenges {
  margin: 12px 0 0;
  font-size: 12px;
  color: var(--q-text3);
}
</style>
