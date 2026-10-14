<template>
  <div class="nav-tiles">
    <router-link v-for="tile in tiles" :key="tile.to" :to="tile.to" class="nav-tile" :style="{ '--accent': tile.color }">
      <component :is="tile.icon" class="tile-icon" />
      <div class="tile-text">
        <div class="tile-title">{{ tile.title }}</div>
        <div class="tile-desc">{{ tile.desc }}</div>
      </div>
      <n-icon class="tile-arrow"><ChevronForward /></n-icon>
    </router-link>
  </div>
</template>

<script setup lang="ts">
import { h } from 'vue'
import { RouterLink } from 'vue-router'
import { NIcon } from 'naive-ui'
import {
  AnalyticsOutline,
  FlashOutline,
  SearchOutline,
  ChatbubblesOutline,
  SettingsOutline,
} from '@vicons/ionicons5'
import { ChevronForward } from '@vicons/ionicons5'

interface NavTile {
  to: string
  icon: ReturnType<typeof h>
  title: string
  desc: string
  color: string
}

// accent 是装饰性标识色：确定性磁贴从 §0.2 系列带取（系列带无状态语义，可借），
// AI Copilot 必须走概率通道 --q-ai-text —— 这条不是配色偏好，是 DESIGN.md §3 双通道硬规则。
const tiles: NavTile[] = [
  { to: '/backtest', icon: h(NIcon, null, () => h(AnalyticsOutline)), title: '回测引擎', desc: '单股票/组合回测分析', color: 'var(--q-primary)' },
  { to: '/screener', icon: h(NIcon, null, () => h(SearchOutline)), title: '选股与市场', desc: '多因子筛选与排名', color: 'var(--q-series-2)' },
  { to: '/strategy-lab', icon: h(NIcon, null, () => h(SettingsOutline)), title: '策略库', desc: '策略管理与参数优化', color: 'var(--q-series-3)' },
  { to: '/copilot', icon: h(NIcon, null, () => h(ChatbubblesOutline)), title: '策略 Copilot', desc: '智能策略生成助手', color: 'var(--q-ai-text)' },
  { to: '/dashboard?tab=batch', icon: h(NIcon, null, () => h(FlashOutline)), title: '批量回测', desc: '多策略多标的对比', color: 'var(--q-series-5)' },
]
</script>

<style scoped>
.nav-tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }

.nav-tile {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border-radius: var(--q-radius);
  border: 1px solid var(--q-border);
  cursor: pointer;
  transition: all var(--q-transition);
  text-decoration: none;
  color: inherit;
}

.nav-tile:hover {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent);
  transform: translateY(-1px);
}

/* tile.icon 是 setup 里 h() 出来的 VNode，拿不到本组件的 scoped 属性 ——
   写成 .tile-icon {} 会**整条静默失效**（颜色与 24px 字号此前都没生效），必须 :deep() */
.nav-tile :deep(.tile-icon) {
  font-size: 24px;
  color: var(--accent);
  flex-shrink: 0;
}

.tile-text { flex: 1; min-width: 0; }
.tile-title { font-size: 13px; font-weight: 700; color: var(--q-text); }
.tile-desc { font-size: 11px; color: var(--q-text3); margin-top: 2px; }

.tile-arrow { font-size: 16px; color: var(--q-text3); flex-shrink: 0; }

@media (max-width: 640px) {
  .nav-tiles { grid-template-columns: 1fr; }
}
</style>
