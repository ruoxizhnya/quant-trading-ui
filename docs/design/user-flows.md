# 用户流程与场景规划（User Flows & Scenarios）— UI 重构

> **版本**: 1.1（2026-10-13）
> **状态**: Draft — UI 重构的 UX 输入基线
> **受众**: 前端 UX 设计 agent、前端实现 agent
> **依据**（只读输入，本文件是它们在 UI 侧的投影）:
> - 产品定义：`quant-trading-docs/docs/PRODUCT.md`（三角色一底座、异步审阅三节奏、漏斗）
> - 设计原则：`quant-trading-docs/docs/VISION.md`（八原则，优先级 1>3>4>6>5>2>7>8）
> - 阶段规划：`quant-trading-docs/docs/ROADMAP.md`（S0 止血✅ → S1 通回路 → S2 解释 → S3 宽度 → S4 监控）
> - 后端 API 契约：`quant-trading/docs/openapi.yaml`（83 个 path，见附录 B）
> - 现有 UI 现状：本仓 `web/src/router/index.ts`、`web/src/pages/`、`web/src/api/`
>
> 本文件**不改**设计系统（色彩/组件/动画仍见 [principles.md](principles.md) / [interaction.md](interaction.md) / [visual.md](visual.md)），只定义：**用户是谁、要完成什么任务、按什么流程、在哪些页面、用哪些 API、有哪些缺口**。
>
> **设计稿的定位（2026-10-13 裁决，见 [ODR-066](../../../quant-trading-docs/docs/archive/odr/odr-066-stitch-design-review-and-boundary-ruling.md)）**：`stitch_quantlab_ux_redesign/` 的 12 屏是**参考件，不是规格**。它可作为方向确认（IA、主线密度、视觉基调）继承，但**任何控件、指标、术语都不得绕过本文件 §4/§5 的 flow 与附录 B 的 API 地图直接落地**。该套稿的越界项（实盘高频执行、分钟线与盘中、L2 行情链路、集群算力布景）、语义契约违规项（二值裁决、六维缺冗余、`unassessed` 缺显式、决策性措辞）、幻觉能力清单（Polars/Parquet/DuckDB、Python 策略类、Merkle 审计链、组合优化器/VaR/HMM-GARCH/Barra、xlsx-pdf 导出、Isolate 动作）与覆盖缺口（F17 合规、F18 系统管理、walkforward/batch、F3 三上下文一致性、F6 质问覆盖面）已在 ODR-066 逐条点名，施工时以其为**删除/标注清单**。**逐控件的处置与 API 映射见 [`stitch_quantlab_ux_redesign/ANNOTATIONS.md`](stitch_quantlab_ux_redesign/ANNOTATIONS.md)** —— 那份文件才是施工直接读的东西，本文件不重复其内容。

---

## 0. 如何读这份文档

- **§1** 是硬约束：任何设计方案不得违反（违反=产品不成立，不只是体验变差）。
- **§3** 是目标信息架构（IA）：页面怎么组织。设计 agent 从这里开始画结构。
- **§4** 是核心主线的逐步骤 flow（F1–F8），每条含状态机、API、异常、验收要点。实现 agent 以此拆任务。
- **§5** 是仪器面场景卡（F9–F18），流程短、以 API 能力为准。
- **§6** 是横切交互模式（异步任务、状态语义、证据质问……），所有页面共享。
- **§7 术语表**、**附录**（路由映射、API 清单、后端缺口）供查证。

---

## 1. 产品定位与 UX 硬约束

### 1.1 一句话

自托管的 A 股量化研究平台。**AI 是操作回测底座的实验员，人是实验室主任**——AI 负责产出与试错，人负责判断与拍板。

### 1.2 三个角色 + 一座底座

| 角色 | 是谁 | 干什么 | UI 中的体现 |
|---|---|---|---|
| 实验室主任 | 人（单人自托管） | 给方向、批阅、拍板 | 唯一用户。**不下场操作仪器**是默认姿态，但仪器面保留手动能力 |
| AI 实验员 | Hermes agent（后台） | 挖因子、调系数、跑回测、看结果 | 交付**提案**，不是结论。UI 永远展示"AI 说"而非"系统判定" |
| 验证器 | 5 个确定性校验器 + 1 个因果审查 | **主动证伪** | 输出**概率估计 + 质疑清单**，绝无"通过/不通过"二值 |
| 底座 | 后端系统 | 行情/财务/因子/回测/证据 | 仪器面（§4 F9–F18） |

### 1.3 异步审阅三节奏（产品的主 UX 框架）

