<script setup lang="ts">
import { NDrawer, NDrawerContent, NSpace, NButton, NAlert, NText, NTag } from 'naive-ui'
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useEvidenceLookup } from '@/composables/useEvidenceLookup'
import EvidenceRecord from './EvidenceRecord.vue'

/**
 * 数字旁的质问入口 —— F6 的落地件（TASKS.md A-06）。
 *
 * 三条不可让的语义，每条都对应一条会被误读的路径：
 *
 * 1. **打开抽屉不改 URL**。质问是"就着这个数看一眼来源"，跳页等于把人从他
 *    正在读的报告里拽走，回来时上下文没了 —— 那就没有人会去质问。
 * 2. **没有坐标就明说"无法回溯"**，而且这行字**在屏幕上，不在点击之后**。
 *    一个查不到来源的数字照常显示，读的人默认它查得到。诚实 > 好看。
 * 3. **404 是"未摄取"，不是"查询失败"**（三态共用 `useEvidenceLookup`，
 *    与 `/evidence` 页同一份实现）。
 */
const props = withDefaults(
  defineProps<{
    /** 被质问的那个数字叫什么，进抽屉标题 */
    label: string
    /** 证据坐标。空串 / null / undefined 一律按"没有坐标"处理 */
    hash?: string | null
    /** 没有坐标时该怎么解释 —— 各页的原因不一样，不能糊成一句 */
    reason?: string
    /** 数字本身的显示值，只进标题，不参与判定 */
    value?: string
  }>(),
  { hash: null, reason: '', value: '' },
)

const router = useRouter()
const open = ref(false)
const { state, record, errorMessage, lookup, reset } = useEvidenceLookup()

/** 判定只看"有没有坐标"，不看坐标像不像 hash —— 像不像不是前端该下的结论 */
const traceable = computed(() => Boolean(props.hash && props.hash.trim()))

function toggle() {
  open.value = !open.value
}

/**
 * 打开时解析；**抽屉开着而坐标变了**也要重查。
 *
 * 第二条不是防御性代码：列表按指标重排、或父组件复用同一个实例渲染另一行时，
 * `hash` 变了而 `open` 一直是 true。只 watch `open` 的话，屏幕上会继续挂着
 * 上一个数字的原始记录 —— 那是把 A 的来源署在 B 上，比查不到更糟。
 */
watch([open, () => props.hash], async ([isOpen]) => {
  if (!isOpen) return
  reset()
  if (traceable.value) await lookup(props.hash as string)
})

/** 深链兜底（断言 6）：这是**用户主动要求换到完整页**，所以这里允许跳页。 */
function openInEvidencePage() {
  if (!props.hash) return
  router.push({ name: 'evidence', query: { content_hash: props.hash } })
}
</script>

<template>
  <span class="ev-probe">
    <!-- 断言 4：无坐标时"无法回溯"是**可见文字**，不是 hover 才出现的提示 -->
    <button
      v-if="!traceable"
      type="button"
      class="ev-trigger ev-untraceable"
      data-testid="ev-probe-trigger"
      :aria-label="`${label} 无法回溯证据`"
      @click="toggle"
    >
      无法回溯
    </button>
    <button
      v-else
      type="button"
      class="ev-trigger"
      data-testid="ev-probe-trigger"
      :aria-label="`质问 ${label} 的来源`"
      @click="toggle"
    >
      证据
    </button>

    <NDrawer v-model:show="open" :width="520" placement="right">
      <NDrawerContent :title="`证据质问：${label}`" closable>
        <NSpace vertical :size="12">
          <NText v-if="value" depth="3" data-testid="ev-probe-value">{{ value }}</NText>

          <template v-if="!traceable">
            <!-- 说清"为什么"而不只是"不行"：不同数字缺的是不同的东西 -->
            <NAlert type="warning" :title="'无法回溯'" data-testid="ev-probe-untraceable">
              这个数字没有携带证据坐标（content_hash），所以查不到它来自哪条原始记录。
              <template v-if="reason"><br />原因：{{ reason }}</template>
            </NAlert>
          </template>

          <template v-else>
            <NText v-if="state === 'loading'" depth="3">正在回溯 ingest.raw 中的原始记录…</NText>

            <NAlert v-else-if="state === 'failed'" type="error" data-testid="ev-probe-failed">
              查询失败：{{ errorMessage }}
            </NAlert>

            <NAlert
              v-else-if="state === 'not-ingested'"
              type="warning"
              data-testid="ev-probe-not-ingested"
            >
              未摄取：该 content_hash 不在 ingest.raw 中。坐标是有效的，只是这条响应没有被归档过。
            </NAlert>

            <EvidenceRecord v-else-if="record" :record="record" />

            <NSpace align="center" :size="8">
              <NTag size="small" :bordered="false" type="default">{{ hash?.slice(0, 12) }}…</NTag>
              <NButton size="tiny" quaternary data-testid="ev-probe-deeplink" @click="openInEvidencePage">
                在证据页打开
              </NButton>
            </NSpace>
          </template>
        </NSpace>
      </NDrawerContent>
    </NDrawer>
  </span>
</template>

<style scoped>
.ev-probe {
  display: inline-flex;
  align-items: center;
}

.ev-trigger {
  border: 1px solid var(--q-border);
  background: transparent;
  color: var(--q-text3);
  border-radius: var(--q-radius-sm);
  font-size: 10px;
  line-height: 1;
  padding: 3px 6px;
  cursor: pointer;
  transition: color var(--q-transition), border-color var(--q-transition);
}

.ev-trigger:hover {
  color: var(--q-primary);
  border-color: var(--q-primary-edge);
}

.ev-trigger:focus-visible {
  outline: 2px solid var(--q-focus);
  outline-offset: 1px;
}

/* 无坐标要**看得见**：用警示色 + 常驻文字，而不是等 hover。
   颜色不是唯一线索 —— 文案本身就写着"无法回溯"。
   用 --q-warning 而不是新造 --q-warning-text：DESIGN.md↔variables.css 那条
   对账护栏会拦下没在基准里立过项的颜色值。 */
.ev-untraceable {
  color: var(--q-warning);
  border-color: var(--q-border);
}
</style>
