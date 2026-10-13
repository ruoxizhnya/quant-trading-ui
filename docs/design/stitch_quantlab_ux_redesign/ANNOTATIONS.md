# Stitch 设计稿逐屏标注（ANNOTATIONS）— 处置与 API 映射

> **版本**: 1.0（2026-10-13）
> **状态**: 常青工作件 —— 随重构施工逐屏更新，直到 12 屏全部处置完毕
> **定位**: 本文件把 `stitch_quantlab_ux_redesign/` 的 12 屏从"看起来像规格"降级为**可执行的处置清单**。裁决依据见 [ODR-066](../../../../quant-trading-docs/docs/archive/odr/odr-066-stitch-design-review-and-boundary-ruling.md)；需求真相源是 [../user-flows.md](../user-flows.md) v1.1。
> **口径**（ODR-066 §Decision 6 细化）: 设计稿**着重参考但不当完成稿** —— 它给方向与 UX 密度，细节一律以实际后端能力为准。**前端不倒逼后端**：缺端点就是缺端点，标 ⏳ 或 ❌，不假装可用。

---

## 0. 图例

| 标记 | 含义 | 施工动作 |
|---|---|---|
| ✅ **留** | 有端点支撑、不违契约 | 按图施工 |
| 🔧 **改** | 方向对，细节须按后端实际或 F5/F7 等条款调整 | 改稿后施工 |
| ❌ **删** | 越界（无数据来源）或幻觉（无端点） | 不实现；稿上划掉 |
| ⏳ **待后端** | 对应 `user-flows.md` 附录 C 的 G1–G8 缺口 | 画 **disabled / placeholder 态**，不得画成可用 |
| 🎨 **装饰** | 纯布景，零信息价值 | 删除，或换成真实系统状态 |

**端点前缀**：`core` = `quant-trading` analysis-service（openapi.yaml 76 path）；`sync` = `cmd/data/main.go` 的 `/api/sync/*` 14 条（经 analysis 反代，**不在 openapi 契约内**）；`ai` = `quant-trading-agent`（反代，契约外，缺口 **G7**）。

---

## 1. `review_desk_5` → 审阅台（F2/F3/F5/F7，P0 新增）

**目标路由** `/review`（候选默认落地页）。**一句话**：全套里最接近可施工的一屏，主线契约基本画对了；三处必须改。

| 控件 | API | 标记 |
|---|---|---|
| 顶栏 `⌘K 发起探索方向` | `ai` `POST /api/explore/runs` | ✅ F1 最快路径 |
| `AGENT RUNNING (380 iter/h)` | `ai` `GET /api/explore/runs/{id}` 轮询 | 🔧 数值来自 attempts 计数，**无独立速率端点**；改为"尝试 N 次 / 用时" |
| `SSE-COLOCATION` 徽标 | — | ❌ 行情侧无推送（ODR-066 §2）。删 |
| 候选卡 `SHARPE 2.41 ±0.18` + `P(>2)=84%` 并置 | `core` `GET /api/backtest/{id}/report` + `ai` verdict | ✅ 原则 6 的正解，**保留为基准画法** |
| `CREDIBILITY 71%` + `短板约束` + `最弱项: 因果语义` | `ai` verdict.probability / weakest | ✅ F5 正解 |
| 验证裁决面板列 **5 维**（统计/经济/稳健/偏差/因果） | — | 🔧 **缺"冗余/正交"维**（S2）。六维是固定契约，补第 6 条 |
| `因果链校验通过` 徽标 | — | 🔧 **二值语义**（S1）。改为"因果维 71%（最弱一环）" |
| `质问凭证 →` | `core` `GET /api/evidence/{content_hash}` | ✅ F6 内嵌侧滑，正解 |
| `抽屉切片` | 同上 | ✅ |
| 摘要卡上的**折线图**（累计超额收益） | `core` `GET /api/backtest/{id}/equity` | 🔧 **F2 要求的是"路径缩略图"（探索路径），不是收益曲线**。二者是不同数据、不同职责，不得互相顶替 |
| 质疑清单（blocking/warning/note 分级） | `ai` verdict.challenges | 🔧 **缺失**。卡片三要素之一，须补分级列表 |
| `搁置复议` / `否决(记录原因)` / `采纳进策略库(Enter)` | `core` `POST /api/strategies` | 🔧 三态方向对；**采纳必须带理由输入 + 概率快照**（S6，F7 硬要求），当前只有否决有"记录原因" |
| 四干预（叫停/指方向/追问/标记） | 叫停 `ai` `POST /api/explore/runs/{id}/stop` ✅；余三条 **G2/G3/G4** | ⏳ 叫停可施工；余三条画 disabled + "待后端"提示，**不得画成可用** |
| `批量归档 (377)` | — | 🔧 无批量归档端点；降级为"前端本地折叠态"或删除 |
| 页脚 `NODE SHA-102 ONLINE / PORT 9840 / 0.42ms` | — | 🎨 删。若要系统状态，换 `core` `GET /health` + `GET /api/datasource/health` 的真实语义 |
| `RESEARCH CORE ACT-4` / `P0 MAINLINE` | — | 🎨 内部编号泄漏，删 |

