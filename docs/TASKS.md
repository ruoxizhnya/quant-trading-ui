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

- **V-3 基线登记（2026-10-14，A-08 收口时改判；归本表是因为它动的是测试基础设施）**：
  - `e2e/tests/visual-regression.spec.ts` 的 **data-sync 那张基线**从「遮四块」改成「route fixture 固定 8 条端点」，基线 png 已重生成。
  - 改判依据是实测不是偏好：遮罩版**单独连跑三轮全绿**，但全量套件里同一条用例红了 —— 遮罩只糊像素**不改布局**，被遮的队列面板行数一变就变高，下面每块整体下移进视口。那个"三轮绿"什么也没证明。
  - 双向取证：① 先跑 `a08-job-console`（含改真库的 cancel 腿）再跑这条基线 → 仍绿（不敏感）；② 临时脚手架量得「换 fixture 时 queue/schedule/readout/quality/datasource 五块像素全变」+「同一 fixture 两次整页逐字节相同」→ 基线不是空跑（脚手架跑完即删，不进提交）。
  - 代价（明写）：视觉网**不再覆盖真数据渲染**；页面将来消费新字段时 fixture 必须跟着补，补漏 = 基线照常绿而界面已错。兜底是 A-08 的真后端功能断言 + 组件单测。
  - 本轮新增 e2e：`a08-job-console.spec.ts` **6 条逐条绿**（真后端只读腿 + 真 cancel 写一次 + 三条拦截腿，分界与理由写在文件头），全量运行里也绿。

- **全量复跑读数（2026-10-14，A-08 收口后；上面那份"61 failed"已经过时）**：
  - `npx playwright test` → **79 failed / 104 passed / 2 skipped**（185 条，退出码 1，`workers: 1`，12.5 分钟）。
  - 相对 61 红涨了 18 条，涨的**全部**在纯 API spec：`api-negative` 2→11、`api-backtest` 2→5、`api-health` 0→3、`api-strategy` 0→2、`backtest-engine` 9→11。抽样核对到根因第 ④ 类：`api-negative.spec.ts:15` 的红是 `Expected: 400 / Received: 429`（要 400 拿到限流），不是新缺陷；`api-backtest.spec.ts:186` 是第 ③ 类（`win_rate` 在 invalid 运行里缺席）。
  - 同一次跑里 `visual-regression` 从 3 红降到 2 红（data-sync 那条基线改走 fixture 之后转绿；剩下两条是 `backtest page` 与 tablet 响应式，属第 ①/② 类，早于本轮）。
  - **阶段一的处置建议不变**：先做 fixme 登记再谈对齐 —— 但登记时请把"限流红"与"断言红"分列，否则 429 会把真缺陷淹掉。本轮不做那件事（它是独立可交付的一整块，且需要一次干净环境的基线跑）。

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

## DATA-04 · 空列表编码成 `null` 而不是 `[]`（🟠 契约说谎，任何客户端都会踩） ⬜ 待做 · **待迁 core**

> 归属是 core（`quant-trading` 的 `cmd/data` + `pkg/storage`）。写在**本仓**台账的原因：core 的
> `docs/TASKS.md` 此刻有并行会话的暂存改动（`git status` 显示 `M  docs/TASKS.md` 在 index 里），
> 我去改会把别人的暂存内容一起卷进提交。等那份文件空出来应把本节整体迁过去，本仓只留指针。

