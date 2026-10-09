# quant-trading-ui

Quant Lab 的**前端**（Vue 3 + Vite + Naive UI）。从 monorepo `quant-trading` 拆出（2026-10-09）。

## 定位与边界

本仓只含**呈现层**。后端（回测引擎、策略运行时、数据供给、AI 实验员）在
[`quant-trading`](https://github.com/ruoxizhnya/quant-trading)，AI 层在
[`quant-trading-agent`](https://github.com/ruoxizhnya/quant-trading-agent)，
跨领域文档在 [`quant-trading-docs`](https://github.com/ruoxizhnya/quant-trading-docs)。

切分判据是 **DDD**：本仓只放「前端这个领域自己的东西」——
组件/交互/视觉规范、页面设计、playwright 端到端用例、前端构建与托管配置。

## 目录

| 路径 | 内容 |
|---|---|
| `web/` | 前端源码（Vue 3 + Vite）。原 monorepo 的 `web/`，路径未变 |
| `e2e/` | playwright 端到端用例（`.spec.ts`）与 helpers |
| `docs/design/` | **前端设计系统**：`index.md`（入口）、`principles.md`、`visual.md`、`components.md`、`interaction.md`、页面设计 `pages/` |
| `Dockerfile` | 前端镜像构建 → nginx 托管（原 `Dockerfile.web`） |
| `deploy/nginx-spa.conf` | nginx 配置：`/api` 反代到后端 analysis-service |

## ⚠️ 跨仓契约：OpenAPI 不要复制

后端 API 契约 `openapi.yaml` **留在 `quant-trading`（core）仓**——它被 Go 的
`//go:embed` 嵌进二进制（运行时 `GET /api/openapi.yaml` 直出），搬走会让 core 构建失败。

本仓**不得**复制一份 openapi.yaml。要用契约时：

- 从运行中的后端取：`GET http://<analysis-service>:8085/api/openapi.yaml`
- 或从 core 仓源码读：`quant-trading/docs/openapi.yaml`

复制契约 = 两份真相，必然漂移（这是本项目已反复出现的一类缺陷）。

## 本地开发

```bash
cd web
npm ci          # 用 ci 而非 install：lockfile 不同步时直接失败
npm run dev     # vite dev server
npm run lint && npm run typecheck && npm test
```

端到端用例（playwright）需要**后端先起来**——它们打的是真实 API
（`api-health` / `api-backtest` / `api-strategy` 等 spec）。后端起法见
core 仓的 `docs/TEST.md` 与 `docs/guides/local-dev.md`。

```bash
cd e2e
npm ci
npx playwright test
```

## 设计文档

前端设计系统的入口是 [`docs/design/index.md`](docs/design/index.md)。注意原
monorepo 里 `docs/design/` 根下的语义就是「前端设计系统」，内核蓝图
（`docs/design/kernel/`）与功能规格（`docs/design/equitydeep/`）**不属于本仓**。