---

## 2. `explore` → 探索观察台（F1/F4，P0 改造现 `/explore`）

**目标路由** `/explore?run=<id>`。**一句话**：F1 与 F4 画得**比现有实现完整**，是这套稿子的主要价值来源；两处违规。

| 控件 | API | 标记 |
|---|---|---|
| 自然语言方向输入 + `启动 AI 实验员探索` | `ai` `POST /api/explore/runs` | ✅ |
| 约束四项：标的行业池 / 回看窗口 `120d-500d` / 上限 `500 次` / **`别碰什么（负向约束）`** | 同上（run spec 字段） | ✅ **负向约束被保留**，这是 F1 最容易被砍掉的一条 |
| 三栏：`Run 342/500 进度` / `实时尝试流` / `收敛最优与验证器裁决` | `ai` `GET /api/explore/runs/{id}` ⏳轮询 | ✅ F1/F2 密度基准 |
| 顶栏 `SHANGHAI · SSE` | — | ❌ 同 §1，行情侧无推送。删 |
| `7维空间状态坐标 (STATE VECTOR)` 6 个参数格 | run spec params | 🔧 术语对齐 `user-flows.md` §7：**七维 = 因子表达式/系数/股票池/持有期/合成权重/过滤条件/买卖规则**，稿上列的是另一套参数名。按实际 spec 字段重列 |
| 因子表达式 AST 代码块 | `core` 表达式 DSL（`pkg/ai/expression`） | ✅ ADR-024 正解 |
| `叫停 Run（带快照保存）` | `ai` `POST /api/explore/runs/{id}/stop` | ✅ 一等公民，且"带快照"是好设计 |
| 结果流 `#342 COMPLETED` / `#341 INVALID (BIAS)` / `#340 ABANDONED` / `#338 STABLE` | attempts + verdict | ✅ **状态语义分得开**，且失败尝试未渲染成 0 分（F5 要求） |
| `为什么放弃?` 挂在被放弃的 `#340` 上 | **G3** | ⏳ **入口位置完全正确**（追问挂在放弃项上，不是只挂在成功项上）—— 但无端点，画 disabled |
| `围绕它多试` 挂在 `#339` 上 | **G4** | ⏳ 同上 |
| `指方向` 注入续跑 | **G2** | ⏳ 同上 |
| 验证器**六维**齐全（含 `5. 因子正交冗余度 74%`） | verdict | ✅ **本屏是六维的正确画法，可作为其他屏的基准** |
| `unassessed` 显式 | verdict | 🔧 本屏未见；F5 硬要求，补 |
| F4 路径回放四阶段（初式/撞墙放弃/范式突变/收敛定型）+ `跳到最优 #342` + `共剪枝 18 个无价值分支` | `ai` `GET /api/explore/runs/{id}`（attempts 按 `seq` 升序） | ✅ **F4 的最佳落地**，"放弃的方向更有信息量"被画出来了 |
| `裁决结论: 建议进入实盘模拟沙盒` | — | 🔧 **原则 3 违例**（S4）。改"验证器给出 71%（最弱：因果语义）" |
| 页脚 `NODE A-102 集群算力 78% · 4x RTX4090 / 内存 64.2GB` | — | 🎨 删（B4） |

---

## 3. `journal` → 研究日志与采纳台账（F7，P0）

**目标路由** `/journal`（或并入审阅台 tab）。**一句话**：把"成功指标可测"这件事画实了，值得保留；**审计链是幻觉，整块删**。

| 控件 | API | 标记 |
|---|---|---|
| `TOTAL PROBE RUNS 1,420` / `ACCEPTED 18` / `PRUNED 1,280` / `HALTED 122` | `ai` runs 聚合（**G1**） | ⏳ 前端可用 attempts+verdict 近似聚合，须标"近似" |
| `MONTHLY ACCEPTANCE RATE 1.27%` | 采纳记录（**G6**） | ⏳ **这是 PRODUCT 成功指标的唯一数据源**，优先级最高的后端缺口 |
| 采纳条目：拍板纪要 + 决议理由 + 概率快照 | **G6** | ⏳ 结构画得对（F7 要求理由+快照），无落库端点 |
| `已采纳 / 搁置 / 否决` 三态筛选 | 同上 | ✅ 语义正确 |
| `被否决/剪枝理由分布`（换手/未来函数/因果弱/数据覆盖） | verdict.challenges | 🔧 分类学合理，但**分布统计无端点** → 前端聚合 + 标近似 |
| `查看回测快照` / `查看 AST 语法树` | `core` `GET /api/backtest/{id}/report`、`/trades` | ✅ |
| `数据管道同步阻断说明` + `查看管道异常日志` | `sync` `GET /api/sync/jobs`、`GET /api/sync/workers` | ✅ **有端点**，且把"数据陈旧影响结论"连到台账，好设计 |
| `导出投委会采纳报告 (PDF)` | — | ❌ `openapi:285` 明写导出"currently only `html`"。改 html 或删 |
| `Git Snapshot 对齐 #8f2da` | — | ❌ 无 git 集成。删 |
| `不可篡改审计链 / 冷密钥签名 / MERKLE ROOT / 验证证书` | — | ❌ **整块删**（幻觉）。本仓的溯源机制是 `content_hash` → `ingest.raw`，走 `core` `GET /api/evidence/{content_hash}`，**不是**哈希树+签名 |
| `VectorDB: Negative_Hypo_Embeddings.idx` | — | ❌ 无向量库。删 |
| `算力等效节约 1,920 GPU 小时(A100)` | — | 🎨 删（B4） |
| 日期自相矛盾（条目 `2026-04-18` vs run `#2026-1012`） | — | 🔧 稿内不一致，施工时以 run 时间为准 |

