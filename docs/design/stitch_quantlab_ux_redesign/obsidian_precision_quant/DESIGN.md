---
name: Obsidian Precision Quant
version: 2.0
status: 单一真相源（Single Source of Truth）
date: 2026-10-13
derived-by:
  - docs/design/visual.md（人读视图，值由本文件派生）
  - web/src/styles/variables.css（运行时 CSS 自定义属性，键名与本文件 1:1，供自定义 CSS 使用）
  - web/src/styles/palette.ts（TS 字面量源 —— Chart.js 与 Naive themeOverrides 吃不了 CSS 变量，只能收字面量）
  - web/src/App.vue（Naive UI themeOverrides，由 palette.ts 驱动）
  - web/src/styles/palette.test.ts（**漂移守卫**：palette.ts ↔ variables.css 逐字相等 + WCAG 对比度不变量）
supersedes: v1.0（Stitch 生成，frontmatter 与正文自相矛盾，见 §0 取舍记录）
evidence: ODR-066（12 屏逐控件处置）· 对比度实测脚本输出见 §7
colors:
  # —— 画布与层级（表面阶梯 = 唯一深度语言，不用投影堆叠）——
  q-bg: '#090a0c'          # canvas，8/12 屏实测众数
  q-surface: '#111620'     # elevation 1：面板、外壳、输入框底
  q-surface2: '#171E2C'    # elevation 2：工作卡片、代码单元
  q-surface3: '#1E2638'    # elevation 3：浮层、抽屉、下拉、菜单
  q-border: '#5a6070'      # 组件边界（canvas 上 3.15:1）
  q-border-light: '#2a3449' # 装饰性 hairline（1.59:1，**不得**作为组件唯一可辨识边界）
  # —— 文字三级（全部 ≥4.5:1，实测于 surface1）——
  q-text: '#e1e2eb'        # 14.04:1  主数据、标题
  q-text2: '#c3c6d7'       # 10.68:1  正文、标签
  q-text3: '#94a3b8'       #  7.06:1  次要、占位符（v1.0 的 #484f58 仅 2.28:1，已废）
  # —— 确定性通道（Deterministic：可验证事实、硬数据操作）——
  q-primary: '#b4c5ff'     # 10.67:1  文字/链接/激活态/图标
  q-primary-dark: '#2563eb' # 白字 5.17:1  填充（按钮、选中态底）
  q-primary-light: '#dbe1ff' # hover、强调态
  # —— 概率性通道（Probabilistic：AI 产出、假设、非确定性）——
  q-ai-text: '#d0bcff'     # 10.63:1  AI 文字/徽标/图标（**唯一**的 AI 文字色）
  q-ai: '#7c3aed'          # 白字 5.70:1  AI 填充（v1.0 的 #8b5cf6 白字仅 4.23:1，已废）
  q-ai-aura: 'rgba(139, 92, 246, 0.25)'  # 非确定性卡片 1px 内发光边（装饰，不受对比度约束）
  q-ai-wash: 'linear-gradient(180deg, rgba(139, 92, 246, 0.04) 0%, transparent 100%)'
  # —— 状态三值（K9 契约：completed / invalid / failed，全链路同口径）——
  q-success: '#10b981'     #  7.14:1  completed / 健康 / 正收益
  q-warning: '#f59e0b'     #  8.43:1  invalid / degraded 的预留色（⚠️ 当前仍零消费，接线见 TASKS.md A-07）
  q-danger: '#ef4444'      #  4.81:1 surface1；**浮层小字改用 q-danger-text**
  q-danger-text: '#f87171' #  5.46:1 surface3 上的失败小字
  q-info: '#b4c5ff'        # 中性提示（与确定性文字色同值，刻意如此）
  q-focus: '#b4c5ff'       # 焦点环 ≥3:1（键盘可达性承重件）
