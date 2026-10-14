import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import VerdictPanel from './VerdictPanel.vue'
import { DIMENSION_ORDER, dimensionLabel, type Verdict } from '@/api/explore'

/**
 * A-05 六维验证器组件的验收测试（TASKS.md A-05 断言 1–6，F5 展示契约）。
 *
 * 每条断言都对应 F5 里一条"做错就会被误读"的语义，不是覆盖率装饰。
 */

function verdictOf(over: Partial<Verdict> = {}): Verdict {
  return {
    dimensions: {
      statistical: 0.9,
      economic: 0.42,
      robustness: 0.7,
      bias: 0.8,
      redundancy: 0.6,
      causal: 0.5,
    },
    probability: 0.9,
    geometric_mean: 0.68,
    blocking: 0,
    challenges: [],
    ...over,
  }
}

const panel = (verdict: Verdict | null) => mount(VerdictPanel, { props: { verdict } })

describe('A-05 断言 1：维度条目数恒为 6', () => {
  it('六维齐全时渲染 6 行', () => {
    const w = panel(verdictOf())
    expect(w.findAll('[data-testid^="vp-dim-"]')).toHaveLength(6)
  })

  it('后端只给 5 维，仍然渲染 6 行，缺的那行显示"未评估"', () => {
    const five = { ...verdictOf().dimensions }
    delete five.causal
    const w = panel(verdictOf({ dimensions: five }))
    const rows = w.findAll('[data-testid^="vp-dim-"]')
    expect(rows).toHaveLength(6)
    expect(w.get('[data-testid="vp-dim-causal"]').text()).toContain('未评估')
  })

  it('规范六维逐字出现（顺序固定，不靠对象键序）', () => {
    const w = panel(verdictOf())
    const labels = w.findAll('.vp-dim-label').map((n) => n.text())
    expect(labels).toEqual(DIMENSION_ORDER.map(dimensionLabel))
  })

  it('后端加了第七维时不得静默丢弃', () => {
    const w = panel(
      verdictOf({ dimensions: { ...verdictOf().dimensions, liquidity: 0.33 } }),
    )
    const rows = w.findAll('[data-testid^="vp-dim-"]')
    expect(rows).toHaveLength(7)
    expect(rows[6].text()).toContain('0.33')
  })
})

describe('A-05 断言 2：unassessed 显示为"未评估"，折叠即红', () => {
  it('unassessed 列表里的维度渲染"未评估"文字，且计数提示出现', () => {
    const five = { ...verdictOf().dimensions }
    delete five.causal
    const w = panel(verdictOf({ dimensions: five, unassessed: ['causal'] }))
    expect(w.get('[data-testid="vp-dim-causal"]').text()).toContain('未评估')
    expect(w.text()).toContain('1 个维度未评估')
    expect(w.text()).toContain('未评估不等于没问题')
  })

  /**
   * unassessed 有**否决权**：契约上 dimensions 与 unassessed 不该同时含同一维，
   * 真同时出现时只能往"没查"那侧失败安全 —— 把一个未评估维度标成概率，
   * 等于替 AI 编造可信度。它同时也不得参与最小值。
   */
  it('后端自相矛盾（既给数又列未评估）时显示"未评估"，且不参与最小值', () => {
    const w = panel(
      verdictOf({
        dimensions: { ...verdictOf().dimensions, causal: 0.05 },
        unassessed: ['causal'],
      }),
    )
    expect(w.get('[data-testid="vp-dim-causal"]').text()).toContain('未评估')
    // 最小值仍是已评估里的 0.42，而不是被那个 0.05 拉低
    expect(w.get('[data-testid="vp-probability"]').text()).toBe('0.42')
  })

  /**
   * 破坏验证的正面腿：F5 验收原文要求"若实现把 unassessed 折叠或省略，本测试必须红"。
   * 这里不查样式，查的是**每一维都必须携带一个可质问的结论**：要么是数，要么是"未评估"。
   * 任何"没查的那维干脆不显示"的实现都会在这里红 —— 因为行数为 6 且每行文本非空。
   */
  it('每一维都必须有值或"未评估"，不得留空或整行省略', () => {
    const w = panel(
      verdictOf({
        dimensions: { statistical: 0.9, bias: 0.8 },
        unassessed: ['economic', 'robustness', 'redundancy', 'causal'],
      }),
    )
    const rows = w.findAll('[data-testid^="vp-dim-"]')
    expect(rows).toHaveLength(6)
    for (const row of rows) {
      const text = row.text()
      expect(text.trim().length).toBeGreaterThan(0)
      const hasVerdict = /\d\.\d{2}/.test(text) || text.includes('未评估')
      expect(hasVerdict, `维度行既无数值也未标"未评估"：${text}`).toBe(true)
    }
  })
})

