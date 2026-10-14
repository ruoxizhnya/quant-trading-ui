# 重构任务清单（TASKS）— Quant Lab UI

> **版本**: 1.0（2026-10-13）
> **定位**: 本文件是 UI 重构的**唯一任务台账**。每个任务用 **6 条可判定断言**描述（AGENTS.md §8.5.2 六字段的断言化：一条断言 = 一个可独立判真伪的事实，不是动作描述）。
> **依据**: [ANNOTATIONS.md](ANNOTATIONS.md)（逐控件处置）· [../user-flows.md](../user-flows.md) v1.1（需求基线）· [obsidian_precision_quant/DESIGN.md](obsidian_precision_quant/DESIGN.md) v2.0（token 真相源）· [ODR-066](../../../../quant-trading-docs/docs/archive/odr/odr-066-stitch-design-review-and-boundary-ruling.md)（裁决）
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

🔶 **部分完成 2026-10-14** —— 断言 1/3/4/6/7 已收口；**2/5/8 未做，且 2 与 8 需要主任拍板**（理由见取证表末）。

### A-04 取证结果

| # | 状态 | 取证 |
|---|---|---|
| 1 | ✅ | `e2e/tests/nav-consistency.spec.ts` 遍历 12 条路由比对 `.nav-item .nav-label` 数组，逐字相同。首跑即暴露本测试自己的缺陷：`goto` 后直接读会拿到 **0 个**（Vue 尚未渲染），改成等条件 `expect(locator).not.toHaveCount(0)` —— 不是加延时 |
| 2 | ✅ **已拍板 2026-10-14：暂不收敛**（主任裁决："等 F11/A-06 落地后再动"）。§3.2 的树实际有 **15 个条目**，而 ANNOTATIONS §13-1 写"9 项一套标签" —— 两个数对不上，"9 项"没有权威清单；且收敛必然摘掉 3 个入口，其归宿（F11 三库合一、A-06 证据内嵌）都还没做，现在摘就是孤儿路由。**在此之前侧栏保持 12 项** |
| 3 | ✅ | 5 个漂移别名作为**标签**出现 0 次（`nav-labels.test.ts` 断言；注释里列举历史别名不算，见该测试的匹配范围）。顺带发现标签其实散在**四处**：侧栏 label、路由 `meta.title`、页面 H1/卡片标题、**首页磁贴标题**（`因子选股 / 策略实验室 / AI Copilot` 与侧栏三套叫法）—— 已全部收敛到 §3.2 词表，并由 `nav-labels.test.ts` 7 条断言钉住（含"磁贴标题须与侧栏同源"，破坏验证：把磁贴改回 `因子选股` 即红） |
| 4 | ✅ | `components/layout/` 内 `\bSSE\b / L2 / probe\/h / iter\/h / HERMES / QUEUE` 命中 0；e2e 有一条顶栏文字断言。注：`stores/sync.ts` 里的 SSE 是**单作业进度流**，A-08 断言 4 明确允许，不在此禁 |
| 5 | ⛔ **待后端** | `⌘K` 命令面板全站不存在（要新写组件）；"待审阅 N"计数**没有 API** —— 审阅台本身是 B-02（等 ai-service）。**不在没有数据源的情况下先画一个恒为 0 的角标**，那是谎报 |
| 6 | ✅ | 键盘 Tab 实测：焦点环计算值 `solid 2px rgb(180, 197, 255)` = `--q-focus`，压画布 **11.67:1**（≥3:1）。**排查过程本身是个教训**：先用 `el.focus()` 程序化聚焦测，读到的是 `3px currentColor`，一度以为规则没生效 —— `:focus-visible` 按**交互方式**判定，程序化聚焦不触发；且 `.nav-item` 上有 `transition: all`，`outline-color/width` 可动画、`outline-style` 离散，聚焦瞬间读到的是动画起点。最终用真键盘事件 + `expect.poll` 等条件才测对，写进 e2e 而不是靠一次性手工探针 |
| 7 | ✅ | 侧栏 Redis/Postgres 常绿点**已删除**（含 `.sys-dot` 三条规则）。裁决依据：`/api/health` 实测只返回 `{service,status,timestamp}`，**没有 redis/postgres 分项**；接真值要后端加字段 = 前端驱动后端设计，违反主任 2026-10-13 的边界裁决 ⇒ 按断言 7 的第二选项删掉，不留常绿点 |
| 8 |  **随断言 2 挂起**（触发条件已明确：F11 + A-06 落地） | 当前侧栏 12 项（分组：总览 1 / 研究主线 2 / 仪器房 8 / 监控 1） |

**顺带修掉的一个真 bug**：旧 `isActive` 用 `route.path.startsWith(item.path)`，在 `/backtest/compare` 上「回测引擎」与「多策略对比」**同时高亮**（后者是前者的字符串前缀）。改为最长匹配。破坏验证：把模板退回旧判定 → e2e 断言在 `/backtest/compare` 报 `Expected: 1, Received: 2`，还原后 4/4 绿。

**9 项提案（主任 2026-10-14 裁决：❌ 暂不执行，等 F11 / A-06 落地后再动）**：`控制台 · 探索观察 · 回测引擎 · 多策略对比 · 策略库 · 因子研究 · 选股与市场 · 数据管理 · 风险告警`。摘除的 3 项去向：策略编辑器 + 策略 Copilot → 策略库（F11）；证据质问 → 数字旁内嵌侧滑（A-06），路由保留作深链兜底。**在此之前侧栏保持 12 项**（标签已统一，条目数不动）。

**改名连带打破的 e2e（已一并修）**：`选股器 / 数据同步 / 策略实验室 / 因子证据 / 探索观察台 / 证据查询` 在 6 个 spec 里被当文案选择器用，改名即断。导航点击一律改 `[data-nav-path="/xxx"]`（新加的稳定钩子），文字断言改新标签。**这正是 AUD-61 记的那笔债的现场复现** —— 靠文案的选择器重构即碎。

**未修的 7 条红**（`dashboard.spec.ts` ×5 / `cross-navigation.spec.ts` ×1 / `strategy-selector.spec.ts` ×1）：实测均为**存量结构脱节**，与本次改动无关 —— 例：断言侧栏 5 项（实际 12）、磁贴 4 枚（实际 5）、等 `.metric-card`（该 class 只在 `BacktestCompare.vue` 存在，Dashboard 根本没有）、点 `.nav-tile` 的 `因子分析`（**从未存在过**）。归 **AUD-61** 阶段一登记，不在本任务顺手改。

1. 12 个页面渲染出的侧栏条目集合完全相同，可用一条 Playwright 断言遍历全部路由比对 `nav` 文本数组。
2. 条目集合等于 `user-flows.md` §3.2 目标 IA 的 9 项，**含"数据管道 Data Sync"**（当前 `review_desk` 稿缺它）。
3. 标签只有一套：不存在 `回测分析 / 探索观测 / 因子工厂 / 全市场选股 / 数据通道` 这 5 个漂移别名（grep 全仓为 0）。
4. 顶栏不再出现 `SSE`、`L2`、`probe/h`、`iter/h` 字样（ODR-066 B3 判删项），grep 为 0。
5. 顶栏保留 `⌘K` 入口与"待审阅 N"计数，二者各有对应测试。
6. 键盘 Tab 顺序与视觉顺序一致（skill 检查项 `keyboard-nav`），焦点环使用 `--q-focus` 且 ≥3:1。
7. **侧栏底部的 Redis / Postgres 状态点必须反映真实健康**（A-03 复查时抓到的**谎报**，2026-10-14）。当前 `AppSidebar.vue:25,29` 把两处都写死成 `class="sys-dot online"`，`.sys-dot.offline` 那条规则**永不匹配** —— 于是界面恒久宣称两个基础设施在线，而它并没有查过任何东西。这违反愿景原则 4（每个数字可被当场质问），与本仓已删的"谎言兜底文案"同类。**做法二选一并说明理由**：接真实健康（`AppHeader` 已有 `apiOnline` 先例；`store.dataSourceHealth` 亦已在数据页使用），或**删掉这两行**不显示。禁止保留常绿点。
8. 侧栏条目数与 A-04 断言 2 的 9 项集合同时成立：当前实测 **12 项**（多出的 `/backtest/compare`、`/evidence`、`/factors` 三项按 ANNOTATIONS §13 归并），归并后每项标签与 §3.2 逐字相同。

