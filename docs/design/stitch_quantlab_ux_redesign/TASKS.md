# 重构任务清单（TASKS）— Quant Lab UI

> **版本**: 1.0（2026-10-13）
> **定位**: 本文件是 UI 重构的**唯一任务台账**。每个任务用 **6 条可判定断言**描述（AGENTS.md §8.5.2 六字段的断言化：一条断言 = 一个可独立判真伪的事实，不是动作描述）。
> **依据**: [ANNOTATIONS.md](ANNOTATIONS.md)（逐控件处置）· [../user-flows.md](../user-flows.md) v1.1（需求基线）· [obsidian_precision_quant/DESIGN.md](obsidian_precision_quant/DESIGN.md) v2.0（token 真相源）· [ODR-066](../../../../../quant-trading-docs/docs/archive/odr/odr-066-stitch-design-review-and-boundary-ruling.md)（裁决）
> **不双写**: 本清单**不**复制进 core 仓 `quant-trading/docs/TASKS.md`。core 侧只登记后端缺口（G1–G8）自己的修复任务。

---

## 图例

| 标记 | 含义 |
|---|---|
| 🟢 **可做** | 依赖端点全部存在（`core` openapi / `sync` `/api/sync/*`），无契约冲突 |
| 🟡 **部分** | 主体可做，个别控件依赖缺失端点 → 该控件画 disabled + "待后端" |
| 🔴 **延后** | 依赖 `ai-service`（:8086）或 G1–G6 后端缺口。**主任裁决 2026-10-13：后端会做但目前没有 ⇒ 相应前端先不做，挂计划** |

**断言的用法**：任务完成 = 6 条断言全部为真且**有取证方式**。任一为假则任务未完成，不得标 done。

---

# 分组 A · 🟢 立即可做（不依赖 ai-service）

## A-01 旧调色板扫页：`BacktestCompare.vue`（8 处）　✅ **已完成 2026-10-13**

| # | 断言 | 取证 |
|---|---|---|
| 1 | 该文件内 `#58a6ff / #f97583 / #85e89d / #ffab70 / #b392f0 / #79b8ff / #ff7b72 / #e1e4e8 / rgba(133,…)` 出现次数为 **0** | `grep -c` = 0 ✅ |
| 2 | 其颜色全部来自 `@/styles/palette` 的 `chartPalette` 或 `--q-*` CSS 变量，二者之一可在源码内被 grep 证明 | 系列色 `chartPalette.seriesCycle`；网格/刻度/图例 `chartPalette.grid/tick/legend/axisTitle`；高亮底 `var(--q-success-soft)` ✅ |
| 3 | `npm run typecheck` 退出码 0，`npm test` 全绿 | 0 错；**257 passed / 21 files** ✅ |
| 4 | 该页 canvas 像素采样中，旧主色 `rgb(88,166,255)` 计数为 **0**，新主色 `rgb(180,197,255)` 计数 **> 0** | 实测 3 条序列 `894 / 838 / 836` px，旧主色 `0` px ✅ |
| 5 | visual 基线已显式重生成（**不是删断言、不是放宽阈值**），diff 只含颜色变化 | ➖ **N/A**（原判"待办"是标错）：`compare` 不在 `visual-regression.spec.ts-snapshots/` 的 12 张基线内，该 spec 也无对应用例 ⇒ **无基线可重生成** |
| 6 | 本任务 diff 内不含逻辑/接口改动 | 纯颜色与配置项替换，无 API/类型变更 ✅ |

**扫页时撞出的新断言（已并入 A-02 / A-03，勿再漏）**

> **7. 该页图表不得残留 Chart.js 库默认色。** 取证方式：canvas 采样中 `rgb(102,102,102)`（默认 tick 色 `#666`）计数须 **≤ 若干像素级噪声**，不得是画布上占比最高的颜色。
> 起因：`BacktestCompare` 原先只设了 `legend/tooltip`，**`scales` 的 grid 与 ticks 完全没设色**，用的是库默认 `#666` —— 它在旧底色上勉强能看，在新 `#090a0c` 上只有约 3.3:1。扫页第一轮我只换了系列色就以为完成，是像素采样把 `102,102,102` 以 1397 px 排到第一位才暴露的。**"grep 到 0 命中"不等于"主题化完成"** —— 库默认值是第三类颜色来源。补完后实测该色 `1397 px → 1 px`，网格转为 `#2a3449`（5706 px）。

**取证纪律补记**：断言 5 一开始被我标成"⏳ 待办"，实际是 **N/A** —— 写台账时我默认了"每页都有 visual 基线"，没去数。基线只有 12 张（`ai-evolution / ai-factor-lab / ai-strategy-workshop / backtest / backtest-form / backtest-tablet / dashboard / dashboard-metric-card / dashboard-mobile / dashboard-sidebar / data-sync / stock-screener`），**不含 compare 与 login**。**"没有基线"和"基线待更新"是两件不同的事**，混标会让 A-03 的收尾判断出错。

## A-02 旧调色板扫页：`Login.vue`（7 处）　✅ **已完成 2026-10-13**

