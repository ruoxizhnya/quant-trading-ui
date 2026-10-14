import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, sep } from 'node:path'
import { describe, expect, it } from 'vitest'
import { backtestValidityNote, invalidReasonLabel, invalidReasonsText, runStatusTag, statusTagFor } from './runStatus'

/**
 * A-07 状态三值全站收口（K9 横切）。
 *
 * 断言 5 明确要"三值各有独立用例，不是 1 条参数化打天下"。理由不是教条：
 * 参数化写法一旦把 `completed` 和"未知"放同一组，测试就看不出**默认落在哪一支** ——
 * 而"status 缺失时默认当成功"正是这次要修的那个 bug 的形状。
 */
describe('runStatusTag — completed', () => {
  it('成功**不**加标签：completed 不需要自证，加一枚绿标会把两态淹掉', () => {
    expect(runStatusTag('completed')).toBeNull()
  })
})

describe('runStatusTag — invalid', () => {
  it('无效是**警示**态而不是错误态（它跑完了，只是结果不可用）', () => {
    expect(runStatusTag('invalid')).toEqual({ type: 'warning', label: '无效运行' })
  })
})

describe('runStatusTag — failed', () => {
  it('失败是**错误**态，且与无效的措辞不同', () => {
    const tag = runStatusTag('failed')
    expect(tag).toEqual({ type: 'error', label: '失败' })
    expect(tag!.label).not.toBe(runStatusTag('invalid')!.label)
  })
})

describe('runStatusTag — 旧数据没有 status 字段', () => {
  /**
   * 这一条守的是一个**有意的不对称**：
   * - 历史列表里 undefined → 无标识。localStorage 存来的旧条目本来就没这个
   *   字段，给它编一个状态才是撒谎。
   * - 快速回测里 undefined → 必须响（见 QuickBacktest.test.ts）。那是刚跑完
   *   的运行，后端今天一定发 status，缺了就是契约破了。
   * 两处不能统一成一条规则，所以这里显式钉住"不响"这一半。
   */
  it('undefined 与 null 都落到"无标识"，而不是被当成失败', () => {
    expect(runStatusTag(undefined)).toBeNull()
    expect(runStatusTag(null)).toBeNull()
  })

  /**
   * 与上一条**相反**的一半：缺失是不编造，"后端说了一个我们不懂的态"则必须响。
   * 列表里让它沉默 = 替用户宣布"这次没问题"，正是 K9 要收的形状。
   */
  it('有值但不认识 ⇒ 显示"未知状态"，不落在无标识', () => {
    expect(runStatusTag('cancelled' as never)).toEqual({ type: 'default', label: '未知状态' })
  })
})

/**
 * `statusTagFor` 是详情页视角（每个态都要有标识），`runStatusTag` 是列表视角。
 * 两个函数读同一张表 —— 这正是 A-07 要收的口：`BacktestEngine.vue` 原先自己
 * 写了一份 switch，措辞与列表逐字相同但各改各的。
 */
describe('statusTagFor — 详情页视角（含 completed）', () => {
  it('completed 显式说"已完成"，而不是靠"没有警示"来暗示', () => {
    expect(statusTagFor('completed')).toEqual({ type: 'success', label: '已完成' })
  })

  it('第四种值必须**响**：有值但不认识 ⇒ 未知状态，不是沉默', () => {
    expect(statusTagFor('cancelled')).toEqual({ type: 'default', label: '未知状态' })
  })

  it('三值在两视角下措辞逐字相同（同口径的唯一机械保证）', () => {
    expect(statusTagFor('invalid')).toEqual(runStatusTag('invalid'))
    expect(statusTagFor('failed')).toEqual(runStatusTag('failed'))
  })
})

describe('invalidReasonsText — Code 要落到人话', () => {
  it('认识的 Code 翻译，不认识的**原样显示**而不是猜', () => {
    expect(invalidReasonLabel('empty_universe')).toBe('股票池为空')
    expect(invalidReasonLabel('brand_new_code')).toBe('brand_new_code')
    expect(invalidReasonsText(['empty_universe', 'zero_trades'])).toBe('股票池为空 · 一次成交都没有')
  })

  it('后端说无效却没给原因时，如实说"没给原因"，不留空也不编', () => {
    expect(invalidReasonsText([])).toContain('未给出原因')
    expect(invalidReasonsText(undefined)).toContain('未给出原因')
  })
})

/**
 * AI 流水线产物那次回测的有效性说法。
 *
 * 这条链路的特殊之处：`job.backtest_result` 里没有 `status`（后端把三值丢在了
 * `pkg/ai/client/backtest_client.go:47` 的客户端边界上，已登记为缺口），
 * 所以它必须退回后端**真正**给的判据 `invalid_reasons`，而不是"有数字就算行"。
 */