用户不盯着看。三种使用节奏决定三种界面密度：

| 节奏 | 耗时 | 用户做什么 | 对应流程 |
|---|---|---|---|
| **给方向** | 30 秒 | "这周看光模块" + 约束（行业/窗口/别碰什么） | F1 |
| **看摘要** | 5 分钟 | "试了 380 次，值得你看的 3 个" | F2–F3、F5 |
| **深挖回放** | 按需 | 完整探索路径：从哪开始、怎么走到这、放弃过什么方向 | F4、F6 |

> **UX 判据**：早上花 5 分钟知道该关注什么，然后可以放心关掉。"让你少看"是目标，不是"让你多看"。

### 1.4 四个干预动作（一等公民）

**叫停 / 指方向 / 追问（为什么放弃这个方向）/ 标记（围绕它多试）**。
"追问"信息量最高——**AI 放弃的方向比它选中的更有信息量**。四个动作在任何展示 AI 探索的地方都必须可达（见 F3）。

### 1.5 对 UX 的原则约束（摘自 VISION，按优先级）

| # | 原则 | 对 UI 的硬要求 |
|---|---|---|
| 1 | 确定性与非确定性分离 | AI 产出区域必须与确定性数据区域视觉可区分（提案 vs 事实） |
| 3 | AI 交付提案不做决策 | 禁止"推荐""建议买入"等决策性措辞；展示"可证伪主张 + 证据 + 存疑项" |
| 4 | 每个数字都能被当场质问 | **证据回溯内嵌在决策路径上**（数字旁点击→侧滑/浮层），**不是独立的查询页面**。独立 `/evidence` 只能作为兜底入口保留 |
| 6 | 校准优于准确率 | 概率估计必须与指标**并置**展示（Sharpe 是"跑出来多少"，概率是"这个数有多少可信"） |
| 5 | 可监督性优先于自动化 | 观察页允许"整晚无人值守"，摘要承担收敛注意力的职责 |

**明确不做**（UI 不应出现的功能）：投资建议/目标价/评级、实时行情与盘中监控（日频是高频边界）、多 agent 投票展示、SaaS/多租户。

> **边界重申（2026-10-13，[ODR-066](../../../quant-trading-docs/docs/archive/odr/odr-066-stitch-design-review-and-boundary-ruling.md) 第 1 条）**：上述四条**不因 UI 重构而放松**。源码实测已确认数据层只有日频（`pkg/data` / `pkg/domain` 对 `1min`·`5min`·`level2`·`逐笔`·`tick` 零命中），故**分钟周期、盘中时点（如 `ENTRY: 14:15`）、L2 逐笔/快照、主力净流入类字段、实盘执行网关（FIX/DMA/Colocation/TWAP-VWAP 母单）在 UI 中一律无数据来源、一律不出现**。危险操作（如紧急平仓）保留，但必须按 F16 走二次确认 + 独立确认码，且文案不得暗示实盘。

---

## 2. 现状盘点与重构动机

### 2.1 现有信息架构（12 路由）

| 路由 | 页面 | 现状 |
|---|---|---|
| `/` | 控制台 Dashboard | 概览卡片 |
| `/backtest` | 回测引擎 | 手动回测主入口（表单→异步 job→报告） |
| `/backtest/compare` | 多策略对比 | 多回测结果对比 |
| `/screener` | 选股器 | 股票筛选 |
| `/copilot` | 策略 Copilot | 自然语言→策略代码生成（异步 job） |
| `/explore` | 探索观察台 | **已实现三栏观察**（正在试什么/结果流/当前最优 + 验证器裁决 + 叫停） |
| `/strategy-lab` | 策略实验室 | 策略实验 |
| `/strategy-builder` | 策略编辑器 | 可视化拖拽多因子策略 |
| `/data-sync` | 数据同步 | 数据管道管理 |
| `/alerts` | 风险告警 | 告警历史/统计 |
| `/evidence` | 证据查询 | content_hash → 原始记录 |
| `/factors` | 因子证据 | 因子→证据坐标 |
| `/login` | 登录 | 布局外，token 认证 |

### 2.2 重构动机（按产品视角列出的问题）

