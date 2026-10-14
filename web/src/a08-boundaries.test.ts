import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * A-08 的三条机械腿（断言 4 / 断言 5 / 「用户可见字符串不夹 markdown」那条约束）。
 *
 * 为什么用源码扫描而不是行为测试：这三条要防的都是**新增代码悄悄破规矩** ——
 * 新开一条推送、把稿上的湖仓元素当真做、往文案里写 `**加粗**`。这三种东西在
 * 行为测试里都长得完全正常（请求发得出去、界面渲染得挺好），只有读源码才看得出越界。
 * 写法与 A-07 断言 1 那条机械腿一致（白名单式 fail-closed）。
 *
 * 扫描范围是 `web/src` 下**非测试**的 .vue/.ts；测试文件允许出现被禁词（它们就是用来
 * 断言禁词的），实现文件不允许。
 */
const SRC_ROOT = resolve(__dirname)

function sourceFiles(): string[] {
  const out: string[] = []
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = resolve(dir, name)
      if (statSync(p).isDirectory()) walk(p)
      else if (/\.(vue|ts)$/.test(name) && !name.includes('.test.')) out.push(p)
    }
  }
  walk(SRC_ROOT)
  return out.sort()
}

const rel = (abs: string) => abs.slice(SRC_ROOT.length + 1).replace(/\\/g, '/')

/**
 * 剥掉注释后的源码 —— 禁词判据只看**可能被渲染的东西**：
 * 一句 `// 不实现 Parquet` 是设计说明，不是实现，判它违规会让守卫变成噪声源。
 * 行注释正则避开 `http://`（前置冒号）与单词内的斜杠。
 */
function codeText(abs: string): string {
  return readFileSync(abs, 'utf8')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(?<![:\w])\/\/[^\n]*/g, '')
}

const FILES = sourceFiles()

describe('A-08 断言 4：推送腿只有单作业进度流那一条', () => {
  /**
   * fail-closed 登记集：构造 EventSource 的文件**有且只有** store 那一处。
   * 判据是 `new EventSource(`（真的构造），不是 "EventSource" 这个词 ——
   * 后者在注释和文档里合法出现，拿它当判据会得到一处假红 + 一处真漏。
   */
  const CONSTRUCTORS = ['stores/sync.ts']

  it('构造点集合等于登记集，别处想开第二条腿就得先改这张表', () => {
    const found = FILES.filter((p) => codeText(p).includes('new EventSource(')).map(rel)
    expect(found).toEqual(CONSTRUCTORS)
  })

  it('那唯一一条腿打的是单作业进度端点，不是任意一条 SSE', () => {
    const store = codeText(resolve(SRC_ROOT, 'stores/sync.ts'))
    expect(store).toMatch(/new EventSource\(\s*syncJobProgressStreamPath\(/)
    const api = codeText(resolve(SRC_ROOT, 'api/sync.ts'))
    expect(api).toMatch(/\/api\/sync\/jobs\/\$\{[^}]+\}\/progress/)
  })

  it('协议名不出现在任何 .vue 的用户可见文案里（屏上说的是「实时」，不是 SSE）', () => {
    const offenders = FILES.filter((p) => p.endsWith('.vue'))
      .filter((p) => /\bSSE\b|EventSource/.test(codeText(p)))
      .map(rel)
    expect(offenders, `文案里出现协议名：${offenders.join(', ')}`).toEqual([])
  })
})

describe('A-08 断言 5：稿上的湖仓 / 集群 / L2 元素零实现', () => {
  // 这 6 个词是断言 5 的被 grep 项，逐个带词边界（translateY 里的 "sla" 不算 SLA）。
  const BANNED: [string, RegExp][] = [
    ['Parquet', /\bparquet\b/i],
    ['Iceberg', /\biceberg\b/i],
    ['DuckDB', /\bduckdb\b/i],
    ['GPU', /\bgpu\b/i],
    ['SLA', /\bsla\b/i],
    ['Level2 逐笔', /\blevel[\s_-]?2\b/i],
  ]

  it('六个词在实现源码（含类型与端点常量）里命中 0', () => {
    const hits: string[] = []
    for (const p of FILES) {
      const text = codeText(p)
      for (const [word, re] of BANNED) {
        if (re.test(text)) hits.push(`${rel(p)} → ${word}`)
      }
    }
    expect(hits, `湖仓/集群/L2 越界：${hits.join(', ')}`).toEqual([])
  })

  // 正证据腿：规则得真的抓得到东西，不然「命中 0」只是没在扫。
  it('违例样本会被同一套规则抓到（守卫不是空跑）', () => {
    const sample = '<div>数据湖 level 2 逐笔 · Parquet 缓存 · SLA 99.999%</div>'
    const matched = BANNED.filter(([, re]) => re.test(sample))
      .map(([w]) => w.toLowerCase())
      .sort()
    expect(matched).toEqual(['level2 逐笔', 'parquet', 'sla'])
  })

  it('扫描面本身不为空（79 个源文件这个量级掉到 0 就是守卫失效）', () => {
    expect(FILES.length).toBeGreaterThan(60)
  })
})

describe('A-08 约束：用户可见字符串不夹 markdown', () => {
  // A-05/A-06/A-08 三连复发的同一个坑：把 `**加粗**` 写进文案，屏幕上原样显示星号。
  // 全站判据（不只是本屏）：这条规则的违例成本是「用户看见星号」，而收益是零。
  const MD_BOLD = /\*\*[^*\n]{1,80}\*\*/

  it('剥掉注释后，全仓实现源码里没有 **加粗** 残留', () => {
    const offenders = FILES.filter((p) => MD_BOLD.test(codeText(p))).map(rel)
    expect(offenders, `文案夹了 markdown：${offenders.join(', ')}`).toEqual([])
  })

  it('违例写法确实会被抓到（同一条正则的正证据腿）', () => {
    expect('已登记为 core 工单 **DATA-02**。').toMatch(MD_BOLD)
  })
})
