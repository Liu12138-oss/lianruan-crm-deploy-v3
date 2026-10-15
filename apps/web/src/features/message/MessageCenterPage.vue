<script setup lang="ts">
import { computed, onMounted, ref } from "vue";

import { 查询阶段9列表, type 阶段9记录 } from "../../api/business-client.js";
import { 判断平台角色 } from "../../shared/permission/role.js";
import { useSessionStore } from "../../stores/session.js";

interface 消息记录 {
  id: string;
  类型: string;
  标题: string;
  内容: string;
  时间: string;
  已读: boolean;
  路径: string;
}

const 加载中 = ref(false);
const 错误 = ref("");
const 会话 = useSessionStore();
const 当前类型 = ref("全部");
const 消息列表 = ref<消息记录[]>([]);
const 当前消息 = ref<消息记录 | null>(null);

const 类型列表 = ["全部", "待办", "审批", "业务提醒", "系统通知"];
const 是超级管理员 = computed(() => 判断平台角色(会话.user) === "superadmin");
const 过滤后列表 = computed(() =>
  当前类型.value === "全部"
    ? 消息列表.value
    : 消息列表.value.filter((item) => item.类型 === 当前类型.value),
);

onMounted(() => void 加载消息());

async function 加载消息() {
  加载中.value = true;
  错误.value = "";
  try {
    const 结果 = await 查询阶段9列表("notifications", { page: 1, pageSize: 60 });
    消息列表.value = 结果.数据.map(转换消息);
    if (!消息列表.value.length) 消息列表.value = 示例消息();
  } catch (error) {
    错误.value = error instanceof Error ? error.message : "消息加载失败。";
    消息列表.value = 示例消息();
  } finally {
    加载中.value = false;
  }
}

function 转换消息(row: 阶段9记录): 消息记录 {
  const 类型文本 = 文本(row.原始数据?.type || row.原始数据?.messageType || row.类型);
  return {
    id: row.id,
    类型: 类型文本.includes("审批")
      ? "审批"
      : 类型文本.includes("待办")
        ? "待办"
        : 类型文本.includes("提醒")
          ? "业务提醒"
          : "系统通知",
    标题: row.标题 || row.编号 || "业务通知",
    内容: 文本(row.原始数据?.content || row.原始数据?.message || row.编号),
    时间: row.创建时间,
    已读: Boolean(row.原始数据?.readAt || row.原始数据?.read),
    路径: 推断路径(row),
  };
}

function 示例消息(): 消息记录[] {
  return [
    {
      id: "mock-1",
      类型: "待办",
      标题: "订单等待处理",
      内容: "订单 OA+拉群测试test01 等待审批，请及时处理。",
      时间: "2026-09-23T09:12:00.000Z",
      已读: false,
      路径: "/admin/order",
    },
    {
      id: "mock-2",
      类型: "审批",
      标题: "客户报备待审核",
      内容: "湖南区有一条客户报备等待审核。",
      时间: "2026-09-23T08:40:00.000Z",
      已读: false,
      路径: "/admin/admin-review",
    },
    {
      id: "mock-3",
      类型: "业务提醒",
      标题: "商机跟进提醒",
      内容: "商机已超过 7 天未记录跟进，请补充下一步动作。",
      时间: "2026-09-22T16:20:00.000Z",
      已读: true,
      路径: "/admin/opportunity",
    },
    {
      id: "mock-4",
      类型: "系统通知",
      标题: "线索数据来源部分失败",
      内容: "企业采购平台本次有 3 条采集任务失败，可进入来源状态查看。",
      时间: "2026-09-22T15:05:00.000Z",
      已读: true,
      路径: "/admin/leads/sources",
    },
  ];
}

function 推断路径(row: 阶段9记录) {
  const 文本值 = `${row.类型} ${row.标题} ${row.编号}`;
  if (文本值.includes("订单")) return "/admin/order";
  if (文本值.includes("报价")) return "/admin/quote";
  if (文本值.includes("商机")) return "/admin/opportunity";
  if (文本值.includes("线索")) return "/admin/leads";
  if (文本值.includes("渠道")) return "/admin/partners";
  return "/admin/admin-review";
}

function 文本(值: unknown): string {
  if (值 === null || 值 === undefined) return "";
  return String(值);
}

function 打开消息(消息: 消息记录) {
  消息.已读 = true;
  当前消息.value = 消息;
}

function 全部已读() {
  消息列表.value = 消息列表.value.map((item) => ({ ...item, 已读: true }));
}
</script>