typography:
  headline-lg:   { fontFamily: Inter, fontSize: 24px, fontWeight: '600', lineHeight: 32px, letterSpacing: '-0.015em' }
  headline-md:   { fontFamily: Inter, fontSize: 18px, fontWeight: '600', lineHeight: 24px, letterSpacing: '-0.01em' }
  title-sm:      { fontFamily: Inter, fontSize: 14px, fontWeight: '500', lineHeight: 20px }
  body-md:       { fontFamily: Inter, fontSize: 13px, fontWeight: '400', lineHeight: 18px }
  body-sm:       { fontFamily: Inter, fontSize: 12px, fontWeight: '400', lineHeight: 16px }
  mono-data-lg:  { fontFamily: JetBrains Mono, fontSize: 15px, fontWeight: '500', lineHeight: 20px }
  mono-data-md:  { fontFamily: JetBrains Mono, fontSize: 12px, fontWeight: '400', lineHeight: 16px }
  mono-data-sm:  { fontFamily: JetBrains Mono, fontSize: 11px, fontWeight: '400', lineHeight: 14px, letterSpacing: '0.02em' }
  label-caps:    { fontFamily: JetBrains Mono, fontSize: 11px, fontWeight: '600', lineHeight: 12px, letterSpacing: '0.08em' } # v1.0 为 10px，小于可读下限，已上调
  cjk-stack:     "'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei'"
rounded:
  q-radius-xs: 2px   # 徽标、hairline 元素
  q-radius-sm: 4px   # 输入框、按钮、chip（基准）
  q-radius: 8px      # 卡片、对话框
  pill: 禁用         # 除小状态徽标外一律不用胶囊形
spacing:
  space-xs: 0.25rem
  space-sm: 0.375rem
  space-md: 0.75rem
  space-lg: 1.25rem
  space-xl: 1.75rem
  gutter: 0.75rem
  gutter-desktop: 1rem
  margin: 1rem
  margin-desktop: 1.5rem
---

# Obsidian Precision Quant — 设计系统 v2.0

> **本文件是设计 token 的唯一真相源。** `visual.md` 是人读视图、`variables.css` 是运行时实现、`App.vue` 的 `themeOverrides` 是组件库实现 —— 三者**只允许从本文件派生值**，不得各自另立。
> 改 token 的正确顺序：本文件 → `variables.css` → `App.vue` → `visual.md`。
> 依据：[ODR-066](../../../../../quant-trading-docs/docs/archive/odr/odr-066-stitch-design-review-and-boundary-ruling.md) §Decision 6（主任裁决：以新设计为方向基准、细节以实际后端能力为准）。

---

## 0. 取舍记录（为什么是这些值）

v1.0 的问题不是"选错了"，而是**根本没有一份自洽的基准**：`DESIGN.md` frontmatter 与正文互相矛盾，12 份 `code.html` 各带一套内联主题，现仓另有 `visual.md` + `variables.css` + Naive UI 内置暗色 —— 共**五处**真相源。裁决口径是"着重参考新设计页面，但不当完成稿"，故按**多数屏实测值 + 与新设计基调一致 + 对比度实测**三条收敛，逐条留痕：

| 维度 | 候选值（实测来源） | 取定 | 理由 |
|---|---|---|---|
| canvas | `#10131a`(v1.0 frontmatter) / `#0B0E14`(v1.0 正文) / `#090a0c`(**8 屏**) / `#090d16`(review_desk) / `#08090b`(compare) / `#0d1117`(现仓) | **`#090a0c`** | 众数；且 v1.0 自身 frontmatter 与正文就给了两个不同值，说明该值未经确认。最深底 + 表面阶梯拉深，最贴合"消除多小时用眼疲劳的深冷底"基调 |
| 表面阶梯 | v1.0 正文 `#111620/#171E2C/#1E2638` vs frontmatter Material 阶梯 | **正文三阶** | 唯一自洽的 elevation 阶梯，且与"不用投影、靠色调分层"一致 |
| 结构字体 | Geist(v1.0 规定，1 屏) / **Inter(6 屏)** / Plus Jakarta Sans(1 屏) / 未指定(3 屏) | **Inter**，Geist 降为 fallback | 按"着重参考新设计**页面**"——页面里 6:1 选 Inter。Inter 字形覆盖与 hinting 更成熟，Geist 保留在栈中以防品牌回摆 |
| 等宽字体 | JetBrains Mono（**12/12 屏 + v1.0 + 现仓一致**） | **不变** | 全站唯一共识，数字对齐承重组，不动 |
| 确定性主色 | `#b4c5ff`(v1.0 frontmatter "primary") / `#2563eb`(v1.0 正文 "Deterministic Primary") | **两个都留，拆角色** | v1.0 的矛盾其实是**未区分文字态与填充态**。实测 `#2563eb` 作文字仅 3.50:1（不达标）、作填充白字 5.17:1（达标）⇒ 文字态 `#b4c5ff`、填充态 `#2563eb`，一次解决矛盾与缺陷 |
| 概率性/AI 色 | `#8b5cf6`(正文) / `#d0bcff`(frontmatter secondary) | **填充 `#7c3aed`、文字 `#d0bcff`** | 实测**白字压 `#8b5cf6` 只有 4.23:1，不达标** ⇒ 填充加深一档到 `#7c3aed`（5.70:1）。`#8b5cf6` 保留给 aura 描边与渐变（纯装饰，不受约束），AI 视觉身份不变 |
| 圆角 | v1.0 正文 4px 基准 / 现仓 10px 卡片 | **4px 基准 / 8px 卡片** | 取新设计（低半径、最大化视口面积），现仓 10px 属旧基调 |
| 小字标签 | v1.0 `label-caps` 10px | **11px** | 10px + 0.08em 字距在暗底上低于可读下限；上调一档，视觉密度损失可忽略 |