## A-05 六维验证器组件（F5，横切）

1. 组件渲染的维度条目数恒为 **6**（统计/经济/稳健/偏差/冗余/因果），不是 5。
2. 任一维度 `unassessed` 时渲染文字"未评估"，且该用例存在一条断言：**若实现把 unassessed 折叠或省略，测试必须红**（F5 验收原文）。
3. `probability` 显示值等于**已评估维度的最小值**，且有单用例用非最小值输入验证其不取平均、不取最大。
4. 最弱一环维度被高亮，高亮是**非颜色单义**的（同时有文字标注），满足无障碍"颜色不是唯一线索"。
5. 失败的尝试（无回测结果）**不渲染裁决**，不出现 0 分或"未通过"。
6. 组件内不出现 `VALIDATED / VERIFIED / 校验通过 / 未通过` 四个词（S1 二值违例），grep 为 0。

## A-05 六维验证器组件（F5，横切）　✅ **已完成 2026-10-14**（含浏览器真实数据实测，证据见下）

落点：`web/src/components/validation/VerdictPanel.vue` + `VerdictPanel.test.ts`（23 条），
`Explore.vue` 原来内联的裁决渲染整段换成该组件（Explore 的 102 条 lint warning 降到 81，
未新增 error）。规范六维顺序由 `api/explore.ts` 的 `DIMENSION_ORDER` 固定。

| # | 断言 | 取证 |
|---|---|---|
| 1 | 维度条目数恒为 6 | 三条用例：六维齐全 → 6 行；**后端只给 5 维 → 仍 6 行**，缺的那行显示"未评估"；标签顺序等于 `DIMENSION_ORDER` 而非对象键序。**另加一条防"只渲染白名单"**：喂入第七维 `liquidity` 必须渲染成第 7 行 —— 否则将来后端加维度会静默不见 |
| 2 | `unassessed` 显示"未评估"，折叠即红 | 三条用例 + **破坏验证已做**：把实现改成"只渲染有数值的维度" → **4 条测试红**（断言 1 的"5 维仍 6 行" + 断言 2 的全部三条），还原后 19/19 绿。核心那条不查样式，查的是**每一维都必须携带可质问的结论**（数值或"未评估"），留空或整行省略都红 |
| 3 | `probability` = 已评估维度的最小值 | 用例故意把 `verdict.probability` 设成 0.9（≈最大）、`geometric_mean` 设成 0.68，断言屏幕显示 **0.42**（真最小值）。**综合概率由屏幕上的六个数当场算出，不读后端聚合字段** —— 理由是可质问性（原则 4）：显示一个来路不同的聚合值，它就成了不能质问的数字。**破坏验证**：改成读 `verdict.probability` → 3 条红，报 `expected '0.90' to be '0.42'` 与 `expected '0.00' to be '无已评估维度'` |
| 4 | 最弱一环高亮非颜色单义 | 最弱行带文字标注"最弱一环"，且**只有一行**有它；另有一条用例喂入指错的 `weakest:'statistical'`，断言组件仍按数值标出 `economic` —— 最弱一环同样从数里推，不采信聚合字段 |
| 5 | 失败的尝试不渲染裁决 | `verdict:null` → 概率元素与维度列表**都不存在**，只有"没有可被证伪的东西"，且全文 `not.toMatch(/0\.00|\d+%/)`（不出现 0 分）。一维都没评估时显示"无已评估维度"而不是 0.00 —— 0 会被读成"零可信"，那是另一种谎报 |
| 6 | 四个二值措辞为 0 | 两条用例：组件**源码**内 `VALIDATED / VERIFIED / 校验通过 / 未通过` 命中 0；**渲染出的文本**里也为 0（措辞可能来自拼接） |

**两处契约判断（写下来以免被当成随手改的）**

1. **`unassessed` 有否决权**：一维若被列为未评估，即使 `dimensions` 里混进了数也不显示它，也不参与最小值。契约上二者不该同时出现；真冲突时只能往"没查"那侧失败安全 —— 把一个未评估维度标成概率，等于替 AI 编造可信度。有用例专门喂这个矛盾输入。
2. **F5 的其余契约一并落地**：因果维显示机制 + `可证伪预测 N 条 · 应验 · 被证伪`（"讲得出但验不了的不算数"）；质疑按 `blocking / warning / note` 分组并带条数，**阻断级排最前**（不按后端数组顺序，避免被 note 埋掉）；无质疑条目时如实写"本轮没有提出质疑条目"，不留白。
3. **配色走概率性通道**：整块用 `--q-ai-text` 且带"AI 评估"文字标注 —— DESIGN.md §3 硬规则，颜色不是唯一线索。

**浏览器真实数据实测已补做（2026-10-14，本地栈全绿后）**

栈：原生 PostgreSQL 17.5（`quant_trading`，5908 stocks / 3,926,510 根日线）+ Redis 7.4.11 +
容器 data/strategy/analysis/ai 四服务 `local-stack.sh status` 全 healthy，Vite :5173。
在 `/explore` 用「做一个动量策略 / 最多试 2 次」真跑了一轮（run `c46fa2ad`），
两次尝试都成功落库并带裁决（`experiments` id 1117/1118），页面渲染的就是那份 JSON。

屏幕上逐项核对通过（不是测试跑绿，是人看见）：

| 断言 | 实测到的真数据表现 |
|---|---|
| 1 六行 | 统计/经济/稳健/偏差/冗余/因果 六行齐全，顺序正确 |
| 2 未评估 | 后端 `unassessed` 给了 4 维 → 屏幕上 4 个「未评估」+ 一行「4 个维度未评估 —— 未评估不等于没问题」 |
| 3 最小值 | `dimensions={bias:0.1304, robustness:0}` → 综合概率 **0.00**；结果流上的 chip 同为 `P 0.00`，**两处同一个数**（这正是审查轮抽公共函数要保的东西） |
| 4 最弱一环 | 「最弱一环」标在 稳健 那一行（0 < 0.13），文字标注而非仅颜色 |
| 5 失败无裁决 | 同一轮里 `b7ddde81` run 的尝试全部 `failed`（YAML 非表达式被拒），页面显示「这一条没有裁决 —— 失败的尝试没有可被证伪的东西」，没有 0 分 |
| 6 无二值措辞 | 全文无「校验通过 / 未通过」 |
| 质疑分级 | 阻断级（2）排在备注（6）前面，每条带维度标签 |

**实测抓出并当场修掉的三个前端缺陷**（各一个 commit，破坏验证已做）：

1. **一次 429 永久打死观察循环** —— 页面 1 秒一跳，把 analysis-service 每人 100 次/分钟
   的预算吃掉 60 次，实测约 3 分钟后弹「请求过于频繁」，而 catch 里跟着 `stopTimer()`：
   窗口从此冻在最后一帧。改 `POLL_MS=2500` + 连续 6 次失败才认断线，停下时明说
   "屏幕上的是最后一次成功拿到的进展"。护栏：`MAX_POLL_FAILS` 调回 1 → e2e 红。
2. **模型写的 markdown 星号直接上屏**（`股票池按**今天**的上市名单取`）。切片段渲染，
   **不走 v-html**；护栏：换成 v-html → "消息里的 HTML 只是字" 那条红。
3. 说明句源码换行被折成空格（"最弱的 那一环"）。

新增 `e2e/tests/explore-verdict.spec.ts`（3 条，fixture 逐字段抄自真实落库的 verdict）
把上面这份现场钉成回归；`/explore` 仍不在 12 张 visual 基线内。

**实测同时暴露的后端问题（前端不动它们，按"前端不干预后端设计"登记待裁决）**：

- **探索主链路只能产出无效回测**：两次尝试的回测都是
  `universe_max_size=0 / zero_trades / garbage_metric` → `Status=invalid`，
  也就是 `/explore` 现在**只能产出无效回测**，六维里四维因此永远未评估。
  这不是渲染问题，是探索主链路拿不到有效结果 —— 归 G 组后端缺口（OBS-01，
  core 仓已跟踪；根因与本轮补的机制更正见 core 仓 `docs/TASKS.md` §八）。
  ⚠️ **登记时我犯过一个错，留在这里以免被当成没自查**：裁决里那句
  「股票池按**今天**的上市名单取（0 只）」我第一反应当成引擎量出来的票池规模，
  逐字读码后确认那个 `0` 是 `PoolSize` 的 **Go 零值**（探索链路只设 `PoolSource`
  不设 `PoolSize`），它和 `universe_max_size=0` 只是碰巧同为 0。
  **一个显示出来却没人量过的数字**本身就是缺陷，core 侧已另立 OBS-01-R1。