describe('A-05 断言 3：综合概率 = 已评估维度的最小值', () => {
  it('显示最小值，不取平均、不取最大，也不采信后端的聚合字段', () => {
    const w = panel(verdictOf())
    // dimensions 最小 0.42；verdict.probability 故意给 0.9（≈最大）、geometric_mean 0.68（平均）
    expect(w.get('[data-testid="vp-probability"]').text()).toBe('0.42')
  })

  it('后端 weakest 指错时，仍按屏幕上的数标出真正的最弱一环', () => {
    const w = panel(verdictOf({ weakest: 'statistical' }))
    expect(w.get('[data-testid="vp-dim-economic"]').classes()).toContain('is-weakest')
    expect(w.get('[data-testid="vp-dim-statistical"]').classes()).not.toContain('is-weakest')
  })

  it('一维都没评估时不给数字（0 会被读成"零可信"，那是另一种谎报）', () => {
    const w = panel(
      verdictOf({
        dimensions: {},
        unassessed: [...DIMENSION_ORDER],
        probability: 0,
      }),
    )
    expect(w.get('[data-testid="vp-probability"]').text()).toBe('无已评估维度')
  })
})

describe('A-05 断言 4：最弱一环高亮是非颜色单义的', () => {
  it('最弱那一行带文字标注"最弱一环"', () => {
    const w = panel(verdictOf())
    expect(w.get('[data-testid="vp-dim-economic"]').text()).toContain('最弱一环')
    expect(w.findAll('.vp-dim-flag')).toHaveLength(1)
  })

  it('非最弱的行不得带该标注', () => {
    const w = panel(verdictOf())
    expect(w.get('[data-testid="vp-dim-statistical"]').text()).not.toContain('最弱一环')
  })
})

describe('A-05 断言 5：失败的尝试不渲染裁决', () => {
  it('verdict 为 null 时只给说明文字，不出现概率、0 分或百分比', () => {
    const w = panel(null)
    expect(w.find('[data-testid="vp-probability"]').exists()).toBe(false)
    expect(w.find('[data-testid="vp-dims"]').exists()).toBe(false)
    expect(w.get('[data-testid="vp-no-verdict"]').text()).toContain('没有可被证伪的东西')
    expect(w.text()).not.toMatch(/0\.00|\d+%/)
  })

  it('verdict 存在但 undefined 字段（causal 缺失）时不渲染因果块', () => {
    const w = panel(verdictOf({ causal: null }))
    expect(w.find('[data-testid="vp-causal"]').exists()).toBe(false)
  })
})

describe('A-05 断言 6：二值裁决措辞全站为 0', () => {
  // S1 违例：把概率估计说成"通过/未通过"，等于把可证伪的结论改写成裁决
  const BANNED = ['VALIDATED', 'VERIFIED', '校验通过', '未通过']

  it('组件源码内不出现四个二值措辞', () => {
    const src = readFileSync(resolve(__dirname, 'VerdictPanel.vue'), 'utf8')
    const hits = BANNED.filter((word) => src.includes(word))
    expect(hits, `二值措辞违例：${hits.join(', ')}`).toEqual([])
  })

  it('渲染出的文本里也不出现（措辞可能来自拼接）', () => {
    const w = panel(
      verdictOf({
        causal: { mechanism: '红利再投资压低波动', testable: 3, passed: 2, failed: 1, probability: 0.5 },
        challenges: [{ dimension: 'robustness', severity: 'blocking', message: '样本外 Sharpe 掉一半' }],
      }),
    )
    const text = w.text()
    for (const word of BANNED) expect(text).not.toContain(word)
  })
})

