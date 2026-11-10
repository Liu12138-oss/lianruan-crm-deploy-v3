<script setup lang="ts">
import { ElMessage } from "element-plus";
import { computed, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";

import { 处理业务会话失效 } from "../../api/auth-client.js";
import type { 阶段9记录 } from "../../api/business-client.js";
import {
  归档统一消息,
  更新消息偏好,
  查询消息偏好,
  查询统一消息全部,
  标记统一消息已读,
  type 消息个人偏好,
  type 消息分类偏好,
} from "../../api/message-client.js";
import type { 指标项 } from "../../components/war/types.js";
import WarKpis from "../../components/war/WarKpis.vue";
import { 文本, 日期时间文本 } from "../../shared/format/business-format.js";

const 路由器 = useRouter();
const 加载中 = ref(false);
const 错误 = ref("");
const 消息列表 = ref<阶段9记录[]>([]);
const 归档列表 = ref<阶段9记录[]>([]);
const 归档已加载 = ref(false);
const 归档加载中 = ref(false);
const 投递列表 = ref<Array<Record<string, unknown>>>([]);
const 当前类型 = ref("全部");
const 当前分类 = ref("全部类型");
const 搜索词 = ref("");
const 展开编号 = ref("");
const 已读处理中 = ref(false);
const 偏好弹窗 = ref(false);
const 偏好加载中 = ref(false);
const 偏好保存中 = ref(false);
const 偏好错误 = ref("");
const 分类定义 = [
  { 代码: "todo" as const, 名称: "待办事项", 说明: "审批、任务等待处理提醒" },
  { 代码: "business" as const, 名称: "业务提醒", 说明: "客户、商机、报价和订单状态变化" },
  { 代码: "system" as const, 名称: "系统通知", 说明: "任务失败、服务异常等系统消息" },
  { 代码: "security" as const, 名称: "安全提醒", 说明: "登录异常、账号安全等提醒" },
];
const 分类偏好 = reactive<Record<string, 消息分类偏好>>({
  todo: { inAppEnabled: true, wecomEnabled: false, smsEnabled: false, emailEnabled: false },
  business: { inAppEnabled: true, wecomEnabled: false, smsEnabled: false, emailEnabled: false },
  system: { inAppEnabled: true, wecomEnabled: false, smsEnabled: false, emailEnabled: false },
  security: { inAppEnabled: true, wecomEnabled: false, smsEnabled: false, emailEnabled: false },
});
const 分类行 = computed(() =>
  分类定义.map((项) => ({ ...项, 偏好: 分类偏好[项.代码] as 消息分类偏好 })),
);
const 分类筛选选项 = ["全部类型", "审批待办", "业务提醒", "系统通知", "安全提醒"];

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
  // 正式状态是唯一可信来源：V2 迁移数据中的 extra_json.unread 可能仍是历史快照。
  const 状态 = 文本(行.状态).trim().toLowerCase();
  if (状态 === "read") return true;
  if (状态 === "unread") return false;
  const 未读 = 取(行, "unread");
  if (未读 === "true") return false;
  if (未读 === "false") return true;
  return 行.状态 === "read";
}

function 已归档(行: 阶段9记录): boolean {
  return 文本(行.状态).trim().toLowerCase() === "archived";
}

function 消息分类(行: 阶段9记录): string {
  const 代码 = 文本(取(行, "categoryCode"));
  return (
    { todo: "审批待办", business: "业务提醒", system: "系统通知", security: "安全提醒" }[代码] ||
    类型文本(行)
  );
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
  let 列表 = 当前类型.value === "已归档" ? 归档列表.value : 消息列表.value;
  if (当前类型.value === "未读") 列表 = 列表.filter((行) => !已读(行));
  if (当前类型.value === "已读") 列表 = 列表.filter((行) => 已读(行));
  if (当前分类.value !== "全部类型") {
    列表 = 列表.filter((行) => 消息分类(行) === 当前分类.value);
  }
  const 关键词 = 搜索词.value.trim().toLowerCase();
  if (!关键词) return 列表;
  return 列表.filter((行) =>
    [
      行.标题,
      行.编号,
      消息说明(行),
      类型文本(行),
      取(行, "eventCode", "aggregateId", "aggregateType"),
    ]
      .filter(Boolean)
      .some((值) => String(值).toLowerCase().includes(关键词)),
  );
});