1. **主线断裂**：产品的主流程"给方向→看摘要→深挖回放→拍板"没有连续载体。给方向没有入口（explore 只有启动表单）、摘要不存在（用户要自己翻结果流）、拍板/采纳没有记录。
2. **按"工具"组织而非按"任务"组织**：导航是 12 个并列工具，用户每次都要自己拼装工作流。
3. **违反原则 4**：证据查询是独立页面（跳页断掉决策上下文），应内嵌为数字旁的质问入口。
4. **干预四缺三**：只有"叫停"（`/api/explore/runs/{id}/stop`）；指方向/追问/标记无 UI 也无 API。
5. **成功指标不可测**：PRODUCT 的"月度可用策略数 / 校准误差"依赖**采纳记录**——UI 必须提供拍板动作与理由记录（F7）。
6. **后端能力超前 UI**：risk / execution / compliance / industry / macro / signals 共约 40 个 endpoint 无任何 UI 承载（场景见 F13–F18）。
7. **状态语义未收口**：回测结果 `status` 三值（`completed` / `invalid` / `failed`）UI 仍按"有 result.id = 成功"渲染（TASKS K9 待办）；`invalid` 必须显式警示并展示 `invalid_reasons`。
8. **测试债**：e2e 套件与前端结构脱节（TASKS AUD-61），重构需按页面同步重对齐，不得静默放宽断言。

---

## 3. 目标信息架构（IA）

### 3.1 组织原则

导航从"工具清单"改为**"三节奏 + 仪器房"**：最高频的主线（研究/审阅）放最上层，仪器面（手动操作后端能力）按领域收纳，系统面收进底部。

### 3.2 建议导航结构

```
Quant Lab
├── 研究主线（P0，新增/改造）
│   ├── 审阅台 Review Desk        ← 看摘要 + 四干预 + 拍板（F2/F3/F5/F7）
│   ├── 探索观察 Explore           ← 改造现 /explore：三栏观察 + 路径回放（F1/F4）
│   └── 研究日志 Journal           ← 历史 run / 摘要归档 / 采纳记录（可并入审阅台 tab）
├── 仪器房 Instruments
│   ├── 回测引擎 Backtest           ← 保留 /backtest（F9）
│   ├── 多策略对比 Compare          ← 保留 /backtest/compare（F10）
│   ├── 策略库 Strategies           ← 合并 strategy-lab + strategy-builder + Copilot（F11）
│   ├── 因子研究 Factors            ← 改造 /factors + 因子计算（F12）
│   ├── 选股与市场 Screener         ← 保留 /screener（F14）
│   └── 数据管理 Data               ← 保留 /data-sync + 数据源状态（F13）
├── 监控 Monitoring
│   ├── 风险告警 Alerts             ← 保留 /alerts（F15）
│   └── 策略健康 Health             ← 新增，S4：regime + drift + 周报（F15，P2）
└── 系统 System
    ├── 执行与账户 Execution        ← 新增，paper/Mock（F16，P2）
    ├── 合规 Compliance             ← 新增（F17，P2）
    ├── 行业与宏观 Research         ← 新增（F18，P2）
    └── 系统管理 Admin              ← 插件/数据源/用户/审计（F18 附）
```

### 3.3 页面分级与现有路由映射

| 优先级 | 目标页面 | 来源 | 说明 |
|---|---|---|---|
| **P0** | 审阅台（新） | — | 三节奏的中枢：摘要流、卡片、干预、拍板 |
| **P0** | 探索观察（改造 `/explore`） | 改造 | 补路径回放、四干预、指方向续跑 |
| **P0** | 证据质问组件（横切） | 改造 `/evidence` | 从独立页降级为**内嵌侧滑/浮层组件**，数字旁触发 |
| **P1** | 策略库（合并） | `strategy-lab`+`strategy-builder`+`copilot` | 一个领域一个家：列表/编辑/生成/入策略库 |
| **P1** | 回测引擎 + 对比 | 保留 | 收口 status 三值、报告导出 |
| **P1** | 因子研究、数据管理、选股 | 保留/改造 | 仪器面常规 |
| **P2** | 监控、执行、合规、行业宏观、系统管理 | 新增 | 后端已有 API，按需启用 |
| 退役候选 | `/factors` 独立页 | 并入 | 因子证据并入因子研究；若保留只作深链接兜底 |

> **约束（AGENTS_TEMPLATE）**：新增页面/路由后必须同步更新 `quant-trading-docs/docs/ARCHITECTURE.md (frontend)`。

---

## 4. 核心主线 User Flows（F1–F8）

> 格式约定：每条 flow 给出 **目标 / 触发 / 步骤（含状态机与分支）/ API / 异常 / UX 要点 / 验收**。
> API 前缀省略主机；轮询类标注 ⏳，异步 job 标注 ⚡。

### F1 · 给方向：发起一轮探索（30 秒节奏）

