<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { NCard, NSpace, NInput, NButton, NAlert, NText } from 'naive-ui'
import { SearchOutline } from '@vicons/ionicons5'
import { useEvidenceLookup } from '@/composables/useEvidenceLookup'
import EvidenceRecord from './EvidenceRecord.vue'

// ADR-022 §5: the L0 evidence lookup. One content_hash in, exactly one
// archived source response out (or an explicit "not ingested").
const props = withDefaults(defineProps<{ initialHash?: string }>(), { initialHash: '' })

const contentHash = ref(props.initialHash)
const { state, record, errorMessage, lookup } = useEvidenceLookup()

const loading = computed(() => state.value === 'loading')
const notIngested = computed(() => state.value === 'not-ingested')
const canSubmit = computed(() => contentHash.value.trim().length > 0)

async function handleLookup() {
  await lookup(contentHash.value)
}

// TASKS.md P5-3: a hand-off from a citation tuple arrives as a prefilled hash
// (/evidence?content_hash=...) and resolves immediately — "one click back to
// the source". Navigating again with a different hash re-resolves in place.
onMounted(() => {
  if (props.initialHash) handleLookup()
})

watch(
  () => props.initialHash,
  (hash) => {
    contentHash.value = hash
    if (hash) handleLookup()
  },
)
</script>

<template>
  <NCard title="证据查询" embedded>
    <NSpace vertical>
      <NText depth="3">
        输入 64 位 content_hash，回溯该数字在 ingest.raw 中的唯一原始记录。
      </NText>

      <NSpace align="center">
        <NInput
          v-model:value="contentHash"
          placeholder="content_hash（sha256 小写 hex）"
          clearable
          style="width: 520px"
        />
        <NButton
          type="primary"
          :loading="loading"
          :disabled="!canSubmit"
          @click="handleLookup"
        >
          <template #icon>
            <SearchOutline />
          </template>
          查询
        </NButton>
      </NSpace>

      <NAlert
        v-if="errorMessage"
        type="error"
        closable
        @close="errorMessage = ''"
      >
        {{ errorMessage }}
      </NAlert>

      <NAlert v-if="notIngested" type="warning">
        未摄取：该 content_hash 不在 ingest.raw 中。
      </NAlert>

      <EvidenceRecord v-if="record" :record="record" />
    </NSpace>
  </NCard>
</template>