### 0.1 顺带修掉的既有缺陷（不是新设计带来的）

| 项 | 旧值 | 问题 | 新值 |
|---|---|---|---|
| `--q-text3` | `#484f58` | **2.28:1，远低于 4.5:1**，且被消费 **14 次**（全站最多的文字 token） | `#94a3b8`（7.06:1） |
| `--q-warning` | `#d29922` | **零消费（至今仍是 0）** —— K9 的 `invalid` 态一直没有可用的警示色 | 值改为 `#f59e0b`（8.43:1）并**在语义上预留**给三值里的 `invalid`。**注意本行修的是"色值不可用"，不是"已经接上"**：`grep -ro "var(--q-warning)"` 实测 0 处（对比 `--q-success` / `--q-danger` 各 9 处），真正接上去是 [TASKS.md](../TASKS.md) 的 **A-07**。把"定义了 token"写成"一等公民"会把计划冒充现状 |
| Naive UI 主题 | `darkTheme` 无 `themeOverrides` | 所有 N 组件（按钮/卡片/输入/表格/下拉）走 Naive 自带调色板，与 `--q-*` **各画各的** | 新增 `themeOverrides`，由本文件同一组值驱动 |

### 0.2 图表系列色（新增：v1.0 完全没有这一层）

Chart.js 收不了 CSS 变量，只能收字面量，所以系列色必须有一处**显式定义**。规则：

| 用途 | 取值 | 为什么 |
|---|---|---|
| 主序列（策略净值） | `--q-primary` `#b4c5ff` | 确定性通道 |
| 参照序列（基准指数 / 股价等上下文线） | `--q-text3` `#94a3b8` | **中性灰 = "背景信息，不是主角"**。不用 amber：`#f59e0b` 是 `invalid` 的专用语义色，借来画股价会让"无效"在图里被误读 |
| 买 / 卖标记 | `--q-success` / `--q-danger` | 这里确实是状态语义，可以借 |
| 成交点（与买卖三角区分） | `successPressed` / `dangerPressed`（深一档） | 同色系深浅分层，不新立色相 |
| 网格 / 刻度 / 图例 | `--q-border-light` / `--q-text3` / `--q-text3` | 刻度沿用旧 `#484f58` 会把 2.28:1 的缺陷从 CSS 侧赶进 canvas 侧 |

**原则：系列色不新立色相，只从既有 token 取。** 需要第 5 条序列时先回到本文件补 token，不要在组件里写字面量。
实现：`web/src/styles/palette.ts` 的 `chartPalette`。

### 0.2.1 多序列色带（v2.0 补，`BacktestCompare` 首次用到）

多策略对比需要最多 6 条可分辨序列。既有 token 里 `success/warning/danger` 是状态语义、`ai*` 是概率性语义，**借给"策略 A/B/C"会让读者把系列误读成状态**（违反原则 1）。因此新增一条**刻意低饱和**的中性冷调色带：

| Token | 值 | 画布上对比度 | 说明 |
|---|---|---|---|
| `--q-series-1` | `#b4c5ff` | 11.67:1 | 与确定性文字色同值（首序列即主角） |
| `--q-series-2` | `#7fb0b8` | 8.30:1 | 钢青 |
| `--q-series-3` | `#d9b98a` | 10.62:1 | 沙，**刻意比 amber 灰**，不与 `invalid` 撞 |
| `--q-series-4` | `#8fb8a8` | 9.04:1 | 鼠尾草，**刻意比 emerald 灰**，不与 `completed` 撞 |
| `--q-series-5` | `#9aa7d6` | 8.37:1 | 雾靛 |
| `--q-series-6` | `#e1e2eb` | 15.35:1 | 近白，末位兜底 |

