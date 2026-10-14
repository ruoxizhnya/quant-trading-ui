# Quant Lab 设计系统

> **版本**: 1.0
> **日期**: 2026-05-03
> **状态**: Active
> **适用范围**: Quant Lab 前端 (Vue 3 + Naive UI)
>
> ⚠️ **目录语义边界 (2026-09-15, ODR-047 DR-8；2026-10-08 微调)**: 本目录（`docs/design/`）根下**专指前端设计系统**。其他设计规格**不得**直接平铺在根下 —— 放入独立子目录：
> - [`design/equitydeep/`](equitydeep/) — EquityDeep 纵向深研规格（工作面 1，上位定义见 [PRODUCT.md](../PRODUCT.md)）
> - [`design/kernel/`](kernel/) — **后端架构设计**（模块化内核目标架构等，2026-10-08 起）

---

## 目录

**前端设计系统（根下）**

1. [设计原则](principles.md) — 核心设计理念与决策准则
2. [视觉规范](visual.md) — 色彩、字体、间距、布局（⚠️ **人读视图**；token 唯一真相源已收敛到 [DESIGN.md v2.0](stitch_quantlab_ux_redesign/obsidian_precision_quant/DESIGN.md)，运行时实现是 `web/src/styles/variables.css` + `palette.ts`）
3. [组件库](components.md) — 自定义组件使用规范
4. [交互规范](interaction.md) — 状态、动画、反馈模式
5. [用户流程与场景规划](user-flows.md) — UI 重构的 user flows / scenarios / API 映射 / 后端缺口（2026-10-13）
   - [Stitch 设计稿逐屏标注](stitch_quantlab_ux_redesign/ANNOTATIONS.md) — 12 屏逐控件 → API 端点处置清单（留/改/删/待后端/装饰 + 横切 6 项 + 缺屏 5 项 + 施工优先级），依 [ODR-066](../../../quant-trading-docs/docs/archive/odr/odr-066-stitch-design-review-and-boundary-ruling.md)（2026-10-13）
   - [重构任务台账 TASKS](stitch_quantlab_ux_redesign/TASKS.md) — **UI 重构唯一任务台账**：A-01~A-11 可做 / B-01~B-06 延后（ai-service 未就绪）/ G1~G9 后端缺口，每任务 6 条可判定断言 + 取证方式（2026-10-13）
6. [页面设计文档](pages/)
   - [控制台 Dashboard](pages/dashboard.md)
   - [回测引擎 BacktestEngine](pages/backtest-engine.md)
   - [选股器 Screener](pages/screener.md)
   - [策略实验室 StrategyLab](pages/strategy-lab.md)
   - [策略 Copilot](pages/copilot.md)
   - [数据同步 DataSync](pages/data-sync.md)

**后端架构设计（子目录）**

7. [模块化内核目标架构](kernel/target-architecture-modular-kernel.md) — 回测/实盘同构 + 双模式策略接口 + 四层表达力（2026-10-08，Draft 已拍板 D1–D5）

---

## 快速开始

### 设计 Token 变量

所有设计值通过 CSS 变量统一管理，定义于 [`web/src/styles/variables.css`](../../web/src/styles/variables.css)：

```css
:root {
  --q-bg: #0d1117;           /* 页面背景 */
  --q-surface: #161b22;      /* 卡片背景 */
  --q-surface2: #1c2333;     /* 次级背景 */
  --q-text: #e6edf3;         /* 主文本 */
  --q-text2: #8b949e;        /* 次级文本 */
  --q-primary: #58a6ff;      /* 主题色 */
  --q-success: #3fb950;      /* 正收益/成功 */
  --q-danger: #f85149;       /* 负收益/错误 */
  --q-radius: 10px;          /* 圆角 */
}
```

### 文件组织

```
web/src/
├── styles/
│   ├── variables.css    # 设计 Token
│   └── global.css       # 全局样式
├── components/          # 组件库
│   ├── layout/          # 布局组件
│   ├── dashboard/       # 控制台组件
│   └── backtest/        # 回测组件
└── pages/               # 页面级组件
```

---

## 设计原则速查

| 原则 | 说明 | 示例 |
|------|------|------|
| **数据优先** | 金融数据清晰可读，数字使用等宽字体 | 收益率 `+12.34%` 使用 JetBrains Mono |
| **状态明确** | 正/负收益用颜色区分，但不依赖颜色 alone | 收益同时显示 `+` / `-` 符号 |
| **暗色优先** | 长时间盯盘场景，降低视觉疲劳 | 全局暗色主题，高对比度文字 |
| **响应式** | 从 4K 到笔记本都能良好展示 | 网格布局 + 断点适配 |
| **即时反馈** | 操作后 100ms 内给出视觉反馈 | 按钮 hover、loading 状态 |

---

## 更新记录

| 日期 | 版本 | 变更 |
|------|------|------|
| 2026-05-03 | 1.0 | 初始版本，整合所有页面设计文档 |