| # | 断言 | 取证 |
|---|---|---|
| 1 | 旧调色板 hex（`#58a6ff/#0d1117/#161b22/#30363d/#e6edf3/#8b949e`）出现次数为 0 | `grep -c` = 0 ✅ |
| 2 | 登录页渲染结果与扫页前**逐节点一致**（只换色，不增减 DOM） | `git diff` 14+/9-；非颜色改动只有两件事：**删掉图标上的 `color="#58a6ff"` 呈现属性** + **新增一条 `.login-brand svg` CSS 规则**。DOM 节点零增减 ✅ |
| 3 | 表单文字与背景对比度 ≥4.5:1 | 该页取色对为 `--q-text` / `--q-text2` 压 `--q-surface`，即 **14.04:1 / 10.68:1**，由 `palette.test.ts` 不变量守；另机械核验该页 8 个 `var(--q-*)` 引用**全部有定义**（见 A-02 附注） ✅ |
| 4 | `/login?redirect=/screener` 重定向防护行为不变 | ⚠️ **部分取证**：`auth-login-flow.spec.ts` 3 条中 **1 passed / 2 skipped** —— skip 原因是运行中的栈是开放访问（`auth_enabled:false`），authGuard 把 `/login` 弹回 `/`（**这是 ADR-026 的正确行为，不是退化**）。重定向参数逻辑的实际覆盖在 `src/router/authGuard.test.ts`（含 `/screener` 用例），已随 257 条单测通过。要跑那 2 条 e2e 需给 analysis-service 配 `JWT_SECRET` 重启，**未擅自改运行栈** |
| 5 | typecheck / test / build 三项全绿 | 0 错 / **257 passed** / build 成功；`palette.test.ts`、`palette.ts`、`App.vue` 三文件 `eslint` **0 warning**（Login 的 3 条 warning 在 129/208/219 行，均为存量属性换行风格，非本次改动行） ✅ |
| 6 | visual 基线重生成且 diff 仅颜色 | ➖ **N/A**：12 张基线不含 login，spec 内 `grep -i login` = 0 命中 |
| 7 | 图表库默认色 | ➖ **N/A**：该页无 canvas（`grep -c canvas\|new Chart` = 0） |

**A-02 附注：图标颜色为什么不能写 `color="var(--q-primary)"`**
SVG 呈现属性**不解析 CSS 自定义属性**，直接把 `var()` 塞进 `color` 属性会得到无效值、图标静默回落到继承色。正确做法是删掉属性、用 CSS 规则 `.login-brand svg { color: var(--q-primary) }` 让 `currentColor` 生效。这条坑对 A-03 的 `NavTiles.vue`（5 处图标色）同样适用。

**A-02 的额外产出：把"引用是否解析得到"升级成全仓机器守卫**
本条取证过程中发现逐页人眼检查不可持续，于是在 `palette.test.ts` 新增 `CSS 变量引用完整性` 两组断言（悬空引用 + 旧值兜底），并配 **棘轮基线**（集合相等 ⇒ 新增欠债红、偷偷修好不记账也红）。**破坏验证已做**：临时注入一条悬空引用 + 一条兜底写法 → 两组断言同时红；还原后 35/35 绿，`git diff` 证明 `global.css` 与 HEAD 字节一致。

守卫上线即抓到 **6 条存量悬空引用**（见 A-03 工作清单）—— 这类缺陷此前不可见，因为浏览器对未知 `var()` 的处理是静默失效，不报错。

## A-03 旧调色板扫页：`NavTiles.vue`(5) · `EmergencyFlatten.vue`(4) · `StrategyBuilder.vue`(4) · `BacktestHistory.vue`(4) · `Alerts.vue`(1) · `DataSourcePanel.vue`(1) · `AppHeader.vue`(1) · `AppSidebar.vue`(1)

1. 全仓 `grep -rE "#58a6ff|#3fb950|#f85149|#8b949e|#21262d|#484f58|#e6edf3|#30363d" web/src --include=*.vue --include=*.ts` 结果为**空**（`palette.test.ts` 的废弃值清单除外）。
2. `dist/assets/*.js` 内旧主色 `#58a6ff` 出现次数为 **0**（当前基线：4）。
3. `EmergencyFlatten.vue` 的紧急平仓仍满足 F16：红色 + 二次确认 + 独立确认码，三者缺一即断言为假。
4. `AppSidebar.vue` 的 9 项导航标签与 A-04 定稿的一套标签**逐字相同**。
5. typecheck / test / build 全绿；visual 基线**仅对 12 张既有快照**重生成（`backtest*` / `dashboard*` / `data-sync` / `stock-screener` / `ai-*`），diff 仅颜色。
6. 扫页**不得为变绿而放宽** `palette.test.ts` 的两组棘轮基线；每修好一条悬空引用或兜底写法，**必须同步删掉对应条目**（不删会让断言红 —— 这是刻意的双向记账要求）。
7. **（承 A-01 第 7 条）** `grep -rn "new Chart(" web/src` 列出的**每一处**都要检查 `scales.grid/ticks` 与 `plugins.legend.labels.color` 是否显式设色；canvas 采样中库默认色 `rgb(102,102,102)` 不得占高占比。
8. **`rgba()` 形式的旧调色板与 `palette.test.ts` 的 `RETIRED_RGBA_BASELINE` 集合相等，且该基线为空。** 取证方式：`npx vitest run src/styles/palette.test.ts` 该条断言绿 —— 它把废弃 hex 表转成 RGB 三元组后匹配任意 `rgba?(r,g,b,…)`，**不依赖人记得去 grep**。破坏验证已做双向：注入 `rgba(31,111,235,.5)` 与 `rgb(88,166,255)` → 红；删掉一条基线却不改代码 → 红；还原后 36/36 绿。