（对比度为脚本实测值，非估算；重跑方式见 `styles/palette.test.ts` 的 `contrast()`。）

两条不变量由 `styles/palette.test.ts` 机器守住：① 每条在画布上 ≥3:1（线条可见性）；② 与全部状态色/AI 色**集合不相交**（撞义即红）。

另新增 `--q-success-soft: rgba(16,185,129,0.08)` —— 最优行高亮与 `completed` 芯片底，替代此前散落的 `rgba(133,232,157,…)` 旧值。

---

## 1. 基调与人格

机构级、自托管的 A 股量化研究工作区。把高频终端的信息密度与现代技术 SaaS 的结构清晰度对齐。

- **Sovereign Rigor**：绝对稳定的视觉骨架、手术刀式布局、多窗体工作流下的无损清晰度。
- **Epistemic Division（本系统的第一原则）**：**确定性事实**与**概率性产出**必须在色彩上可分辨 —— 见 §3 双通道。这不只是审美：它对应产品原则 1（确定性与非确定性分离）与原则 3（AI 交付提案不做决策）。
- **Silent Competence**：去掉装饰性浮夸，靠微对比、光学对齐、零干扰的暗底承载。

**Movement**：Slate Obsidian Modernism，precision hairline 分层（0.5px/1px 低不透明度边界）。
**Tone**：技术、克制、不粉饰、高度纪律。

---

## 2. 色彩：画布、层级与边界

### 2.1 表面阶梯 = 唯一的深度语言

| 层 | 值 | 用途 |
|---|---|---|
| Canvas | `#090a0c` | 页面底、视口承载 |
| Elevation 1 | `#111620` | 面板、外壳、输入框底 |
| Elevation 2 | `#171E2C` | 工作卡片、代码单元 |
| Elevation 3 | `#1E2638` | 浮层、检视抽屉、菜单 |
| Hairline | `rgba(255,255,255,0.08)` | 分隔线（**装饰**，不可作组件唯一边界） |

**不用氛围模糊与投影堆叠。** 浮层允许一个方向性阴影：`0 8px 24px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.08)`；卡片层为 `none`，靠色阶差 + 1px 边界分层。

### 2.2 边界对比度纪律

- **组件边界**（输入框、可选中卡片、开关）：`--q-border #5a6070`，canvas 上 3.15:1。
- **装饰分隔**：`--q-border-light #2a3449`（1.59:1）**只能**用于分组线，且该组件必须另有可辨识线索（层级差、内边距、label）。
- **焦点环**：`--q-focus #b4c5ff`，≥3:1，键盘可达性的承重件，**不得移除**。
- ⚠️ 已知不足：`#5a6070` 在 elevation 1 上为 2.88:1（略低于 3:1）。当前判**可接受**，因为静息边界不是唯一可辨识线索（焦点环与层级差承担该职责）；若后续要严判 1.4.11，把输入框底从 `#111620` 提到 `#171E2C` 或边框提到 `#626a7d`（canvas 3.66:1）。

---

## 3. 双通道：确定性 vs 概率性（本系统最重要的一节）

产品原则 1 要求"AI 产出区域必须与确定性数据区域视觉可区分"。落到色彩上就是两条互不借用的通道：

| 角色 | 确定性（Deterministic） | 概率性（Probabilistic / AI） |
|---|---|---|
| 文字 / 图标 / 链接 | `--q-primary #b4c5ff` | `--q-ai-text #d0bcff` |
| 填充（按钮 / 选中底） | `--q-primary-dark #2563eb` | `--q-ai #7c3aed` |
| hover / 强调 | `--q-primary-light #dbe1ff` | `#a78bfa` |
| 卡片标识 | 无 aura | `--q-ai-aura` 1px 内发光 + `--q-ai-wash` 顶部渐染 |
| 语义 | 可验证事实、硬数据联动、回测管线执行、确定性 run | LLM 假设、合成因子、非确定性代码提案、验证器概率 |

**规则（违反即视为缺陷，不是风格问题）**

1. AI 产出的文字**永远不用** `#b4c5ff`；确定性数据**永远不用** `#d0bcff`。
2. 概率性内容必须**同时**具备：violet 通道色 + 一处文字标注说明它是产出（如"AI 假设""未评估"）。**颜色不能是唯一线索**（无障碍：不靠颜色单义传达）。
3. 一条意图里若确定性指标与 AI 估计并排，二者必须分色 —— 这正是原则 6（校准优于准确率）要求的"并置"。

---