describe('backtestValidityNote — 三值到说话', () => {
  it('completed：只报数字，不加任何有效性免责措辞', () => {
    expect(backtestValidityNote({ status: 'completed', total_return: 0.0312 })).toBe(
      '，回测总收益 3.12%'
    )
  })

  it('invalid：点名无效并把 Code 翻成人话', () => {
    const note = backtestValidityNote({ status: 'invalid', invalid_reasons: ['empty_universe'] })
    expect(note).toContain('被判无效')
    expect(note).toContain('股票池为空')
    expect(note).not.toContain('empty_universe')
  })

  it('failed：说没跑成，且不带收益数字', () => {
    const note = backtestValidityNote({ status: 'failed', total_return: 0 })
    expect(note).toBe('，但那次回测失败，没有可用结果')
  })

  /**
   * 今天的全部现实：没有 status。这一条是本轮要防的形状 ——
   * 空票池的无效运行同样带着 `total_return: 0` 走到这里，
   * 界面若只看数字就会对着 0 笔成交播报"回测总收益 0.00%"。
   */
  it('status 缺失但 invalid_reasons 非空 ⇒ 仍判无效（不靠 status 也在）', () => {
    const note = backtestValidityNote({ total_return: 0, invalid_reasons: ['zero_trades'] })
    expect(note).toContain('被判无效')
    expect(note).toContain('一次成交都没有')
  })

  it('status 缺失且 reasons 为空 ⇒ 报数字，但**把判据说出来**', () => {
    const note = backtestValidityNote({ total_return: 0.0312 })
    expect(note).toContain('3.12%')
    expect(note).toContain('有效性判据：invalid_reasons 为空')
  })

  it('既没 status 也没数字 ⇒ 明说没产出，绝不默认成一次成功观测', () => {
    const note = backtestValidityNote({})
    expect(note).toContain('没有产出指标')
    expect(note).not.toContain('成功')
  })

  it('整个产物缺席 ⇒ 空串（没发生的事不编一句话去描述）', () => {
    expect(backtestValidityNote(undefined)).toBe('')
  })
})

/**
 * 断言 1 的机械腿：**凡渲染 total_return 的文件，必须真的读 status**。
 *
 * 为什么用源码扫描而不是行为测试：这条要防的是"新加一个显示收益的地方，
 * 顺手又只看有没有结果" —— 那种代码在行为测试里长得完全正常（它有 id、有数字、
 * 渲染得挺好），只有读源码才看得出它从没问过 status。ConsoleHistory 就是这么漏的。
 *
 * 白名单式的 fail-closed：文件清单写死，新增渲染 total_return 的文件不在表里就红。
 */
describe('A-07 断言 1：没有"以有结果判成功"的路径', () => {
  const FILES = [
    'src/utils/runStatus.ts',
    'src/components/dashboard/QuickBacktest.vue',
    'src/components/dashboard/ConsoleHistory.vue',
    'src/components/backtest/BacktestHistory.vue',
    'src/pages/BacktestEngine.vue',
    'src/pages/Copilot.vue',
    'src/stores/backtest.ts',
  ]

  /**
   * 显式豁免，并写明**为什么豁免成立** —— 放宽规则不如把例外摊开。
   *
   * 对比页不引用 status 是对的：后端 `CompareReports` 已经把结果**预 partition**
   * 成 `entries` / `invalid` / `missing` 三份（`pkg/backtest/reporting/compare.go`），
   * 无效运行根本进不了 entries。它该做的是把 `invalid` 连同原因渲染出来
   * （A-06 复查时它连这个字段都没声明，已补）。
   */
  const EXEMPT: Record<string, string> = {
    'src/pages/BacktestCompare.vue': '后端预 partition 成 entries/invalid/missing，页面消费 invalid',
  }

  for (const rel of FILES) {
    it(`${rel} 对 status 取值分支（不是只在注释里提到这个词）`, () => {
      const src = readFileSync(resolve(__dirname, '..', '..', rel), 'utf-8')
      // \bstatus\b 单独用是**假护栏**：一句 `// 见 K9 status 口径` 就能让它绿。
      // 要的是"真的读了这个字段"——比较、switch、或经全站唯一口径的 helper。
      expect(src).toMatch(/\bstatus\b\s*[!=]==|switch\s*\([^)]*\bstatus\b|\brunStatusTag\b|\bstatusTag\w*\(/)
    })
  }

  it('豁免表里的文件确实渲染 total_return，且理由不是空话', () => {
    for (const [rel, why] of Object.entries(EXEMPT)) {
      expect(why.length, `${rel} 的豁免理由没写清楚`).toBeGreaterThan(10)
      const src = readFileSync(resolve(__dirname, '..', '..', rel), 'utf-8')
      expect(src).toContain('total_return')
      // 豁免的前提是它走了另一条有效性通道
      expect(src).toMatch(/\binvalid\b/)
    }
  })

  it('清单本身没漏：全仓渲染 total_return 的文件要么在表里、要么被显式豁免', () => {
    // 这条防的是"加了新页面显示收益却没进上面的清单" —— 那样断言 1 就悄悄失效了。
    const root = resolve(__dirname, '..', '..')
    const walk = (dir: string, out: string[]) => {
      for (const name of readdirSync(dir)) {
        const p = resolve(dir, name)
        if (statSync(p).isDirectory()) walk(p, out)
        else if (/\.(vue|ts)$/.test(name) && !name.includes('.test.')) {
          if (readFileSync(p, 'utf-8').includes('total_return')) out.push(p)
        }
      }
      return out
    }
    const covered = new Set([...FILES, ...Object.keys(EXEMPT)].map((f) => resolve(root, f)))
    // types/ 与 api/ 只是声明字段、不渲染，允许不在表里
    const offenders = walk(resolve(root, 'src'), [])
      .filter((p) => !covered.has(p))
      .filter((p) => !/[\\/](types|api)[\\/]/.test(p))
      .map((p) => p.replace(root + sep, ''))

    expect(offenders, `这些文件渲染 total_return 但未纳入 status 检查：${offenders.join(', ')}`).toEqual([])
  })
})
