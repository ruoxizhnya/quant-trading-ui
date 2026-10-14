import { describe, expect, it } from 'vitest'
import { assessedProbability, weakestDimension, type Verdict } from './explore'

/**
 * 综合概率与最弱一环的**唯一口径**（A-05）。
 *
 * 为什么单独测这两个纯函数：裁决面板与结果流的 "P x.xx" 都调它们，同一个 attempt
 * 在两处显示的两个数由这一段代码保证一致。口径出错会同时污染两处，且没人会红。
 */

const v = (over: Partial<Verdict> = {}): Verdict => ({
  dimensions: { statistical: 0.9, economic: 0.42, robustness: 0.7 },
  probability: 0.9,
  geometric_mean: 0.66,
  blocking: 0,
  challenges: [],
  ...over,
})

describe('assessedProbability', () => {
  it('取已评估维度的最小值，不读后端的 probability / geometric_mean', () => {
    expect(assessedProbability(v())).toBe(0.42)
  })

  it('unassessed 有否决权：被列为未评估的维度不参与最小值', () => {
    expect(assessedProbability(v({ dimensions: { statistical: 0.9, causal: 0.05 }, unassessed: ['causal'] }))).toBe(0.9)
  })

  it('一维都没评估时返回 null 而不是 0（0 会被读成"零可信"）', () => {
    expect(assessedProbability(v({ dimensions: {}, probability: 0 }))).toBeNull()
    expect(assessedProbability(null)).toBeNull()
    expect(assessedProbability(undefined)).toBeNull()
  })
})

describe('weakestDimension', () => {
  it('按数值给出最弱一环，不采信后端 weakest 字段', () => {
    expect(weakestDimension(v({ weakest: 'statistical' }))).toBe('economic')
  })

  it('未评估的维度即使数值更低也不算最弱', () => {
    expect(weakestDimension(v({ dimensions: { statistical: 0.9, bias: 0.1 }, unassessed: ['bias'] }))).toBe('statistical')
  })

  it('无已评估维度时返回 null', () => {
    expect(weakestDimension(v({ dimensions: {} }))).toBeNull()
  })
})
