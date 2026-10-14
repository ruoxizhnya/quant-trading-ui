<template>
  <n-config-provider
    :theme="darkTheme"
    :theme-overrides="themeOverrides"
    :locale="zhCN"
  >
    <n-notification-provider>
      <n-message-provider>
        <n-dialog-provider>
          <router-view />
        </n-dialog-provider>
      </n-message-provider>
    </n-notification-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
import { darkTheme, zhCN, NConfigProvider, NNotificationProvider, NMessageProvider, NDialogProvider } from 'naive-ui'
import type { GlobalThemeOverrides } from 'naive-ui'
import { palette } from '@/styles/palette'

/**
 * Naive UI 组件调色板 —— 与 web/src/styles/variables.css 同源（两者均派生自 DESIGN.md v2.0）。
 * 字面量一律取自 @/styles/palette，漂移由 styles/palette.test.ts 机器钉住。
 *
 * 此前只传 :theme="darkTheme" 而无 overrides，导致所有 N 组件（按钮/卡片/输入/表格/下拉）
 * 走 Naive 自带调色板，与 --q-* 各画各的 —— 改 variables.css 不会让组件变。
 *
 * primaryColor 是**填充**语义（NButton type=primary 上叠白字），故取 primaryFill #2563eb
 * 而非文字态的 primary #b4c5ff —— 后者作填充时白字对比度不达标。
 */
const themeOverrides: GlobalThemeOverrides = {
  common: {
    // 表面阶梯
    bodyColor: palette.canvas,
    cardColor: palette.surface1,
    modalColor: palette.surface3,
    popoverColor: palette.surface3,
    tableColor: palette.surface1,
    tableColorHover: palette.surface2,
    actionColor: palette.surface2,
    borderColor: palette.border,
    dividerColor: palette.hairline,
    // 输入框底走的是 common.inputColor，不覆写会留在 Naive 自带的 rgba(255,255,255,0.1)
    inputColor: palette.surface1,

    // 文字三级
    textColorBase: palette.text,
    textColor1: palette.text,
    textColor2: palette.text2,
    textColor3: palette.text3,
    placeholderColor: palette.text3,

    // 确定性通道
    primaryColor: palette.primaryFill,
    primaryColorHover: palette.primaryFillHover,
    primaryColorPressed: palette.primaryFillPressed,
    primaryColorSuppl: palette.primaryFill,
    infoColor: palette.primaryFill,
    infoColorHover: palette.primaryFillHover,
    infoColorPressed: palette.primaryFillPressed,

    // 状态三值（K9）
    successColor: palette.success,
    successColorHover: palette.successHover,
    successColorPressed: palette.successPressed,
    warningColor: palette.warning,
    warningColorHover: palette.warningHover,
    warningColorPressed: palette.warningPressed,
    errorColor: palette.danger,
    errorColorHover: palette.dangerHover,
    errorColorPressed: palette.dangerPressed,

    // 形状与字体
    borderRadius: '4px',
    fontFamily: "'Inter', 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', Roboto, sans-serif",
  },
  Tag: { borderRadius: '2px' },
  Card: { borderRadius: '8px' },
  Dialog: { borderRadius: '8px' },
  /**
   * Naive 暗色主题把 primary/info 实心按钮的文字派生成 #000。压在 #2563eb 上只有
   * 4.06:1，不达 4.5:1 —— 实测自真实页面（--n-text-color: #000），非推断。
   * 按 DESIGN.md §6.1 改回白字（5.17:1）。success/warning/error 实心钮的黑字
   * 分别约 8.4 / 9.0 / 6.2:1，达标，故不覆写，保持最小改动面。
   */
  Button: {
    textColorPrimary: '#ffffff',
    textColorPrimaryHover: '#ffffff',
    textColorPrimaryPressed: '#ffffff',
    textColorPrimaryFocus: '#ffffff',
    textColorInfo: '#ffffff',
    textColorInfoHover: '#ffffff',
    textColorInfoPressed: '#ffffff',
    textColorInfoFocus: '#ffffff',
  },
}
</script>

<style>
body {
  margin: 0;
  background: var(--q-bg);
}
#app {
  width: 100%;
  min-height: 100vh;
}
</style>
