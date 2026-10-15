<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";

import { 查询阶段9全部, type 阶段9记录 } from "../../api/business-client.js";
import WarKpis from "../../components/war/WarKpis.vue";
import type { 指标项 } from "../../components/war/types.js";
import { 日期时间文本, 文本 } from "../../shared/format/business-format.js";

const 路由器 = useRouter();
const 加载中 = ref(false);
const 错误 = ref("");
const 消息列表 = ref<阶段9记录[]>([]);
const 投递列表 = ref<Array<Record<string, unknown>>>([]);
const 当前类型 = ref("全部");
const 搜索词 = ref("");
const 展开编号 = ref("");

const 类型映射: Record<string, string> = {
  due_reminder: "业务提醒",
  approval_pending: "审批待办",
  order_pending: "审批待办",
  quote_expiring: "业务提醒",
  system: "系统通知",
};

function 取(行: 阶段9记录, ...键列表: string[]): string {
  const 数据 = (行.原始数据 as Record<string, unknown>) || {};
  return 文本(...键列表.map((键) => 数据[键]), ...键列表.map((键) => (行 as never)?.[键]));
}

function 类型代码(行: 阶段9记录): string {
  return 取(行, "type");
}

function 类型文本(行: 阶段9记录): string {
  return 类型映射[类型代码(行)] || 文本(行.类型, 类型代码(行), "业务消息");
}

function 已读(行: 阶段9记录): boolean {
  const 未读 = 取(行, "unread");
  if (未读 === "true") return false;
  if (未读 === "false") return true;
  return 行.状态 === "read";
}

function 消息说明(行: 阶段9记录): string {
  return 文本(取(行, "desc", "content"), "无消息内容");
}

function 相对时间(时间值: string): string {
  const 时间 = new Date(时间值);
  if (Number.isNaN(时间.getTime())) return "—";
  const 分钟 = Math.floor((Date.now() - 时间.getTime()) / 60000);
  if (分钟 < 1) return "刚刚";
  if (分钟 < 60) return `${分钟} 分钟前`;
  if (分钟 < 1440) return `${Math.floor(分钟 / 60)} 小时前`;
  return `${Math.floor(分钟 / 1440)} 天前`;
}

const 过滤后列表 = computed(() => {
  let 列表 = 消息列表.value;
  if (当前类型.value === "未读") 列表 = 列表.filter((行) => !已读(行));
  if (当前类型.value === "已读") 列表 = 列表.filter((行) => 已读(行));
  const 关键词 = 搜索词.value.trim().toLowerCase();
  if (!关键词) return 列表;
  return 列表.filter((行) =>
    [行.标题, 消息说明(行), 类型文本(行)].filter(Boolean).some((值) =>
      String(值).toLowerCase().includes(关键词),
    ),
  );
});

const 投递统计 = computed(() => {
  const 失败 = 投递列表.value.filter((行) => 文本(行.statusCode) && 文本(行.statusCode) !== "success");
  const 成功 = 投递列表.value.filter((行) => 文本(行.statusCode) === "success");
  return { 失败: 失败.length, 成功: 成功.length, 总数: 投递列表.value.length };
});

const 指标 = computed<指标项[]>(() => {
  const 列表 = 消息列表.value;
  const 未读 = 列表.filter((行) => !已读(行)).length;
  const 计数 = (类型名: string) => 列表.filter((行) => 类型文本(行) === 类型名).length;
  return [
    { label: "未读消息", value: String(未读), unit: "条", note: `当前账号共 ${列表.length} 条消息` },
    { label: "审批待办", value: String(计数("审批待办")), unit: "项", note: "审批与订单待办" },
    { label: "业务提醒", value: String(计数("业务提醒")), unit: "条", note: "到期与业务进展提醒" },
    { label: "系统通知", value: String(计数("系统通知")), unit: "条", note: "系统与运维消息" },
    {
      label: "外部投递失败",
      value: String(投递统计.value.失败),
      unit: "条",
      note: 投递统计.value.总数
        ? `最近 ${投递统计.value.总数} 条投递记录中失败`
        : "暂无投递记录",
    },
    {
      label: "已投递",
      value: String(投递统计.value.成功),
      unit: "条",
      note: 投递统计.value.总数
        ? `最近 ${投递统计.value.总数} 条投递记录中成功`
        : "暂无投递记录",
    },
  ];
});

onMounted(() => void 加载());

async function 加载() {
  加载中.value = true;
  错误.value = "";
  try {
    const 结果 = await 查询阶段9全部("notifications", { 最大页数: 5 });
    消息列表.value = 结果.数据;
  } catch (异常) {
    错误.value = 异常 instanceof Error ? 异常.message : "消息数据加载失败。";
  } finally {
    加载中.value = false;
  }
  投递列表.value = await 读取投递();
}

/** 投递明细仅超级管理员可读，其他角色直接跳过，避免无权限请求。 */
function 是超级管理员(): boolean {
  try {
    const 原始 = window.localStorage.getItem("admin_user_info");
    if (!原始) return false;
    return (JSON.parse(原始) as { role?: string }).role === "superadmin";
  } catch {
    return false;
  }
}

async function 读取投递(): Promise<Array<Record<string, unknown>>> {
  if (!是超级管理员()) return [];
  try {
    const 响应 = await fetch("/api/messages/platform/deliveries?limit=100", {
      credentials: "include",
    });
    if (!响应.ok) return [];
    const 结果 = (await 响应.json()) as { data?: Array<Record<string, unknown>> };
    return Array.isArray(结果.data) ? 结果.data : [];
  } catch {
    return [];
  }
}

