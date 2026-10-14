import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { NTag } from 'naive-ui'
import ConsoleHistory from './ConsoleHistory.vue'
import type { HistoryEntry } from '@/types/api'

/**
 * 控制台历史列表的三值渲染（A-07 断言 1/2）。
 *
 * 这里是断言 1 的**第二处现场**：prefix 那枚标签原先纯由 `total_return` 的
 * 正负推出"多/空"，从不问 status —— 于是一次 `status=invalid`、
 * `total_return=0` 的运行显示成绿色"多"，和一次真成功的回测一模一样。
 *
 * 与 QuickBacktest 同一口径（`utils/runStatus`），因为同一条记录从两个页面
 * 进来必须长一样；各写一份的话，"同口径"就只能靠运气。
 */
function entry(over: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    id: 'bt-1',
    status: 'completed',
    strategy: 'momentum',
    stock_pool: ['600000.SH'],
    total_return: 0.0312,
    sharpe_ratio: 1.42,
    ...over,
  }
}

function mounted(entries: HistoryEntry[]) {
  return mount(ConsoleHistory, { props: { history: entries } })
}

function tagOf(w: ReturnType<typeof mount>, label: string) {
  return w.findAllComponents(NTag).find((t) => t.text().includes(label))
}

describe('ConsoleHistory — completed', () => {
  it('成功仍显示方向标签（多/空），不加状态噪音', () => {
    const w = mounted([entry()])
    expect(tagOf(w, '多')).toBeTruthy()
    expect(w.text()).not.toContain('无效运行')
  })
})

describe('ConsoleHistory — invalid', () => {
  it('显示"无效运行"警示标签，**不再**用收益正负冒充方向', () => {
    const w = mounted([entry({ status: 'invalid', total_return: 0 })])
    const tag = tagOf(w, '无效运行')
    expect(tag).toBeTruthy()
    expect(tag!.props('type')).toBe('warning')
    // 关键：不能同时出现那枚从 total_return 推出来的"多"
    expect(tagOf(w, '多')).toBeFalsy()
  })

  it('无效运行**不抹掉**这一行的指标位 —— 后端给了数字就照给（不可信由标签说），没给就显示占位', () => {
    // 喂 synthetic 数字是测**组件行为**；真实无效响应里这些键是缺席的
    // （2026-10-14 实测：`total_return` 不在 JSON 里，`sortino_ratio` 却是
    // 1.8e+308 的 MaxFloat64），那种情形渲染成"收益: - | 夏普: -"。
    const w = mounted([entry({ status: 'invalid', total_return: 0.0312 })])
    expect(w.text()).toContain('3.12%')
  })
})

describe('ConsoleHistory — failed', () => {
  it('错误标签 + 不显示指标（failed 的字段是零值，摆出来就是伪造观测）', () => {
    const w = mounted([entry({ status: 'failed', total_return: 0, sharpe_ratio: 0 })])
    const tag = tagOf(w, '失败')
    expect(tag).toBeTruthy()
    expect(tag!.props('type')).toBe('error')
    expect(w.text()).toContain('没有产出指标')
    expect(w.text()).not.toContain('夏普')
  })
})

describe('ConsoleHistory — 旧数据没有 status 字段', () => {
  /**
   * 有意的"不响"：localStorage 里那批改动之前存的条目本来就没这个字段，
   * 给它编一个状态才是撒谎。与快速回测相反 —— 那是刚跑完的运行，
   * 后端今天一定发 status，缺了必须响（见 QuickBacktest.test.ts）。
   */
  it('undefined 落到无标识，按 completed 的外观显示，不编造状态', () => {
    const w = mounted([entry({ status: undefined })])
    expect(w.text()).not.toContain('无效运行')
    expect(w.text()).not.toContain('失败')
    expect(tagOf(w, '多')).toBeTruthy()
  })
})

describe('ConsoleHistory — 混合列表逐条独立判定', () => {
  it('三条记录三种态，各自标签正确', () => {
    const w = mounted([
      entry({ id: 'a', status: 'completed' }),
      entry({ id: 'b', status: 'invalid', total_return: 0 }),
      entry({ id: 'c', status: 'failed' }),
    ])
    expect(w.text()).toContain('无效运行')
    expect(w.text()).toContain('失败')
    expect(w.text()).toContain('没有产出指标')
    // completed 那条仍显示方向
    expect(tagOf(w, '多')).toBeTruthy()
  })
})