### A-03 取证结果　✅ **已完成 2026-10-14**（断言 4 除外，见下）

| # | 取证 |
|---|---|
| 1 | 废弃 hex 表扩到 **33 条**（扫页时新登 `#f78166`/`#ffa657`/`#db61a2` —— `#f78166` 是 NavTiles 的策略实验室磁贴色，**原清单根本没覆盖它**，说明"按清单 grep"本身不完整）。扩表后全仓命中 **0 行**（含注释；`variables.css` 里那处提及旧值的注释已改为引用 §0.1） ✅ |
| 2 | `npm run build` 后 `dist/assets/*.js` 内 `58a6ff` 计数 **4 → 0** ✅。全量扫 dist：唯一残留是 `d03050:1`，上下文实测为 **Naive UI 自带的 light-theme 内部常量**（`errorHover:"#de576d",errorDefault:"#d03050",…`），不在我们的 darkTheme+overrides 路径上 —— 不是欠债 |
| 3 | 浏览器 computed style 实测：`border-left: 3px rgb(239,68,68)` = `--q-danger`、图标 `rgb(239,68,68)`、`strong` 文字 `rgb(248,113,113)` = `--q-danger-text`、卡片边界 `rgb(90,96,112)` = `--q-border`。F16 三要件（红色 / 二次确认 / 独立确认码）未被颜色改动削弱 ✅。**未点真按钮**（Kill Switch 是危险操作，armed 态的 `--q-danger-soft` 只做了 token 解析核验） |
| 4 | ➖ **不适用（依赖未完成的 A-04）**：侧栏当前实测 **12 项**（`/`、`/backtest`、`/backtest/compare`、`/screener`、`/copilot`、`/explore`、`/strategy-lab`、`/strategy-builder`、`/data-sync`、`/evidence`、`/factors`、`/alerts`），而"定稿的 9 项标签集"要 A-04 才存在。本条留待 A-04 一并收口，**不在此处判真** |
| 5 | typecheck 0 错 / **258 passed (21 files)** / build ✅；12 张 visual 基线**全部显式重生成**（未删断言、未放宽阈值）。**但只有 10/12 可复现**，根因见下"重生成时撞出的三个存量测试缺陷" |
| 6 | 三组棘轮基线**全部收缩为空数组**（悬空 6→0、兜底 8→0、rgba 7→0），且是**集合相等**断言 ⇒ 从此这三类静默失败是永久门禁。`DANGLING_BASELINE: string[] = []` 等三处注释记录了清零时点 ✅ |
| 7 | `grep -rln "new Chart("` 全仓只有 3 处（`EquityChart` / `useBacktestChart` / `BacktestCompare`），均为 A-01 已主题化文件；三处 `chartPalette` 显式设色计数 6/3/5，A-03 未新增图表 ✅ |
| 8 | `RETIRED_RGBA_BASELINE = []` 且断言绿 ⇒ 7 处全部清零 ✅。alpha **逐条重算**（合成后 ΔL 相等）而非照搬：过程与结果记在 DESIGN.md §0.2.2 |

**扫页时撞出的三个"看不见"缺陷（都是真缺陷，不是风格问题）**

> **9. scoped 样式对 `h()` 创建的 VNode 不生效 —— 整条规则静默失效。** `NavTiles.vue` 的 `.tile-icon { font-size: 24px; color: var(--accent) }` **从来没生效过**：`tile.icon` 是 setup 里 `h(NIcon, …)` 造出来的，拿不到本组件的 `data-v-*` 属性，而 scoped CSS 编译成 `.tile-icon[data-v-*]`。实测图标色是继承的 `--q-text`、字号也不是 24px。**这条缺陷早于本次扫页**（旧代码写 hex 时同样是死规则），改 token 只是让它显形。修法：`.nav-tile :deep(.tile-icon)`。修后实测 5 枚图标分别解析为 `#b4c5ff / #7fb0b8 / #d9b98a / #d0bcff / #9aa7d6` ✅
>
> **10. `class-name` 不是 NIcon 的 prop，会被当成字面 HTML 属性落进 DOM。** 我第一次把侧栏图标色改成 CSS 变量时写 `<n-icon class-name="brand-icon">`，结果 DOM 里是 `class-name="brand-icon"` 而 `class="n-icon"` —— 规则永不匹配，且**不报任何错**。是 computed style 查不到该元素才暴露的。正确写法：`class="brand-icon"`（Vue 会合并到组件根，且模板内的元素拿得到 scope 属性）。
>
> 这两条合起来的教训：**颜色改动的验收不能只看 grep，必须看渲染结果。** 断言 1/2/8 全是静态的，三个缺陷里有两个静态断言永远抓不到。

