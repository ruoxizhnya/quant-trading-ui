<template>
  <aside class="app-sidebar" :class="{ collapsed }">
    <div class="sidebar-brand">
      <n-icon size="22" class="brand-icon"><TrendingUpOutline /></n-icon>
      <span v-if="!collapsed" class="brand-text">Quant Lab</span>
    </div>

    <nav
      class="sidebar-nav"
      aria-label="主导航"
    >
      <div v-for="group in navGroups" :key="group.title" class="nav-group">
        <div v-if="!collapsed" class="nav-group-title">{{ group.title }}</div>
        <router-link
          v-for="item in group.items"
          :key="item.path"
          :to="item.path"
          class="nav-item"
          :data-nav-path="item.path"
          :class="{ active: item.path === activePath }"
          :aria-current="item.path === activePath ? 'page' : undefined"
        >
          <n-icon size="20"><component :is="item.icon" /></n-icon>
          <span v-if="!collapsed" class="nav-label">{{ item.label }}</span>
        </router-link>
      </div>
    </nav>
  </aside>
</template>

<script setup lang="ts">
import { computed, markRaw } from 'vue'
import { useRoute } from 'vue-router'
import {
  HomeOutline,
  AnalyticsOutline,
  SearchOutline,
  ChatbubbleEllipsesOutline,
  BeakerOutline,
  TrendingUpOutline,
  CloudDownloadOutline,
  NotificationsOutline,
  GitCompareOutline,
  ConstructOutline,
  DocumentTextOutline,
  StatsChartOutline,
  FlaskOutline,
} from '@vicons/ionicons5'
import { NIcon } from 'naive-ui'

defineProps<{ collapsed: boolean }>()

const route = useRoute()

/**
 * 标签唯一真相源：user-flows.md §3.2 目标 IA。此前同一页在四处有四种叫法
 * （选股器 / 全市场选股 / 选股与市场、数据同步 / 数据通道 / 数据管道 …），
 * 设计稿每屏各写一遍，全站没有一套导航。此处只允许引 §3.2 的词。
 *
 * 分组沿用 §3.2 的四段；`研究主线` 的 审阅台 / 研究日志 与 `系统` 整段尚未落地
 * （B-02 / B-03 / F17 / F18），**不渲染空入口** —— 点了没反应的导航比没有更糟。
 */
const navGroups = [
  { title: '总览', items: [{ path: '/', label: '控制台', icon: markRaw(HomeOutline) }] },
  {
    title: '研究主线',
    items: [
      { path: '/explore', label: '探索观察', icon: markRaw(FlaskOutline) },
      { path: '/evidence', label: '证据质问', icon: markRaw(DocumentTextOutline) },
    ],
  },
  {
    title: '仪器房',
    items: [
      { path: '/backtest', label: '回测引擎', icon: markRaw(AnalyticsOutline) },
      { path: '/backtest/compare', label: '多策略对比', icon: markRaw(GitCompareOutline) },
      { path: '/strategy-lab', label: '策略库', icon: markRaw(BeakerOutline) },
      { path: '/strategy-builder', label: '策略编辑器', icon: markRaw(ConstructOutline) },
      { path: '/copilot', label: '策略 Copilot', icon: markRaw(ChatbubbleEllipsesOutline) },
      { path: '/factors', label: '因子研究', icon: markRaw(StatsChartOutline) },
      { path: '/screener', label: '选股与市场', icon: markRaw(SearchOutline) },
      { path: '/data-sync', label: '数据管理', icon: markRaw(CloudDownloadOutline) },
    ],
  },
  { title: '监控', items: [{ path: '/alerts', label: '风险告警', icon: markRaw(NotificationsOutline) }] },
]

/**
 * 高亮唯一：旧实现用 `route.path.startsWith(item.path)`，于是在 /backtest/compare 上
 * 「回测引擎」与「多策略对比」**同时高亮**（后者是前者的字符串前缀）。改为取最长匹配。
 */
const activePath = computed(() => {
  const p = route.path
  let best = ''
  for (const group of navGroups) {
    for (const item of group.items) {
      const hit = item.path === '/' ? p === '/' : p === item.path || p.startsWith(`${item.path}/`)
      if (hit && item.path.length > best.length) best = item.path
    }
  }
  return best
})
</script>

<style scoped>
.app-sidebar {
  width: var(--q-sidebar-width);
  background: var(--q-surface);
  border-right: 1px solid var(--q-border);
  display: flex;
  flex-direction: column;
  transition: width 0.2s ease;
  flex-shrink: 0;
  overflow: hidden;
}

.app-sidebar.collapsed { width: 60px; }

.sidebar-brand {
  height: var(--q-header-height);
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 16px;
  border-bottom: 1px solid var(--q-border);
}

/* 品牌图标色走 CSS：color 若落到 SVG 呈现属性，var() 会静默失效 */
.sidebar-brand .brand-icon {
  color: var(--q-primary);
}

.brand-text { font-size: 16px; font-weight: 700; color: var(--q-text); white-space: nowrap; }

.sidebar-nav {
  flex: 1;
  padding: 12px 8px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow-y: auto;
}

.nav-group { display: flex; flex-direction: column; gap: 4px; }

.nav-group-title {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--q-text3);
  padding: 0 14px 4px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-radius: var(--q-radius-sm);
  color: var(--q-text2);
  text-decoration: none;
  transition: all var(--q-transition);
  white-space: nowrap;
}

.nav-item:hover { background: var(--q-surface2); color: var(--q-text); }
.nav-item.active {
  background: var(--q-primary-soft);
  color: var(--q-primary);
  box-shadow: inset 0 0 0 1px var(--q-primary-edge);
}
/* 焦点环是键盘可达性的承重件（DESIGN.md §7：≥3:1，不得移除） */
.nav-item:focus-visible {
  outline: 2px solid var(--q-focus);
  outline-offset: 1px;
}
.nav-item .nav-label { font-size: 13px; }
</style>