---

## 4. `backtest_tradingview` → 回测引擎（F9，P1 保留 `/backtest`）

**目标路由** `/backtest`。**一句话**：报告页骨架可用；**周期切换与盘中腿必须切除**。

| 控件 | API | 标记 |
|---|---|---|
| 策略/基准选择 + `重新运算` + `固化入库` | `core` `POST /api/backtest`、`POST /api/strategies` | ✅ |
| 主图 NAV vs 基准 + BUY/SELL 标记 | `core` `GET /api/backtest/{id}/equity`、`/trades` | ✅ |
| **周期切换 `1D / 60m / 15m / 5m`** | — | ❌ **B2**：数据层只有日频（实测 `pkg/data`+`pkg/domain` 对 1min/5min/tick 零命中）。**只留 `1D`**，整个周期选择器删 |
| `2026-04-17 14:00 O/H/L/C` 盘中时点读数 | — | ❌ 同上，改为交易日 |
| 顶栏 `A-SHARE LEVEL2 TICKS` | — | ❌ B3。删 |
| 指标带 `SHARPE 2.41 / CAGR / MaxDD / 胜率 / PF / Calmar / 笔数 / 换手` | `core` `GET /api/backtest/{id}/report` | ✅ 与引擎输出对齐 |
| `综合可信度 71%` + `木桶短板: 因果语义(反事实验证未闭环)` | `ai` verdict | ✅ F5 正解 |
| 滑点 1.5BP / 印花税 0.05% / 规费 0.002% + `T+1 A-SHARE MATCHED` | `core` 费用模型 | ✅ A 股口径正确 |
| Tab `2.交易清单(342)` / `3.逐月收益 Matrix` | `/trades`、report | ✅ |
| Tab `4.验证器裁决 & 疑点(6)` | `ai` verdict | ✅ 质疑清单落位处 |
| Tab `5.AST 因子内核` | 表达式 DSL | ✅ ADR-024 |
| `耗时 1.42s (Polars GPU)` | — | ❌ 栈错位。改真实耗时（report 元数据有则显示，无则不显示） |
| `AI 实验员优化提示: 若在14:30引入尾盘…` + `一键采纳修正` | — | ❌ 双重违例：盘中时点（B2）+ 决策性措辞与一键决策（S4/原则 3）。删 |
| `RENDER: 算力光模块景气上行` REGIME 条 | `core` `POST /api/risk/detect_regime` | 🔧 端点存在，但**回测报告页不是它的主场**（属 F15 健康页）。移走或标"来自风控维" |
| 侧栏标签 `回测分析/探索观测/因子工厂/全市场选股/数据通道` | — | 🔧 **与其他 11 屏命名不一致**，统一见 §13 |

---

## 5. `compare` → 多策略对比（F10，P1 保留 `/backtest/compare`）

**目标路由** `/backtest/compare`。**一句话**：**K9 三值收口的正确落地样板**，`GATE EXCLUDED` 那一条是全套最值得抄的设计；底部组合优化器删掉。

| 控件 | API | 标记 |
|---|---|---|
| 多结果叠加归一净值 + 对数/线性切换 | `core` `GET /api/backtest/compare` | ✅ |
| `K9闸门: 1个策略剔除 (Optical-Drift 换手率48.7%)` + `GATE EXCLUDED + 原因` | 同上 | ✅✅ **F10"不得静默丢弃被排除项"的正解，作为全站基准** |
| 收益互相关矩阵（正交/冗余判读） | `core` compare 输出 | ✅ 且与验证器"冗余维"同源，好 |
| 多维指标表 + `综合置信度 71% ±3.8%` 并置 | compare + `ai` verdict | ✅ 原则 6 |
| `[Audit Evidence]` 抽屉 | `core` `GET /api/evidence/{content_hash}` | ✅ F6 |
| `SUB-PANE 02: 60日滚动 BETA 与风格漂移` | — | ❌ 无 beta/风格漂移端点（`pkg/ai/drift` 是概念漂移，不是市场 beta）。删或标 ⏳ |
| 底栏 `组合构建方案已就绪 期望夏普 2.68` + `优化权重 (Risk Parity / MV)` + `生成组合回测` | — | ❌ **三重违例**：无优化器端点（幻觉）+ "期望夏普"前瞻承诺（S4/原则 3）+ 组合构建不在 F10 范围内。整块删 |
| `导出 (xlsx/.pdf)` | `core` `GET /api/backtest/{id}/export/{format}` | 🔧 **只有 `html`**（openapi:285）。改 `导出 HTML` |
| `TICK / PRO-PRECISION` | — | ❌ B3。删 |