const 当前筛选为空说明 = computed(() => {
  if (当前类型.value === "已归档") return "当前没有已归档消息；归档消息不会删除审计和业务记录。";
  if (当前分类.value !== "全部类型") return `当前没有“${当前分类.value}”分类的消息。`;
  return "没有符合条件的消息，请调整搜索词或筛选条件。";
});

const 投递统计 = computed(() => {
  const 失败 = 投递列表.value.filter(
    (行) => 文本(行.statusCode) && 文本(行.statusCode) !== "success",
  );
  const 成功 = 投递列表.value.filter((行) => 文本(行.statusCode) === "success");
  return { 失败: 失败.length, 成功: 成功.length, 总数: 投递列表.value.length };
});

const 指标 = computed<指标项[]>(() => {
  const 列表 = 消息列表.value;
  const 未读 = 列表.filter((行) => !已读(行)).length;
  const 计数 = (类型名: string) => 列表.filter((行) => 类型文本(行) === 类型名).length;
  return [
    {
      label: "未读消息",
      value: String(未读),
      unit: "条",
      note: `当前账号共 ${列表.length} 条消息`,
    },
    { label: "审批待办", value: String(计数("审批待办")), unit: "项", note: "审批与订单待办" },
    { label: "业务提醒", value: String(计数("业务提醒")), unit: "条", note: "到期与业务进展提醒" },
    { label: "系统通知", value: String(计数("系统通知")), unit: "条", note: "系统与运维消息" },
    {
      label: "外部投递失败",
      value: String(投递统计.value.失败),
      unit: "条",
      note: 投递统计.value.总数 ? `最近 ${投递统计.value.总数} 条投递记录中失败` : "暂无投递记录",
    },
    {
      label: "已投递",
      value: String(投递统计.value.成功),
      unit: "条",
      note: 投递统计.value.总数 ? `最近 ${投递统计.value.总数} 条投递记录中成功` : "暂无投递记录",
    },
  ];
});

onMounted(() => void 加载());

async function 加载() {
  加载中.value = true;
  错误.value = "";
  try {
    const 结果 = await 查询统一消息全部(5);
    消息列表.value = 结果.数据;
  } catch (异常) {
    错误.value = 异常 instanceof Error ? 异常.message : "消息数据加载失败。";
  } finally {
    加载中.value = false;
  }
  投递列表.value = await 读取投递();
}

async function 加载归档() {
  if (归档已加载.value || 归档加载中.value) return;
  归档加载中.value = true;
  try {
    const 结果 = await 查询统一消息全部(5, "archived");
    归档列表.value = 结果.数据;
    归档已加载.value = true;
  } catch (异常) {
    ElMessage.error(异常 instanceof Error ? 异常.message : "已归档消息加载失败。");
  } finally {
    归档加载中.value = false;
  }
}

