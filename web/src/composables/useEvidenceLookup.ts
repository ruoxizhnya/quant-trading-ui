import { ref } from 'vue'
import { ApiError } from '@/api/client'
import { getEvidence } from '@/api/evidence'
import type { RawIngest } from '@/types/evidence'

/**
 * 证据回溯的三态机 —— F6 的唯一一份实现。
 *
 * 为什么要抽出来：A-06 之后有**两个**消费方（独立查询页 `/evidence` 的输入框、
 * 挂在数字旁的质问抽屉），而它们必须对同一个 hash 给出**同一个**结论。三态里
 * 最关键的一条是「404 是答复，不是故障」—— 写两遍就会有一天只有一遍是对的，
 * 而用户在那一遍里看到的是「查询失败」，实际是「这条数据从没被摄取过」。
 * 这两种说法的区别正是 F6 要传达的东西，不能被一次复制粘贴抹平。
 */
export type EvidenceState = 'idle' | 'loading' | 'found' | 'not-ingested' | 'failed'

export function useEvidenceLookup() {
  const state = ref<EvidenceState>('idle')
  const record = ref<RawIngest | null>(null)
  const errorMessage = ref('')

  /** 当前正在解析的 hash —— 用于判断"换了一个数字要重查"而不是沿用上一个结果 */
  const resolvedHash = ref('')

  async function lookup(hash: string): Promise<void> {
    const trimmed = hash.trim()
    if (!trimmed) {
      reset()
      return
    }
    state.value = 'loading'
    record.value = null
    errorMessage.value = ''
    try {
      record.value = await getEvidence(trimmed)
      resolvedHash.value = trimmed
      state.value = 'found'
    } catch (err) {
      resolvedHash.value = trimmed
      // 404 = 「这个坐标在 ingest.raw 里没有对应记录」。它是关于数据的一个
      // **结论**（未摄取），不是这次查询没做成。判据来自 ApiError.isNotFound，
      // 不靠 HTTP 文案猜。
      if (err instanceof ApiError && err.isNotFound) {
        state.value = 'not-ingested'
      } else {
        state.value = 'failed'
        errorMessage.value = err instanceof Error ? err.message : '证据查询失败'
      }
    }
  }

  function reset(): void {
    state.value = 'idle'
    record.value = null
    errorMessage.value = ''
    resolvedHash.value = ''
  }

  return { state, record, errorMessage, resolvedHash, lookup, reset }
}
