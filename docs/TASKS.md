# quant-trading-ui · 任务台账

> 任务定义规范沿用 core 仓 `quant-trading/AGENTS.md` §8.5（六字段：①目标 ②上下文 ③要求 ④约束与非目标 ⑤验收 ⑥边界）。
> 状态标记：`⬜ 待做` / `🔶 进行中` / `⛔ 阻塞` / `✅ 完成（附日期）`

---

## AUD-61 · e2e 套件与前端结构脱节（测试债） ⬜

> 2026-10-14 自 core 仓 `quant-trading/docs/TASKS.md` §五迁入——e2e 套件随前端拆仓（2026-10-09）已物理归属本仓，且本仓前端正处设计系统重构（DESIGN.md v2.0），e2e 将大改，留 core 主线已无执行意义。本文件为 AUD-61 唯一归属地。

- **① 目标**：e2e 套件恢复「全绿 = 真实通过」的可信账目——已知红全部 `test.fixme` 显式登记在案；前端重构落地后按页重对齐选择器与期望值，直至 fixme 清零。
- **② 上下文**：
  - 套件位置：`e2e/tests/` 共 **19** 个 spec（api-backtest / api-health / api-negative / api-strategy / auth-login-flow / backtest-engine / copilot / copilot-e2e / critical-e2e / cross-navigation / **nav-consistency** / dashboard / data-sync / data-sync-error / data-sync-schedule / rbac-open-access / screener / strategy-selector / visual-regression；重构期间 spec 有增减，**阶段一以 `npx playwright test --list` 实测为准**）。
  - 运行配置：`e2e/playwright.config.ts`——`BASE_URL`（默认 :5173）、`DATA_SERVICE_URL`（:8081）、`BACKEND_URL`（:8085）、`workers: 1`、CI 下 `forbidOnly` + retries 2；数据隔离由 `e2e/helpers/isolation.ts`（库级隔离）保证。
  - 历史实测（**2026-09-26** 干净环境，出处 core 仓 `quant-trading-docs/docs/TEST.md` §7.2.0 实测读数 + core 台账原记录）：**127 passed / 34 failed / 2 skipped（共 163）**；34 条全归因（24 条 DOM/选择器漂移 + 4 条 API 期望过时 + …）、与代码改动无关——套件选择器/期望值与前端结构脱节。
  - 前端现状：`feat/design-tokens-v2-palette-sweep` 分支正在做设计系统重构（DESIGN.md v2.0 为唯一基准、调色板全量扫仓），页面结构将大改 ⇒ **现在按旧结构重对齐是白做工**，先登记、后对齐。
  - 红线（继承 core 台账原文）：不得把「34 条红」洗成「已验证通过」，也不得放宽断言消红。
- **③ 要求**：
  - **阶段一（先做，独立可交付）**：起齐三服务（前端 :5173 / data-service :8081 / analysis :8085）后干净环境跑 `npx playwright test` 取得**当前**红清单（重构进行中，数字会漂移，以实测为准）；每条红改为 `test.fixme("AUD-61: <一句话归因>")` 并在下方登记表登记一行。除 fixme 与登记表外**不改任何断言/选择器/期望值**。
  - **阶段二（设计系统重构落地后）**：按页面分批重对齐——每批一个 commit，对齐一条则同步删除该条 fixme 与登记行；选择器优先 `data-testid`，不靠文案/DOM 位置（重构即碎）。
  - 登记表列：`spec 文件 | 用例名 | 红因归类 | fixme 日期 | 对齐批次 | 清除日期`。

  | spec 文件 | 用例名 | 红因归类 | fixme 日期 | 对齐批次 | 清除日期 |
  |---|---|---|---|---|---|
  | （阶段一实测后填写） | | | | | |

