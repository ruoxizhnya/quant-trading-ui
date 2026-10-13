# 视觉规范

> 色彩、字体、间距、布局的完整规范
>
> ⚠️ **本文件是人读视图，不是真相源。** 颜色/字体/圆角的唯一真相源是
> [`stitch_quantlab_ux_redesign/obsidian_precision_quant/DESIGN.md`](stitch_quantlab_ux_redesign/obsidian_precision_quant/DESIGN.md)（v2.0，2026-10-13），
> 运行时实现是 `web/src/styles/variables.css` 与 `web/src/App.vue` 的 `themeOverrides`。
> 改 token 的顺序：**DESIGN.md → variables.css → App.vue → 本文件**。本文件不得另立任何值。
> 背景与取舍依据见 [ODR-066](../../../quant-trading-docs/docs/archive/odr/odr-066-stitch-design-review-and-boundary-ruling.md)。

---

## 1. 色彩系统

### 1.1 基础色板（画布与表面阶梯）

深度**只靠色阶差 + 1px 边界**表达，不靠投影。

| Token | 色值 | 用途 |
|-------|------|------|
| `--q-bg` | `#090a0c` | 页面背景（canvas） |
| `--q-surface` | `#111620` | elevation 1：面板、卡片底、输入框底 |
| `--q-surface2` | `#171e2c` | elevation 2：工作卡片、代码单元 |
| `--q-surface3` | `#1e2638` | elevation 3：浮层、检视抽屉、菜单 |
| `--q-border` | `#5a6070` | **组件边界**（canvas 上 3.15:1） |
| `--q-border-light` | `#2a3449` | **装饰 hairline**，不可作组件唯一可辨识边界 |

### 1.2 文字色彩（三级全部 ≥4.5:1）

| Token | 色值 | 用途 | 对比度(surface1) |
|-------|------|------|------|
| `--q-text` | `#e1e2eb` | 主标题、重要数据 | 14.04:1 |
| `--q-text2` | `#c3c6d7` | 正文、标签 | 10.68:1 |
| `--q-text3` | `#94a3b8` | 次要、占位符 | 7.06:1 |

> 旧值 `--q-text3: #484f58` 仅 **2.28:1** 且被消费 14 次（全站最多的文字 token），已于 v2.0 修正。

### 1.3 双通道：确定性 vs 概率性（最重要的一节）

对应产品原则 1（确定性与非确定性分离）与原则 3（AI 交付提案不做决策）。**两条通道不得互相借用。**

| 角色 | 确定性（可验证事实） | 概率性（AI 产出） |
|---|---|---|
| 文字 / 图标 / 链接 | `--q-primary` `#b4c5ff` | `--q-ai-text` `#d0bcff` |
| 填充（按钮 / 选中底） | `--q-primary-dark` `#2563eb` | `--q-ai` `#7c3aed` |
| hover / 强调 | `--q-primary-light` `#dbe1ff` | `--q-ai-light` `#a78bfa` |
| 卡片标识 | 无 aura | `--q-ai-aura` 1px 内发光 + `--q-ai-wash` 顶部渐染 |

**硬规则（违反视为缺陷，不是风格问题）**

1. AI 产出的文字**永不用** `#b4c5ff`；确定性数据**永不用** `#d0bcff`。
2. `--q-primary` 只能作**文字/图标/边框**，作填充时白字仅 3.50:1 —— 填充一律用 `--q-primary-dark`。
3. 概率性内容必须**同时**有色彩通道 + 一处文字标注（"AI 假设""未评估"）。**颜色不能是唯一线索。**
4. 确定性指标与概率估计并排时二者必须分色 —— 这正是原则 6（校准）要求的"并置"。

### 1.4 状态三值（K9 契约）

**禁止以 `result.id` 存在判成功。** 三态芯片文案与配色固定：