- **① 目标**：集合型端点在**结果为空**时返回 `[]`（或 SPEC 明写可为 `null` 并让所有消费方按可空处理），二选一，不能一边声明数组一边给 `null`。
- **② 上下文**（2026-10-14 curl 当场实测，不是读码推测）：
  - `GET :8085/api/sync/jobs?status=pending` → `{"count":0,"jobs":null}`。
  - 根因形状：Go 侧 `Jobs []*SyncJob` 为 nil 时 `encoding/json` 编出 `null`，`[]` 需要显式初始化；`docs/openapi.yaml` 与前端类型 `web/src/types/sync.ts:60`（`jobs: SyncJob[]`）都按**必有数组**写。
  - 前端已止血（本轮 A-08：`stores/sync.ts` 的 `resp.jobs ?? []`，并有单测钉住真形状），但**止血不等于契约对了**：下一个客户端（agent 的 MCP 工具、curl 脚本、别的 SPA 页面）照类型写就会踩。本轮实测里同一个形状在 `schedules` 那条上也有对应处理（`resp.schedules ?? []`），说明这不是孤例而是**一族**。
  - **第三个实测实例（2026-10-16，core DATA-11 自审时顺带查出，已登记为 core `DATA-13`）**：`GET :8085/api/ohlcv/600000.SH?start_date=2024-01-01&end_date=2024-12-31` ⇒ **200 `{"ohlcv":null}`**，同参换 `20240101/20241231` ⇒ 200 带真行。成因不是「集合端点忘了初始化」而是**日期格式被吞**：`pkg/data/cache.go:60` 的 `parseDate` 写着 `t, _ := time.Parse("20060102", s)`，注释自承「Returns zero time on error」⇒ ISO 写法塌成零值日期、查询范围 `[0001-01-01, 0001-01-01]`、结果 nil slice 编成 `null`。分工提醒，别各自收一半：**本单管形状**（空集合该是 `[]` 还是明写可空），**core DATA-13 管成因**（坏格式该 400 而不是装成没数据）；同一台服务上 `cmd/data/handlers_factor.go:223-229` 对同样的 `YYYYMMDD` 声明是**回 400** 的，可见两种做法已经并存。
- **③ 要求**：把该族端点（至少 `GET /api/sync/jobs`、`GET /api/sync/schedules`）在空结果时序列化成 `[]`；或反过来在 SPEC/openapi 里把字段标成可空并同步所有已知消费方。**形状与取舍由 core 定**，前端不指挥。
- **④ 约束与非目标**：不改前端已就位的 fail-closed（那是防御，不是本单的解）；不动 `ResultSpec`；不在本单里顺手改别的端点 —— 先盘点还有哪些集合端点会吐 `null`，把清单写进结案记录。
- **⑤ 验收**：
  - `curl` 拿一条**保证为空**的查询（例如 `?status=retrying`，实测库里 0 条）→ body 里该字段是 `[]`（或 SPEC 明写可空且消费方同步完）。
  - 加一条 Go 侧断言：空结果路径序列化后含 `":[]"` 而不是 `":null"`（照 `pkg/storage/bulk_insert_ddl_test.go` 那种静态读源码/编解码的零 DB 依赖做法）。
  - **破坏验证**：把 `?? []` 那类前端防御临时摘掉 ⇒ 队列面板那条 e2e（`a08-job-console.spec.ts` 的「空队列的真实回包走空态」）必须红，还原转绿 —— 证明那条 e2e 真在钉形状，不是常驻绿。
- **⑥ 边界**：只处理"空集合的编码形状"这一件事；`latest_date` 静默缺席与 PIT 通道是 DATA-03，票池拆分是 DATA-02。

## UI-01 · 「研究质量读数」文案过期 + `fmtVolume/fmtAmount` 把 0 读成缺失（两处界面在撒谎）⬜ 待做

> 2026-10-16 做 core 仓 DATA-03 + DATA-07 合体单时顺带实测发现，归属本仓（前端展示与文案）。
> 那两单里已改的是**契约与类型**（`StockCount` 现含 `by_status` 与 `latest_date: string | null`；
> `MarketIndex` 现含 `volume/amount`），**没改**的是下面这两处。
>
> ⚠️ **登记后已就地订正一小部分（2026-10-16，DATA-07 并入前自审）**：`DataQualityPanel.vue`
> 的 PIT 通道那句（原文「它的总数接口里声明的行情最新日实测从不返回 —— 两个形状问题登记为
> core 工单 DATA-03」）与 script 注释里同一说法，被 DATA-03 的落地**证伪**（那个键现在恒在），
> 已随自审改掉，PIT 那块也改成「DATA-03 裁决不开放 + 护栏已钉」的口径。
> **本单剩下的**是：把 `by_status` / `latest_date` 真读数接上屏（下面 ③ 第一条），以及
> `fmtVolume/fmtAmount` 的 `0` 分支 —— 这两件不是文案失真，是没做的读数与错显示。

