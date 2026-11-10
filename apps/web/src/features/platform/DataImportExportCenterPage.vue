<script setup lang="ts">
import { ElMessage } from "element-plus";
import { ref } from "vue";
import { useRouter } from "vue-router";

import {
  下载导入模板,
  type 业务导入类型,
  type 业务导出类型,
  导出业务数据,
} from "../../api/business-import-client.js";

interface 导入入口 {
  标题: string;
  描述: string;
  路径: string;
  标签: string;
}

const 路由器 = useRouter();
const 处理中 = ref("");

/** 只提供既有导入页面的统一入口，不复制导入逻辑，避免与各业务模块形成两套实现。 */
const 导入入口列表: 导入入口[] = [
  {
    标题: "客户报备导入",
    描述: "批量导入客户报备，先预检行级错误，再确认落库并下载错误报告。",
    路径: "/admin/registration/import",
    标签: "客户",
  },
  {
    标题: "商机导入",
    描述: "批量导入商机，校验客户、阶段和负责人后生成导入任务。",
    路径: "/admin/opportunity/import",
    标签: "商机",
  },
  {
    标题: "渠道商导入",
    描述: "批量导入渠道主档和层级关系，预检通过后统一建档。",
    路径: "/admin/partners/import",
    标签: "渠道",
  },
  {
    标题: "员工账号导入",
    描述: "批量导入内部员工账号与任职关系，支持错误报告下载。",
    路径: "/admin/users/import",
    标签: "账号",
  },
  {
    标题: "组织部门导入导出",
    描述: "在组织与岗位页面导入部门、导出组织树，并维护子部门。",
    路径: "/admin/organization/units",
    标签: "组织",
  },
];

const 导出类型: Array<{
  类型: 业务导出类型;
  名称: string;
  说明: string;
  可下载模板: boolean;
}> = [
  {
    类型: "registrations",
    名称: "客户报备",
    说明: "导出全部客户报备主档及保护状态。",
    可下载模板: true,
  },
  {
    类型: "opportunities",
    名称: "商机",
    说明: "导出商机名称、客户、金额与阶段。",
    可下载模板: true,
  },
  {
    类型: "partners",
    名称: "渠道商",
    说明: "导出渠道商主档、区域、联系人和层级。",
    可下载模板: true,
  },
  {
    类型: "staff",
    名称: "渠道员工",
    说明: "导出渠道成员登录账号、姓名与所属渠道商。",
    可下载模板: true,
  },
  {
    类型: "orders",
    名称: "订单",
    说明: "导出订单金额、渠道价格、履约状态与收货信息。",
    可下载模板: false,
  },
];

async function 下载模板(类型: 业务导入类型, 名称: string) {
  if (处理中.value) return;
  处理中.value = `模板-${类型}`;
  try {
    const 结果 = await 下载导入模板(类型);
    保存文件(结果.内容, 结果.文件名);
    ElMessage.success(`${名称}导入模板已下载。`);
  } catch (异常) {
    ElMessage.error(异常 instanceof Error ? 异常.message : "模板下载失败。");
  } finally {
    处理中.value = "";
  }
}

function 下载模板行(项: { 类型: 业务导出类型; 名称: string }) {
  if (项.类型 === "orders") return;
  下载模板(项.类型, 项.名称);
}

async function 导出数据(类型: 业务导出类型, 名称: string) {
  if (处理中.value) return;
  处理中.value = `导出-${类型}`;
  try {
    const 结果 = await 导出业务数据(类型);
    保存文件(结果.内容, 结果.文件名);
    ElMessage.success(`${名称}数据已导出。`);
  } catch (异常) {
    ElMessage.error(异常 instanceof Error ? 异常.message : "数据导出失败。");
  } finally {
    处理中.value = "";
  }
}

function 保存文件(内容: Blob, 名称: string) {
  const 地址 = URL.createObjectURL(内容);
  const 链接 = document.createElement("a");
  链接.href = 地址;
  链接.download = 名称;
  document.body.appendChild(链接);
  链接.click();
  document.body.removeChild(链接);
  URL.revokeObjectURL(地址);
}
</script>