- **限流豁免表要不要纳入状态轮询**：**已裁决：不进**。`IsRateLimitExempt` 是
  **逐字相等**匹配（明写不做前缀匹配，因为前缀会让 `/api/auth/status/../login`
  这类写法绕过限流），而这条路径带 run_id 动态段，逐字表**永远匹配不上** ——
  要放开就得拿一条有安全理由的不变量换便利。真解是 SSE 化（本仓已有
  `/api/sync/stream` 先例）或给只读状态端点单列预算，两者都是后端的事。
  前端已在自己那层自救完毕（2.5s + 连续失败才停 + 停下时明说进展可能过期）。
- **ai-service 的构建/运行缺口**（拆仓阶段 2 遗留，共 4 条）已在本轮拉起时修掉，
  分别提交在 `quant-trading-agent` 的 `fix/a05-env-ai-service-image`
  （go.mod 缺 15 条 indirect、镜像缺 wait-for-deps.sh 与 config/ai-service.yaml）
  与 core 的 `fix/a05-env-stack-startup`（`Dockerfile.service` 末行多余的 `\\` 让三个镜像
  全建不出来、compose 缺 `AI_SERVICE_URL` 让四族 AI 路由在容器形态下全 503）。
  前两条尤其值得注意：`docker compose ps` 显示三个服务 healthy，跑的却是那个 typo
  落地**之前**构建的旧镜像 —— "起得来"和"是新的"是两件事。

## A-06 证据质问内嵌（F6，横切）

1. 回测报告、因子 IC、多策略对比三处的可质问数字**各自**至少有一个质问入口（这三处正是设计稿缺失的）。
2. 点击入口打开侧滑/浮层，**页面 URL 不变**（不跳页），可用 Playwright 断言 `page.url()` 前后相等。
3. 从数字到原始记录的点击次数 ≤2，用测试步骤数佐证。
4. 无 `content_hash` 的数字显示"无法回溯"，且存在一条用例专门喂无 hash 数据断言该文案出现（诚实 > 好看）。
5. `GET /api/evidence/{content_hash}` 返回 404 时呈现"未摄取"警示态而非错误态（沿用 ODR-060 的三态渲染）。
6. `/evidence` 独立页保留为深链兜底且支持 `?content_hash=`，现有测试不退化。

## A-06 证据质问内嵌（F6，横切）　✅ **已完成 2026-10-14**（浏览器真实数据实测）

落点：`components/evidence/EvidenceProbe.vue`（质问入口 + 抽屉，8 条单测）
+ `composables/useEvidenceLookup.ts`（三态机，从 `EvidenceLookup.vue` 抽出）
+ `components/evidence/EvidenceRecord.vue`（记录展示，同样抽出共用）；
三处接线 = `MetricsCards.vue`（回测报告）、`BacktestCompare.vue`、
`FactorCitation.vue`。新增 `e2e/tests/evidence-probe.spec.ts`（6 条）。

| # | 断言 | 取证 |
|---|---|---|
| 1 | 三处各有质问入口 | 浏览器实测：回测报告 5 张指标卡各 1 个入口（真数据 `?id=76a00397…`，Sharpe −27.43）；对比页 12 行 × 1 个（实测 `probes=12 / rowCount=12`）；因子侧每条 citation 1 个 |
| 2 | 打开抽屉 **URL 不变** | 单元 1 条（断言 `push` 未被调用 + `location.href` 前后相等）+ e2e 1 条（真后端，`expect(page.url()).toBe(before)`）。**并撤掉一处既有违例**：`FactorCitation` 原先 `router.push('/evidence?…')`，点一下就被送出当前页 |
| 3 | ≤2 次点击到原始记录 | 实测 1 次：点入口即开抽屉**并自动解析**，记录直接出现。e2e 用步骤数佐证（一次 `click()` 后 `[data-testid="evidence-record"]` 即可见） |
| 4 | 无 hash 显示"无法回溯" | 该文案是**渲染出来的可见文字**，不是 hover/title；单元 + e2e 各有一条专门喂无 hash 数据。e2e 逐个数 5 个入口都写着"无法回溯" |
| 5 | 404 = "未摄取"警示态 | 与 `/evidence` 页**共用同一份三态机**（`useEvidenceLookup`），三态名逐一对上 [ODR-060](../../../../quant-trading-docs/docs/archive/odr/odr-060-p5-1-frontend-evidence-api.md) 定义的 命中 / 未摄取(warning) / 其他失败(error)。破坏验证：把 404 当故障 → 新单测 2 条 + **一条原有** `EvidenceLookup` 测试 + e2e 2 条同时红 |
| 6 | `/evidence` 深链兜底不退化 | 抽屉内"在证据页打开"仍在（那是用户**主动**要的跳转）；`/evidence?content_hash=` 用真记录验：取回 `akshare / akshare.stock_financial_abstract / 600519.SH/2024Q1`。<br>⚠️ **本行原先还写着"全量 playwright 116 passed / 2 skipped / 0 failed"，那是错的读数，A-07 当日证伪并更正**：命令是 `npx playwright test \| tail -30`，**管道把退出码换成了 `tail` 的 0**，而截断只剩最后 30 行，红清单整体被切掉了。A-07 用不截断的重跑实测：**61 failed / 116 passed / 2 skipped**（共 179）。**这 61 条不是 A-06/A-07 引入的**，归因见 [AUD-61](../../TASKS.md) 的 2026-10-14 实测登记（死选择器、async 默认态导致的 strict-mode、纯 API 用例的数据期望、共享限流 429）。A-06 自己的 6 条在本轮改成"只对 429 退避"后**逐条绿** |

**三处接线的现实差别（实测，不是设计假设）**

- **回测报告**：`GET /api/backtest/:id/report` 响应里**零个** hash/citation
  （逐字段遍历过，2026-10-14 实测）⇒ 五个指标一律"无法回溯"。原因写具体：
  质问一个**派生数**的正确问法不是"哪条原始记录"，而是"这组输入下能否重算出同一个数"。
- **多策略对比**：同上；入口挂在**行标签**而非每格 —— 每格一个会糊出
  N 策略 × 12 行个按钮，而被质问的是同一个量，一次质问覆盖整行。
- **因子侧**：唯一真带坐标的一路（citation 五元组）。但 `factor_cache` 今天
  **0 行**（`GET /api/factors/momentum?…` → 404），所以抽屉的命中态只能用 mock 验。
  **没有为了取证往那张表塞假行** —— 引擎启动即 warm 它（日志
  `factor cache warming enabled`），一条假因子可能悄悄进真回测。

**两处自查记录**

1. 写 `reason` 字符串时我用了 `**派生结果**`，实测原样露出星号 —— 与 A-05 刚修的
   同一类缺陷，隔一天在**自己新写的**字符串上复发。修法是别在用户可见字符串里
   夹 markdown，而不是给 `reason` 加一套解析器。
2. 登记断言 5 时调研一度报"ODR-060 不存在"（它只搜了 core 与 ui 两个仓）。
   核对后确认该 ODR 在 `quant-trading-docs` 仓，三态定义与实现一致 ——
   差点把"引用是死链"写进台账，那会是本轮第二次犯"没核实就下结论"。

**复查（同日第二轮）又抓出三件，都已处置**

| 发现 | 处置 |
|---|---|
| `useEvidenceLookup` 导出 `resolvedHash`，两个调用方**都不读** | 删。我当初还给它写了句理由（"用于判断换了一个数字要重查"），但 EvidenceProbe 是直接 `reset()+lookup()` 的 —— 那个理由是我替它编的 |
| 给 `DetailMetrics.vue` 也加了质问入口 | 撤。实测它是**死组件**：`GET /api/backtest/:id/report` 响应里**没有 `metrics` 这个键**（逐字段核过），前端也从不赋值 ⇒ `v-if` 恒假、整块永不渲染。给不存在的场景写代码不是"顺手做全" |
| 为防窄屏溢出加了两条 CSS（`.metric-label{min-width:0}`、`.ev-probe{flex-shrink:0}`） | 撤。把网格压到 260px 实测：两条都**不改变任何结果** —— 标签自带 `overflow:hidden`，其自动最小尺寸本来就是 0，我防的那个溢出压根不发生。**死 CSS 配一段讲风险多严重的注释，比没有更糟** |