- **实测登记（2026-10-14，A-07 收口时顺手取的真实读数；阶段一的 fixme 转换仍未做）**：
  - **179 条用例 = 61 failed / 116 passed / 2 skipped**（`workers: 1`，本地栈齐全）。
    **本节 ② 里"127 passed / 34 failed"那份 2026-09-26 的历史读数已经过时**，
    红条数在涨（34 → 61），而涨的部分主要是下面第 ④ 类（共享限流）与第 ① 类（死选择器）。
  - **一处方法学错误必须先认**：此前两次"全量套件 0 failed"的读数**都是错的** ——
    命令写成 `npx playwright test | tail -30`，**管道把退出码换成 `tail` 的 0**，
    而截断恰好把红清单整段切掉。判据只能是不截断重跑 + 读 playwright 自己的退出码
    （`EXIT=1`）。台账里 A-06 那条"全量 0 failed"已按此更正。
  - 按 spec 的红分布（共 61）：copilot-e2e 9、backtest-engine 9、data-sync-error 6、
    data-sync 6、rbac-open-access 5、dashboard 5、evidence-probe 4、critical-e2e 4、
    visual-regression 3、strategy-selector 2、status-tristate 2、api-negative 2、
    api-backtest 2、data-sync-schedule 1、cross-navigation 1。
  - 四类根因，各附**当场核过**的证据：
    ① **死选择器 / 结构漂移**（阶段二的活）。例：`dashboard.spec.ts:75` 等
    `.quick-bt-card` —— `git show HEAD:web/src/components/dashboard/QuickBacktest.vue`
    里**这个类名 0 命中**，全仓也 0 命中 ⇒ 这条红与本轮改动无关，早于本轮。
    ② **strict-mode 撞上后加的结构**。例：`backtest-engine.spec.ts:49` 断
    `.n-button--primary-type` 唯一，但 `BacktestEngine.vue` 的同步/异步切换
    （`asyncMode = ref(true)`，HEAD 里 `:155` 就是这个默认值）让页面上有**两枚**
    primary 按钮 ⇒ 选择器必须换 `data-testid` 或 `getByRole(name)`。
    ③ **纯 API 用例的数据期望**。例：`api-backtest.spec.ts:174` 断
    `typeof report.win_rate === 'number'` 实得 `undefined` —— 这与 OBS-01 同源：
    被判 `invalid` 的运行**指标键是缺席的**（2026-10-14 实测：`POST /api/backtest`
    拿 `["csi300"]` 当票池，返回里没有 `total_return`/`sharpe_ratio`，却带着
    `sortino_ratio=1.79e+308`）。用例假设"每次运行都带全指标"，那个假设已经不成立。
    ④ **共享限流**。本地 analysis-service 的限流桶是**全进程共享**的，一次全量套件
    里 `GET /api/backtest` 会 429，于是 `expect(res.ok())` 在**与自己改动无关**处变红。
    本轮已把我自己写的两条 spec（`evidence-probe` / `status-tristate`）的取值 helper
    改成走 `helpers/api.ts` 新增的 `getJsonWithBackoff` —— **只对 429 退避**
    （404/500 照旧响），且退避预算必须远小于 30s 用例超时（第一版写 8×5s=40s，
    把"429 红"变成了"超时红"，归因更难，已改）。其余 spec 的同类改造属阶段一/二，
    **不在这里全仓铺开**。
  - 红线不变：不得为消红放宽断言或删用例。上面 ③ 那条若要改期望值，必须先在
    core 侧确认"invalid 运行不带指标"是**契约**而非缺陷（`contracts.CheckValidity`
    与 ResultSpec 的口径支持前者），改的时候在登记行写明依据。

- **④ 约束与非目标**：
  - DO NOT 放宽/删除断言、改期望值迁就现状、把红改成裸 `skip`——消红唯一合法路径是对齐选择器与期望。
  - DO NOT 在设计系统重构落地前做阶段二的重对齐（防白做工）。
  - DO NOT 动 `web/src` 生产代码——e2e 债归 e2e；对齐过程中发现的前端缺陷另立工单，不在本单修。
  - DO NOT 改 `e2e/playwright.config.ts` 与 `helpers/isolation.ts` 的隔离机制（库级隔离是防测试串数据的护栏，AUD-62 同源教训）。