**重生成基线时撞出的三个存量测试缺陷**

| # | 症状 | 根因（实测） | 处置 |
|---|---|---|---|
| V-1 | 12 张基线里 5 张**刚生成完立刻重跑就红**，diff 图唯一差异像素在页头时间 | `AppHeader` 有 `setInterval(updateClock, 1000)`，全页快照把秒级时钟烙进基线 | ✅ **已修**：`beforeEach` 里 `page.clock.setFixedTime(2026-05-06T10:30:00)`。**用 setFixedTime 不用 clock.install** —— 后者会冻结待触发的 setTimeout，把依赖轮询的页面打成空态（那是为了变绿而破坏被测行为）。响应式两例自造 context，拿不到 `beforeEach({ page })` 的注入，必须各自调用（第一版就漏在这里，基线里烙进了 `00:28:42`） |
| V-2 | `backtest-tablet` 偶发：基线有"20 条记录"，实跑渲染"暂无回测历史" | 测试用 `waitForTimeout(500)` **盲等**，异步历史在慢的那次没落地就截图 | ⏳ 待办：改成等终态（`条记录` 或 `暂无回测历史` 二选一出现），别加延时 |
| V-3 | `data-sync` 不可复现 | 该页渲染的是**活的后台状态**：作业 ID 带纳秒时间戳（`ohlcv_all_aud49_17919266933509689000`）、近期任务列表随状态变、数据源限流告警"请求过于频繁"时有时无 | ⏳ 待办：要么 mask 掉同步状态卡 + 告警条，要么给视觉测试一套 fixture 后端。**这是测试设计决策，不在扫页里顺手改** |

**顺带生效的一处**：`--q-warning` 从"零消费"变为 **1 处真实消费**（`StrategyBuilder` 权重校验的 `.weight-summary.invalid` → `var(--q-warning)` + `--q-warning-soft`）。**这不等于 A-07 完成** —— A-07 要的是 K9 运行结果的 `invalid` 态三处同口径，那里仍是 0。DESIGN.md §0.1 的措辞已按"色值修正 + 语义预留"如实改写。

### A-03 工作清单（历史）：守卫上线时抓到的 6 条存量悬空引用 —— ✅ 已全部清零

这些是**真缺陷**，不是风格问题：组件引用了从未定义的变量，浏览器对未知 `var()` **静默失效不报错**，所以此前没人看见。逐条要么改用已有 token，要么在 DESIGN.md 正式立该 token 后再定义进 `variables.css`。

| # | 悬空 token | 位置 | 判断要点 |
|---|---|---|---|
| 1 | `--q-radius-md` | `components/dashboard/NavTiles.vue` | 大概率想要 `--q-radius`(8px) 或 `--q-radius-sm`(4px)，**先读上下文再定**，不要猜 |
| 2 | `--q-text-muted` | `components/paper/EmergencyFlatten.vue` | 语义即 `--q-text3`；该处还带 `#888` 兜底 ⇒ 实际一直在吃兜底值 |
| 3 | `--q-text-muted` | `pages/Alerts.vue` | 同上 |
| 4 | `--q-surface-muted` | `pages/Alerts.vue` | 疑似想要次级背景 ⇒ `--q-surface2`？读上下文定 |
| 5 | `--q-card-bg2` | `pages/StrategyBuilder.vue` | 同上；若确需"卡片次级底"则**先回 DESIGN.md 立 token** |
| 6 | `--q-divider` | `pages/StrategyBuilder.vue` | 语义即 `--q-border-light`（装饰 hairline） |

另有 **8 处 `var(--q-x, 旧值)` 兜底写法**（`EmergencyFlatten` 2 / `Alerts` 3 / `StrategyBuilder` 3）：兜底永不生效（变量总有定义），却把旧调色板留在仓库里 —— 一并删。

### A-03 工作清单补录（历史）：**7 处 `rgba()` 形式的旧色** —— ✅ 已全部清零（2026-10-13 审查时抓到，第 8 条断言守）

这是我自己的扫页判据留下的盲点：**前两条断言只按 hex 抓，而半透明旧色一个 hex 都不含**。最严重的正是**每页都渲染**的侧栏激活态。清单由脚本枚举 `src` 得到（我第一版手抄 grep 成 6 条，实际 7 条，漏了 `EmergencyFlatten` —— 所以清单本身也必须机器生成）。