- **目标**：用户用一句话 + 少量约束，启动 AI 一轮探索，全程 < 30 秒。
- **触发**：审阅台/观察页的"给方向"入口；快捷键/命令面板（Ctrl+K）直达。
- **步骤**：
  1. 输入：方向描述（自然语言，必填）+ 约束（行业 / 回看窗口 lookback_min–max / 最大尝试次数 max_tries / "别碰什么"）。
  2. 提交 → `POST /api/explore/runs` ⚡ → 返回 `run_id`。
  3. 跳转观察页该 run（URL 可分享：`/explore?run=<run_id>`）。
- **异常**：提交失败→表单保留 + 字段级错误；重复提交→按钮 loading 禁用。
- **UX 要点**：默认值尽量少（只有描述是必填）；"别碰什么"是自由文本约束，不得砍掉。
- **验收**：从落地到看到第一条尝试进入结果流 ≤ 3 秒（轮询首帧）。

### F2 · 看摘要：审阅台（5 分钟节奏）

- **目标**：一眼知道"该关注什么"——AI 试了 N 次之后值得看的少数候选。
- **触发**：打开审阅台（默认落地页候选）；或收到"有新摘要"提示。
- **数据与排序**：
  - 摘要 = 一轮 run 收敛后的候选集合，**排序不按 IC 排，按「高原面积 × 因果强度」排**。
  - 每个候选卡片必备三要素：**路径缩略图**（探索路径微缩图，点开→F4）+ **质疑清单**（验证器 challenges 摘要）+ **概率估计**（verdict.probability，注明"最弱一环"维度）。
  - 卡片同时显示关键指标（如 Sharpe）但必须与概率**并置**（原则 6）。
- **步骤**：
  1. 摘要列表（按 run 分组：run 名称/描述/状态/尝试次数）。
  2. 展开候选卡片 → 三要素。
  3. 任何卡片上可直接做四干预（F3）与拍板（F7）。
- **API**：`GET /api/explore/runs/{id}` ⏳（现状数据源）；摘要聚合 API 为**后端缺口 G1**（见附录 C，可先由前端聚合 attempts + verdict 近似）。
- **异常**：run 失败/被叫停的摘要要显式标注（被叫停的 run 结论可信度不同，不得与跑满的混排无差别）。
- **UX 要点**："让你少看"——默认折叠，只显示 top 候选；未读/新摘要有轻提示，不做强打断。
- **验收**：用户不点开任何详情即可说出"这轮最值得看的是什么、有多少可信、最大疑点是什么"。

### F3 · 干预四动作（横切，任何 AI 探索展示处可达）

| 动作 | 语义 | 现状 API | 缺口 |
|---|---|---|---|
| **叫停** | 立即停止该 run | `POST /api/explore/runs/{id}/stop` ✅ | 无 |
| **指方向** | 对进行中的 run 注入新方向/约束，续跑 | ❌ | G2 |
| **追问** | "为什么放弃这个方向？"→ AI 针对某次被放弃的尝试作答 | ❌ | G3 |
| **标记** | "围绕它多试"→ 提升该方向的探索权重/派生子 run | ❌ | G4 |

- **通用步骤**：动作入口（卡片/结果流行）→ 确认（叫停需二次确认）→乐观更新 + 结果反馈。
- **UX 要点**：
  - 叫停是一等公民：**被叫停的探索与跑满的探索结论可信度完全不同**，UI 必须在摘要/回放中显著区分（`ExploreStatus.stopped`）。
  - 追问的入口应挂在**被放弃的尝试**上（结果流中 `ok=false` 或未被选中的方向），不是只挂在成功候选上。
- **验收**：四个动作在候选卡片、结果流行、回放页三个上下文中入口一致、语义一致。

### F4 · 深挖回放：探索路径（按需节奏）

- **目标**：回答"从哪开始、怎么走到这、放弃过什么方向"。
- **触发**：摘要卡片的路径缩略图 / 结果流"查看路径"。
- **步骤**：
  1. 路径回放视图：按 `seq` 升序展示尝试序列（`ListExperiments` 已按尝试顺序排序，**不是插入顺序**）。
  2. 每个节点：hypothesis、params、experiment_id、sharpe、ok、verdict 摘要。
  3. 时间线交互：逐条前进/后退、跳到最优（`best_seq`）、高亮被放弃分支。
  4. 任一节点可触发 F3 四干预（尤其"追问"）。
- **API**：`GET /api/explore/runs/{id}` ⏳；实验日志深层查询为缺口 G5（`experiments` 表已在 core 存储层就绪）。
- **UX 要点**：缩略图与完整回放是同一数据的两种密度；回放是"读故事"，不是调试器——文案面向实验室主任，不堆参数 JSON。
- **验收**：能在 1 分钟内讲清一条候选的演化史。