---

## 6. `strategies` → 策略库 & Labs（F11，P1 三页合并）

**目标路由** `/strategies`（合并现 `/strategy-lab` + `/strategy-builder` + `/copilot`）。**一句话**：三页合一的 tab 结构是对的，四干预里"指方向/追问"在这屏出现是对的；**但策略代码画成 Python，与 ADR-024 三重不符，是全套最需要重画的一屏**。

| 控件 | API | 标记 |
|---|---|---|
| Tab `全部在研策略 24 / 可视化编辑器 / Copilot 提案流 3 / 已拍板实盘候选 6` | `core` `GET /api/strategies`；`ai` `POST /api/copilot/generate` + `GET /api/copilot/generate/{job_id}` | ✅ F11 合并结构 |
| 策略卡列表 + SHARPE/CAGR/MaxDD/置信度 + 迷你净值 | `core` `GET /api/strategies`、`GET /api/backtest/{id}/report` | ✅ |
| `[INVALID] 换手率超标 142.8x` + `审计拦截证据` | report.status=invalid + `invalid_reasons` | ✅ **K9 正解**，警示态与原因都在 |
| 流水线块图 `UNIVERSE → FACTOR PIPELINE → FILTER CRITERIA` | 表达式策略配置（ADR-024：意图→YAML→ExpressionStrategy） | 🔧 形状对，但块内代码须是**表达式**，见下条 |
| **`class LateSessionVolumeDivergence(AlphaStrategy): def compute_signals(self, context, market_data)` + `resample('5min')`** | — | ❌ **最严重违例，三重不符 ADR-024**：① 执行载体是**表达式**不是代码；② artifact 语言是 **Go** 不是 Python；③ canonical 接口是 `GenerateSignals(ctx, bars, portfolio) ([]Signal, error)`，与稿上签名完全不同；④ `5min` 又踩 B2。**整块按 Go + 表达式重画** |
| `沙箱编译通过 (0.12s)` + `AST Ref #CP-902` | `core` 沙箱（`pkg/sandbox`）+ 编译校验 | ✅ **ADR-024 的"真编译校验、不加载不执行"被正确表达**，保留 |
| `[假设主张] … 次日开盘9:35前均值回归概率为 74.2%` | `ai` verdict causal（mechanism + testable） | 🔧 可证伪主张+预测的写法**很好**；但 `9:35` 是盘中时点（B2）→ 改为交易日粒度 |
| `追问底层假设逻辑` / `指方向微标` | **G3 / G2** | ⏳ 入口对，无端点，画 disabled |
| `一键采纳并创建回测(Enter)` | `core` `POST /api/strategies` + `POST /api/backtest` | 🔧 采纳须带**理由 + 概率快照**（F7/S6） |
| `方向引导模板` 三个预设 chip | **G2** | ⏳ 好设计，待后端 |
| `导入 Python/Q-AST` / `PyPy 7.3 JIT / C++ AST Core` / `导出策略包 (.qpkg)` | — | ❌ 幻觉栈。删 |
| `LIVE AST v2.4` / `内存执行周期 1.84ms` | — | 🎨 删 |

---

## 7. `factors_ic` → 因子研究（F12，P1 改造 `/factors`）

**目标路由** `/factors`。**一句话**：F12 的 API 映射基本准确，**六维齐全可作基准**；数据栈布景删。

| 控件 | API | 标记 |
|---|---|---|
| 因子列表 + 详情头（分类/池/频率 `日频`） | `core` `GET /api/factor/list` | ✅ |
| `MEAN IC +0.084 (IR 1.88)` / `IC>0 胜率` / `单调性` | `core` `GET /api/factor/ic/{factor}` | ✅ |
| `Rolling 250D Rank IC` + `IC 衰减曲线` + `半衰期 3.4d` + 最佳换仓窗口 | 同上 | ✅ F12 主场景 |
| `10分位累计收益` Q1–Q10 | `core` `GET /api/factor/returns/{factor}` | ✅ |
| `触发全量计算` | `core` `POST /api/factor/compute-ic`、`/compute-returns` | ✅ 长任务 → 轮询 |
| `公式定义与 AST 语法树` | 表达式 DSL | ✅ |
| **6 维验证器裁决齐全**（含 `5. 因子正交性 Orthogonality 74%`） | `ai` verdict | ✅ **与 §2 同为六维基准画法** |
| `风格正交性热力矩阵`（CPO_SURGE × SIZE/MOM/REV/VOL/LIQ） | 因子相关性 | 🔧 方向对（冗余维可视化），但 **`BARRA CNE6 STYLE BENCHMARK` 无数据源** → 用自仓因子集，删 Barra |
| `Hermes Agent 变异建议` + `一键派生变异` + `推入回测引擎` | `core` 基因池/进化（`pkg/ai/gene_pool`、`evolution`）+ `POST /api/backtest` | ✅ **漏斗闭环的正解**，保留 |
| `触发全量计算 (Polars)` / `Parquet` / `PARTITION: l2_tick_snapshot_sh_sz` | — | ❌ 栈错位 + L2 越界。删 |
| `VERIFIED 2024-Q2` 徽标 | — | 🔧 二值（S1）→ 改"综合 71%，最弱：因果" |
| `已排查 2015/2020 极端流动性衰竭样本，未见明显过拟合回撤` | — | 🔧 表述像**挑样本**；改为可质问的稳健性维输出 |
| `IC 衰减 T+1…T+10` | 同上 | ✅ 日频粒度，合法 |