> **`DetailMetrics` 是死组件**这件事登记给 **A-07**（状态三值全站收口）：它和
> "用 `result.id` 是否存在判成功"同一族 —— TS 类型里写了个 `metrics?`，于是代码
> 假设了一个后端并不发的形状，而 `v-if` 让这种假设**静默失效**，既不报错也不显示。
> A-07 正是收这一类的。

## A-07 状态三值全站收口（K9 横切）

1. 全站不存在以 `result.id` 存在判成功的代码路径（grep `result.id` 相关判定为 0）。
2. `completed / invalid / failed` 三态在 API 类型、组件、文案三处同口径，类型层为三值联合（已在 b28d5b6 落）。
3. `invalid` 态渲染警示样式**且**列出 `invalid_reasons`，缺一即断言为假。
4. 含 `invalid` 的混合结果集进入对比页时，被排除项与其原因被显式呈现（抄 `compare` 稿的 `GATE EXCLUDED` 画法）。
5. 三值各有独立单测用例（3 条用例，不是 1 条参数化打天下）。
6. `--q-warning` 在实现中被 `invalid` 态实际消费（当前该 token 历史消费数为 0）。

## A-07 状态三值全站收口（K9 横切）　✅ **已完成 2026-10-14**（真后端 + **真无效运行**实测）

落点：新增 `utils/runStatus.ts` —— 三值的**唯一**展示口径（`statusTagFor` 详情视角、
`runStatusTag` 列表视角、`invalidReasonLabel`/`invalidReasonsText` 原因人话、
`backtestValidityNote` 流水线产物措辞）。接线 6 处：`QuickBacktest.vue`、
`ConsoleHistory.vue`、`BacktestHistory.vue`、`BacktestEngine.vue`、
`BacktestCompare.vue`、`Copilot.vue`；另删掉 `Dashboard.vue` 与 `QuickBacktest.vue`
各自那份 `interface QuickResult`（投影把 `status` 丢了，见断言 1）。
新增单测 `runStatus.test.ts`(26) + `QuickBacktest.test.ts`(11) +
`ConsoleHistory.test.ts`(6)，新增 `e2e/tests/status-tristate.spec.ts`(2)。

| # | 断言 | 取证 |
|---|---|---|
| 1 | 不存在以 `result.id` 存在判成功的代码路径 | 全部 7 处 `*.id` 判定逐条读过：`BacktestEngine.vue:46`（只是把 id 印在标签后）、`:165`（是否已在对比集 —— 没 id 就**不能**加入对比）、`:403`（报告缺 id 时用路由参数回填）、`Dashboard.vue:117`（缺 id 抛错：id 是**身份**不是结论）、`stores/backtest.ts:69`（id 是历史条目的主键）、`BacktestCompare.vue:134`（最佳标记）、`StrategyBuilder.vue:262`（拖拽载荷）。**没有一处**是"有 id ⇒ 成功"。机械腿见断言 5 下的源码扫描 |
| 2 | 三态在类型 / 组件 / 文案三处同口径 | 类型层 `RunStatus = 'completed'\|'invalid'\|'failed'`（`types/api.ts:44`，b28d5b6）；组件层六处全部 import 同一个 `utils/runStatus`；文案层由一条单测**钉住不漂移**：`statusTagFor('invalid')` 与 `runStatusTag('invalid')` 必须 `toEqual`（两个视角读同一张表，措辞不可能各自跑开） |
| 3 | `invalid` 渲染警示样式**且**列出 `invalid_reasons` | 单测各一条断 `NTag` 的 `type` prop（断 class 是**空断言** —— naive-ui 不加 type 修饰类，走 CSS 变量）；真实数据：控制台卡片跑 `stock_pool=["csi300"]` ⇒ 屏幕上是「无效运行」+「股票池为空 · 一次成交都没有 · 指标是不可用值」，**一个指标都不显示** |
| 4 | 混合结果集进对比页时被排除项与原因可见 | `e2e/tests/status-tristate.spec.ts` 两条：真后端走 `missing` 通道（用不存在的 id，理由见该文件注记）、mock 走 `invalid` 通道（本地库 **0 条 invalid 作业**，见下方"实测边界"）。两条都断"策略名 + 原因"，不只看 id |
| 5 | 三值各有独立单测用例（不是 1 条参数化） | `QuickBacktest.test.ts` 三个独立 `describe`（completed / invalid / failed）+ 一个"status 缺失或第四种值"；`runStatus.test.ts` 同样分态。参数化写法看不出**默认落在哪一支**，而"缺 status 就当成功"正是本轮修的 bug 形状 |
| 6 | `--q-warning` 被 `invalid` 态实际消费 | 断的是浏览器里的**计算色**：`toHaveCSS('color', 'rgb(245, 158, 11)')`（对比页原因行）+ 实测 `getComputedStyle` 读回同一值（快速回测卡的无效原因行）。措辞老实一点：那枚标签的色**早就**是这个值 —— `palette.ts` 的 `warning:'#f59e0b'` 经 `App.vue:67` 的 themeOverrides 喂给 naive-ui；本轮真正补上的是**原因文本**（原先是次级灰 `--q-text2`） |

**另有一处扫描器现在能机械抓住的东西**：`QuickBacktest.vue` 与 `Dashboard.vue`
原先各写一份 `interface QuickResult { id; total_return?; sharpe_ratio? }`。
投影丢掉 `status` 的代价不是少个标签，而是一次 `status=invalid` 的运行会带着
0 / 垃圾值进到这个卡片，被渲染成一枚绿色「收益 +0.00%」，与一次真成功的回测
**逐像素相同**。现在 props 就是 `BacktestResult`。

**断言 1 的机械腿（源码扫描，fail-closed 白名单）**：`runStatus.test.ts` 里
「凡渲染 `total_return` 的文件必须**真的读 status**」，两条腿都做过破坏验证 ——
① 探针文件不进清单 ⇒ 「清单本身没漏」红；② 探针进了清单但只在**注释**里写
`status` ⇒ 逐文件断言红。第二条是本轮加固的：第一版正则写的是 `\bstatus\b`，
那是**假护栏**（一句 `// 见 K9 status 口径` 就能骗绿），现在要求出现比较、
`switch(...status)` 或口径 helper。`Copilot.vue` 就是这条扫描器当场抓出来的
第三处现场。

**实测边界（哪些是真数据、哪些只能 mock，写清楚）**

- **真数据 · 真无效运行**：`POST /api/backtest` 用 `["csi300"]` 当票池（core 侧
  `docs/TASKS.md` §八 5 号条目查清的机制：字面量进 `StockPool` 而非 `IndexCode`
  ⇒ 展开分支不可达 ⇒ 票池归零）。浏览器实测三处：快速回测卡（无效标签 + 人话原因，
  指标一位不露）、控制台历史（该行标签是「无效运行」而不是方向「多」）、
  回测报告页（状态标签 + 警示条 + 5 张指标卡全 `-`）。**这就是断言 3 的正证据**。
- **实测顺手抓到的后端实情**（已写进 `ConsoleHistory.vue` 的注释，别再当假设）：
  无效响应的指标键是**缺席**的 —— 返回 JSON 里没有 `total_return` / `sharpe_ratio`，
  却带着 `sortino_ratio: 1.7976931348623157e+308`（MaxFloat64，正是 `garbage_metric`
  那条 Code 的来由）。所以"invalid 保留数字"这句原先的说法**不准确**，
  实际渲染是「收益: - | 夏普: -」。目前没有任何在渲染的界面会显示那个垃圾
  `sortino_ratio`（唯一会显示它的 `DetailMetrics` 是死组件，A-06 已登记）。
- **只能 mock**：对比页的 `invalid` 通道 —— 本地 `backtest_jobs` 里
  **0 条 invalid**（`GET /api/backtest` 只回 completed），而 `limit` 顶到 100
  也捞不到那 17 条 failed（它们比最新 100 条更老，接口没有 offset）。
  **没有为取证往库里塞假行**（同 A-06 对 `factor_cache` 的裁决）。