### F5 · 验证器裁决阅读（横切组件）

- **目标**：让用户正确理解"可信度"，而不是误读为"通过"。
- **展示契约（不得改动的语义）**：
  - 输出 = **概率估计 + 质疑清单**，不是通过/不通过。
  - 六维：统计/经济/稳健/偏差/冗余（确定性）+ 因果（语义）。
  - `unassessed` 维度**必须显示为"未评估"**——"没查"不等于"没问题"。
  - `probability` = 已评估维度的**最小值**（结论受限于最弱一环），`weakest` 高亮。
  - 因果维：展示 mechanism + 可证伪预测条数（testable/passed/failed）——**"讲得出但验不了的不算数"**。
  - `blocking` 计数与 `challenges`（severity: blocking/warning/note）分级呈现。
- **失败的尝试没有裁决**（没有回测结果就没有可被证伪的东西），不得渲染成 0 分或"未通过"。
- **验收**：实现里"未评估"若被折叠或省略，对应单测必须红（破坏验证，参照 TASKS 的验收风格）。

### F6 · 证据质问：数字 → 来源（原则 4 的落地）

- **目标**：任何数字被"当场质问"时，2 次点击内到达唯一原始记录。
- **触发**：数字/指标旁的质问入口（hover 显 affordance，点击开侧滑）。
- **步骤**：
  1. 数字携带证据坐标（`content_hash`）→ 点击 → **侧滑/浮层**（不跳页、不丢上下文）。
  2. 侧滑内：`GET /api/evidence/{content_hash}` 展示原始记录 + 归档元数据（`POST /api/ingest/raw`、`/api/ingest/equitydeep` 是写入侧）。
  3. 需要完整页时提供"在证据页打开"深链（保留 `/evidence` 作兜底，支持 `?content_hash=`）。
- **适用范围**：摘要卡片、回放节点、验证器裁决、回测报告、因子 IC/收益——所有"可被质问的数字"。
- **UX 要点**：信任机制在决策路径上，不是独立功能。没有坐标的数字要显式标注"无法回溯"（诚实 > 好看）。
- **验收**：从摘要卡片上任一数字到原始记录 ≤ 2 次点击、0 次页面跳转。

### F7 · 拍板与采纳（信心门槛）

- **目标**：把"我看过了，决定用/不用"变成**系统可测的记录**（成功指标"月度可用策略数/校准误差"的唯一数据源）。
- **步骤**：
  1. 候选卡片 → "拍板"：**采纳**（进策略库）/ **搁置**（可再议）/ **否决**（记录原因）。
  2. 采纳必须填写**理由**（自由文本，哪怕一句）+ 记录当时的**概率估计快照**（校准回测要用）。
  3. 采纳 → 生成策略条目（`POST /api/strategies`），携带来源 run/experiment 引用。
- **API**：`POST /api/strategies` ✅；采纳记录（含理由/概率快照）为缺口 G6。
- **验收**：任一采纳可从策略库回溯到 run → experiment → 证据链。

### F8 · 状态机总表（主线横切）

```
run:    running ──→ completed            （跑满）
          │  └────→ stopped（被叫停）     （显著区分可信度）
          └──────→ failed
attempt: running ──→ ok（有 verdict） / error（无 verdict）
verdict: 已评估维度 + unassessed + probability（最小值）+ causal?
```

---

## 5. 仪器面场景卡（F9–F18）

> 这些是"实验室主任偶尔下场"或"系统维护"场景。流程短、表单驱动；交互遵循 [interaction.md](interaction.md)。
> 优先级：P1 = S1–S2 阶段需要；P2 = S3–S4 或按需启用。

### F9 · 手动回测（P1，保留 `/backtest`）

- 流程：表单（策略/股票池/起止日期/初始资金/佣金/滑点）→ `POST /api/backtest` ⚡（同步或异步 job）→ 进度（`GET /api/backtest/{id}` ⏳，可取消）→ 报告（`/{id}/report`）→ 交易明细（`/trades`）/ 权益曲线（`/equity`）→ 导出（`/export/{format}`）。
- **status 三值收口（K9）**：`completed` 正常渲染；`invalid` **警示样式 + `invalid_reasons` 列表**；`failed` 显式失败态。**禁止以 `result.id` 存在判成功。**
- URL 深链：`/backtest?id=<job_id>` 直达报告（现状已支持）。

### F10 · 多策略对比（P1，保留 `/backtest/compare`）