<template>
  <section class="消息页">
    <header class="消息页头">
      <div>
        <span>业务协同</span>
        <h1>消息中心</h1>
        <p>统一展示审批待办、业务提醒、系统通知和业务详情跳转。</p>
      </div>
      <div class="消息页动作">
        <div class="消息页动作">
          <RouterLink v-if="是超级管理员" class="消息按钮" to="/admin/notifications/platform">
            消息渠道配置
          </RouterLink>
          <RouterLink v-if="是超级管理员" class="消息按钮" to="/admin/notifications/rules">
            提醒规则与模板
          </RouterLink>
          <button class="消息按钮" type="button" @click="全部已读">全部标记已读</button>
        </div>
        <RouterLink v-if="是超级管理员" class="消息按钮" to="/admin/notifications/platform">
          渠道配置
        </RouterLink>
        <RouterLink v-if="是超级管理员" class="消息按钮" to="/admin/notifications/rules">
          提醒规则
        </RouterLink>
      </div>
    </header>
    <div v-if="错误" class="消息提示">消息接口不可用，当前展示前端兜底数据：{{ 错误 }}</div>
    <div class="消息指标">
      <article>
        <span>未读消息</span><strong>{{ 消息列表.filter((item) => !item.已读).length }}</strong>
      </article>
      <article>
        <span>待办事项</span
        ><strong>{{ 消息列表.filter((item) => item.类型 === "待办").length }}</strong>
      </article>
      <article>
        <span>审批消息</span
        ><strong>{{ 消息列表.filter((item) => item.类型 === "审批").length }}</strong>
      </article>
      <article>
        <span>业务提醒</span
        ><strong>{{ 消息列表.filter((item) => item.类型 === "业务提醒").length }}</strong>
      </article>
    </div>
    <section class="消息面板">
      <nav>
        <button
          v-for="类型 in 类型列表"
          :key="类型"
          :class="{ active: 当前类型 === 类型 }"
          type="button"
          @click="当前类型 = 类型"
        >
          {{ 类型 }}
        </button>
      </nav>
      <div v-if="加载中" class="消息空态">正在加载消息...</div>
      <div v-else-if="过滤后列表.length" class="消息列表">
        <article v-for="消息 in 过滤后列表" :key="消息.id" :class="{ 未读: !消息.已读 }">
          <span class="消息类型">{{ 消息.类型 }}</span>
          <button class="消息主体" type="button" @click="打开消息(消息)">
            <strong>{{ 消息.标题 }}</strong>
            <p>{{ 消息.内容 }}</p>
          </button>
          <time>{{ new Date(消息.时间).toLocaleString("zh-CN", { hour12: false }) }}</time>
          <button class="消息详情按钮" type="button" @click="打开消息(消息)">查看详情</button>
        </article>
      </div>
      <div v-else class="消息空态">当前分类没有消息。</div>
    </section>

    <div v-if="当前消息" class="消息遮罩" @click.self="当前消息 = null">
      <section class="消息详情弹窗">
        <header>
          <div>
            <span>{{ 当前消息.类型 }}</span>
            <h2>{{ 当前消息.标题 }}</h2>
          </div>
          <button type="button" @click="当前消息 = null">×</button>
        </header>
        <div class="消息正文">{{ 当前消息.内容 }}</div>
        <dl>
          <div>
            <dt>消息时间</dt>
            <dd>{{ new Date(当前消息.时间).toLocaleString("zh-CN", { hour12: false }) }}</dd>
          </div>
          <div>
            <dt>业务入口</dt>
            <dd>{{ 当前消息.路径 }}</dd>
          </div>
        </dl>
        <footer>
          <button type="button" @click="当前消息 = null">关闭</button>
          <RouterLink :to="当前消息.路径" @click="当前消息 = null">进入业务页面</RouterLink>
        </footer>
      </section>
    </div>
  </section>
</template>

<style scoped>
.消息页 {
  display: grid;
  min-width: 980px;
  gap: 18px;
  color: #172b4d;
}
.消息页头 {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
}
.消息页头 span {
  color: #2f69ed;
  font-size: 11px;
  font-weight: 700;
}
.消息页头 h1 {
  margin: 7px 0 5px;
  font-size: 22px;
}
.消息页头 p {
  margin: 0;
  color: #60748c;
  font-size: 11px;
}
.消息页动作 {
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}
.消息按钮 {
  min-height: 36px;
  padding: 0 14px;
  border: 1px solid #d5e2f0;
  border-radius: 8px;
  background: #fff;
  color: #4f6178;
  font: inherit;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}