**自查记录（本轮自己犯的 / 自己抓的，都留档）**

1. **破坏验证时我把组件改坏了**：为验证"unknown 不默认成成功"，把
   `v-else-if="status==='completed'"` 改成 `v-else` —— 那与后面那支未知态
   构成**两个兄弟 v-else**，Vue 模板直接编译失败，测试跑出 `no tests`；
   还原时 Edit 又匹配到 2 处而失败。当时最危险的念头是 `git checkout` 该文件，
   而那会把整个三值模板一起丢掉（A-07 全部未提交）。**教训**：变异要选
   **不改变模板结构**的等价写法（最终用 `status !== 'invalid' && status !== 'failed'`，
   两条未知态用例干净转红），还原锚点用分支上方那段唯一注释。
2. **假护栏一处**：见上，`\bstatus\b` 换成"真的读 status"。
   判据是"改坏能不能变红"，不是"看起来像在检查"。
3. **复查自己的 A-07 代码又抓到两处二口径**：`BacktestCompare.vue` 把
   `invalid_reasons` 原样 `join(' / ')` 贴给用户（同一份原因在快速回测卡是
   「股票池为空」），`BacktestEngine.vue` 自带一份 `statusTagType`/`statusTagLabel`
   switch（措辞与 `runStatus` 逐字相同但各改各的）。两处都收进 `utils/runStatus`。
   为此改了**一条既有断言**：`BacktestEngine.test.ts` 原先断 `empty_universe`
   原样出现在屏幕上 —— 那是行为被本任务**故意**改掉的那一种，按 §规范记为
   "改测试因为需求变了"，不是为了让测试变绿。
4. **e2e 的 429 不是代码问题，但红在无关处一样有毒**：`pickJob` 连打
   `GET /api/backtest` 被**共享限流**打中，两条用例在与本次改动无关的地方红
   （实测两轮）。只给 **429** 加退避重试，其他状态码照旧响 —— 500 是真坏了。
   写第一版重试时我先 `dispose()` 再 `json()`，得到 `Response has been disposed`，
   自己踩自己挖的坑；已在注释里留这句。**同类 flake 大概率遍布 e2e 套件**，
   已按归属登记给 AUD-61，不在这里全仓铺开。
5. **一条被我写歪的理由及时改准**：CSS 注释初稿说"naive-ui 的 warning 是它自己的
   琥珀、外部覆盖不动"。实测 `getComputedStyle` 读回 `rgb(245,158,11)` —— 因为
   `palette.ts` 早把 `warning` 映射成同一个值了。所以本轮补的**不是**"接上 token"，
   而是"原因文本别再用次级灰"。注释与本文都已按实情改写。

**门禁读数（A-07 收口时，如实分开写）**

- 单测：`npx vitest run` **354 passed / 28 files**（本轮 +31）。
- `npm run typecheck` **0 错**；`eslint` 对改动文件 **0 error**（warning 是全站存量的
  属性换行风格，非本轮引入的写法问题）。
- 本轮自己的 e2e：`status-tristate`（2）+ `evidence-probe`（6）**逐条绿**。
- **全量 e2e 不是绿的**：`61 failed / 116 passed / 2 skipped`（179 条，退出码 1）。
  这 61 条**不是 A-07 引入的**（归因与逐条证据见 [AUD-61](../../TASKS.md) 的
  2026-10-14 实测登记）。我此前两次报"全量 0 failed"是把
  `npx playwright test | tail -30` 的输出当成结论 —— **管道给的是 `tail` 的退出码**，
  而截断切掉了红清单。判据只能是不截断重跑并读 playwright 自己的退出码。

## A-08 `data_sync` 整屏重做为作业控制台（F13）

1. 页面主区是作业队列（列表 / 详情 / 取消 / 重试），对应 `sync` 端点 `GET /api/sync/jobs`、`GET /jobs/{id}`、`POST /jobs/{id}/cancel`、`POST /jobs/{id}/retry` 各有一次真实调用。
2. 排程管理 CRUD + toggle + run-now 可达，对应 7 条 `/api/sync/schedules*` 端点。
3. worker 与 scheduler 统计有展示位（`GET /api/sync/workers`、`GET /api/sync/scheduler/stats`）。
4. 页面内**唯一**允许出现 "SSE" 字样的地方是单作业进度流，且其订阅走 `GET /api/sync/jobs/{id}/progress`；其余位置 grep 为 0。
5. 稿上的湖仓/集群/L2 元素（Parquet、Iceberg、DuckDB、GPU、SLA、Level2 逐笔）**一个都不实现**，grep 为 0。
6. PIT 时间轴与幸存者偏差两块**保留**（ANNOTATIONS 判为唯一精华），各有一条用例。

### A-08 实施计划（六字段，2026-10-14 起草 → 同日批准开工：若曦指示「先 sync01 再 A08」）

**① 目标**：`/data-sync` 成为作业控制台 —— 一条可筛可续的队列、一块排程管理、一组真实的
worker/scheduler 读数，且**屏幕上每个数都能指到一条端点或明写"未摄取"**。

**② 上下文（2026-10-14 当场实测，不是引用断言）**

| 端点 | 状态 | 前端现状 |
|---|---|---|
| `GET /api/sync/jobs` / `GET /jobs/{id}` / `POST /jobs/{id}/cancel` / `POST /jobs/{id}/retry` | 实测 200（`count:20`，内含 `aud49_…` 纳秒 ID 作业） | ✅ 已有：`api/sync.ts` 四函数 + `stores/sync.ts` 的 `cancelJob`/`retryJob`/`watchJob`/`unwatchJob`，消费在 `SyncStatusPanel.vue`(146 行) |
| `GET /api/sync/jobs/{id}/progress`（SSE） | 已有 | ✅ `syncJobProgressStreamPath` + store 的 watch/unwatch（全站唯一 SSE 腿） |
| `/api/sync/schedules` 系 **7 条**（list/get/create/update/delete/toggle/run-now） | 实测 200；后端在 `quant-trading/cmd/data/main.go:149-155`，经 analysis 网关代理可达 | ❌ **`web/src` 对 `schedules` 零命中** ⇒ 这一整块是**纯新增**，不是改造 |
| `GET /api/sync/workers` | 实测 200（`num_workers:3` + 7 类 registered_types） | ❌ 无消费点 |
| `GET /api/sync/scheduler/stats` | 起草时实测恒 `{"active_schedules":0,"total_entries":0}` | ❌ 无消费点。**根因见 core 仓工单 SYNC-01，已于同日修掉**（`quant-trading` commit `65a31a7`）：`pkg/sync/scheduler.go:47` 的 `Scheduler.Start()` 全仓**零调用方（生产与测试都是 0）** ⇒ cron 从未启动。修后实测：toggle on → `total_entries:1` + `next_runs` 有值；toggle off → `0/0`（见步骤 0 结论 (a)）。⚠️ **0/0 有两种成因（启动失败 vs 确实无 active 排程），后端不区分** —— 已登记，前端不得编诊断文案（§三 跨仓指针 A-08 行） |

页面现状：`pages/DataSync.vue`(34 行) 只是三块拼装 —— `DataSourcePanel`(139) /
`SyncStatusPanel`(146) / `DataImportForm`(93)；`api/sync.ts` 另有 datasource
`status`/`health` 两个消费点。**改造不是从零，是把已有的队列层重排 + 补齐三块空白。**

**③ 要求（六步，每步一个可独立测试通过的 commit）**