| 态 | 文字 | 底 | 边 | 标签 |
|---|---|---|---|---|
| `completed` | `#10b981` | `rgba(16,185,129,.1)` | `rgba(16,185,129,.2)` | `COMPLETED` |
| `invalid` | `#f59e0b` | `rgba(245,158,11,.1)` | `rgba(245,158,11,.25)` | `INVALID (原因)` + `invalid_reasons` |
| `failed` | `#ef4444`（浮层用 `--q-danger-text` `#f87171`） | `rgba(239,68,68,.1)` | `rgba(239,68,68,.25)` | `FAILED` |

> `invalid` ≠ `failed`：前者"跑出来了但结论无效"，后者"没跑出来"。混用会把"数据有问题"伪装成"服务有问题"。
> `--q-danger-text` 的存在理由：`#ef4444` 在 elevation 3 上只有 **4.02:1**。

### 1.5 功能色

| Token | 色值 | 用途 |
|-------|------|------|
| `--q-success` | `#10b981` | 正收益、completed、健康 |
| `--q-warning` | `#f59e0b` | **invalid / degraded**（旧值 `#d29922` 零消费） |
| `--q-danger` | `#ef4444` | 负收益、failed、风险 |
| `--q-danger-text` | `#f87171` | 浮层上的失败小字 |
| `--q-info` | `#b4c5ff` | 中性提示（与确定性文字色同值，刻意） |
| `--q-focus` | `#b4c5ff` | **焦点环 ≥3:1，键盘可达性承重件，不得移除** |

> **涨跌色已知偏离**：沿用绿涨红跌（与 A 股本地惯例相反）。理由：翻转会让"红=风险"与"红=上涨"同屏冲突，且系统遥测须保持绿=正常。要改需整体决策，不在 token 合一里顺手改。

### 1.6 语义化使用

```css
/* 收益率 */
.positive { color: var(--q-success); }
.negative { color: var(--q-danger); }

/* 交互状态（确定性激活态用文字态色） */
.nav-item.active {
  background: rgba(37, 101, 176, 0.16);
  color: var(--q-primary);
}

/* AI 产出卡片：内发光边 + 顶部渐染 + 文字标注（颜色不是唯一线索） */
.card--probabilistic {
  border: 1px solid var(--q-ai-aura);
  background-image: var(--q-ai-wash);
}

/* 浮层：唯一允许投影的地方 */
.popover { box-shadow: var(--q-shadow-lg); }
```

> ⚠️ 旧规范里的 `.metric-box:hover { transform: translateY(-1px); box-shadow: var(--q-shadow) }` **已废** —— v2.0 卡片层 `--q-shadow: none`，不做抬升动效（"避免戏剧性投影"）。悬停反馈改用背景色阶 + 边界色。

---

## 2. 字体系统

### 2.1 字体栈

```css
--q-font: 'Inter', 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI',
          'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', Roboto, sans-serif;
--q-mono: 'JetBrains Mono', 'Noto Sans Mono CJK SC', 'Fira Code', monospace;
```

- **结构层 Inter**：12–14px 下 kerning 优化，承载表头与侧栏树；`Geist` 保留为 fallback。
- **数据层 JetBrains Mono**：不可协商。表格数字、策略日志、Sharpe、因子表达式一律等宽。
- **CJK 必须显式声明**：Inter / Geist 都无中文字形，不写 `Noto Sans SC` 则中文落到浏览器默认（Windows 上是宋体族），基线与密度全乱。旧规范完全没写 CJK，v2.0 补齐。

> ⚠️ **当前这三族字体均未加载**（`index.html` 无 `<link>`、`public/` 无 woff2），实际渲染仍走系统字体。
> 启用需单独决策：自托管 woff2（涉二进制，属 AGENTS 禁区，需批准）或外部 CDN（与"自托管"定位冲突）。
> 在字体落地前，本节的**角色分工**（结构 vs 等宽）有效，**具体字面**尚未生效。

### 2.1.1 数字严格性

所有表格值与对比指标必须 tabular lining numbers，流式更新时数字不得横向跳动：

