import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import EvidenceProbe from './EvidenceProbe.vue'
import { ApiError } from '@/api/client'

/**
 * A-06 证据质问入口的验收测试（TASKS.md A-06 断言 2/4/5/6 + F6 的三条语义）。
 *
 * 抽屉内容经 teleport 挂到 document.body，所以断言查的是**真实 DOM**，
 * 不是 wrapper —— 查不到 wrapper 里的东西会误判成"没渲染"。
 */
const getEvidence = vi.fn()
vi.mock('@/api/evidence', () => ({
  getEvidence: (h: string) => getEvidence(h),
}))

const push = vi.fn()
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))

const record = {
  content_hash: 'a'.repeat(64),
  source: 'akshare',
  dataset: 'akshare.stock_financial_abstract',
  key: '600519.SH/2023Q4',
  as_of: '2024-01-20',
  fetched_at: '2024-01-21T02:00:00Z',
  payload: { net_profit: 3e10 },
}

function bodyText(): string {
  return document.body.textContent ?? ''
}

async function mounted(props: { label: string; hash?: string | null; reason?: string; value?: string }) {
  const w = mount(EvidenceProbe, {
    props,
    attachTo: document.body,
    global: { stubs: { transition: false } },
  })
  await flushPromises()
  return w
}

beforeEach(() => {
  document.body.innerHTML = ''
  getEvidence.mockReset()
  push.mockReset()
})

describe('EvidenceProbe — 没有坐标的数字', () => {
  it('断言 4：屏幕上直接写着"无法回溯"，不用点、不用 hover', async () => {
    const w = await mounted({ label: 'Sharpe', value: '1.42' })
    expect(w.get('[data-testid="ev-probe-trigger"]').text()).toBe('无法回溯')
    // 没坐标时**不许**去查 —— 空 hash 打出去会得到一个假的"未摄取"
    expect(getEvidence).not.toHaveBeenCalled()
  })

  it('点开后说清"为什么"，而不是只说"不行"', async () => {
    const w = await mounted({ label: 'Sharpe', reason: '回测结果不落 content_hash' })
    await w.get('[data-testid="ev-probe-trigger"]').trigger('click')
    await flushPromises()
    expect(bodyText()).toContain('无法回溯')
    expect(bodyText()).toContain('回测结果不落 content_hash')
    expect(document.querySelector('[data-testid="ev-probe-not-ingested"]')).toBeNull()
  })
})

describe('EvidenceProbe — 有坐标', () => {
  it('断言 2：打开抽屉**不改 URL**（质问不该把人从报告里拽走）', async () => {
    getEvidence.mockResolvedValue(record)
    const w = await mounted({ label: '因子 IC', hash: record.content_hash })
    const before = window.location.href
    await w.get('[data-testid="ev-probe-trigger"]').trigger('click')
    await flushPromises()
    expect(push).not.toHaveBeenCalled()
    expect(window.location.href).toBe(before)
  })

  it('断言 3：一次点击就到原始记录 —— 打开即解析并展示来源五元组', async () => {
    getEvidence.mockResolvedValue(record)
    const w = await mounted({ label: '因子 IC', hash: record.content_hash })
    await w.get('[data-testid="ev-probe-trigger"]').trigger('click')
    await flushPromises()
    expect(getEvidence).toHaveBeenCalledTimes(1)
    expect(getEvidence).toHaveBeenCalledWith(record.content_hash)
    expect(bodyText()).toContain('akshare')
    expect(bodyText()).toContain('600519.SH/2023Q4')
    expect(document.querySelector('[data-testid="evidence-record"]')).not.toBeNull()
  })

  it('断言 5：404 是"未摄取"警示态，不是错误态', async () => {
    getEvidence.mockRejectedValue(new ApiError(404, 'not found'))
    const w = await mounted({ label: '因子 IC', hash: record.content_hash })
    await w.get('[data-testid="ev-probe-trigger"]').trigger('click')
    await flushPromises()
    expect(document.querySelector('[data-testid="ev-probe-not-ingested"]')).not.toBeNull()
    expect(bodyText()).toContain('未摄取')
    // 关键：不能同时报"查询失败" —— 那会把"这条没归档"说成"系统坏了"
    expect(document.querySelector('[data-testid="ev-probe-failed"]')).toBeNull()
    expect(bodyText()).not.toContain('查询失败')
  })

  it('非 404 才是查询失败，且不许冒充"未摄取"', async () => {
    getEvidence.mockRejectedValue(new ApiError(500, '服务器内部错误'))
    const w = await mounted({ label: '因子 IC', hash: record.content_hash })
    await w.get('[data-testid="ev-probe-trigger"]').trigger('click')
    await flushPromises()
    expect(document.querySelector('[data-testid="ev-probe-failed"]')).not.toBeNull()
    expect(bodyText()).toContain('服务器内部错误')
    expect(bodyText()).not.toContain('未摄取')
  })

  it('换一个数字必须重查 —— 沿用上一个 hash 的结果等于张冠李戴', async () => {
    getEvidence.mockResolvedValue(record)
    const w = await mounted({ label: 'IC', hash: record.content_hash })
    await w.get('[data-testid="ev-probe-trigger"]').trigger('click')
    await flushPromises()
    expect(getEvidence).toHaveBeenLastCalledWith(record.content_hash)

    // 抽屉**开着**的时候坐标换了（列表重排 / 父组件复用实例渲染另一行）。
    // 只 watch open 的话这里不会重查，屏幕上会继续挂着上一个数字的原始记录。
    const other = 'b'.repeat(64)
    await w.setProps({ label: 'ICIR', hash: other })
    await flushPromises()
    expect(getEvidence).toHaveBeenLastCalledWith(other)
  })

  it('断言 6：深链兜底仍在 —— 用户主动要完整页时才跳，且带上坐标', async () => {
    getEvidence.mockResolvedValue(record)
    const w = await mounted({ label: '因子 IC', hash: record.content_hash })
    await w.get('[data-testid="ev-probe-trigger"]').trigger('click')
    await flushPromises()
    const link = document.querySelector('[data-testid="ev-probe-deeplink"]')
    expect(link).not.toBeNull()
    link!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()
    expect(push).toHaveBeenCalledWith({
      name: 'evidence',
      query: { content_hash: record.content_hash },
    })
  })
})