function 切换展开(行: 阶段9记录) {
  展开编号.value = 展开编号.value === 行.id ? "" : 行.id;
}

function 提醒明细(行: 阶段9记录): Array<Record<string, unknown>> {
  const 项 = (行.原始数据 as Record<string, unknown>)?.reminderItems;
  return Array.isArray(项) ? (项 as Array<Record<string, unknown>>) : [];
}
</script>

<template>
  <div class="vui war-artboard war-artboard-flow 消息页">
    <div class="workspace-switch">
      <button type="button" class="active">消息列表</button>
      <button type="button" @click="路由器.push('/admin/notifications/platform')">
        消息渠道配置
      </button>
      <button type="button" @click="路由器.push('/admin/notifications/rules')">
        提醒规则与模板
      </button>
    </div>

    <WarKpis :items="指标" />

    <section class="panel">
      <header class="panel-head">
        <div>
          <h2>消息列表</h2>
          <p>
            业务消息与系统消息统一展示，按来源和状态区分；当前列表来源为历史站内通知表
            （V2 迁移通知），V3 事件消息另行投递，两套数据尚未合并。
          </p>
        </div>
      </header>
      <div class="panel-body flush">
        <div class="toolbar">
          <div class="filters">
            <div class="field search">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" />
              </svg>
              <input v-model="搜索词" placeholder="搜索标题、业务编号" />
            </div>
            <div class="segmented">
              <button
                v-for="项 in ['全部', '未读', '已读']"
                :key="项"
                type="button"
                class="segment"
                :class="{ active: 当前类型 === 项 }"
                @click="当前类型 = 项"
              >
                {{ 项 }}
              </button>
            </div>
          </div>
          <div class="button-row">
            <span class="war-count">共 {{ 过滤后列表.length }} 条</span>
          </div>
        </div>

        <div v-if="加载中" class="war-empty">正在加载消息…</div>
        <div v-else-if="错误" class="war-empty">{{ 错误 }}</div>
        <div v-else class="table-wrap">
          <table class="data-table 消息表">
            <thead>
              <tr>
                <th>消息</th>
                <th>类型</th>
                <th>时间</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="消息 in 过滤后列表" :key="消息.id">
                <tr @click="切换展开(消息)">
                  <td>
                    <span class="record-title">{{ 文本(消息.标题, "未命名消息") }}</span>
                    <span class="record-meta">{{ 消息说明(消息) }}</span>
                  </td>
                  <td>{{ 类型文本(消息) }}</td>
                  <td>{{ 相对时间(文本(消息.创建时间, 取(消息, "createdAt"))) }}</td>
                  <td>
                    <span class="status" :class="已读(消息) ? 'gray' : 'blue'">
                      {{ 已读(消息) ? "已读" : "未读" }}
                    </span>
                  </td>
                  <td>
                    <span class="table-actions">
                      <button type="button" class="link" @click.stop="切换展开(消息)">
                        {{ 展开编号 === 消息.id ? "收起" : "查看" }}
                      </button>
                    </span>
                  </td>
                </tr>
                <tr v-if="展开编号 === 消息.id" :key="`${消息.id}-详情`" class="消息详情行">
                  <td colspan="5">
                    <div class="info-grid">
                      <div class="info-item"><span>消息类型</span><strong>{{ 类型文本(消息) }}</strong></div>
                      <div class="info-item"><span>接收人</span><strong>{{ 文本(消息.负责人, "—") }}</strong></div>
                      <div class="info-item"><span>追踪编号</span><strong>{{ 文本(消息.编号, "—") }}</strong></div>
                      <div class="info-item">
                        <span>创建时间</span><strong>{{ 日期时间文本(消息.创建时间) }}</strong>
                      </div>
                    </div>
                    <p class="war-note">{{ 消息说明(消息) }}</p>
                    <table v-if="提醒明细(消息).length" class="data-table 提醒明细">
                      <thead>
                        <tr><th>对象</th><th>到期时间</th><th>剩余天数</th></tr>
                      </thead>
                      <tbody>
                        <tr v-for="(项, 序号) in 提醒明细(消息)" :key="序号">
                          <td>{{ 文本(项.targetName, 项.customer, "—") }}</td>
                          <td>{{ 文本(项.dueDate, "—") }}</td>
                          <td>{{ 文本(项.daysLeft, "—") }} 天</td>
                        </tr>
                      </tbody>
                    </table>
                  </td>
                </tr>
              </template>
              <tr v-if="!过滤后列表.length">
                <td colspan="5" class="war-empty">没有符合条件的消息。</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.消息表 tbody tr {
  cursor: pointer;
}

.消息详情行 {
  cursor: default;
}

.消息详情行 td {
  padding: 12px 13px;
  background: #f8fbff;
}

.消息详情行 .war-note {
  margin: 10px 0 0;
  color: var(--text-3);
  font-size: 11px;
  line-height: 1.6;
}

.提醒明细 {
  margin-top: 10px;
}

.war-count {
  color: var(--text-3);
  font-size: 11px;
  font-weight: 700;
}

.war-empty {
  display: grid;
  place-items: center;
  min-height: 80px;
  padding: 16px;
  color: var(--text-3);
  font-size: 11px;
}
</style>
