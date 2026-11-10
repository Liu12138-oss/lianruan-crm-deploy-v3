<script setup lang="ts">
import ApprovalCenterPage from "../approval/ApprovalCenterPage.vue";
</script>

<template>
  <div class="渠道资质审核页">
    <div class="渠道资质返回行">
      <RouterLink class="返回按钮" to="/admin/partners">← 返回渠道商列表</RouterLink>
    </div>
    <ApprovalCenterPage
      :限定渠道资质="true"
      页面标题="渠道资质审核"
      页面说明="仅展示渠道商建档与资质审核记录，账号审批仍保留在审核中心统一处理。"
    />
  </div>
</template>

<style scoped>
.渠道资质审核页 {
  min-height: 100%;
}

.渠道资质返回行 {
  /* 与渠道成员维护等标准页头对齐：内容起点 x=53、y=109。 */
  padding: 23px 25px 0;
}
</style>