- **① 目标**：屏幕上不再有与后端实际能力相反的说明文字，也不再有「把 0 显示成没数据」的格式化函数。
- **② 上下文**（2026-10-16 实测，`/data-sync` 页 DOM 回读 + 源码逐行）：
  - `components/sync/DataQualityPanel.vue:31-37` 的文案写着「在市 / 退市拆分**没有只读接口**：SPA 能走到的只有票池总数……已登记为 core 工单 DATA-02」。但 DATA-02 早已在 `GET /api/stocks/count` 给出 `by_status`（实测 `{"active":5569,"delisted":339}`），DATA-03 又给出 `latest_date`；类型 `types/api.ts` 也已带上这两个字段。**文案与能力相反** = 用户与下一个改前端的人都会被它带去重开一条已经存在的通道。
  - 同页 `utils/format.ts:33-43`：`fmtVolume` 与 `fmtAmount` 都以 `if (!v) return '-'` 开头 —— `0` 是 falsy，于是「成交量 0 股」被显示成 `-`（没读数）。这与 A-08/DATA-07 刚立的口径（`null` 才是没有读数，0 是 0）直接冲突。`format.test.ts` 甚至把 `fmtVolume(0) → '-'` 当成期望钉住了（:104-105），所以要改的是**断言与实现一起**，属于行为变更，得单独走。
- **③ 要求**：
  - 把 `DataQualityPanel` 的 PIT / 幸存者两块改成消费 `by_status`（在市/退市两档真读数 + 退市占比）与 `latest_date`（行情最新日），拿不到时才走显式空态；文案里"没有只读接口"整段按现状重写或删除。
  - `fmtVolume` / `fmtAmount` 改成只在 `null`/`undefined`/`NaN` 时返回占位，`0` 正常格式化；同步更新 `format.test.ts` 里钉住旧行为的那两条用例（改断言要写明理由，不许静默翻转）。
- **④ 约束与非目标**：不动后端契约（形状由 core 定，本单只是接住已给的字段）；不在前端算 `5908 - 339` 之类客户端重建（core AGENTS.md §9 禁止两处真相）；不改其他格式化函数。
- **⑤ 验收**：`npm test` + `npm run typecheck` + `npm run lint`（0 error）绿；新增/更新的 `MarketMetrics`/`DataQualityPanel` 单测钉住「0 不再显示成占位」与「空态只在 null 时出现」；浏览器实测 `/data-sync` 与 `/` 两页 DOM 回读，屏幕上的文字与 `curl` 拿到的字段集合一致；`e2e/tests/visual-regression.spec.ts` 的 `dashboard.png` 若因文案变化需 `--update-snapshots`，须在结案里写明是有意变化。**破坏验证**：把面板改回读 `count` 单一字段 ⇒ 新断言红；把 `fmtVolume` 的 null 判据改回 `!v` ⇒ 0 那条用例红。
- **⑥ 边界**：只做"文案与能力对齐 + 0 与缺失分得开"；~~`/market/index` 的参数不生效（core DATA-11）~~ **该句已于 2026-10-16 被 core DATA-11 落地证伪**：`(a1)` 参数化后 `?symbol`/`?date` 真下传（网关那层原本连 query 都不带，也一并补上），ui 侧取值改为按选中项命中 + 选中项/日期一变就重取（本仓 `f473fa9`，已在 ui main），日期框同时改成不可清空 —— 清空会让 `market.ts` 的 `if (date)` 把参数省掉，屏上仍是最新一期而框里没有日期，正是本节立的「文案与能力相反」那一族。指数 bar 数据面（core DATA-12）仍不在本单。