---

## 8. `screener` → 选股与市场（F14，P1 保留 `/screener`）

**目标路由** `/screener`。**一句话**：条件构造器与"发至回测"是亮点；**整屏的盘中雷达与资金流必须切除**，切完剩一半。

| 控件 | API | 标记 |
|---|---|---|
| 条件 chip `PE(TTM)<40` / `MA(Amount,20)>5亿` / `剔除 ST/*ST/退市` | `core` `POST /api/screen` | ✅ 基本面+成交额条件有数据源（`stock_fundamentals`） |
| 预设筛选器 4 组 + `新建筛选器` | `POST /api/screen` | ✅ |
| `立即扫描` + 命中数 `42 / 5,380` | `POST /api/screen` + `GET /api/stocks/count` | ✅ |
| `存为动态池` / `条件逻辑组` | — | ⏳ 无筛选器持久化端点 → 标 ⏳ 或本地态 |
| `发至回测` | `POST /api/backtest` | ✅ **好设计**，选股→回测的桥 |
| 结果表（代码/名称/最新价/换手/动量Z-Score/因子归因） | `POST /api/screen` + `GET /api/ohlcv/{symbol}` | 🔧 日频收盘价合法；**"动量 Z-Score / 因果度"列需标数据来源**（因子维，非实时） |
| **`REAL-TIME RADAR` 徽标 + `60-MIN CANDLESTICK + FACTOR PULSE` + `ENTRY: 14:15` + `09:30/11:30/14:15/15:00` 轴** | — | ❌❌ **B2 最严重一屏**：分钟 K + 盘中入场点。整块换成**日线 K + 区间** |
| `SSE L2 行情切片: 2024-Q2-LATEST` / `全市场扫描延迟 284ms` | — | ❌ B3。删 |
| `尾盘大单主买比例 42.8% / 主力净流入 +3.42亿元 / 拥挤度 48%` | — | ❌ 无资金流/大单数据源（日频栈没有 L2 腿）。删 |
| `五维因子透视` 雷达图 | 因子暴露 | 🔧 维度须与六维契约对齐，或明确标注"这是因子暴露，不是验证器六维" |
| `质问因子假说` + `#cpo_mom_lag0_7a81` | `core` `GET /api/evidence/{content_hash}` | ✅ F6 |
| `SIMULATED EXP SHARPE 2.35 P(S>1.8)=81%` | — | ❌ 前瞻承诺 + 无端点。删 |
| `因果可信度 > 70%` 作为筛选条件 | — | ⏳ 因子级因果置信度未进筛选契约（G 类）→ 标 ⏳ |

---

## 9. `data_sync` → 数据管理（F13，P1 保留 `/data-sync`）

**目标路由** `/data-sync`。**一句话**：**唯一"画的内容与真实能力几乎零重叠"的一屏** —— 真实能力（作业队列/排程/worker/重试）比画出来的湖仓更有用，须整屏重做；**PIT 与幸存者偏差两块是唯一该保留的精华**。