| # | 位置 | 现值 | 换成 |
|---|---|---|---|
| 1 | `components/layout/AppSidebar.vue` | `rgba(88,166,255,0.12)` 激活态底 | `var(--q-primary)` 的低透明底（新主色 `#b4c5ff` 同透明度）—— **每页都渲染，优先级最高** |
| 2 | `components/layout/AppSidebar.vue` | `rgba(88,166,255,0.2)` 激活态 hover/边框 | 同上 |
| 3 | `pages/StrategyBuilder.vue` | `rgba(88, 166, 255, 0.06)` | 同 |
| 4 | `pages/StrategyBuilder.vue` | `rgba(133, 232, 157, 0.08)`（旧 success 半透明） | `--q-success` 半透明 |
| 5 | `components/backtest/BacktestHistory.vue` | `rgba(63, 185, 80, 0.04)`（旧 success） | `--q-success-soft` 语义 |
| 6 | `components/backtest/BacktestHistory.vue` | `rgba(248, 81, 73, 0.04)`（旧 danger） | `--q-danger` 半透明 |
| 7 | `components/paper/EmergencyFlatten.vue` | `rgba(245, 108, 108, 0.04)`（Naive danger 色半透明） | 同 |

> 这 7 处**不宜简单替换成 `rgba(新hex, a)`**：新主色 `#b4c5ff` 明度远高于旧 `#58a6ff`，沿用 0.12 透明度会得到明显更亮的底。A-03 执行时**逐条重算透明度**，用 canvas/像素采样复核对比度，别机械照搬 alpha。

## A-04 侧栏与顶栏统一（ANNOTATIONS §13 第 1–2 项）

1. 12 个页面渲染出的侧栏条目集合完全相同，可用一条 Playwright 断言遍历全部路由比对 `nav` 文本数组。
2. 条目集合等于 `user-flows.md` §3.2 目标 IA 的 9 项，**含"数据管道 Data Sync"**（当前 `review_desk` 稿缺它）。
3. 标签只有一套：不存在 `回测分析 / 探索观测 / 因子工厂 / 全市场选股 / 数据通道` 这 5 个漂移别名（grep 全仓为 0）。
4. 顶栏不再出现 `SSE`、`L2`、`probe/h`、`iter/h` 字样（ODR-066 B3 判删项），grep 为 0。
5. 顶栏保留 `⌘K` 入口与"待审阅 N"计数，二者各有对应测试。
6. 键盘 Tab 顺序与视觉顺序一致（skill 检查项 `keyboard-nav`），焦点环使用 `--q-focus` 且 ≥3:1。

## A-05 六维验证器组件（F5，横切）

1. 组件渲染的维度条目数恒为 **6**（统计/经济/稳健/偏差/冗余/因果），不是 5。
2. 任一维度 `unassessed` 时渲染文字"未评估"，且该用例存在一条断言：**若实现把 unassessed 折叠或省略，测试必须红**（F5 验收原文）。
3. `probability` 显示值等于**已评估维度的最小值**，且有单用例用非最小值输入验证其不取平均、不取最大。
4. 最弱一环维度被高亮，高亮是**非颜色单义**的（同时有文字标注），满足无障碍"颜色不是唯一线索"。
5. 失败的尝试（无回测结果）**不渲染裁决**，不出现 0 分或"未通过"。
6. 组件内不出现 `VALIDATED / VERIFIED / 校验通过 / 未通过` 四个词（S1 二值违例），grep 为 0。

## A-06 证据质问内嵌（F6，横切）

1. 回测报告、因子 IC、多策略对比三处的可质问数字**各自**至少有一个质问入口（这三处正是设计稿缺失的）。
2. 点击入口打开侧滑/浮层，**页面 URL 不变**（不跳页），可用 Playwright 断言 `page.url()` 前后相等。
3. 从数字到原始记录的点击次数 ≤2，用测试步骤数佐证。
4. 无 `content_hash` 的数字显示"无法回溯"，且存在一条用例专门喂无 hash 数据断言该文案出现（诚实 > 好看）。
5. `GET /api/evidence/{content_hash}` 返回 404 时呈现"未摄取"警示态而非错误态（沿用 ODR-060 的三态渲染）。
6. `/evidence` 独立页保留为深链兜底且支持 `?content_hash=`，现有测试不退化。

## A-07 状态三值全站收口（K9 横切）

1. 全站不存在以 `result.id` 存在判成功的代码路径（grep `result.id` 相关判定为 0）。
2. `completed / invalid / failed` 三态在 API 类型、组件、文案三处同口径，类型层为三值联合（已在 b28d5b6 落）。
3. `invalid` 态渲染警示样式**且**列出 `invalid_reasons`，缺一即断言为假。
4. 含 `invalid` 的混合结果集进入对比页时，被排除项与其原因被显式呈现（抄 `compare` 稿的 `GATE EXCLUDED` 画法）。
5. 三值各有独立单测用例（3 条用例，不是 1 条参数化打天下）。
6. `--q-warning` 在实现中被 `invalid` 态实际消费（当前该 token 历史消费数为 0）。

## A-08 `data_sync` 整屏重做为作业控制台（F13）