async function 切换状态筛选(值: string) {
  当前类型.value = 值;
  if (值 === "已归档") await 加载归档();
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
    if (响应.status === 401) {
      处理业务会话失效();
      return [];
    }
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

async function 标记已读(行?: 阶段9记录) {
  if (已读处理中.value) return;
  已读处理中.value = true;
  try {
    const 结果 = await 标记统一消息已读(行?.id || "");
    ElMessage[结果.updated ? "success" : "info"](结果.message);
    await 加载();
  } catch (异常) {
    ElMessage.error(异常 instanceof Error ? 异常.message : "标记已读失败，请稍后重试。");
  } finally {
    已读处理中.value = false;
  }
}

async function 归档消息(行: 阶段9记录) {
  if (已读处理中.value || 已归档(行)) return;
  if (!window.confirm("确认归档该消息？归档后默认列表不再显示，但审计与业务记录会保留。")) return;
  已读处理中.value = true;
  try {
    const 结果 = await 归档统一消息(行.id);
    ElMessage.success(结果.message);
    消息列表.value = 消息列表.value.filter((消息) => 消息.id !== 行.id);
    归档列表.value = [行, ...归档列表.value.filter((消息) => 消息.id !== 行.id)];
  } catch (异常) {
    ElMessage.error(异常 instanceof Error ? 异常.message : "消息归档失败，请稍后重试。");
  } finally {
    已读处理中.value = false;
  }
}

function 提醒明细(行: 阶段9记录): Array<Record<string, unknown>> {
  const 项 = (行.原始数据 as Record<string, unknown>)?.reminderItems;
  return Array.isArray(项) ? (项 as Array<Record<string, unknown>>) : [];
}

/** 个人偏好按当前登录人隔离，未单独保存的分类继承账号级渠道开关。 */
function 应用偏好(偏好: 消息个人偏好) {
  for (const 项 of 分类定义) {
    const 已保存 = 偏好.categoryPreferences[项.代码];
    分类偏好[项.代码] = {
      inAppEnabled: 已保存?.inAppEnabled ?? 偏好.inAppEnabled,
      wecomEnabled: 已保存?.wecomEnabled ?? 偏好.wecomEnabled,
      smsEnabled: 已保存?.smsEnabled ?? 偏好.smsEnabled,
      emailEnabled: 已保存?.emailEnabled ?? 偏好.emailEnabled,
    };
  }
}

async function 打开偏好设置() {
  偏好弹窗.value = true;
  偏好错误.value = "";
  偏好加载中.value = true;
  try {
    应用偏好(await 查询消息偏好());
  } catch (异常) {
    偏好错误.value = 异常 instanceof Error ? 异常.message : "个人通知偏好加载失败。";
  } finally {
    偏好加载中.value = false;
  }
}

async function 保存偏好设置() {
  if (偏好保存中.value) return;
  偏好保存中.value = true;
  偏好错误.value = "";
  try {
    const 结果 = await 更新消息偏好({
      categoryPreferences: Object.fromEntries(
        分类定义.map((项) => [项.代码, { ...分类偏好[项.代码] }]),
      ),
    });
    应用偏好(结果);
    偏好弹窗.value = false;
    ElMessage.success("个人通知偏好已保存。");
  } catch (异常) {
    偏好错误.value = 异常 instanceof Error ? 异常.message : "个人通知偏好保存失败。";
  } finally {
    偏好保存中.value = false;
  }
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
      <button type="button" @click="打开偏好设置">个人通知偏好</button>
    </div>

    <WarKpis :items="指标" :加载中="加载中" />

    <section class="panel">
      <header class="panel-head">
        <div>
          <h2>消息列表</h2>
          <p>业务消息与系统消息统一展示，按来源和状态区分，支持检索、标记已读和批量处理。</p>
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
                v-for="项 in ['全部', '未读', '已读', '已归档']"
                :key="项"
                type="button"
                class="segment"
                :class="{ active: 当前类型 === 项 }"
                @click="切换状态筛选(项)"
              >
                {{ 项 }}
              </button>
            </div>
            <label class="分类筛选">
              <span>消息分类</span>
              <select v-model="当前分类">
                <option v-for="项 in 分类筛选选项" :key="项" :value="项">{{ 项 }}</option>
              </select>
            </label>
          </div>
          <div class="button-row">
            <span class="war-count">共 {{ 过滤后列表.length }} 条</span>
            <button
              type="button"
              class="button small"
              :disabled="已读处理中 || !消息列表.some((行) => !已读(行))"
              @click="标记已读()"
            >
              {{ 已读处理中 ? "处理中…" : "全部已读" }}
            </button>
          </div>
        </div>

        <div v-if="加载中 || 归档加载中" class="war-empty">正在加载消息…</div>
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
                    <span
                      class="status"
                      :class="已归档(消息) ? 'gray' : 已读(消息) ? 'gray' : 'blue'"
                    >
                      {{ 已归档(消息) ? "已归档" : 已读(消息) ? "已读" : "未读" }}
                    </span>
                  </td>
                  <td>
                    <span class="table-actions">
                      <button type="button" class="link" @click.stop="切换展开(消息)">
                        {{ 展开编号 === 消息.id ? "收起" : "查看" }}
                      </button>
                      <button
                        v-if="!已读(消息) && !已归档(消息)"
                        type="button"
                        class="link"
                        :disabled="已读处理中"
                        @click.stop="标记已读(消息)"
                      >
                        标记已读
                      </button>
                      <button
                        v-if="!已归档(消息)"
                        type="button"
                        class="link"
                        :disabled="已读处理中"
                        @click.stop="归档消息(消息)"
                      >
                        归档
                      </button>
                    </span>
                  </td>
                </tr>
                <tr v-if="展开编号 === 消息.id" :key="`${消息.id}-详情`" class="消息详情行">
                  <td colspan="5">
                    <div class="info-grid">
                      <div class="info-item">
                        <span>消息类型</span><strong>{{ 类型文本(消息) }}</strong>
                      </div>
                      <div class="info-item">
                        <span>接收人</span><strong>{{ 文本(消息.负责人, "—") }}</strong>
                      </div>
                      <div class="info-item">
                        <span>追踪编号</span><strong>{{ 文本(消息.编号, "—") }}</strong>
                      </div>
                      <div class="info-item">
                        <span>创建时间</span><strong>{{ 日期时间文本(消息.创建时间) }}</strong>
                      </div>
                    </div>
                    <p class="war-note">{{ 消息说明(消息) }}</p>
                    <table v-if="提醒明细(消息).length" class="data-table 提醒明细">
                      <thead>
                        <tr>
                          <th>对象</th>
                          <th>到期时间</th>
                          <th>剩余天数</th>
                        </tr>
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
                <td colspan="5" class="war-empty">{{ 当前筛选为空说明 }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
    <div v-if="偏好弹窗" class="偏好遮罩" @click.self="偏好弹窗 = false">
      <section class="偏好弹窗">
        <header>
          <div>
            <span>个人设置</span>
            <h2>个人通知偏好</h2>
          </div>
          <button type="button" aria-label="关闭" @click="偏好弹窗 = false">×</button>
        </header>
        <p class="偏好说明">
          按业务分类控制通知渠道。关闭某类站内通知后，新产生的该类消息不会进入未读列表；外部渠道需管理员先完成配置。
        </p>
        <p v-if="偏好错误" class="偏好错误">{{ 偏好错误 }}</p>
        <div v-if="偏好加载中" class="war-empty">正在读取偏好…</div>
        <template v-else>
          <table class="偏好表">
            <thead>
              <tr>
                <th>业务分类</th>
                <th>站内</th>
                <th>企微</th>
                <th>短信</th>
                <th>邮件</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="项 in 分类行" :key="项.代码">
                <td>
                  <strong>{{ 项.名称 }}</strong>
                  <small>{{ 项.说明 }}</small>
                </td>
                <td><input v-model="项.偏好.inAppEnabled" type="checkbox" /></td>
                <td><input v-model="项.偏好.wecomEnabled" type="checkbox" /></td>
                <td><input v-model="项.偏好.smsEnabled" type="checkbox" /></td>
                <td><input v-model="项.偏好.emailEnabled" type="checkbox" /></td>
              </tr>
            </tbody>
          </table>
          <footer class="偏好动作">
            <button type="button" @click="偏好弹窗 = false">取消</button>
            <button type="button" class="primary" :disabled="偏好保存中" @click="保存偏好设置">
              {{ 偏好保存中 ? "保存中…" : "保存偏好" }}
            </button>
          </footer>
        </template>
      </section>
    </div>
  </div>
</template>

<style scoped>
.消息表 tbody tr {
  cursor: pointer;
}

.分类筛选 {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--text-3);
  font-size: 11px;
  font-weight: 700;
}

.分类筛选 select {
  min-height: 30px;
  padding: 0 28px 0 9px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #ffffff;
  color: var(--text);
  font: inherit;
  font-size: 11px;
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

.偏好遮罩 {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: center;
  background: rgba(15, 39, 68, 0.42);
}

.偏好弹窗 {
  width: min(720px, calc(100vw - 48px));
  max-height: calc(100vh - 80px);
  overflow: auto;
  padding: 22px 24px;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 24px 60px rgba(15, 39, 68, 0.24);
}

.偏好弹窗 header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.偏好弹窗 header span {
  color: var(--text-3);
  font-size: 11px;
}

.偏好弹窗 h2 {
  margin: 4px 0 0;
  font-size: 18px;
  font-weight: 700;
}

.偏好弹窗 header button {
  border: 0;
  background: transparent;
  color: var(--text-3);
  font-size: 22px;
  cursor: pointer;
}

.偏好说明 {
  margin: 12px 0 16px;
  color: var(--text-3);
  font-size: 12px;
  line-height: 1.7;
}

.偏好错误 {
  margin: 0 0 12px;
  color: #c0392b;
  font-size: 12px;
}

.偏好表 {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.偏好表 th,
.偏好表 td {
  padding: 10px 8px;
  border-bottom: 1px solid var(--line-soft);
  text-align: center;
}

.偏好表 th:first-child,
.偏好表 td:first-child {
  text-align: left;
}

.偏好表 td:first-child strong {
  display: block;
  font-size: 12px;
}

.偏好表 td:first-child small {
  display: block;
  margin-top: 3px;
  color: var(--text-3);
  font-size: 11px;
}

.偏好动作 {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 18px;
}

.偏好动作 button {
  min-width: 96px;
  padding: 9px 16px;
  border: 1px solid var(--line-soft);
  border-radius: 8px;
  background: #fff;
  font-size: 12px;
  cursor: pointer;
}

.偏好动作 button.primary {
  border-color: #2f6fe4;
  background: #2f6fe4;
  color: #fff;
}
</style>