| 控件 | API | 标记 |
|---|---|---|
| `PIT 真实时间轴防未来函数沙盒`（财务期末 / 公告披露时间 / 因子有效可交易起始） | `core` `stock_fundamentals` / `fundamentals_detail.ann_date`（PIT） | ✅✅ **全套最有价值的一块**，与偏差维 + ODR-053 同源，保留为基准 |
| `幸存者偏差过滤（包含历史退市标的 127 只）` | `core` `stocks` 含退市 | ✅ 真实关注点 |
| `立即全量校验 (SHA-256)` | `core` `POST /api/ingest/raw`（content_hash） | 🔧 语义可映射到 hash 坐标校验，但**无"全量校验"端点** → 标 ⏳ |
| `增量回补 (Trigger Backfill)` | `sync` `POST /api/sync/jobs`（7 类 job type） | ✅ |
| 数据源健康 | `core` `GET /api/datasource/status`、`/api/datasource/health` | ✅ |
| **（稿上缺失，必须补）作业队列** | `sync` `GET /api/sync/jobs`、`GET /jobs/{id}`、`POST /jobs/{id}/cancel`、`POST /jobs/{id}/retry` | 🔧 **真实能力未被画出** —— 这才该是主区 |
| **（稿上缺失）作业进度流** | `sync` `GET /api/sync/jobs/{id}/progress`（**SSE，全站唯一真推送**） | 🔧 唯一可以合法显示 "SSE" 的地方，且须写明"仅本作业" |
| **（稿上缺失）排程管理** | `sync` `/api/sync/schedules` CRUD + `/{id}/toggle` + `/{id}/run` + `GET /scheduler/stats` | 🔧 整块未画 |
| **（稿上缺失）worker 状态** | `sync` `GET /api/sync/workers` | 🔧 |
| 同步日历 | `core` `POST /api/sync/calendar`、`GET /api/v1/trading/calendar` | ✅ |
| **（稿上缺失）插件热加载** | `core` `/api/plugins` 家族 9 条 | 🔧 属 F18 系统管理区，本屏不放 |
| `上交所 Level2 逐笔 3秒快照 / 深交所 Level2 94,120 msg/s / 极速二进制 TCP` | — | ❌❌ B3。整块删 |
| `PARQUET 湖仓 84.2TB/200TB` / `Apache Iceberg` / `DuckDB 查询` / `OSS 异地灾备` / `Arrow IPC Zero-Copy` / `ZSTD L3 压缩` | — | ❌ 栈错位（真实：PostgreSQL + Redis）。整块删 |
| `8 CPU Workers (EPYC 9654) + 2 GPU Indexers (A100)` / `SLA 99.999%` / `双主节点 SHA-01/SZX-02 零丢包` | — | ❌ B4。删 |
| `NLP 宏观与产业链非结构化 42家通讯社 抽取速率 120 doc/min` | `core` `POST /api/ingest/equitydeep` | 🔧 摄取入口真实，**吞吐数字与"42家通讯社"虚构** → 改为 job 维度真实统计 |
| `轮询周期 1000ms` 实时矩阵 | — | 🔧 本屏可用 SSE，不需要伪轮询 |

---

## 10. `alerts_health_regime` → 风险告警与策略健康（F15，P1 告警 / P2 健康）

**目标路由** 拆两页：`/alerts`（P1 保留）+ `/health`（P2 新增）。**一句话**：健康矩阵的"状态×regime×drift"三列是 F15 的正解；VaR/HMM-GARCH 与 L2 时钟删。

| 控件 | API | 标记 |
|---|---|---|
| 告警历史 / 统计 | `core` `GET /api/alerts/history`、`/api/alerts/stats` | ✅ |
| `立即检查` | `core` `POST /api/alerts/force-check` | ✅ |
| 策略健康矩阵 `STATE (NOMINAL/WATCH/ISOLATED) × TURNOVER × ASSIGNED REGIME × DRIFT INDEX` | `core` `POST /api/risk/detect_regime`、`GET /api/risk/metrics`；drift 见 `pkg/ai/drift` | ✅ **F15 主场景的正解**，保留为基准 |
| `待办风险介入事件` + `更新风控阈值` | `core` `POST /api/risk/check_stoploss`、`/calculate_position` | 🔧 端点是**计算型**（无状态查询/写回），"阈值更新"无持久化端点 → 标 ⏳ |
| `一键风险隔离 (Isolate)` | — | ❌ 无隔离端点。改 ⏳ 或删；若保留必须二次确认 |
| `MAX PORTFOLIO DRAWDOWN` 组合级 | `core` `GET /api/backtest/{id}/report` | 🔧 单策略合法；**组合级回撤无端点** → 标 ⏳ |
| `AGGREGATE VAR (99% 1D) 1.18%` / `BETA DRIFT` | — | ❌ 无 VaR/beta 端点。删 |
| `HMM-GARCH 宏观状态概率与波动率包络` | `core` `GET /api/macro/series` | ❌ 宏观序列真实，**HMM/GARCH 模型栈虚构**。改为原始序列图 |
| `极端情景压力测试 (Scenario Replays)` + `Monte Carlo 自定义情景` | — | ❌ 无端点。删或标 ⏳ |
| `A-Share L2 Synchronized 14:59:58 UTC+8` / `LIVE TELEMETRY` | — | ❌ B2/B3。删，改"数据截至 <交易日>" |
| `失效 → 回到 F1 候选生成` 漏斗回流 | `ai` `POST /api/explore/runs` | 🔧 **F15 要求但稿上缺失**：健康页须有"就这个失效策略发起新一轮探索"的入口 |
| `策略健康度周报` | — | 🔧 F15 明列的产出物，**稿上未画** → 补（导出仅 `html`） |
| `Dual-Momentum 漂移审计跟踪` 里的 `MarkovSwitchingModel(k_regimes=3).fit(...)` | — | ❌ 代码级虚构。改为 drift 输出的自然语言结论 |

---

## 11. `execution` → 执行与账户（F16，P2）

**目标路由** `/execution`。**一句话**：**整屏不可施工，需从"高频执行网关"重写为"纸交易观测台"**。这是唯一一屏判定为"重画"而非"改"的。