.消息页动作 {
  display: flex;
  align-items: center;
  gap: 10px;
  white-space: nowrap;
}
.消息页动作 a.消息按钮 {
  line-height: 34px;
  text-decoration: none;
}
.消息提示 {
  padding: 10px 12px;
  border: 1px solid #f2d7a4;
  border-radius: 8px;
  background: #fff7df;
  color: #936409;
  font-size: 11px;
}
.消息指标 {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}
.消息指标 article {
  display: grid;
  gap: 8px;
  min-height: 96px;
  padding: 18px;
  border: 1px solid #dce7f3;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 10px 28px rgba(42, 82, 130, 0.07);
}
.消息指标 span {
  color: #8391a5;
  font-size: 11px;
}
.消息指标 strong {
  font-size: 23px;
  font-variant-numeric: tabular-nums;
}
.消息面板 {
  overflow: hidden;
  border: 1px solid #dce7f3;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 10px 28px rgba(42, 82, 130, 0.07);
}
.消息面板 nav {
  display: flex;
  gap: 4px;
  min-height: 52px;
  align-items: center;
  padding: 0 16px;
  border-bottom: 1px solid #e9f0f7;
}
.消息面板 nav button {
  min-height: 32px;
  padding: 0 12px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: #60748c;
  font: inherit;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}
.消息面板 nav button.active {
  background: #edf5ff;
  color: #1557d6;
}
.消息列表 article {
  display: grid;
  grid-template-columns: 76px minmax(0, 1fr) 160px 80px;
  align-items: center;
  gap: 14px;
  min-height: 78px;
  padding: 12px 18px;
  border-bottom: 1px solid #edf2f7;
}
.消息列表 article.未读 {
  background: #f5f9ff;
}
.消息类型 {
  justify-self: start;
  padding: 4px 8px;
  border-radius: 6px;
  background: #edf5ff;
  color: #1557d6;
  font-size: 11px;
  font-weight: 700;
}
.消息列表 strong {
  font-size: 11px;
}
.消息列表 p {
  margin: 5px 0 0;
  color: #60748c;
  font-size: 11px;
  line-height: 1.5;
}
.消息列表 time {
  color: #8391a5;
  font-size: 11px;
  text-align: right;
}
.消息列表 a {
  color: #2f69ed;
  font-size: 11px;
  font-weight: 700;
}
.消息空态 {
  display: grid;
  min-height: 220px;
  place-items: center;
  color: #8391a5;
  font-size: 11px;
}
.消息主体,
.消息详情按钮 {
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.消息详情按钮 {
  color: #2f69ed;
  font-size: 11px;
  font-weight: 700;
  text-align: right;
}
.消息遮罩 {
  position: fixed;
  z-index: 1200;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(17, 37, 64, 0.38);
}
.消息详情弹窗 {
  width: min(680px, calc(100vw - 48px));
  overflow: hidden;
  border: 1px solid #d9e5f2;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 24px 70px rgba(25, 54, 91, 0.24);
}
.消息详情弹窗 header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 20px 22px 16px;
  border-bottom: 1px solid #e9f0f7;
}
.消息详情弹窗 header span {
  color: #2f69ed;
  font-size: 11px;
  font-weight: 700;
}
.消息详情弹窗 h2 {
  margin: 6px 0 0;
  font-size: 16px;
}
.消息详情弹窗 header button {
  border: 0;
  background: transparent;
  color: #70839a;
  font-size: 20px;
  cursor: pointer;
}
.消息正文 {
  padding: 18px 22px;
  color: #344b68;
  font-size: 11px;
  line-height: 1.8;
  white-space: pre-wrap;
}
.消息详情弹窗 dl {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin: 0;
  padding: 0 22px 18px;
}
.消息详情弹窗 dl div {
  padding: 12px;
  border-radius: 8px;
  background: #f6f9fd;
}
.消息详情弹窗 dt {
  color: #8391a5;
  font-size: 11px;
}
.消息详情弹窗 dd {
  margin: 5px 0 0;
  color: #173b68;
  font-size: 11px;
  font-weight: 700;
}
.消息详情弹窗 footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 22px;
  border-top: 1px solid #e9f0f7;
}
.消息详情弹窗 footer button,
.消息详情弹窗 footer a {
  min-height: 36px;
  padding: 0 14px;
  border: 1px solid #d5e2f0;
  border-radius: 8px;
  background: #fff;
  color: #4f6178;
  font: inherit;
  font-size: 11px;
  font-weight: 700;
  line-height: 34px;
  cursor: pointer;
}
.消息详情弹窗 footer a {
  border-color: #2f69ed;
  background: #2f69ed;
  color: #fff;
}
</style>