1. 页面主区是作业队列（列表 / 详情 / 取消 / 重试），对应 `sync` 端点 `GET /api/sync/jobs`、`GET /jobs/{id}`、`POST /jobs/{id}/cancel`、`POST /jobs/{id}/retry` 各有一次真实调用。
2. 排程管理 CRUD + toggle + run-now 可达，对应 7 条 `/api/sync/schedules*` 端点。
3. worker 与 scheduler 统计有展示位（`GET /api/sync/workers`、`GET /api/sync/scheduler/stats`）。
4. 页面内**唯一**允许出现 "SSE" 字样的地方是单作业进度流，且其订阅走 `GET /api/sync/jobs/{id}/progress`；其余位置 grep 为 0。
5. 稿上的湖仓/集群/L2 元素（Parquet、Iceberg、DuckDB、GPU、SLA、Level2 逐笔）**一个都不实现**，grep 为 0。
6. PIT 时间轴与幸存者偏差两块**保留**（ANNOTATIONS 判为唯一精华），各有一条用例。

## A-09 `execution` 重画为纸交易观测台（F16）

1. 页面四块齐备：订单 / 持仓 / 账户 / 外部信号流，对应 `core` 的 `orders`、`positions`、`account`、`signals` 端点（稿上后三块缺失）。
2. 全站文案 grep 不出现 `实盘`、`FIX`、`Colocation`、`DMA`、`TWAP`、`VWAP`、`100 FPS`、`亚毫秒`（F16「UI 文案不得暗示实盘」）。
3. 紧急平仓按钮满足红色 + 二次确认 + 独立确认码三条件，且有一条用例断言缺确认码时不可提交。
4. 所有数值来自 `MockTrader` 真实响应，无写死的机构级布景（担保品金额、保证金占用率等虚构值 grep 为 0）。
5. 页面明确标注"纸交易 / Mock"身份，与 `/api/execution/*` 的实际能力一致。
6. 不引入任何新的执行端点假设（`grep` 请求路径全部命中 openapi 已有 6 条）。

## A-10 缺屏补设计：合规 F17 / 系统管理 F18 / walkforward+batch

1. 合规页覆盖 `core` `/api/compliance/*` 全部 **9** 条端点，逐条有调用点。
2. 系统管理页覆盖 `/api/auth/admin/users`、`/audit`、`/status`、`/bootstrap` 与 `/api/plugins*` **9** 条。
3. walk-forward 与批量回测有承载页，覆盖 `/api/walkforward*`、`/api/batch*` 共 **5** 条。
4. 三个新页均登记进 `core` 侧 `docs/ARCHITECTURE.md` 前端章节（AGENTS.md Rule 1 触发器）。
5. 每页有对应 Playwright spec，且新增路由后 `authGuard` 分支行为不变（开放访问/鉴权两态各一条）。
6. 三页都不引入后端没有的控件（每个控件可指到一条端点或标 ⏳）。

## A-11 字体加载决策落地

1. 决策二选一并有 ODR 记录：自托管 woff2（需主任批准二进制）或外部 CDN（需说明与"自托管"定位的冲突如何化解）。
2. 若加载：`document.fonts.check('12px Inter')` 在真实页面返回 `true`。
3. 若不加载：`DESIGN.md §5.1`、`variables.css` 注释、本任务三处的"未加载"标注被更新为明确结论，不留悬置。
4. 中文实际命中 `Noto Sans SC` 族（可用 `document.fonts` 或像素比对验证，不靠"看起来对"）。
5. 等宽数字在表格中不横向跳动：`font-variant-numeric: tabular-nums` 在数据单元上生效，有一条计算样式断言。
6. 字体变更不使 `npm run build` 产物体积无谓膨胀 >200KB（若自托管需报告实际增量）。

---

# 分组 B · 🔴 延后（依赖 ai-service 或后端缺口）

> **主任裁决（2026-10-13）**：ai-service 后端会做、目前没有 ⇒ 相应前端先不做，挂计划。
> **已知阻塞细节**：`ai-service` 当前**镜像构建失败** —— agent 仓 `go.mod` 与 import 不同步，报 `updates to go.mod needed; go mod tidy`。这是存量问题，`go mod tidy` 会改依赖文件，属 Ask First。**看起来一条命令可解，但按裁决不擅自执行。**

## V 组：视觉基线可复现性（A-03 重生成基线时撞出，2026-10-14）

> 为什么单列：这三条不是设计问题，是**测试基础设施**问题 —— 基线不可复现意味着后面每一个
> 改颜色的任务（A-04~A-11）都没有可信的回归网。V-1 已在 A-03 内修掉，V-2/V-3 需要设计决策，
> 不并进扫页 commit。

1. **V-1 ✅ 已修**：`AppHeader` 的秒级时钟被烙进全页基线 → `beforeEach` 用 `page.clock.setFixedTime(2026-05-06T10:30:00)` 冻结。**判据**：`npx playwright test tests/visual-regression.spec.ts` 连跑两轮全绿（当前 10/12，剩余 2 张红因 V-2/V-3）。
2. **V-2 待办**：`dashboard-mobile` / `backtest-tablet` 用 `waitForTimeout(500)` 盲等，慢的一次在历史列表落地前就截图（实测基线有"20 条记录"、实跑渲染"暂无回测历史"）。改成**等终态**：`条记录` 与 `暂无回测历史` 二者其一可见即可。**禁止**用加大延时解决 —— 那只是把 race 的概率调低。
3. **V-3 待办**：`data-sync` 页渲染的是**活的后台状态**（纳秒时间戳作业 ID `ohlcv_all_aud49_17919266933509689000`、近期任务列表随状态变、数据源限流告警时有时无），全页基线原理上不可复现。二选一并说明理由：(a) `toHaveScreenshot({ mask: [...] })` 遮掉同步状态卡与告警条；(b) 给视觉测试一套固定 fixture 后端。**不得**删该页基线或断言了事。
4. 三条收口后，**12/12 连跑三轮全绿**才算 V 组完成（两轮不够 —— race 的漏检率就是这么量出来的）。