| 控件（稿上） | 真实能力 | 标记 |
|---|---|---|
| `Q-ROUTER ACTIVE / TWAP-VWAP ALGO / 亚毫秒挂单路由 / 100 FPS L2 TICK / FIX 4.4 / SSE Colocation / Direct DMA / Internal Crossing` | — | ❌❌ **B1 整块删**。F16：实盘不做，UI 文案不得暗示实盘；`LiveEngine` 生产零调用方（AGENTS §14） |
| 母单流水（算法模型/目标已成/均价到达价） | `core` `GET /api/execution/orders`、`GET /orders/{id}` | 🔧 订单列表真实（MockTrader），但**算法母单/滑点基准是实盘概念** → 改为纸交易委托流水 |
| 撤单 | `core` `POST /api/execution/orders/{id}/cancel` | ✅ |
| 下单 | `core` `POST /api/execution/orders` | ✅ |
| 持仓 | `core` `GET /api/execution/positions` | ✅ **稿上未画，须补** |
| 账户 | `core` `GET /api/execution/account` | ✅ **稿上未画，须补** |
| `紧急全局平仓熔断` | `core` `POST /api/execution/emergency-flatten` | 🔧 端点真实，但稿上是一级按钮 —— **F16 要求：红色 + 二次确认 + 独立确认码** |
| 外部信号流观测 | `core` `POST /api/signals`（机器写入面） | 🔧 **稿上未画**：UI 只做观测/审计展示 |
| `执行质量与滑点时序 vs Intraday VWAP` / `ALMGREN-CHRIS 冲击分解` | — | ❌ B2 + 无端点。删 |
| `可用担保品 ¥42,850,000 / 保证金占用率 / T+1 预留流动性缓冲` | `GET /api/execution/account` | 🔧 账户字段真实，**金额与杠杆概念是机构实盘布景** → 用 MockTrader 真实账户值 |
| `事前风控引擎: 全部 Pre-Trade 校验合规通过 0 REJECT` | `core` `POST /api/compliance/check`、`POST /api/risk/check_stoploss` | 🔧 计算型端点真实，"全部通过 0 REJECT"这种**汇总徽标无端点** → 标 ⏳ |

**重画指引**：本屏目标形态 = *纸交易观测台*（订单/持仓/账户/信号流四块 + 一个受保护的紧急平仓），**不是**交易员终端。

---

## 12. `macro` → 行业与宏观（F18，P2）

**目标路由** `/research`（行业与产业链）。**一句话**：**概念上最贴合 ADR-023"EquityDeep 降为数据底座"的一屏**，图谱→因子→回测的链路是全套最有想法的交互；统计模型名删。

| 控件 | API | 标记 |
|---|---|---|
| 产业链图谱（外源驱动→上游→焦点节点→中游→下游→算力/内需） | `core` `GET /api/industry/tree`、`/api/industry/edges` | ✅ **F18"产业链图谱可视化是重点场景"的正解** |
| 环节景气度 | `core` `GET /api/industry/vitality` | ✅ |
| ETF 成分 | `core` `GET /api/industry/etf/{etf_code}/constituents` | ✅ |
| 宏观序列 | `core` `GET /api/macro/series` | ✅ |
| `滞后观察窗 15~45 交易日 (t-Δ)` + `因果强权重阈值 >0.60` | `ai` 因果维（`pkg/ai/causal`） | 🔧 概念对齐因果维；**具体统计量（Granger/ADF/Johansen/VAR(3)）无端点** → 展示因果维的 mechanism + testable/passed/failed，不展示模型名 |
| `一键将该传导链提取为 Alpha 因子` + `发送至因子实验室检验 (IC/IR 回测)` | `core` `POST /api/factor/compute-ic` + `POST /api/backtest` | ✅✅ **漏斗闭环，本屏最大亮点**，保留 |
| `STATIONARY VAR(3)` / `ADF TEST PASSED` / `Johansen r=3` 报告卡 | — | ❌ 虚构统计栈。删（见上） |
| `美债10Y / USD-CNH / 北美四大云厂 CapEx` 外生驱动节点 | `GET /api/macro/series` | 🔧 序列端点真实，**这些具体标的是否已摄取需核验** → 施工前先查库，缺则标 ⏳ |
| `拓扑矩阵更新于 15:30 收盘后 L2 票类演算` | — | ❌ B3。改"更新于 <日期>（同步作业 #id）" |
| `节点因果流向审计 ID: 300308.SZ` + `Audit Evidence` | `core` `GET /api/evidence/{content_hash}` | ✅ F6 |

---

## 13. 横切：全站必须统一的 6 件事

