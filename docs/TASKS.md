# quant-trading-ui · 任务台账

> 任务定义规范沿用 core 仓 `quant-trading/AGENTS.md` §8.5（六字段：①目标 ②上下文 ③要求 ④约束与非目标 ⑤验收 ⑥边界）。
> 状态标记：`⬜ 待做` / `🔶 进行中` / `⛔ 阻塞` / `✅ 完成（附日期）`

---

## AUD-61 · e2e 套件与前端结构脱节（测试债） ⬜

> 2026-10-14 自 core 仓 `quant-trading/docs/TASKS.md` §五迁入——e2e 套件随前端拆仓（2026-10-09）已物理归属本仓，且本仓前端正处设计系统重构（DESIGN.md v2.0），e2e 将大改，留 core 主线已无执行意义。本文件为 AUD-61 唯一归属地。

- **① 目标**：e2e 套件恢复「全绿 = 真实通过」的可信账目——已知红全部 `test.fixme` 显式登记在案；前端重构落地后按页重对齐选择器与期望值，直至 fixme 清零。
- **② 上下文**：
  - 套件位置：`e2e/tests/` 共 18 个 spec（api-backtest / api-health / api-negative / api-strategy / auth-login-flow / backtest-engine / copilot / copilot-e2e / critical-e2e / cross-navigation / dashboard / data-sync / data-sync-error / data-sync-schedule / rbac-open-access / screener / strategy-selector / visual-regression）。
  - 运行配置：`e2e/playwright.config.ts`——`BASE_URL`（默认 :5173）、`DATA_SERVICE_URL`（:8081）、`BACKEND_URL`（:8085）、`workers: 1`、CI 下 `forbidOnly` + retries 2；数据隔离由 `e2e/helpers/isolation.ts`（库级隔离）保证。
  - 历史实测（2026-10-13 干净环境，core 台账原记录）：**127 passed / 34 failed / 2 skipped**；34 条全归因、与代码改动无关——套件选择器/期望值与前端结构脱节。
  - 前端现状：`feat/design-tokens-v2-palette-sweep` 分支正在做设计系统重构（DESIGN.md v2.0 为唯一基准、调色板全量扫仓），页面结构将大改 ⇒ **现在按旧结构重对齐是白做工**，先登记、后对齐。
  - 红线（继承 core 台账原文）：不得把「34 条红」洗成「已验证通过」，也不得放宽断言消红。
- **③ 要求**：
  - **阶段一（先做，独立可交付）**：起齐三服务（前端 :5173 / data-service :8081 / analysis :8085）后干净环境跑 `npx playwright test` 取得**当前**红清单（重构进行中，数字会漂移，以实测为准）；每条红改为 `test.fixme("AUD-61: <一句话归因>")` 并在下方登记表登记一行。除 fixme 与登记表外**不改任何断言/选择器/期望值**。
  - **阶段二（设计系统重构落地后）**：按页面分批重对齐——每批一个 commit，对齐一条则同步删除该条 fixme 与登记行；选择器优先 `data-testid`，不靠文案/DOM 位置（重构即碎）。
  - 登记表列：`spec 文件 | 用例名 | 红因归类 | fixme 日期 | 对齐批次 | 清除日期`。

  | spec 文件 | 用例名 | 红因归类 | fixme 日期 | 对齐批次 | 清除日期 |
  |---|---|---|---|---|---|
  | （阶段一实测后填写） | | | | | |

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
