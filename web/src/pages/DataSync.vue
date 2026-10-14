<script setup lang="ts">
import { NSpace, NGrid, NGridItem, NH1 } from 'naive-ui'
import JobQueuePanel from '@/components/sync/JobQueuePanel.vue'
import SchedulePanel from '@/components/sync/SchedulePanel.vue'
import SyncReadoutPanel from '@/components/sync/SyncReadoutPanel.vue'
import DataQualityPanel from '@/components/sync/DataQualityPanel.vue'
import DataSourcePanel from '@/components/sync/DataSourcePanel.vue'
import DataImportForm from '@/components/sync/DataImportForm.vue'
</script>

<template>
  <div class="data-sync-page">
    <NH1>数据管理</NH1>

    <!-- A-08：主区是作业队列（列表 / 筛选 / 详情 / 取消 / 重试），
         数据源与导入是辅区 —— 导入本身就是"往队列里加一条作业"，
         所以它排在队列后面，看得见自己刚创建的那条。 -->
    <JobQueuePanel />

    <!-- 排程是队列的上游：这里改一行配置，到点就该在队列里多一条作业。 -->
    <SchedulePanel class="data-sync-schedules" />

    <NSpace vertical :size="16" class="data-sync-secondary">
      <NGrid :cols="2" :x-gap="16" :y-gap="16" responsive="screen">
        <NGridItem>
          <SyncReadoutPanel />
        </NGridItem>

        <NGridItem>
          <DataSourcePanel />
        </NGridItem>
      </NGrid>

      <DataQualityPanel />

      <DataImportForm />
    </NSpace>
  </div>
</template>

<style scoped>
.data-sync-page {
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
}

.data-sync-secondary {
  margin-top: 16px;
  width: 100%;
}

.data-sync-schedules {
  margin-top: 16px;
}
</style>