0. **前置归因（不写 UI）**：三件事各自出结论后才开工 —— (a) SYNC-01 是否在本轮修（不修则下述措辞约束生效）；(b) V-3 的基线策略二选一（本任务会**动掉 `data-sync` 这张视觉基线**，而它本来就因渲染活后台状态而不可复现 —— 不先定策略就等于改完没有回归网）；(c) 实测幸存者偏差的数据前提：`stocks.delist_date` 有多少非空行（代码路径已在：`pkg/data/tushare.go:217` 请求列含该字段、`:276` 注明修复、`pkg/domain/market/types.go:40`、`pkg/storage/postgres.go:389-394`，**但行数为 0 还是几百，直接决定那块显示什么**）。
1. **API 层补齐**：`api/sync.ts` 加排程 7 函数 + `workers` + `scheduler/stats`（命名与既有 `listSyncJobs`/`cancelSyncJob` 同风格；类型落 `types/api.ts`，**不在组件里就地声明**。
2. **store 层**：`stores/sync.ts` 增加排程切片与统计切片；SSE 仍**只有** `watchJob/unwatchJob` 一条腿，不得为排程另开轮询以外的第二条推送。
3. **队列区**（断言 1）：列表 + 筛选（状态/类型）+ 详情抽屉 + cancel/retry 动作，动作后必须回到"这条作业的最新状态"，不靠乐观更新。
4. **排程区**（断言 2）：CRUD + toggle + run-now；run-now 后跳去队列看那条新作业（不是弹一句"已触发"就算）。表单侧 cron 表达式**原样透传后端校验**（`ErrInvalidCron` → 400 的措辞要显示出来，不在前端猜合法性）。
5. **读数区**（断言 3）+ **PIT / 幸存者**（断言 6）：读数是 `workers`/`stats` 的真值；PIT 三时刻（财务期末 / 公告披露 `ann_date` / 因子可交易起始）从 `GET :8081/fundamentals/:symbol/history` 取 —— **今天它返回 `{"history":null}`**，故这块渲染**显式空态**（"未摄取"，同 ODR-060 三态口径），**不造行**（与 A-06 对 `factor_cache` 的裁决同规则：摄取缺口是 core 的 EQD-P1-2，不是前端可以填的空）。

**④ 约束与非目标**

- **措辞硬约束（SYNC-01 未修前生效）**：排程面板与 stats 读数**不得**出现「调度运行中」「下次执行 …」这类暗示 cron 会在后台触发的文案或字段位。可以显示"已注册 N 条 / 已排定"吗？—— 不行，"排定"就是那个暗示。只允许显示后端**确实量到**的东西：条目数、`is_active` 状态、以及"本环境的调度器未启动（见 core SYNC-01）"这句事实。
  > ⚠️ **本条已被步骤 0 结论 (a) 改判（2026-10-14，SYNC-01 已修并落 commit `65a31a7`）**：前提「cron 永不触发」不再成立，故「下次执行」这类文案**可以用**——但只在 `is_active=true` 时；替换生效的是步骤 0 (a) 里那条新规则（inactive 不显示 `next_run_at`，因 core SYNC-03 未修）。原文保留是为可追溯：这条约束当初为什么会存在。
- **不做**：稿上湖仓/集群/L2 全部（Parquet、Iceberg、DuckDB、GPU、SLA 99.999%、Level2 逐笔）—— 断言 5 以 grep 判定；不引入 `Tailwind`/新依赖；不加新端点假设（每条请求都能指到 `cmd/data/main.go` 的注册行或 openapi）；不碰 `docker-compose.yml`；不在前端改 `stats` 字段语义来"让它好看"。
- **不退化**：`DataSourcePanel` / `DataImportForm` 的现有能力（数据源状态与创建作业）在新 IA 里必须仍有落点，删除任一功能要在本台账写明理由，不静默丢弃。
- 每条用户可见字符串**不夹 markdown**（A-05/A-06 两次复发的老坑）；大对象用 `shallowRef`；DOM 访问前 `await nextTick()`。

**⑤ 验收（断言 → 取证方式，写清哪条用真数据、哪条只能 mock）**

| 断言 | 取证 |
|---|---|
| 1 队列四操作各一次真实调用 | e2e（真后端）：列表可见、点开详情、cancel 与 retry 后状态变化 —— 用 `GET /api/sync/jobs` 里的真作业；**cancel/retry 需要一条非终态作业**，取不到则造一条 `POST /api/sync/jobs` 真作业（这是真实 API 调用，不是往库里塞假行） |
| 2 排程 7 条端点可达 | 单测（api 层 mock 逐条断 URL/方法）+ e2e 用 route 拦截走一遍 CRUD 序列；**toggle 的真后端用例受 SYNC-01 影响，见下方"实测边界"** |
| 3 worker/stats 有展示位 | e2e 真后端读 `num_workers:3` 断渲染一致；`total_entries` 恒 0 的处置：显示 0 并附"调度器未启动"的事实句，**不美化** |
| 4 SSE 只出现在单作业进度 | 源码扫描守卫（fail-closed 白名单，同 A-07 断言 1 那条机械腿的写法）：全 `src/` 里 `EventSource` 命中文件必须等于登记集 |
| 5 湖仓/集群/L2 零实现 | grep 判据（用例断 0 命中），列出被 grep 的 6 个词 |
| 6 PIT + 幸存者各一条用例 | 各一条单测断"数据缺席时走显式空态、有数据时三时刻齐全"，空态那条是**今天唯一能真跑的** |

**⑥ 边界**：只做 `/data-sync` 一屏 + 其 api/store/组件；core 侧 SYNC-01、EQD-P1-2 归 core；V-3 的策略决定若需要测试基础设施改动，落 AUD-61 而不是夹在本任务里。

### A-08 步骤 0 结论（2026-10-14 实测，三件事各自的落笔前结论）

**(a) SYNC-01 已在 A-08 开工前修掉** —— core 仓 commit `65a31a7`（`fix(sync): 调度器接上装配点`）。
活进程正证据：重建重启 data-service 后日志齐 `scheduler.go:48/:254/:56` 三行；`POST /schedules/1/toggle {active:true}` → `scheduler/stats` 的 `total_entries` **0→1** 且 `next_runs` 出现，toggle 回 `false` → `0/0`（现场已还原，未触发真同步）。

⇒ **原「措辞硬约束」解除**（那条约束的前提「cron 永远不会跑」已不成立）。但实测顶出**一条新的、方向相反的约束**：

> **SYNC-03 实测（同一批 curl）**：toggle 回 `false` 后 `GET /api/sync/schedules/1` 仍返回
> `is_active:false` **且** `next_run_at:"2026-10-15T09:00:00Z"` —— 停用路径只 `cron.Remove`，不清字段。
> ⇒ **A-08 前端规则：`is_active=false` 的排程一律不显示 `next_run_at`**（显示它就是把一个不会发生的未来当事实，违愿景原则 4）。
> 后端真解登记为 core 工单 **SYNC-03**（`quant-trading:docs/TASKS.md` §二·补），前端防御**不代替**它修好后的口径。

**(b) V-3 基线策略：选 (a) mask，不选 (b) 固定 fixture 后端。**

- 理由：`scheduler/stats` 从今天起是**活状态**（排程一注册就变），全页基线原理上不可能复现；(b) 要新搭一套测试后端，属**测试基础设施**，按 §⑥ 归 AUD-61，且无法与本屏改造原子提交。
- 代价（明写）：被遮的区域**不再有任何像素覆盖** —— 排程卡/队列/告警条三块的颜色回归只剩 A-08 的功能断言（断言 1–3）兜，视觉回归网在这些地方是**主动放弃**的，不是通过。
- 依赖顺序：mask 需要稳定选择器 ⇒ 步骤 3–5 先落 `data-testid`，再回来遮；遮哪几块、连跑三轮的登记**落 AUD-61 表**，本文件不重复记账（两处各记必漂移）。

**(c) 幸存者偏差块的数据前提：库里真有，HTTP 面上没有。**

| 实测（`stocks` 表，psql `ON_ERROR_STOP=1`） | 读数 |
|---|---|
| 总行数 | **5908** |
| `delist_date IS NOT NULL` | **339**（跨度 `1999-07-12` → `2026-07-30`） |
| 按 `status` 分组 | `active` 5569 行 / `delist_date` 非空 **0** 条；`delisted` 339 行 / `delist_date` 非空 **339** 条 |
| 不一致行（有摘牌日却仍标 active） | **0** |

⇒ 数据侧干净可用（列存在且类型是 `date`，`pkg/storage/stocks.go:15 stockColumns` 已把 `delist_date` 读出来，`pkg/domain/market/types.go:49` 用指针区分「未知」与「仍在市」）。

**但**：SPA 唯一的票池读数腿是 `GET /api/stocks/count` → `{count, latest_date}`（`cmd/data/handlers_stocks.go:84-104`，count 是**含已退市**的 5908），analysis 网关**没有**代理带 `status`/`delist_date` 的 `/api/stocks` 列表（`cmd/analysis/handlers_proxy.go` 只登记了 count 一条）。