## B-01 `explore` 改造：三栏观察 + 路径回放（F1/F4）

1. 页面消费 `ai` `POST /api/explore/runs` / `GET /runs/:runID` / `POST /runs/:runID/stop` 三条端点，全部真实可达（**当前阻塞：ai-service 未运行**）。
2. 三栏数据源是**轮询**，不是推送；订阅层与 A-08 的 SSE 共用同一抽象接口。
3. F4 回放按 `seq` **升序**渲染尝试序列，且存在一条用例断言"非插入顺序"。
4. "被叫停"与"跑满"在回放与摘要中显著区分（`ExploreStatus.stopped`），有一条用例比对二者文案。
5. 失败的尝试不渲染裁决（同 A-05 第 5 条）。
6. 解锁前置：ai-service 可构建 + `/api/explore/*` 补进 `openapi.yaml`（缺口 **G7**）。

## B-02 审阅台（F2/F3/F5/F7，P0 新页）

1. 摘要排序按**高原面积 × 因果强度**，不是按 IC；有一条用例用反例数据断言排序结果不同。
2. 候选卡三要素齐备：路径缩略图（**不是**收益曲线）、质疑清单（blocking/warning/note 分级）、概率估计（注明最弱一环）。
3. 摘要聚合数据源为后端缺口 **G1**；未就绪前用前端 attempts+verdict 近似聚合，且界面**显式标注"近似"**。
4. 四干预入口一致（同 A-05/B-01 的候选卡、结果流行、回放页三上下文）；指方向/追问/标记三条为 **G2/G3/G4**，画 disabled。
5. 采纳动作必须采集**理由（自由文本）+ 概率快照**，缺任一不可提交（F7/S6）。
6. 被叫停的 run 与跑满的 run 在列表中不混排无差别（F2 异常条款）。

## B-03 研究日志与采纳台账（F7）

1. 台账数据源是采纳记录端点（缺口 **G6**）；未就绪前不落库、不假装可写。
2. 任一采纳可回溯 `run → experiment → 证据链`，有一条端到端用例。
3. "月度采纳率"等聚合数标为**近似**或来自 G6 真实端点，二者必居其一，不静默估算。
4. 稿上的 Merkle Root / 冷密钥签名 / Git Snapshot / 投委会 PDF 导出**全部不实现**（幻觉项），grep 为 0。
5. 导出仅 `html`（`openapi:285` 明写），不出现 xlsx/pdf 选项。
6. 解锁前置：**G6** 采纳记录落库（含理由与概率快照两列）。

## B-04 策略库合并（F11）的 Copilot 腿

1. 三页合一（`strategy-lab` + `strategy-builder` + `copilot`）的 tab 结构可做；**Copilot 提案流依赖 ai-service，延后**。
2. 策略 CRUD 走 `core` `/api/strategies*` 两条端点，可做。
3. 生成代码 artifact 是 **Go + 表达式**，不出现 Python 类、`AlphaStrategy`、`resample('5min')`、`.qpkg`（ADR-024 三重违例），grep 为 0。
4. "沙箱编译通过"展示为可审阅 artifact 状态，**不加载不执行**，失败不阻断（ADR-024）。
5. Copilot 产出文案为"可证伪主张 + 证据 + 存疑项"，不出现"AI 推荐的策略"。
6. 解锁前置：ai-service 运行 + `POST /api/copilot/generate` 轮询契约可用。

## B-05 因子研究页的 AI 腿（F12）

1. 因子列表 / IC / 十分位收益 / 计算触发全部走 `core` `/api/factor/*` 5 条端点 —— **这部分现在就能做**。
2. 六维裁决面板复用 A-05 组件，不自造。
3. "变异建议 / 一键派生变异"依赖基因池与 ai 层，延后；界面画 disabled。
4. 不实现 Polars / Parquet / L2 分区 / Barra CNE6（栈错位与幻觉项），grep 为 0。
5. `VERIFIED` 二值徽标不出现，改综合概率 + 最弱项。
6. 因子证据坐标并入因子详情（`/factors` 独立页降级为深链兜底），现有 `FactorCitation` 测试不退化。

## B-06 指方向 / 追问 / 标记 三干预（G2/G3/G4）

1. 三条端点在后端存在并可调用（**当前均无**）。
2. 三者在候选卡、结果流行、回放页三个上下文入口一致。
3. "追问"入口挂在**被放弃的尝试**上，不是只挂在成功候选上（F3 UX 要点）。
4. 每条端点有契约测试，且补进 `openapi.yaml`（连带收 G7）。
5. 前端从 disabled 转可用时，**只改状态位、不改结构**（有一条快照测试断言 DOM 结构不变）。
6. 解锁前置：G2/G3/G4 后端实现。