## 4. 状态三值（K9 契约，全链路同口径）

每个异步作业、回测、数据校验都必须通过三态芯片表达。**禁止以 `result.id` 存在判成功。**

| 态 | 文字色 | 底 | 边 | 标签示例 |
|---|---|---|---|---|
| `completed` | `#10b981` | `rgba(16,185,129,0.1)` | `rgba(16,185,129,0.2)` | `COMPLETED` |
| `invalid` | `#f59e0b` | `rgba(245,158,11,0.1)` | `rgba(245,158,11,0.25)` | `INVALID (BIAS DETECTED)` |
| `failed` | `#f87171`（浮层）/ `#ef4444`（面板） | `rgba(239,68,68,0.1)` | `rgba(239,68,68,0.25)` | `FAILED (EXIT 137)` |

- `invalid` ≠ `failed`：前者"跑出来了但结论无效"（前视污染、幸存者污染、参数非法），后者"没跑出来"。**二者混用是产品级缺陷**，因为它把"数据有问题"伪装成"服务有问题"。
- 被叫停（`stopped`）与跑满（`completed`）的**可信度不同**，探索类界面必须显著区分。
- 失败的尝试**没有裁决**，不得渲染成 0 分或"未通过"。

### 4.1 涨跌色与 A 股惯例（已知偏离，登记不改）

本系统沿用**绿涨红跌**（`--q-success` / `--q-danger`），与现仓及 12 屏一致。A 股本地惯例是红涨绿跌，此处**刻意不翻转**，理由：① 翻转会让"红=风险/失败"与"红=上涨"在同一屏内冲突；② 系统级遥测（绿=健康、红=故障）必须保持绿正向。此为**已知偏离**，要改需整体决策，不在 token 合一里顺手改。

---

## 5. 字体

### 5.1 字体栈（**含 CJK —— v1.0 完全缺失**）

```css
--q-font: 'Inter', 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI',
          'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', Roboto, sans-serif;
--q-mono: 'JetBrains Mono', 'Noto Sans Mono CJK SC', 'Fira Code', monospace;
```

> **v1.0 的缺口**：规定 Geist + JetBrains Mono，**一个 CJK 字体都没写**，而 12 屏几乎全是中文。Inter 与 Geist 均无中文字形，实际会 fallback 到浏览器默认（Windows 上是宋体族），密度与基线全乱。此处补齐并按"拉丁字体在前、CJK 在后"排列，使中文命中 `Noto Sans SC`。

- **结构层（Inter）**：12–14px 下 kerning 优化，承载表头与侧栏树。
- **数据层（JetBrains Mono）**：不可协商。表格数字、策略日志、Sharpe、因子表达式、矩阵形状一律等宽。

### 5.2 数字严格性

所有表格值与对比指标必须 **tabular lining numbers**：`font-variant-numeric: tabular-nums`。流式更新时数字**不得**横向跳动。

### 5.3 层级

见 frontmatter `typography`。要点：`body-md` 13px 为桌面正文；**<1024px 单列模式下正文升至 16px**（v1.0 未区分，13px 在手机上是可读性负债）。`label-caps` 由 10px 上调至 11px。

---

## 6. 组件规范

### 6.1 按钮

| 类型 | 底 | 文字 | 规格 |
|---|---|---|---|
| 确定性主操作 | `#2563eb` | `#ffffff`（5.17:1） | 4px 半径，Inter Medium 12px，无渐变 |
| AI 动作 / 合成 | `#7c3aed` | `#ffffff`（5.70:1） | 同上 + 活动态轻微呼吸 |
| 终端 Ghost | 透明 + `1px solid rgba(255,255,255,0.12)` | `#94a3b8` | hover 底升至 `rgba(255,255,255,0.04)` |
| 危险（紧急平仓等） | `#ef4444` | `#ffffff` | **必须二次确认 + 独立确认码**，禁用一键 |

### 6.2 指标与概率并置

确定性绩效与概率估计**永不合并成单一无量纲数字**：

```
Sharpe: 2.41        ← JetBrains Mono 常规
P(Sharpe > 1.8) = 76% ± 4.2%   ← 紧邻，violet 胶囊（#d0bcff on rgba(139,92,246,…)）
```

### 6.3 证据质问 affordance

每个可被质问的数字必须内嵌质问钩子（`[Audit Evidence]`），点击开**分栏抽屉/侧滑，不跳页**（验收：≤2 次点击、0 次页面跳转）。抽屉内展示原始记录 + 归档元数据。**无坐标的数字要显式标注"无法回溯"** —— 诚实优先于好看。