⇒ 结论两条：
1. 幸存者块**这次不显示任何拆分数**，只显示「后端未暴露按状态拆分的读数」这一事实 + 指向 core 需求单；**不**在前端偷偷 `5908 - 339` 之类自算（那是在客户端重建后端语义，两处真相）。
2. 现有 `count` 若出现在界面上，标签必须写「全部记录（含已退市）」——把 5908 叫「在市股票数」就是假数字。
3. 需求以**只登记不指挥**的方式提给 core（工单 **DATA-02**，见本节末「向 core 提的需求」）：要一条按状态拆分/含摘牌日的只读腿。**具体形状由 core 定**，前端不干预后端设计（若曦 2026-10-14 准则原文）。

**实测边界（提前声明，避免事后写假结论）**：排程 toggle 之后 `scheduler/stats` 的
`active_schedules` **会变 1**（`ToggleSchedule` 真的把条目加进了 cron），但因为没有
`cron.Start()`，那一格**永远不会跑**。所以 A-08 若用"stats 计数变化"当验收，会在缺陷状态下
照样变绿 —— 验收必须落在「**是否出现了由排程产生的作业行**」这种可证伪的事实上，这条正是
core SYNC-01 的验收第 1、2 条要防的形状，本任务不能替它绕过。

> **改判后的形状（2026-10-14，步骤 0 结论 (a)）**：`cron.Start()` 现在有调用方了，所以这条**不再是缺陷**
> —— 但它作为**方法论**保留，且对 A-08 依然生效，只是方向变了：
> toggle 之后 `total_entries` 变 1 只证明「注册进了 cron」，**不证明「会跑」**（cron 表达式指向的未来时刻
> 在测试窗口内不会到）。⇒ A-08 断言 2 里「排程真的产生作业」这一腿必须走 **`POST /schedules/:id/run`（run-now）**
> ——它同步创建作业行（实测返回 `202 {message, job_id, status}`），是唯一能在测试窗口内证伪的判据；
> 用「等 toggle 后出现作业行」当判据是把验收挂在一条 09:00 的时间上，等于没有判据。
>
> ✅ **run-now 那条已经当场量过，不是读码推测**（2026-10-14 17:41Z，经网关 :8085）：
> `POST /api/sync/schedules/1/run` → `202 {"job_id":"scheduled-1791999687307345938","message":"schedule triggered","status":"pending"}`；
> 1.6 秒后 `GET /api/sync/jobs/{id}` → `status:"completed"`、`progress_percent:100`、`result:{count:242, symbols:1}`。
> **副作用留痕（明写不藏）**：这次真取数向 `ohlcv_daily_qfq` 写入 000001.SZ 2024 年 **242** 行真实日线；
> 作业行 `scheduled-1791999687307345938` 留在 `sync_jobs` 里，**正好充当 A-08 队列区 e2e 的真作业 fixture**。

## A-08 `data_sync` 整屏重做为作业控制台（F13）　✅ **已完成 2026-10-14**（真后端 + 真 cancel 实测；V-3 基线在收口时改判，见步骤 6 ④）

### A-08 步骤 6 收口（门禁与台账，2026-10-14）

**① 三条机械腿**（`web/src/a08-boundaries.test.ts`，8 条用例）

| 腿 | 判据 | 为什么是源码扫描而不是行为测试 |
|---|---|---|
| 断言 4 | `new EventSource(` 的构造点集合 **等于登记集** `['stores/sync.ts']`；那条构造打的是 `syncJobProgressStreamPath(...)`，其形状是 `/api/sync/jobs/${id}/progress`；`.vue` 剥掉注释后不出现 `SSE`/`EventSource` 字样 | 新开一条推送在行为测试里长得完全正常（请求发得出去、界面渲染得挺好）；只有读源码看得出"多了一条腿" |
| 断言 5 | 六个词（Parquet / Iceberg / DuckDB / GPU / SLA / Level2）带**词边界**扫全 `src/` 非测试源码，命中 0；另有两条"不空跑"腿（违例样本必须被同一套规则抓到、扫描面文件数 > 60） | 湖仓元素是"不许实现"，实现进来就是新代码，行为测试只会去测它工作得好不好 |
| 约束 | 剥掉注释后全仓实现源码不含 `**加粗**`（A-05/A-06/A-08 三连复发的同一个坑） | 违例的表现是"用户看见星号"，而收益是零 —— 全站判据，不只本屏 |

判据用 `\bSLA\b` 而不是子串：`translateY` 里含 `sla`，子串 grep 会把 CSS 判成违规（假红），而假红会把人训练成忽略红灯。

**破坏验证（新增护栏必验，四条腿各自点名）**

| 编号 | 改坏 | 结果 |
|---|---|---|
| MUT-13 | 撤掉 store 里 `schedulesLoaded.value = true` | **5 红**（store 3 条 + 读数区"0 条/未读取"两条） |
| MUT-14 | 把重复的 `fetchStats()` 加回排程面板挂载 | **1 红**，正是那条"一个数据集一个自动触发点"守卫 |
| MUT-15/16 | 临时探针文件里放第二条 `new EventSource(` + `SSE` 文案；再放 Parquet/SLA/Level2 + `**加粗**` | 两轮分别 **2 红 / 2 红**，消息点名到文件与词 |
| MUT-19 | 撤掉 `jobsLoaded.value = true` | **3 红**（store 1 条 + 队列空态 2 条） |

探针一律用**新建临时文件**而不是改真组件（改完 `rm`，`git status` 只剩该留下的文件）；MUT-13/14/19 用 node 写 `.bak` 再逐字节还原，还原后断言 `restored identical: true` + 全文无 `MUT-` 残留。

**② 本轮修掉的三处同族口径缺陷**（"读到空"与"没读到"是一句话的两副面孔）

1. **空队列的真回包是 `{"count":0,"jobs":null}`**（2026-10-14 curl `?status=pending` 实测，Go 侧 nil slice 编成 `null`），而前端类型写 `SyncJob[]`。按 null 存进 store，`queueLength` 的 `.filter` 当场 TypeError ⇒ 整块队列白屏，而这恰恰是最常见的空态。修法：`resp.jobs ?? []`（与 `schedules` 同一 fail-closed 口径）。**先红后绿**：单测拿真形状写 → `expected null to deeply equal []` → 修 → 484 全绿。后端侧的编码问题登记为 core **DATA-04**（只登记不指挥）。
2. `schedulesLoaded` / `jobsLoaded` 两面旗标：读数区不再拿 `schedules.length` 当"读到了没有"的代理（空表会被说成"未读取"），队列空态分三句（未读取 / 确实没有 / 被类型筛掉），排程空态分两句。
3. **一个数据集一个自动触发点**：浏览器实测（页面加载的网络面板）`schedules`/`workers`/`scheduler/stats` 各被打通**两遍**（排程面板与读数面板各自挂载各取一遍）。single-flight 挡不住错开的 await，所以按归属收口（排程行归排程面板、两条读数归读数区，读数区的刷新按钮是唯一"拉全"入口），并给 `fetchSchedules`/`fetchStats` 加 single-flight 覆盖变更动作后的并发重读。收口后网络面板实测：**三条各一次**。共享限流桶是进程级的（core OPS-01），空耗预算会把真实请求挤成 429 —— 这不是洁癖，是本轮 e2e 自己被 429 打死过两次之后收回来的结论。

**③ A-08 自己的 e2e**（`e2e/tests/a08-job-console.spec.ts`，6 条，逐条绿，退出码 0）

| 用例 | 真后端 / 拦截 | 钉住的东西 |
|---|---|---|
| 队列列表 + 详情回读 + worker 读数 | **真后端**（只读） | 界面那格 == 页面自己吃下的那条响应；详情抽屉必须是刚点的那条 |
| 空队列 `jobs:null` 走空态 | 拦截（要的是**真形状**） | 上面第 ②-1 条缺陷的回归腿 |
| 取消/重试按钮三态 | 拦截 | `canCancel`/`canRetry` 镜像后端规则（`cancelled` 不可重试、`pending` 可 —— 与直觉相反） |
| 取消走真后端 | **真后端（写一次）** | 点完之后界面 == 后端回读的状态，不是前端猜的"已取消" |
| CRUD + toggle + run-now | 拦截（理由写在文件头） | 六条写端点各命中一次、run-now 之后**队列里出现那条作业**、停用行不显示残留 `next_run_at`、全站唯一那条推送只开在 run-now 的作业上 |
| PIT + 幸存者 | 拦截 + 真后端 | 缺通道就明写缺通道，不造数、不在前端自算退市占比 |