<template>
  <section class="数据导入导出页">
    <header class="页面说明">
      <div>
        <h2>数据导入导出</h2>
        <p>从统一入口进入各业务模块的正式导入页面；导入前均需预检，失败行可下载错误报告。</p>
      </div>
    </header>

    <div class="导入入口网格">
      <article v-for="入口 in 导入入口列表" :key="入口.路径" class="导入入口卡片">
        <span class="入口标签">{{ 入口.标签 }}</span>
        <h3>{{ 入口.标题 }}</h3>
        <p>{{ 入口.描述 }}</p>
        <button type="button" class="button primary small" @click="路由器.push(入口.路径)">
          进入{{ 入口.标题 }}
        </button>
      </article>
    </div>

    <section class="导出面板">
      <header class="导出面板头">
        <div>
          <h2>模板下载与数据导出</h2>
          <p>模板与后端导入校验使用同一份字段定义；导出结果与当前业务数据范围一致。</p>
        </div>
      </header>
      <div class="导出表格">
        <div class="导出表头">
          <span>业务类型</span><span>说明</span><span>导入模板</span><span>导出数据</span>
        </div>
        <div v-for="项 in 导出类型" :key="项.类型" class="导出行">
          <strong>{{ 项.名称 }}</strong>
          <span>{{ 项.说明 }}</span>
          <button
            v-if="项.可下载模板"
            type="button"
            class="次要按钮"
            :disabled="!!处理中"
            @click="下载模板行(项)"
          >
            {{ 处理中 === `模板-${项.类型}` ? "下载中…" : "下载模板" }}
          </button>
          <span v-else class="不适用">订单仅支持导出</span>
          <button
            type="button"
            class="次要按钮"
            :disabled="!!处理中"
            @click="导出数据(项.类型, 项.名称)"
          >
            {{ 处理中 === `导出-${项.类型}` ? "导出中…" : "导出数据" }}
          </button>
        </div>
      </div>
      <p class="导出说明">
        订单必须由报价单转单生成，不提供 Excel
        直接导入，避免绕过报价、价格、收货与审批链路；订单中心提供按当前筛选导出。
      </p>
    </section>
  </section>
</template>

<style scoped>
.数据导入导出页 {
  display: grid;
  gap: 18px;
  color: #172b4d;
}
.页面说明,
.导入入口卡片 {
  border: 1px solid #dce7f3;
  border-radius: 10px;
  background: #ffffff;
  box-shadow: 0 8px 22px rgb(31 70 120 / 6%);
}
.导出面板 {
  overflow: hidden;
  border: 1px solid #dce7f3;
  border-radius: 10px;
  background: #ffffff;
  box-shadow: 0 8px 22px rgb(31 70 120 / 6%);
}
.导出面板头 {
  padding: 18px 20px;
  border-bottom: 1px solid #e7eef6;
}
.导出面板头 h2 {
  margin: 0;
  color: #172b4d;
  font-size: 16px;
}
.导出面板头 p {
  margin: 6px 0 0;
  color: #60758e;
  font-size: 12px;
}
.导出表格 {
  display: grid;
}
.导出表头,
.导出行 {
  display: grid;
  grid-template-columns: 110px minmax(0, 1fr) 110px 110px;
  align-items: center;
  gap: 12px;
  padding: 11px 20px;
  border-bottom: 1px solid #eef3f9;
}
.导出表头 {
  background: #f5f9fe;
  color: #5d7590;
  font-size: 11px;
  font-weight: 700;
}
.导出行 strong {
  color: #233d59;
  font-size: 12px;
}
.导出行 span {
  color: #667d96;
  font-size: 11px;
}
.次要按钮 {
  min-height: 30px;
  border: 1px solid #d5e2f0;
  border-radius: 8px;
  background: #ffffff;
  color: #2d5c91;
  font: inherit;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}
.次要按钮:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.导出说明 {
  margin: 0;
  padding: 12px 20px;
  color: #7a8ca0;
  background: #fbfdff;
  font-size: 11px;
  line-height: 1.6;
}
.不适用 {
  color: #8a9aab;
  font-size: 11px;
  text-align: center;
}
@media (max-width: 760px) {
  .导出表头 {
    display: none;
  }
  .导出行 {
    grid-template-columns: 1fr auto auto;
  }
  .导出行 > span {
    grid-column: 1 / -1;
  }
}
.页面说明 {
  padding: 20px 24px;
}
.页面说明 h2,
.导入入口卡片 h3 {
  margin: 0;
  color: #172b4d;
}
.页面说明 p,
.导入入口卡片 p {
  margin: 8px 0 0;
  color: #60758e;
  line-height: 1.7;
}
.导入入口网格 {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 14px;
}
.导入入口卡片 {
  display: grid;
  align-content: start;
  gap: 10px;
  padding: 18px 20px;
}
.入口标签 {
  width: fit-content;
  padding: 3px 9px;
  border-radius: 999px;
  background: #edf4ff;
  color: #2f69ed;
  font-size: 11px;
  font-weight: 700;
}
.导入入口卡片 button {
  justify-self: start;
  margin-top: 4px;
}
</style>