### 6.4 输入与代码单元

输入底 `#111620`，hairline 边 `1px solid rgba(255,255,255,0.1)`；标的代码（`600519.SH`）、日期区间、超参一律等宽。聚焦时边框换 `#2563eb`（确定性）或 `#8b5cf6`（AI 配置项）。

### 6.5 卡片与表格

- 卡片：`#171E2C` 填充，`space-md` 内边距，标题行 + 右对齐元数据 chip。
- 表格：行高 32px，**关闭斑马纹**改用 hover 轨道线；金额与因子权重右对齐，`mono-data-sm`。

---

## 7. 对比度实测（本文件的每个颜色都有账）

| 前景 / 背景 | 比值 | 判定 |
|---|---|---|
| `#e1e2eb` / canvas | 15.35 | ✅ AA 文本 |
| `#e1e2eb` / e1 · e2 · e3 | 14.04 / 12.94 / 11.72 | ✅ |
| `#c3c6d7` / e1 | 10.68 | ✅ |
| `#94a3b8` / e1 | 7.06 | ✅（旧 `#484f58` = 2.28 ❌ 已废） |
| `#b4c5ff` / e1（确定性文字） | 10.67 | ✅ |
| `#2563eb` / e1（**若误作文字**） | 3.50 | ❌ ⇒ 只能作填充 |
| `#ffffff` / `#2563eb` | 5.17 | ✅ |
| `#d0bcff` / e1（AI 文字） | 10.63 | ✅ |
| `#ffffff` / `#8b5cf6`（**v1.0 AI 按钮**） | 4.23 | ❌ ⇒ 加深为 `#7c3aed` = 5.70 ✅ |
| `#10b981` / e1 | 7.14 | ✅ |
| `#f59e0b` / e1 | 8.43 | ✅ |
| `#ef4444` / e1 · e2 · **e3** | 4.81 / 4.43 / **4.02** | ⚠️ 浮层小字改 `#f87171`（5.46）✅ |
| `#5a6070` / canvas（组件边框） | 3.15 | ✅ 非文本 3:1 |
| `#2a3449` / canvas（装饰 hairline） | 1.59 | ➖ 不受约束，见 §2.2 限制 |

---

## 8. 边界：本系统明确不含的东西

以下在 12 屏中出现过，经 ODR-066 判为**越界或幻觉**，**不得**为其设计任何 token、组件或状态：

- 分钟/盘中周期与 L2 逐笔（`1D/60m/15m/5m`、`ENTRY: 14:15`、`REAL-TIME RADAR`、`100 FPS L2 TICK`）—— 数据层只有日频。
- 实盘高频执行（TWAP/VWAP 母单、FIX 4.4、Colocation、Direct DMA、内部撮合）。
- 行情推送通道（全站顶栏 `SSE · L2 FEED`）。全站唯一合法 SSE 是**单个同步作业的进度流**。
- 集群/算力布景（GPU 型号、机房、端口、SLA 百分比）。
- 湖仓栈（Polars / Parquet / DuckDB / Iceberg / OSS）与向量库。
- 组合优化器（Risk Parity / MV）、VaR、HMM-GARCH、Barra CNE6。
- Merkle Root / 冷密钥签名审计链 —— 本仓的溯源机制是 `content_hash` → `ingest.raw`。

---

## 更新记录

| 日期 | 版本 | 变更 |
|---|---|---|
| 2026-10-13 | 2.0 | 五处真相源合一的**基准层**：canvas 取 8 屏众数 `#090a0c`、表面阶梯取 v1.0 正文三阶、结构字体按页面众数取 Inter（Geist 降 fallback）、确定性/概率性**拆成文字态与填充态两对**（顺带解决 v1.0 frontmatter 与正文的自相矛盾）、AI 填充 `#8b5cf6→#7c3aed`（白字对比度 4.23→5.70）、`label-caps` 10→11px、**补齐 CJK 字体栈**（v1.0 全缺）、修 `--q-text3` 2.28:1 既有缺陷、`--q-warning` **色值修正并语义预留**给 K9 的 `invalid`（接线在 A-07，当前仍零消费）、新增 §4.1 涨跌色偏离登记、§7 全量对比度实测、§8 边界负面清单。依据 ODR-066 §Decision 6 |
| — | 1.0 | Stitch 生成初稿（frontmatter 与正文不一致，已 superseded） |