真 cancel 这条落了库的正证据（不是读码推测）：`aud49_1792010807809070700` → `cancelled @ 20:55:12Z`、`aud49_1792010807381222300` → `cancelled @ 20:56:35Z`，两条都由这条用例点出来的。
**未现场跑过的腿明写**：库里没有非终态作业时的兜底分支（`POST /api/sync/jobs {type:'stocks'}` 造一条真作业再取消）逻辑就位但本轮没走到——本地栈里一直有 stale `running` 行；retry 只走拦截（真 retry 会重跑一次真取数，代价大于这条腿能证的东西）。

**④ V-3 基线：改判，从「遮」换成「fixture」**（这一步的结论反转，写在最前面）

步骤 0 选的是 (a) 遮罩。本轮先按 (a) 落地并**连跑三轮全绿**——随后在全量套件里同一条用例**红了**，所以那个绿是假的：

- 根因：**遮罩只糊像素，不改布局**。被遮那块（队列面板）行数一变就变高，下面每一块整体下移；单独跑三轮时库里行数恰好没变，位移没发生，于是"绿"什么也没证明。全量套件里 A-08 的真 cancel 腿先改了库，位移进视口 → diff。
- 改判：这一屏请求的 8 条端点全部由测试给出固定回包（`DATA_SYNC_FIXTURE`），**不加遮罩**。副作用是这四块**重新有了像素覆盖**（遮罩版是主动放弃覆盖）。
- 双向取证：① 不敏感——先跑 A-08 那 6 条（含改真库的 cancel），再跑这条基线，仍绿；② 不空跑——临时脚手架实测"换 fixture 时五块区域像素全变"（`responds_to_fixture=[queue,schedule,readout,quality,datasource]`），且同一 fixture 两次整页逐字节相同（`page_reproducible=true`）。脚手架跑完即删，不进提交。
- 代价明写：视觉网**不再覆盖真数据渲染**（真队列的深度、真数字的宽度都不在这张图上）；页面将来消费新字段时回包必须跟着补，补漏了就是"基线照常绿而界面已经错"——那层兜底交给 A-08 的真后端功能断言与组件单测。
- 三条刻意的 fixture 选择写进注释：作业全给终态（非终态会开 SSE + 起 8s 轮询，"实时连接"那颗芯片是时间函数）；`failed` 那条保留 重试 按钮、`active` 那条保留 下次执行（按钮与三态排版仍在图上）；停用行故意带着残留 `next_run_at`，让「显示 —」这条 SYNC-03 防御也进这张图。

**⑤ 门禁读数（A-08 收口时，如实分开写）**

- 单测：`npx vitest run` **484 passed / 36 files**（本轮 +14），退出码 0。
- `npm run typecheck` 退出码 **0**；`npm run lint` 退出码 **0**（0 error，945 warning 是全站存量的属性换行风格）。
- 本轮自己的 e2e：`a08-job-console`（6）**逐条绿**，退出码 0；`visual-regression` 的 data-sync 那条在 fixture 版下绿，且对真库变化不敏感。
- **全量 e2e 不是绿的**（两次跑，读数如实并排）：
  - 遮罩版基线那次：`79 failed / 104 passed / 2 skipped`（185 条，退出码 1），其中 data-sync 基线**红**。
  - 改走 fixture 之后复跑：同样 `79 failed / 104 passed / 2 skipped`，但 data-sync 基线**绿**、`a08-job-console` 6 条**全绿**。红总数没变，变的是"哪几条红"。
  - 与 AUD-61 登记的 61 红基线相比涨了 18 条，涨的全部在纯 API spec：`api-negative` 2→11、`api-backtest` 2→5、`api-health` 0→3、`api-strategy` 0→2、`backtest-engine` 9→11；`visual-regression` 3→**2**（本轮把 data-sync 那条收进来了）。抽样点名核对：`api-negative.spec.ts:15` 的失败是 `Expected: 400 / Received: 429` —— 就是 AUD-61 的第 ④ 类（共享限流），不是新缺陷；`api-backtest.spec.ts:186` 是第 ③ 类（`win_rate` 在 invalid 运行里缺席，与 OBS-01 同源）。
  - **本轮引入的断言级红：0 条** —— 我自己那 7 条（A-08 e2e 6 + data-sync 基线）在全量运行里全绿。但**不把话说满**：这几条也往同一个限流桶里投了约 25 次请求（两次真页面加载 + 真 cancel 的写），涨的 18 条红不能排除被它推过顶。"谁贡献了几次 429"这种归因要 AUD-61 阶段一的逐条登记 + 单跑复验才做得起，本轮不下那个结论。


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

> **归属交叉引用**：本组是 **e2e 测试债**，与 [`docs/TASKS.md`](../../TASKS.md) 的 **AUD-61**
> （e2e 套件与前端结构脱节，声明"本文件为 AUD-61 唯一归属地"）同源。此处只保留**设计重构
> 视角需要的东西**（基线必须可复现，否则 A-04~A-11 没有回归网）；V-2/V-3 的**执行登记与
> fixme 记账一律落在 AUD-61 那张表里**，不在本文件重复登记 —— 两处各记一份必然漂移。

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
| 2026-10-14 (3) | **A-03 自审第二轮**，四处直接修掉：① §0.2.2 声称的"等重量 alpha"实测**并不等量**（`primary-soft` 只有旧值 0.78×）—— 根因是我把合成后的绝对亮度当成 ΔL 记进文档、且从上次扫描输出里挑数而没当场重跑，这是"估算当实测"第三次犯，已按实测重解为 0.10 / 0.16 并连带重生成 12 张基线；② `palette.test.ts` 抬头一直写着三方对账，实际**从不核对 DESIGN.md** —— 补守卫后上线即抓到 7 处真漂移（`--q-series-1..6` + `--q-ai-light` 实现里有、基准里从未立项）；③ `BacktestHistory` 三条 `.pnl-*` 规则**永不匹配**（模板不产该类名，真正用的是 `TradeTable.vue`），我扫页时机械替换的是死代码；④ 用脚本扫完 A-01~A-03 全部 10 个文件的 scoped 选择器，另抓到一处**谎报**：侧栏 Redis/Postgres 状态点写死 `online`、`.offline` 规则永不命中 ⇒ 界面恒久宣称基础设施在线却什么都没查，登记为 **A-04 断言 7**（并补断言 8：12 项归并到 9 项）。四个盲点同一条教训：**静态 grep 命中 ≠ 该样式在页面上起作用** |
| 2026-10-14 (7) | **A-07 完成**（详见该节）。三件事值得单独记：① 三值口径收进 `utils/runStatus.ts` 一份表，**动了别人的断言** —— `BacktestEngine.test.ts` 与 `backtest-engine.spec.ts` 各有一条在断屏幕上出现原始 Code（`empty_universe`），那是被本任务**故意**改掉的行为，不是为了让测试变绿；② 断言 1 的机械腿第一版 `\bstatus\b` 是**假护栏**（注释就能骗绿），改成"必须真的读 status"并用探针文件双向破坏验证；③ 真数据抓到无效响应的实情：指标键是**缺席**而非零值，同时带着 `sortino_ratio=1.79e+308`（MaxFloat64）—— 我原先写在 `ConsoleHistory` 注释里的"invalid 保留数字（它算出来了）"因此**不准确**，已按实测改写。另：`pickJob` 被**共享限流**打成无关处变红，只给 429 加退避（其他码照旧响），同类 flake 按归属登记给 AUD-61；④ **更正我自己写过的假结论** —— A-06 台账那句"全量 playwright 116 passed / 0 failed"是把 `npx playwright test \| tail -30` 的输出当结论（管道给的是 `tail` 的退出码，截断又切掉了红清单）。不截断重跑实测 **61 failed / 116 passed / 2 skipped**（退出码 1），该 61 条经逐类取证（死选择器 / strict-mode 撞 async 默认态 / 纯 API 用例的指标假设 / 共享限流）**均非 A-06~A-07 引入**，已登记给 AUD-61 |
