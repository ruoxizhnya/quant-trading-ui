import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import DataQualityPanel from './DataQualityPanel.vue'
import { ApiError } from '@/api/client'

/**
 * PIT / 幸存者两块（A-08 断言 6）的判据：**数据缺席时走显式空态**。
 *
 * 这块最容易被写成的样子是"拿总数编一个看起来像研究质量的数字"（把 5908 叫作
 * 在市股票数、或算一个退市占比出来）。所以除了"该显示什么"，更要紧的是钉住
 * **不该出现什么**：没有编造的百分比，也没有前端去请求一条网关上并不存在的端点。
 */
const market = vi.hoisted(() => ({ getStockCount: vi.fn() }))
const syncApi = vi.hoisted(() => ({ getDataSourceStatus: vi.fn(), getDataSourceHealth: vi.fn() }))

vi.mock('@/api/market', () => market)
vi.mock('@/api/sync', () => syncApi)

beforeEach(() => {
  vi.clearAllMocks()
})

async function mountPanel() {
  const w = mount(DataQualityPanel)
  await flushPromises()
  return w
}

describe('幸存者偏差块', () => {
  it('只显示真读到的总数，且标签明写含已退市', async () => {
    market.getStockCount.mockResolvedValue({ count: 5908 })
    const w = await mountPanel()
    expect(w.find('[data-testid="surv-total"]').text()).toContain('票池记录（含已退市）')
    expect(w.find('[data-testid="surv-total"]').text()).toContain('5908')
    expect(w.text()).not.toContain('在市股票数')
  })

  it('不编造退市占比，只指名缺的是哪条通道、登记在哪张工单', async () => {
    market.getStockCount.mockResolvedValue({ count: 5908 })
    const w = await mountPanel()
    const gap = w.find('[data-testid="surv-gap"]').text()
    expect(gap).toContain('缺读数通道')
    expect(gap).toContain('DATA-02')
    // 判据钉的是"没有编造出来的比例"，不是"不许出现某个词"——文案里正当提到
    // 「不显示退市占比」也会被禁词式断言误伤（第一版就是这么红的）。
    expect(w.find('[data-testid="survivorship-block"]').text()).not.toMatch(/\d+(\.\d+)?\s*%/)
  })

  it('总数读不到时显示未读取，不用 0 顶替', async () => {
    market.getStockCount.mockRejectedValue(new ApiError(500, '服务暂时不可用，请稍后重试'))
    const w = await mountPanel()
    expect(w.find('[data-testid="surv-total"]').text()).toContain('未读取')
    expect(w.find('[data-testid="quality-error"]').text()).toBe('服务暂时不可用，请稍后重试')
  })

  it('用户可见文案里不夹 markdown（A-05/A-06 复发过的老坑，这次也在同一条上栽了）', async () => {
    market.getStockCount.mockResolvedValue({ count: 5908 })
    const w = await mountPanel()
    const text = w.text()
    expect(text).not.toContain('**')
    expect(text).not.toMatch(/(^|\s)#[^ ]/)
    expect(text).not.toContain('__')
  })

  it('后端有原话时显示原话，不被通用文案盖掉', async () => {
    market.getStockCount.mockRejectedValue(
      new ApiError(400, '请求参数有误', { code: 'bad_request', error: 'stocks table not migrated' }),
    )
    const w = await mountPanel()
    expect(w.find('[data-testid="quality-error"]').text()).toBe('stocks table not migrated')
  })
})

describe('PIT 三时刻块', () => {
  it('三个时刻各自成行，全部标为无通道（今天没有一条能真跑）', async () => {
    market.getStockCount.mockResolvedValue({ count: 5908 })
    const w = await mountPanel()
    expect(w.find('[data-testid="pit-financial-end"]').text()).toContain('财务期末（report_date）')
    expect(w.find('[data-testid="pit-ann-date"]').text()).toContain('公告披露（ann_date）')
    expect(w.find('[data-testid="pit-tradeable"]').text()).toContain('因子可交易起始')
    for (const testid of ['pit-financial-end', 'pit-ann-date', 'pit-tradeable']) {
      expect(w.find(`[data-testid="${testid}"]`).text()).toContain('无通道')
    }
  })

  it('缺口分两层写清：数据没摄取（EQD-P1-2）与通道没转发（DATA-03），并各留实测形状', async () => {
    market.getStockCount.mockResolvedValue({ count: 1 })
    const w = await mountPanel()
    const gap = w.find('[data-testid="pit-gap"]').text()
    expect(gap).toContain('EQD-P1-2')
    expect(gap).toContain('DATA-03')
    expect(gap).toContain('0 行')
  })

  it('不请求网关上并不存在的历史端点（前端不新增后端没有的假设）', async () => {
    market.getStockCount.mockResolvedValue({ count: 5908 })
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await mountPanel()
    await flushPromises()
    const urls = fetchMock.mock.calls.map((c) => String(c[0]))
    expect(urls.some((u) => u.includes('fundamentals'))).toBe(false)
    expect(urls.every((u) => u.includes('stocks/count'))).toBe(true)
    vi.unstubAllGlobals()
  })
})