describe('F5 其余契约：因果维与质疑分级', () => {
  it('因果维展示机制与可证伪预测的下注结果', () => {
    const w = panel(
      verdictOf({
        causal: { mechanism: '红利再投资压低波动', testable: 3, passed: 2, failed: 1, probability: 0.5 },
      }),
    )
    const causal = w.get('[data-testid="vp-causal"]').text()
    expect(causal).toContain('红利再投资压低波动')
    expect(causal).toContain('可证伪预测 3 条')
    expect(causal).toContain('应验 2')
    expect(causal).toContain('被证伪 1')
  })

  it('质疑按 blocking / warning / note 分组并带条数', () => {
    const w = panel(
      verdictOf({
        blocking: 1,
        challenges: [
          { dimension: 'statistical', severity: 'note', message: '样本期偏短' },
          { dimension: 'robustness', severity: 'blocking', message: '参数扰动即失效' },
          { dimension: 'bias', severity: 'warning', message: '幸存者偏差未排除' },
        ],
      }),
    )
    const groups = w.findAll('.vp-challenge-group')
    expect(groups).toHaveLength(3)
    // 阻断级排在最前，不是按后端数组顺序
    expect(groups[0].attributes('data-severity')).toBe('blocking')
    expect(groups[0].text()).toContain('参数扰动即失效')
    expect(groups[0].text()).toContain('（1）')
  })

  it('没有质疑条目时如实说明，而不是留白', () => {
    const w = panel(verdictOf())
    expect(w.find('[data-testid="vp-challenges"]').exists()).toBe(false)
    expect(w.text()).toContain('本轮没有提出质疑条目')
  })
})

/**
 * 2026-10-14 浏览器实测抓出来的：这些消息是模型写的，带 markdown 强调
 * （`股票池按**今天**的上市名单取`），原样渲染会把星号留在屏幕上。
 *
 * 修法是"切片段交给 Vue 渲染"，所以这里第二件事比第一件事更重要：
 * 消息里的 HTML 必须**仍然是字**，而不是节点。一旦有人为了"支持更多语法"
 * 改成 v-html，下面那条就红。
 */
describe('VerdictPanel — AI 消息里的 markdown 强调', () => {
  it('`**x**` 渲染成强调，屏幕上不留星号', () => {
    const w = panel(
      verdictOf({
        challenges: [
          {
            dimension: 'bias',
            severity: 'blocking',
            message: '股票池按**今天**的上市名单取（0 只）—— 幸存者偏差最典型的形态。',
          },
        ],
      }),
    )
    const msg = w.find('.vp-challenge-msg')
    expect(msg.text()).toContain('按今天的上市名单')
    expect(msg.text()).not.toContain('**')
    const em = msg.find('.vp-em')
    expect(em.exists()).toBe(true)
    expect(em.text()).toBe('今天')
    // 强调前后各留一段正文，没有被整条替换掉
    expect(msg.findAll('span')).toHaveLength(3)
  })

  it('消息里的 HTML 只是字 —— 这条守的是"不走 v-html"这个选择', () => {
    const w = panel(
      verdictOf({
        challenges: [
          { dimension: 'bias', severity: 'note', message: '前复权<b>自带</b>前视成分 <img src=x onerror=alert(1)>' },
        ],
      }),
    )
    const msg = w.find('.vp-challenge-msg')
    expect(msg.element.querySelector('b')).toBeNull()
    expect(msg.element.querySelector('img')).toBeNull()
    expect(msg.text()).toContain('<b>自带</b>')
    expect(msg.text()).toContain('onerror=alert(1)')
  })

  it('未闭合的星号原样留着，不吞掉后半句', () => {
    const w = panel(
      verdictOf({
        challenges: [{ dimension: 'economic', severity: 'note', message: '换手率**偏高 且没有配对基准' }],
      }),
    )
    expect(w.find('.vp-challenge-msg').text()).toBe('换手率**偏高 且没有配对基准')
  })

  it('因果维的机制说明走同一套渲染', () => {
    const w = panel(
      verdictOf({
        causal: {
          mechanism: '动量靠**资金持续流入**驱动，可证伪',
          testable: 3,
          passed: 2,
          failed: 1,
          probability: 0.5,
        },
      }),
    )
    const mech = w.find('.vp-mechanism')
    expect(mech.text()).toBe('动量靠资金持续流入驱动，可证伪')
    expect(mech.find('.vp-em').text()).toBe('资金持续流入')
  })
})