---

# 分组 C · 后端缺口台账（UI 依赖，归 core/agent 侧修）

| # | 缺口 | 阻塞的 UI | 状态 |
|---|---|---|---|
| G1 | 摘要聚合 API（高原面积×因果强度排序、路径缩略图数据） | B-02 | 无 |
| G2 | 指方向（run 续跑注入约束） | B-06 | 无 |
| G3 | 追问（针对被放弃方向的问答） | B-01 / B-06 | 无 |
| G4 | 标记（派生子 run / 提升权重） | B-06 | 无 |
| G5 | 实验日志深查询 | B-01 | `GET /api/explore/runs/{id}` 基本够用 |
| G6 | 采纳记录（决定 / 理由 / 概率快照） | B-02 / B-03 + **成功指标测量** | 无 |
| G7 | `/api/explore/*`、`/api/tools/*` 未入 openapi 契约 | B-01~B-06 | 反代可用，契约待补 |
| G8 | 行情侧推送 | — | **明确不做**（ODR-066 B3）；sync 作业 SSE 已存在 |
| **G9** | **ai-service 镜像构建失败（`go mod tidy`）** | **整个分组 B** | 存量，2026-10-13 实测；解锁分组 B 的前置 |

---

## 执行顺序建议

```
A-01 → A-02 → A-03   （调色板扫页，一次一页，每页独立 commit + 基线重生成）
A-04                 （导航/顶栏统一 —— 后续所有新页都依赖它）
A-05 → A-06 → A-07   （三个横切组件，新页复用）
A-08 → A-09          （两个"整屏重做"，收益最大）
A-10 → A-11          （补屏与字体）
分组 B               ← 等 G9 + G1~G7
```

## 更新记录

| 日期 | 变更 |
|---|---|
| 2026-10-13 | 初版：11 个可做任务 + 6 个延后任务 + G9 新登缺口，每任务 6 条可判定断言。分组 B 依主任裁决挂起（ai-service 后端未就绪） |
| 2026-10-13 (2) | **A-01、A-02 完成并逐条取证**。三处台账修正与一处扩标准：① 断言 7 新增（**"grep 零命中 ≠ 主题化完成"**，Chart.js 库默认色是第三类来源，实测 `#666` 1397px→1px）；② A-01/A-02 的 visual 基线断言由"待办"改判 **N/A**（12 张快照不含 compare 与 login —— "没基线"≠"基线待更新"）；③ A-02 断言 4 标为**部分取证**并写明 skip 的真实原因（开放访问下 authGuard 正确弹回，重定向逻辑由 `authGuard.test.ts` 覆盖）；④ 新增 `CSS 变量引用完整性` 两组**棘轮基线**守卫（悬空引用 / 旧值兜底，集合相等双向红，破坏验证已做），上线即抓到 **6 条存量悬空引用 + 8 处失效兜底**，已列为 A-03 强制工作清单 |
| 2026-10-14 | **A-01/A-02 自审复盘**，两处问题直接修掉：① 扫页判据全按 **hex** 抓 ⇒ `rgba()` 形式旧色全程不可见，其中包含**每页都渲染**的侧栏激活态。新增断言 8 + `RETIRED_RGBA_BASELINE` 守卫（废弃 hex 表→RGB 三元组，匹配任意 `rgba?(r,g,b,…)`），并补录 **7 处**进 A-03 工作清单。**清单本身也必须机器生成** —— 我第一版手抄 grep 成 6 条，脚本实测 7 条。破坏验证双向已做（注入红 / 不记账红 / 还原 36 绿）。② `DESIGN.md` §0.1 与 frontmatter 把 `--q-warning` 写成"升格为三值之一/一等公民"，实测 `var(--q-warning)` **消费仍为 0**（success/danger 各 9）—— 那是 A-07 的计划不是现状，已改为"色值修正 + 语义预留"并标注接线任务。另：`index.md` 第 2 项加"visual.md 是人读视图，真相源在 DESIGN.md"的导航注记 |
| 2026-10-14 (2) | **A-03 完成**（8 文件扫页 + 三组棘轮基线全部收缩为空 ⇒ 永久门禁）。三处新登缺陷：① `NavTiles` 的 `.tile-icon` 整条规则**从未生效**（scoped 属性打不到 `h()` 造的 VNode），改 `:deep()` 后图标才真的着色；② `class-name` 不是 NIcon 的 prop，会落成字面属性且**不报错**，正确写法是 `class`；③ visual 基线不可复现的三个根因里 **V-1（页头秒级时钟）已用 `page.clock.setFixedTime` 修掉**（刻意不用 `clock.install` —— 那会冻结待触发的 setTimeout，把依赖轮询的页面打成空态），**V-2 盲等 `waitForTimeout`、V-3 `data-sync` 渲染活后台状态（纳秒作业 ID / 限流告警）另立待办**，属测试设计决策，不在扫页里顺手改。教训：**颜色改动的验收不能只看 grep** —— 断言 1/2/8 全是静态的，三个缺陷里两个静态断言永远抓不到 |