```css
.metric, .mono-data { font-variant-numeric: tabular-nums; }
```

### 2.2 字号层级

| 层级 | 字号 | 字重 | 用途 |
|------|------|------|------|
| headline-lg | 24px | 600 | 页面标题（-0.015em） |
| headline-md | 18px | 600 | 卡片标题（-0.01em） |
| title-sm | 14px | 500 | 区块标题 |
| body-md | 13px | 400 | 桌面正文 |
| body-sm | 12px | 400 | 标签、辅助文字 |
| mono-data-lg | 15px | 500 | 指标数值（等宽） |
| mono-data-md | 12px | 400 | 表格数字 |
| mono-data-sm | 11px | 400 | 因子权重、密集表（0.02em） |
| label-caps | 11px | 600 | 大写微标签（0.08em） |

> 两处相对旧规范的修正：① 字重由 700 降到 **600** —— 暗底上 700 会糊，这是新设计 12 屏的一致做法；
> ② `label-caps` 由 10px 上调到 **11px**，10px + 0.08em 字距在暗底上低于可读下限。
> ③ **<1024px 单列模式下正文升至 16px**（13px 在手机上是可读性负债）。

### 2.3 数字格式化

```typescript
// 收益率: +12.34% / -5.67%
fmtPercent(0.1234) // "+12.34%"

// 金额: ¥1,234,567.89
fmtNumber(1234567.89, 2) // "1,234,567.89"

// 成交量: 1.23M / 1.23B
fmtVolume(1230000) // "1.23M"
```

---

## 3. 间距系统

### 3.1 基础单位

以 `4px` 为基础单位：

| Token | 值 | 用途 |
|-------|-----|------|
| `--space-xs` | 4px | 图标与文字间距 |
| `--space-sm` | 8px | 紧凑元素间距 |
| `--space-md` | 12px | 卡片内边距、网格间距 |
| `--space-lg` | 16px | 表单元素间距 |
| `--space-xl` | 20px | 卡片间距 |
| `--space-2xl` | 24px | 页面内边距 |

### 3.2 布局间距

```css
/* 页面容器 */
.page-container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 24px;
}

/* 卡片间距 */
.card + .card { margin-top: 20px; }

/* 表单网格 */
.form-grid {
  display: grid;
  gap: 12px 16px;
}
```

---

## 4. 圆角与阴影

### 4.1 圆角

低半径、建筑感：**最大化密集表格与图表的可用视口面积**。胶囊形除小状态徽标外禁用。

| Token | 值 | 用途 |
|-------|-----|------|
| `--q-radius-xs` | 2px | 徽标、hairline 元素 |
| `--q-radius-sm` | 4px | 输入框、按钮、chip（**基准**） |
| `--q-radius` | 8px | 卡片、对话框 |

> 旧值 4/6/10px 属上一版基调，v2.0 按新设计下调一档。

### 4.2 阴影

**不用戏剧性投影与氛围模糊**，深度靠色调分层 + hairline 边界。

```css
--q-shadow: none;            /* 卡片层：无投影 */
--q-shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.45),
               0 0 0 1px rgba(255, 255, 255, 0.08);  /* 仅浮层、菜单 */
```

> 抬升式 hover（`translateY(-1px)` + 投影）已废，见 §1.6 注意事项。

---

## 5. 布局规范

### 5.1 整体布局

```
┌─────────────────────────────────────────┐
│  Sidebar (220px)  │  Header (56px)      │
│                   ├─────────────────────┤
│                   │                     │
│                   │    Content Area     │
│                   │    (padding: 24px)  │
│                   │                     │
└───────────────────┴─────────────────────┘
```

### 5.2 响应式断点

```css
/* Desktop */
@media (min-width: 1200px) {
  .metrics-grid { grid-template-columns: repeat(5, 1fr); }
  .form-grid { grid-template-columns: repeat(4, 1fr); }
}

/* Tablet */
@media (max-width: 1200px) {
  .metrics-grid { grid-template-columns: repeat(3, 1fr); }
}

/* Mobile */
@media (max-width: 768px) {
  .metrics-grid { grid-template-columns: repeat(2, 1fr); }
  .form-grid { grid-template-columns: 1fr; }
  .app-sidebar { display: none; } /* 或折叠 */
}
```