| # | 事项 | 现状 | 要求 |
|---|---|---|---|
| 1 | **侧栏导航** | 11 屏含 `数据管道 Data Sync`，`review_desk` **缺**；`backtest` 屏标签全变（回测分析/探索观测/因子工厂/全市场选股/数据通道） | 以 §3.2 目标 IA 为准，**9 项一套标签**，全站逐字一致 |
| 2 | **顶栏** | `SSE · L2 FEED` / `HERMES 380 probe/h` / `DETERMINISTIC STABLE` / `QUEUE 3` 各屏措辞不同 | 收敛为：`⌘K` + run 状态（轮询）+ 待审阅数 + 身份。**去掉所有行情/L2/集群字样** |
| 3 | **六维验证器** | explore/factors 6 维，review_desk 5 维，其余屏无 | 六维固定 + `unassessed` 显式 + probability=min + 最弱项高亮；**以 §2/§7 为基准画法** |
| 4 | **F6 质问入口** | 仅 4/12 屏有；**恰好缺回测报告、因子 IC、对比页** | 所有"可被质问的数字"带 affordance，侧滑不跳页（F6 验收：≤2 击、0 跳页） |
| 5 | **F3 四干预** | 叫停 2 屏 / 指方向+追问 1 屏 / 标记 1 屏 | 三上下文（候选卡、结果流行、回放页）**入口一致**；G2/G3/G4 一律 disabled + "待后端" |
| 6 | **状态三值** | `COMPLETED / INVALID / FAILED` 见 §1、§6 正确，其余屏未体现 | 全链路同口径（K9）；**禁止以 `result.id` 存在判成功** |

---

## 14. 缺屏清单（设想有、稿上无 —— 需新设计）

| 缺屏 | 依据 | 端点 |
|---|---|---|
| **F17 合规检查** | §3.2 系统 System | `core` `/api/compliance/*` **9 条**（适当性/异常交易/减持） |
| **F18 系统管理 Admin** | §3.2 | `core` `/api/auth/admin/users`、`/audit`、`/auth/status`、`/bootstrap` + `/api/plugins*` **9 条** |
| **F9 扩展：walk-forward / 批量回测** | 附录 B | `core` `/api/walkforward`、`/api/walkforward/{strategy_id}`、`/api/batch`、`/api/batch/{batch_id}`、`/api/batch/{batch_id}/export/{format}` |
| **登录 / 首次引导** | F18 | `core` `/api/auth/login`、`/refresh`、`/me`、`/status`、`/bootstrap`（现 `/login` 已有实现，稿上未画） |
| **MCP 工具面观测** | L2 能力层 | `ai` `GET /api/tools`、`GET /api/tools/{name}`（AI 操作底座的可监督性入口，**与 ADR-023 可监督性直接相关，建议补**） |

---

## 15. 施工优先级建议（按"端点已就绪 × 契约无冲突"排序）

> **任务台账已迁出**：本表的每一项已展开为 [TASKS.md](TASKS.md) 里带 **6 条可判定断言**的任务（A-01…A-11 可做 / B-01…B-06 延后）。
> **进度与取证只记在 TASKS.md**，本文件保持"处置清单"职责不重复。
> 主任裁决（2026-10-13）：`ai-service` 后端会做但目前没有 ⇒ 分组 B（explore / 审阅台 / 台账 / Copilot 腿）**先不做，挂计划**。

| 序 | 屏 | 可立即施工部分 | 阻塞项 |
|---|---|---|---|
| 1 | `explore`（F1/F4） | 三栏 + 回放 + 叫停（全有端点） | 指方向/追问/标记 → disabled |
| 2 | `compare`（F10） | 叠加曲线 + 相关矩阵 + **GATE EXCLUDED 基准** | 组合优化器删后无阻塞 |
| 3 | `backtest`（F9） | 报告五 tab + 三值收口 | 无（切除盘中腿后即可） |
| 4 | `factors_ic`（F12） | IC/衰减/十分位/变异派生 | 无 |
| 5 | `data_sync`（F13） | **整屏重做**为作业队列+排程+PIT | 无（真实端点比稿上丰富） |
| 6 | `review_desk`（F2/F3/F5/F7） | 卡片骨架 + 六维 + 质问侧滑 | **G1 摘要聚合 / G6 采纳记录** |
| 7 | `journal`（F7） | 台账结构 + 管道阻断关联 | **G6** |
| 8 | `strategies`（F11） | 三 tab 合并 + 策略 CRUD + Copilot job | 代码块按 Go+表达式重画 |
| 9 | `screener`（F14） | 条件构造 + 扫描 + 发至回测 | 动态池持久化 ⏳ |
| 10 | `alerts`/`health`（F15） | 告警 + 健康矩阵 | 周报、隔离 ⏳ |
| 11 | `macro`（F18） | 图谱 + 传导链→因子 | 统计模型名删 |
| 12 | `execution`（F16） | 订单/持仓/账户/信号流（纸交易观测） | 整屏重画 |

---

## 更新记录

| 日期 | 版本 | 变更 |
|---|---|---|
| 2026-10-13 | 1.0 | 初版：12 屏逐控件 → API 端点映射与处置（留/改/删/待后端/装饰），含横切 6 项、缺屏 5 项、施工优先级 12 序。端点清单实测自 `openapi.yaml`（76 path）+ `cmd/data/main.go` `/api/sync/*`（14 条，契约外）+ `quant-trading-agent/cmd/ai/handlers_*.go`（explore/copilot/pipeline/tools）。依据 [ODR-066](../../../../quant-trading-docs/docs/archive/odr/odr-066-stitch-design-review-and-boundary-ruling.md) |