- 流程：选多个结果 → `GET /api/backtest/compare` → 对比表/叠加权益曲线 → 导出。
- 含 `invalid` 结果的混合集：对比页闸门需显式呈现被排除项与原因（不得静默丢弃）。

### F11 · 策略库：CRUD + 编辑器 + Copilot（P1，合并三页）

- CRUD：`GET/POST /api/strategies`、`GET/PUT/DELETE /api/strategies/{id}`。
- 策略编辑器（现 strategy-builder）：可视化多因子构建 → 保存为策略。
- Copilot（现 `/copilot`）：自然语言 → `POST /api/copilot/generate` ⚡ → 轮询 `GET .../{job_id}` ⏳ → 沙箱编译 + 回测结果 → 用户审阅后入库。生成统计：`GET /api/copilot/stats`。
- **语义**：Copilot 产出=提案（可证伪主张+证据），UI 不得呈现为"AI 推荐的策略"。

### F12 · 因子研究（P1）

- `GET /api/factor/list` → 因子详情：`/api/factor/returns/{factor}`、`/api/factor/ic/{factor}` → 计算触发：`POST /api/factor/compute-returns`、`/compute-ic`（长任务 → 轮询/刷新）。
- 因子证据坐标（现 `/factors` 页能力）并入因子详情（F6 质问入口）。

### F13 · 数据管理（P1，保留 `/data-sync`）

- 数据源状态/健康：`GET /api/datasource/status`、`/health`；同步日历：`POST /api/sync/calendar`、`GET /api/v1/trading/calendar`。
- 归档写入（研究证据侧）：`POST /api/ingest/raw`、`/api/ingest/equitydeep`。
- 插件热加载（管理动作）：`GET /api/plugins`（+ active/load/unload/reload/watch-dir/load-all）→ 放系统管理区。

### F14 · 选股与市场概览（P1，保留 `/screener`）

- `POST /api/screen`（筛选）+ `GET /api/stocks/count`；行情：`GET /api/ohlcv/{symbol}`（K 线图）；`GET /api/market/index`。
- **不做**盘中实时行情（产品边界）。

### F15 · 风险告警与策略健康（P1 告警 / P2 健康）

- 告警（保留 `/alerts`）：`GET /api/alerts/history`、`/stats`、`POST /api/alerts/force-check`。
- 风控能力：`POST /api/risk/calculate_position`、`/detect_regime`、`/check_stoploss`、`GET /api/risk/metrics`。
- 策略健康（S4，新增页）：regime + drift 接入主流程，回答"每个策略近 3 个月是否偏离历史基准/是否连续失效超历史最长失效期"；产出**策略健康度周报**。监控闭环回流：**失效 → 回到 F1 候选生成**（漏斗的"持续监控"）。

### F16 · 执行与账户（P2，paper/Mock）

- 订单：`POST/GET /api/execution/orders`、`GET /orders/{id}`、`POST /orders/{id}/cancel`；持仓：`/positions`；账户：`/account`；**紧急平仓**：`POST /api/execution/emergency-flatten`（危险操作：红色、二次确认、独立确认码）。
- 外部信号流观测：`POST /api/signals`（机器写入面，UI 只做观测/审计展示）。
- **边界**：实盘交易不做（MockTrader 足够；XTP 是桩）。UI 文案不得暗示实盘。

### F17 · 合规检查（P2）

- 适当性：`POST /api/compliance/check`、`/requirements`、`/boards`；异常交易：`POST /api/compliance/abnormal/run`、日报 `/report/daily`；减持：`/divestment/check` + holder-types/methods/rules。

### F18 · 行业/宏观研究 + 系统管理（P2）

- 行业：`GET /api/industry/tree`、`/edges`、`/vitality`、`/etf/{etf_code}/constituents`（产业链图谱可视化是重点场景——因果解释的数据底座）。
- 宏观：`GET /api/macro/series`（时序图）。
- 系统管理：认证（`/api/auth/login`、`/refresh`、`/me`、`/status`、`/bootstrap` 首次引导）、管理端（`/auth/admin/users`、`/audit`）。
- 登录流（保留 `/login`）：布局外、authGuard 守卫、token 刷新（`authToken.ts`）。

---

## 6. 横切交互模式（所有页面共享）