- **⑤ 验收**：
  - 阶段一：`npx playwright test` 输出 **0 failed**（红全部以 fixme 形式登记在案，报告可见 fixme 注解）；登记表行数 == fixme 总数；随机抽 3 条与实测红清单核对一致。
  - 破坏验证（护栏必验）：任选一条登记项**去掉 fixme 前缀重跑 → 该条必须重新变红**（证明 fixme 没把真红藏起来）→ 逐字节还原。
  - 阶段二：每批对齐后全量套件仍 0 failed；批次收口时登记行同步清除，最终登记表为空。
- **⑥ 边界**：只做 `e2e/` 目录 + 本登记表；前端生产代码缺陷、core 侧问题均另立工单。

---

## API-01 · client.ts 把后端 4xx 原话换成通用文案（🟠 全站错误可读性） ⬜ 待批

- **① 目标**：任何一次 4xx 失败，界面上出现的**是后端那句话说**，而不是按状态码查表得到的「请求参数有误」。
- **② 上下文**（2026-10-14 A-08 步骤 4 浏览器实测当场抓出）：
  - 表单填非法 cron ⇒ 界面显示「请求参数有误」；同一请求 `curl` 实测后端返回
    `{"code":"bad_request","error":"invalid cron expression: expected exactly 6 fields, found 3: [99 99 99]"}`
    —— 原话**到了浏览器**，被前端丢掉。
  - 丢的位置：`web/src/api/client.ts:247` `const message = getStatusMessage(res.status, errMsg)`，
    而 `STATUS_MESSAGES`（`:62-74`）给 400/401/403/404/409/422/429/5xx 都备了中文模板，
    `getStatusMessage` **模板优先**，`errMsg`（后端原话）只在模板缺失时才用。
    `ApiError.body` 里原话仍在（`:242` 已把 body 存下来），所以是可恢复的，不是后端缺陷。
  - 后端侧口径（core 仓 `pkg/httpserver/errors.go:100-108`、`:163-176`）：4xx 透传
    `err.Error()` 到 `error` 字段；**≥500 故意只给人话 + code**，细节留服务端。
    所以本单只动 4xx 这一支，5xx 的通用文案是对的、不要改。
  - A-08 已在边界内止血：新增 `web/src/utils/apiMessage.ts`（读取顺序 **后端原话 > 通用文案 > 兜底串**），
    `stores/sync.ts` 的 13 处错误写入与排程表单统一走它 —— 本单要解的是**其余所有页面**仍在显示模板。
- **③ 要求**：
  1. `client.ts` 里把优先级反过来：**4xx 有可用原话就用原话**，否则退回模板；5xx 恒用模板。
  2. 抽掉的模板不能变成空白：body 里 `error/message/detail` 皆空时仍落模板（`apiMessage.ts` 已有这条口径，复用而不是再写一份）。
  3. 三条钉旧口径的既有测试按**行为变更**更新（不是为消红改断言）：`client.test.ts:115`（404 localized）、`:127`（418 `error: 'I am a teapot'`）、`:142`（429）。
  4. 更新后全站复核：`Screener`/`BacktestEngine`/`Dashboard`/`Copilot` 各挑一条 4xx 路径确认文案来源可质问。
- **④ 约束与非目标**：不改 5xx 与 401 的会话处理链（`refreshSession`/`settleUnauthorized` 那条不变）；不改 `ApiError` 的字段与 `isClientError` 等判定；不动后端任何响应形状；不把错误文案做 i18n。
- **⑤ 验收**：
  - 单测：400 带 `body.error` ⇒ `ApiError.message` 等于后端原话；400 不带 ⇒ 等于「请求参数有误」；500 带细节 body ⇒ **仍**是模板（证明没把后端内部错误暴露出去）。
  - 破坏验证：把优先级改回模板优先 ⇒ 上述第一条红，还原绿。
  - 真请求：非法 cron 与非existent 资源各一次，屏幕文案与 `curl` 的 `error` 字段逐字一致。
- **⑥ 边界**：只改 `api/client.ts` 的 message 取值一处 + 相关测试；`apiMessage.ts` 的调用点不改语义（它自然变成透传）。