### 5.3 网格系统

- 指标卡片: `repeat(5, 1fr)` → `repeat(3, 1fr)` → `repeat(2, 1fr)`
- 表单: `repeat(4, 1fr)` → `repeat(2, 1fr)` → `1fr`
- 导航磁贴: `repeat(auto-fill, minmax(220px, 1fr))`

---

## 6. CSS 变量完整列表

> 与 `web/src/styles/variables.css` 逐字对应；该文件是运行时实现，本列表是它的人读镜像。
> 另注意：Naive UI 组件调色板在 `web/src/App.vue` 的 `themeOverrides` 中由**同一组值**驱动 —— 只改本列表不会让 NButton/NCard/NInput 变。

```css
:root {
  /* Surface ladder（唯一深度语言） */
  --q-bg: #090a0c;
  --q-surface: #111620;
  --q-surface2: #171e2c;
  --q-surface3: #1e2638;

  /* Border */
  --q-border: #5a6070;          /* 组件边界 3.15:1 */
  --q-border-light: #2a3449;    /* 装饰 hairline，不可作唯一可辨识边界 */

  /* Text（三级全部 ≥4.5:1） */
  --q-text: #e1e2eb;
  --q-text2: #c3c6d7;
  --q-text3: #94a3b8;

  /* 确定性通道 */
  --q-primary: #b4c5ff;         /* 文字/图标/链接 —— 不可作填充 */
  --q-primary-dark: #2563eb;    /* 填充 */
  --q-primary-light: #dbe1ff;

  /* 概率性 / AI 通道 */
  --q-ai: #7c3aed;              /* AI 填充（白字 5.70:1） */
  --q-ai-text: #d0bcff;         /* AI 文字/徽标 */
  --q-ai-light: #a78bfa;
  --q-ai-aura: rgba(139, 92, 246, 0.25);
  --q-ai-wash: linear-gradient(180deg, rgba(139, 92, 246, 0.04) 0%, transparent 100%);

  /* 状态三值（K9） */
  --q-success: #10b981;
  --q-warning: #f59e0b;
  --q-danger: #ef4444;
  --q-danger-text: #f87171;     /* 浮层失败小字（#ef4444 在 e3 上仅 4.02:1） */
  --q-info: #b4c5ff;
  --q-focus: #b4c5ff;           /* 焦点环，不得移除 */

  /* Shape */
  --q-radius: 8px;
  --q-radius-sm: 4px;
  --q-radius-xs: 2px;
  --q-shadow: none;
  --q-shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.08);

  /* Motion */
  --q-transition: 0.2s ease;    /* prefers-reduced-motion 下自动降至 0.01ms */

  /* Typography */
  --q-font: 'Inter', 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI',
            'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', Roboto, sans-serif;
  --q-mono: 'JetBrains Mono', 'Noto Sans Mono CJK SC', 'Fira Code', monospace;

  /* Layout */
  --q-sidebar-width: 220px;
  --q-header-height: 56px;
}
```

---

## 更新记录

| 日期 | 变更 |
|---|---|
| 2026-10-13 | **v2.0 token 合一**：本文件降级为**人读视图**，真相源改指 `DESIGN.md` v2.0。色彩/字体/圆角/阴影全部按新设计重定值；新增 §1.3 双通道、§1.4 状态三值、§2.1.1 数字严格性；修 `--q-text3` 2.28:1 既有缺陷；`--q-warning` 由零消费升格为 K9 一等公民；废抬升式 hover；补 CJK 字体栈并登记"字体未加载"待决。依据 [ODR-066](../../../quant-trading-docs/docs/archive/odr/odr-066-stitch-design-review-and-boundary-ruling.md) |