1. **异步任务统一模式** ⚡：提交（返回 job_id）→ 轮询 ⏳（进度条 + 可取消/叫停）→ 终态（成功拉取结果 / invalid / failed）。适用于：回测、批量（`/api/batch`、walkforward `/api/walkforward`）、Copilot、因子计算、pipeline（`POST /api/pipeline/run`、`GET /api/pipeline/jobs`）。轮询频率/退避统一实现，禁止每页自造。
2. **状态三值语义**（K9）：`completed` / `invalid`（警示 + reasons）/ `failed`（失败态）全链路一致——API、对比页、UI 同口径。
3. **概率 ≠ 指标**：凡展示验证结果，概率与指标并置；"未评估"显式；阻断项（blocking）与提示项（note）分级。
4. **提案视觉语言**：AI 产出（假设/候选/生成代码）与确定性数据（行情/回测指标）视觉可区分（原则 1/3）。
5. **证据质问入口**：可质问数字统一带 affordance（F6）。
6. **空态/错误**：空态给下一步操作引导；错误分级处理（网络→自动重试 3 次；业务→字段级；系统→全局边界），见 [interaction.md](interaction.md)。
7. **轮询 vs 推送**：**研究主线（F1–F4 的 explore run）与全部异步 job 走轮询** —— `quant-trading-agent/cmd/ai/handlers_explore.go` 只有 `POST /runs` / `GET /runs/:runID` / `POST /runs/:runID/stop`，**无推送端点**。**唯一已落地的推送是数据同步作业进度**：`GET /api/sync/jobs/{id}/progress`（`cmd/data/sync_handlers.go` 置 `text/event-stream`，analysis 侧 `handlers_proxy.go` 以 `FlushInterval=-1` 直通），前端 `web/src/stores/sync.ts` 已真实使用 `EventSource`。⚠️ 更正记录：本条 v1.0 原文写「当前后端无 WebSocket/SSE，全部轮询」，对 explore 成立、对 sync 作业**不成立**，v1.1 已按源码实测收窄（见 ODR-066 第 2 条）。**任何行情侧推送不存在**，UI 不得出现"实时行情流"通道。**收敛要求不变**：UI 抽象为单一 subscription 层（轮询与 SSE 共用同一订阅接口），未来换推送不改页面。
8. **长时任务离机**：run 可整晚无人值守（原则 5）——页面关闭再回来，从审阅台/观察页 URL 恢复到同一 run。
9. **快捷键**：Ctrl+K 命令面板（30 秒给方向的最快路径）、Esc 关闭浮层、`R` 刷新。
10. **视觉基线**：暗色优先、数字等宽 + 千分位、正负带 ± 符号不单靠颜色（见 [principles.md](principles.md)）。

---

## 7. 术语表

| 术语 | 定义 |
|---|---|
| run / 探索 | 一轮 AI 研究：连续试若干组参数，每次落一行实验日志 |
| 尝试（attempt） | 一次"挖" = 调底座跑一次回测。挖的是七维空间的一个点：因子表达式/系数/股票池/持有期/合成权重/过滤条件/买卖规则 |
| 假设（hypothesis） | 一次尝试的可证伪主张 |
| 裁决（verdict） | 验证器输出：各维概率 + 质疑清单 + 综合概率（= 已评估维度最小值）。**不是通过/不通过** |
| 质疑清单（challenges） | 验证器的问题列表，分 blocking / warning / note |
| 因果维 | 六维中唯一需要语义理解的一维：机制 + 可证伪预测（testable/passed/failed） |
| 路径缩略图 | 一条候选的探索路径微缩图，摘要卡片三要素之一 |
| 高原面积 × 因果强度 | 摘要排序依据（非 IC） |
| 拍板/采纳 | 人的决策动作：采纳/搁置/否决 + 理由 + 概率快照 |
| 证据坐标 | `content_hash` → `ingest.raw` 唯一原始记录 |
| invalid | 回测结果合法但无效（如参数非法），≠ failed（执行失败） |
| 底座 / 仪器 | 后端确定性能力（行情/因子/回测/证据） |
| 实验室主任 / AI 实验员 / 验证器 | 三个角色，见 §1.2 |

---

## 附录 A · 现有路由 → 目标映射

| 现有 | 目标 | 动作 |
|---|---|---|
| `/` Dashboard | 审阅台（或其聚合视图） | 重定位 |
| `/explore` | 探索观察（F1/F4） | 改造：+回放 +四干预 |
| （无） | 审阅台（F2/F3/F5/F7） | **新增，P0** |
| `/evidence`、`/factors` | F6 质问组件 | 降级为组件 + 深链兜底 |
| `/backtest`、`/backtest/compare` | F9/F10 | 保留 + status 收口 |
| `/strategy-lab`、`/strategy-builder`、`/copilot` | F11 策略库 | 合并 |
| `/screener`、`/data-sync`、`/alerts` | F14/F13/F15 | 保留 |
| `/login` | F18 登录 | 保留 |
| （无） | F15 健康、F16 执行、F17 合规、F18 行业宏观 | 新增，P2 |

## 附录 B · 后端 API 能力地图（83 path，来源 openapi.yaml + ai-service 反代）

| 组 | 路径前缀 | 端点数 | 支撑场景 | 对应 flow |
|---|---|---|---|---|
| 健康/版本 | `/health` `/metrics` `/api/v1` | 3 | 系统状态 | 系统管理 |
| 回测 | `/api/backtest*` | 8 | 回测/报告/导出/对比 | F9/F10 |
| 前向/批量 | `/api/walkforward*` `/api/batch*` | 5 | 策略验证/批量实验 | F9 扩展 |
| 策略 | `/api/strategies*` | 2 | 策略库 CRUD | F7/F11 |
| 数据源/插件 | `/api/datasource/*` `/api/plugins*` | 12 | 数据/插件管理 | F13/F18 |
| 因子 | `/api/factor/*` | 5 | 因子研究/计算 | F12 |
| Copilot/AI | `/api/copilot/*` `/api/pipeline/*` | 6 | AI 生成/流水线 | F11 |
| 认证 | `/api/auth/*` | 7 | 登录/用户/审计 | F18 |
| 风控 | `/api/risk/*` | 4 | 仓位/状态/止损/指标 | F15 |
| 执行 | `/api/execution/*` | 6 | 订单/持仓/账户/紧急平仓 | F16 |
| 合规 | `/api/compliance/*` | 9 | 适当性/异常交易/减持 | F17 |
| 告警 | `/api/alerts/*` | 3 | 告警/统计 | F15 |
| 数据代理 | `/api/ohlcv` `/screen` `/stocks/count` `/market/index` `/sync/calendar` `/v1/trading/calendar` | 6 | 行情/选股/日历 | F14 |
| 证据/归档 | `/api/ingest/*` `/api/evidence/*` | 3 | 证据回溯 | F6 |
| 信号 | `/api/signals` | 1 | 外部信号写入 | F16 |
| 行业/宏观 | `/api/industry/*` `/api/macro/*` | 6 | 产业链/宏观 | F18 |
| **ai-service（反代，契约外）** | `/api/explore/*` `/api/tools/*` | 3+ | 探索观察（start/status/stop） | F1/F3/F4 |

## 附录 C · 后端缺口清单（UX 依赖但 API 尚缺）

| # | 缺口 | 阻塞的 UX | 现状 |
|---|---|---|---|
| G1 | 摘要聚合 API（候选排序：高原面积×因果强度、路径缩略图数据） | F2 | 前端可临时用 attempts+verdict 聚合近似 |
| G2 | 指方向（run 续跑注入约束） | F3 | 无 |
| G3 | 追问（针对被放弃方向的问答） | F3/F4 | 无 |
| G4 | 标记（派生子 run / 提升权重） | F3 | 无 |
| G5 | 实验日志深查询（experiments 表已在 core 就绪） | F4 | `GET /api/explore/runs/{id}` 基本够用 |
| G6 | 采纳记录（决定/理由/概率快照） | F7、成功指标测量 | 无 |
| G7 | `/api/explore/*`、`/api/tools/*` 未入 openapi.yaml 契约 | F1–F4 契约保障 | 反代可用，契约待补 |
| G8 | 推送通道（WebSocket/SSE） | 实时观察体验 | 现全部轮询（可接受，抽象 subscription 层） |

---

## 更新记录

| 日期 | 版本 | 变更 |
|---|---|---|
| 2026-10-13 | 1.0 | 初版：结合 PRODUCT/VISION/ROADMAP、openapi.yaml（83 path）与现有 UI 盘点，规划 UI 重构的 user flows / scenarios |
| 2026-10-13 | 1.1 | **Stitch 设计稿评审后的三项裁决落地**（详见 [ODR-066](../../../quant-trading-docs/docs/archive/odr/odr-066-stitch-design-review-and-boundary-ruling.md)）：① 顶部标注设计稿定位 = **参考件非规格**，并列出越界/违规/幻觉/缺口四类处置入口；② §1.5 追加**边界重申**（日频无分钟线、无 L2、无实盘执行网关，含源码实测依据）；③ §6.7 **事实性更正** —— 原「后端无 WebSocket/SSE」过强，实测 sync 作业进度确有 SSE 且前端已接 `EventSource`，收窄为「研究主线与异步 job 轮询、仅同步作业有 SSE、行情侧无推送」。产品边界本身**零变更**（PRODUCT / VISION 未动） |
