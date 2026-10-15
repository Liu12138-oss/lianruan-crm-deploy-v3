<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

import WarKpis from "../../components/war/WarKpis.vue";
import WarLayout from "../../components/war/WarLayout.vue";
import type { 指标项, 记录标签 } from "../../components/war/types.js";
import { 日期文本, 日期时间文本, 文本 } from "../../shared/format/business-format.js";

const 路由 = useRoute();
const 路由器 = useRouter();
const 当前形态 = ref(路由.path.endsWith("/rules") ? "rules" : "channels");
const 加载中 = ref(false);
const 错误 = ref("");
const 通道列表 = ref<Array<Record<string, unknown>>>([]);
const 投递列表 = ref<Array<Record<string, unknown>>>([]);
const 规则列表 = ref<Array<Record<string, unknown>>>([]);
const 模板列表 = ref<Array<Record<string, unknown>>>([]);
const 任务模板列表 = ref<Array<Record<string, unknown>>>([]);
const 当前分类 = ref("业务事件");
const 搜索词 = ref("");
const 选中编号 = ref("");

const 通道定义 = [
  { channelCode: "wecom", name: "企业微信群机器人", description: "用于发送脱敏团队汇总" },
  { channelCode: "wecom_app", name: "企微自建应用", description: "用于向指定成员发送提醒" },
  { channelCode: "sms", name: "短信", description: "用于高优先级审批和到期提醒" },
  { channelCode: "email", name: "SMTP 邮箱", description: "用于外部联系人和汇总通知" },
];

const 通道名称映射: Record<string, string> = {
  in_app: "站内消息",
  wecom: "企业微信群机器人",
  wecom_app: "企微自建应用",
  sms: "短信",
  email: "SMTP 邮箱",
};

const 分类列表 = ["业务事件", "到期提醒", "任务模板", "消息模板"];

function 通道代码(通道: Record<string, unknown>): string {
  return 文本(通道.channelCode, 通道.标识);
}

function 通道名称(通道: Record<string, unknown>): string {
  return 文本(通道.name, 通道.名称, 通道名称映射[通道代码(通道)], 通道代码(通道));
}

function 通道已启用(通道: Record<string, unknown>): boolean {
  return 通道.enabled === true;
}

function 通道已配置(通道: Record<string, unknown>): boolean {
  return 通道.configured === true;
}

function 通道状态文本(通道: Record<string, unknown>): string {
  // 配置不可用是阻塞性问题，优先于启用状态展示，避免出现「已启用但发不出去」的误导。
  if (通道.needsReconfigure === true) return "需重新配置";
  if (通道已启用(通道)) return "已启用";
  if (通道已配置(通道)) return "未启用";
  return "未就绪";
}

function 通道状态色调(通道: Record<string, unknown>): string {
  if (通道.needsReconfigure === true) return "red";
  if (通道已启用(通道)) return "green";
  if (通道已配置(通道)) return "gray";
  return "red";
}

const 通道视图 = computed<Array<Record<string, unknown>>>(() =>
  通道列表.value.length ? 通道列表.value : (通道定义 as unknown as Array<Record<string, unknown>>),
);

function 投递状态(行: Record<string, unknown>): string {
  return 文本(行.statusCode, "unknown");
}

const 投递失败 = computed(() => 投递列表.value.filter((行) => 投递状态(行) !== "success"));
const 今日投递 = computed(() =>
  投递列表.value.filter((行) => {
    const 时间 = new Date(文本(行.createdAt));
    return !Number.isNaN(时间.getTime()) && 时间.toDateString() === new Date().toDateString();
  }),
);
const 投递成功 = computed(() => 投递列表.value.filter((行) => 投递状态(行) === "success"));

/** 判断文本是否包含中文，用于拦截 eventCode、statusCode 等开发字段直接上屏。 */
function 含中文(值: string): boolean {
  return /[\u4e00-\u9fa5]/.test(值);
}

/** 代码转中文：优先用中文值，其次走映射，最后退回默认中文名，绝不显示英文代码。 */
function 中文名或默认(值: string, 映射: Record<string, string>, 默认名: string): string {
  if (!值) return 默认名;
  if (映射[值]) return 映射[值];
  return 含中文(值) ? 值 : 默认名;
}

/** 兜底映射：历史模板中已在用、但规则清单未覆盖的事件代码。 */
const 事件中文兜底: Record<string, string> = {
  "iam.account.approval.pending": "员工账号审核待办",
  "crm.order.approval.pending": "订单待审批",
  "crm.order.confirmed": "订单已确认",
  "crm.order.status.changed": "订单状态变化",
  "channel.partner.approval.pending": "渠道商审核待办",
  "task.failed.excessive": "消息任务连续失败",
};

/**
 * 事件代码中文化：事件代码（如 crm.order.approval.pending）只用于系统匹配，
 * 页面统一展示配置里的中文规则名，未登记的代码按业务事件归口。
 */
const 事件中文名 = (事件代码: unknown): string => {
  const 代码 = 文本(事件代码);
  if (!代码) return "业务事件";
  const 命中规则 = 规则列表.value.find((规则) => 文本(规则.eventCode) === 代码);
  if (命中规则) {
    const 名称 = 文本(命中规则.ruleName, 命中规则.templateName);
    if (名称) return 名称;
  }
  const 命中模板 = 任务模板列表.value.find((模板) => 文本(模板.eventCode) === 代码);
  if (命中模板) {
    const 名称 = 文本(命中模板.templateName, 命中模板.ruleName);
    if (名称) return 名称;
  }
  return 事件中文兜底[代码] || "业务事件";
};

const 提醒类型映射: Record<string, string> = {
  event: "事件提醒",
  reminder: "到期提醒",
  task: "自定义任务",
};

const 消息分类映射: Record<string, string> = {
  todo: "待办",
  business: "业务",
  system: "系统",
  approval: "审批",
  other: "其他",
};

function 规则名称(规则: Record<string, unknown>): string {
  return 文本(规则.ruleName, 规则.templateName, 规则.名称, 事件中文名(规则.eventCode), "提醒任务");
}

function 规则说明(规则: Record<string, unknown>): string {
  return 文本(规则.description, 规则.subscriptionCode, "业务事件触发后生成提醒");
}

function 接收人文本(规则: Record<string, unknown>): string {
  const 接收人规则 = 规则.recipientRule as { label?: unknown } | undefined;
  return 文本(接收人规则?.label, 规则.recipientLabel, 规则.接收人, "平台管理员");
}

function 渠道文本(规则: Record<string, unknown>): string {
  const 通道代码集 = Array.isArray(规则.channelCodes) ? (规则.channelCodes as string[]) : [];
  if (通道代码集.length) return 通道代码集.map((代码) => 通道名称映射[代码] || 代码).join(" / ");
  return 文本(规则.channelLabel, 规则.渠道, "站内消息");
}

function 规则状态文本(规则: Record<string, unknown>): string {
  if (规则.statusCode === "active") return "启用";
  if (规则.statusCode === "disabled") return "停用";
  return 文本(规则.状态, "已配置");
}

const 到期提醒规则 = computed(() =>
  规则列表.value.filter((规则) => 文本(规则.reminderType) === "reminder"),
);

interface 列表项 {
  id: string;
  标题: string;
  说明: string;
  徽标: string;
  色调: string;
  标签: 记录标签[];
}

const 规则列表项 = computed<列表项[]>(() => {
  const 生成 = (
    集合: Array<Record<string, unknown>>,
    说明: (项: Record<string, unknown>) => string,
    徽标: (项: Record<string, unknown>) => string,
    色调: (项: Record<string, unknown>) => string,
  ) =>
    集合.map((项, 序号) => ({
      id: 文本(项.ruleCode, 项.templateCode, 项.subscriptionCode, 项.eventCode, String(序号)),
      标题: 规则名称(项),
      说明: 说明(项),
      徽标: 徽标(项),
      色调: 色调(项),
      标签: [{ text: 文本(项.eventCode) ? 事件中文名(项.eventCode) : 中文名或默认(文本(项.channelCode), 通道名称映射, "—") }],
    }));
  if (当前分类.value === "业务事件")
    return 生成(
      规则列表.value.filter((规则) => 文本(规则.reminderType) !== "reminder"),
      (项) => `${渠道文本(项)} · ${接收人文本(项)}`,
      () => 规则状态文本({ statusCode: "active" }),
      () => "green",
    );
  if (当前分类.value === "到期提醒")
    return 生成(
      到期提醒规则.value,
      (项) => `${渠道文本(项)} · ${中文名或默认(文本(项.reminderCode), {}, "定时扫描")}`,
      () => "启用",
      () => "blue",
    );
  if (当前分类.value === "任务模板")
    return 生成(
      任务模板列表.value,
      (项) =>
        `${中文名或默认(文本(项.reminderType), 提醒类型映射, "自定义")} · ${
          中文名或默认(文本(项.categoryCode), 消息分类映射, "任务模板")
        }`,
      () => "模板",
      () => "purple",
    );
  return 生成(
    模板列表.value,
    (项) => `${通道名称映射[文本(项.channelCode)] || 文本(项.channelCode, "—")} · ${文本(项.eventCode, "—")}`,
      () => "启用",
      () => "green",
  );
});

const 渠道过滤 = computed(() => {
  let 列表 = 通道视图.value;
  if (当前分类.value === "已启用") 列表 = 列表.filter(通道已启用);
  if (当前分类.value === "未就绪") 列表 = 列表.filter((通道) => !通道已配置(通道));
  const 关键词 = 搜索词.value.trim().toLowerCase();
  if (!关键词) {
    return 列表.map((通道) => ({
      id: 通道代码(通道),
      标题: 通道名称(通道),
      说明:
        通道.needsReconfigure === true
          ? 文本(通道.configurationError, "历史配置不可用，请重新保存配置。")
          : 文本(通道.description, 通道.说明, "外部消息通道"),
      徽标: 通道状态文本(通道),
      色调: 通道状态色调(通道),
      标签: [{ text: 通道代码(通道) }],
    }));
  }
  return 列表
    .filter((通道) => [通道名称(通道), 文本(通道.description, 通道.说明)].some((值) => String(值).toLowerCase().includes(关键词)))
    .map((通道) => ({
      id: 通道代码(通道),
      标题: 通道名称(通道),
      说明: 文本(通道.description, 通道.说明, "外部消息通道"),
      徽标: 通道状态文本(通道),
      色调: 通道状态色调(通道),
      标签: [{ text: 通道代码(通道) }],
    }));
});

const 规则过滤 = computed(() => {
  const 关键词 = 搜索词.value.trim().toLowerCase();
  if (!关键词) return 规则列表项.value;
  return 规则列表项.value.filter((项) =>
    [项.标题, 项.说明, ...项.标签.map((标签) => 标签.text)].some((值) =>
      String(值).toLowerCase().includes(关键词),
    ),
  );
});

const 列表项集合 = computed(() =>
  当前形态.value === "channels" ? 渠道过滤.value : 规则过滤.value,
);

const 当前选中 = computed(
  () => 列表项集合.value.find((项) => 项.id === 选中编号.value) || 列表项集合.value[0] || null,
);

const 动态 = computed(() => {
  const 项 = 投递列表.value.slice(0, 3).map((行) => ({
    标题: `${通道名称映射[文本(行.channelCode)] || 文本(行.channelCode, "通道")}投递${投递状态(行) === "success" ? "成功" : "失败"}`,
    说明: 文本(行.summary, `尝试 ${文本(行.attemptCount, "1")} 次`),
    时间: 日期时间文本(文本(行.createdAt)).slice(0, 10),
  }));
  return 项;
});

const 指标 = computed<指标项[]>(() => {
  if (当前形态.value === "rules") {
    return [
      {
        label: "业务事件规则",
        value: String(规则列表.value.filter((规则) => 文本(规则.reminderType) !== "reminder").length),
        unit: "条",
        note: "事件触发提醒",
      },
      { label: "到期提醒规则", value: String(到期提醒规则.value.length), unit: "条", note: "定时扫描提醒" },
      { label: "消息模板", value: String(模板列表.value.length), unit: "个", note: "按通道维护" },
      { label: "任务模板", value: String(任务模板列表.value.length), unit: "个", note: "自定义提醒" },
      { label: "自建提醒任务", value: String(任务模板列表.value.length), unit: "条", note: "基于任务模板" },
      {
        label: "投递失败",
        value: String(投递失败.value.length),
        unit: "条",
        note: 投递列表.value.length
          ? `最近 ${投递列表.value.length} 条投递记录中失败`
          : "暂无投递记录",
      },
    ];
  }
  const 启用数 = 通道视图.value.filter(通道已启用).length;
  const 未就绪 = 通道视图.value.filter((通道) => !通道已配置(通道)).length;
  return [
    { label: "消息渠道", value: String(通道视图.value.length), unit: "类", note: "站内、企微、短信、邮件" },
    { label: "正式启用", value: String(启用数), unit: "类", note: "已开启外部投递" },
    {
      label: "测试成功",
      value: String(通道视图.value.filter((通道) => 文本(通道.lastTestStatus) === "success").length),
      unit: "类",
      note: "最近一次测试通过",
    },
    {
      label: "今日投递",
      value: String(今日投递.value.length),
      unit: "条",
      note: 投递列表.value.length
        ? `最近 ${投递列表.value.length} 条投递记录中当日投递`
        : "暂无投递记录",
    },
    { label: "失败投递", value: String(投递失败.value.length), unit: "条", note: "需关注的外部投递" },
    { label: "未就绪", value: String(未就绪), unit: "类", note: "尚未保存配置" },
  ];
});

const 列表标题 = computed(() => (当前形态.value === "channels" ? "消息渠道" : "规则分类"));
const 标签列表 = computed(() => (当前形态.value === "channels" ? ["全部", "已启用", "未就绪"] : 分类列表));

watch(
  () => 路由.path,
  (路径) => {
    当前形态.value = 路径.endsWith("/rules") ? "rules" : "channels";
    当前分类.value = 路径.endsWith("/rules") ? "业务事件" : "全部";
    选中编号.value = "";
  },
);

watch(标签列表, (列表) => {
  if (!列表.includes(当前分类.value)) 当前分类.value = 列表[0] || "全部";
});

onMounted(() => void 加载());

async function 加载() {
  加载中.value = true;
  错误.value = "";
  try {
    const [通道, 投递, 规则, 模板, 任务模板] = await Promise.all([
      取数据("/api/messages/platform/channels"),
     取数据("/api/messages/platform/deliveries?limit=100"),
      取数据("/api/messages/platform/rules"),
      取数据("/api/messages/platform/rules/templates"),
      取数据("/api/messages/platform/rules/task-templates"),
    ]);
    通道列表.value = 通道;
    投递列表.value = 投递;
    规则列表.value = 规则;
    模板列表.value = 模板;
    任务模板列表.value = 任务模板;
  } catch (异常) {
    错误.value = 异常 instanceof Error ? 异常.message : "消息配置加载失败。";
  } finally {
    加载中.value = false;
  }
}

async function 取数据(路径: string): Promise<Array<Record<string, unknown>>> {
  try {
    const 响应 = await fetch(路径, { credentials: "include" });
    if (!响应.ok) return [];
    const 结果 = (await 响应.json()) as {
      data?: Array<Record<string, unknown>> | { items?: Array<Record<string, unknown>> };
    };
    if (Array.isArray(结果.data)) return 结果.data;
    const 嵌套 = (结果.data as { items?: Array<Record<string, unknown>> } | undefined)?.items;
    return Array.isArray(嵌套) ? 嵌套 : [];
  } catch {
    return [];
  }
}

async function 切换形态(形态: string) {
  if (形态 === 当前形态.value) return;
  当前形态.value = 形态;
  当前分类.value = 形态 === "rules" ? "业务事件" : "全部";
  选中编号.value = "";
  await 路由器.replace(形态 === "rules" ? "/admin/notifications/rules" : "/admin/notifications/platform");
}
</script>

<template>
  <div class="vui war-artboard 消息设置页">
    <WarKpis :items="指标" />

    <WarLayout
      :list-title="列表标题"
      :list-count="String(列表项集合.length)"
      :search-placeholder="当前形态 === 'channels' ? '搜索渠道名称或状态' : '搜索事件、模板或任务'"
      :tabs="标签列表"
      :active-tab="当前分类"
      v-model="搜索词"
      :动态="动态"
      @切换标签="当前分类 = $event"
    >
      <template #list>
        <article
          v-for="项 in 列表项集合"
          :key="项.id"
          class="war-record"
          :class="{ active: 当前选中?.id === 项.id }"
          @click="选中编号 = 项.id"
        >
          <div class="war-record-top">
            <strong>{{ 项.标题 }}</strong>
            <span class="status" :class="项.色调">{{ 项.徽标 }}</span>
          </div>
          <p>{{ 项.说明 }}</p>
        </article>
        <div v-if="!列表项集合.length" class="war-empty">暂无数据。</div>
      </template>

      <template #center>
        <div class="消息返回行">
          <button class="返回按钮" type="button" @click="路由器.push('/admin/notifications')">
            ← 返回消息列表
          </button>
        </div>
        <div class="war-center-head">
          <div class="deal-title">
            <strong>{{ 当前形态 === "channels" ? "消息渠道配置" : "提醒规则与任务管理" }}</strong>
            <span>
              {{
                当前形态 === "channels"
                  ? "敏感配置只提交不回显，测试通过后才允许启用正式投递"
                  : "事件、到期计划、模板和任务实例统一管理"
              }}
            </span>
          </div>
          <div class="center-actions">
            <button type="button" class="button" @click="切换形态(当前形态 === 'channels' ? 'rules' : 'channels')">
              {{ 当前形态 === "channels" ? "查看提醒规则" : "查看消息渠道" }}
            </button>
          </div>
        </div>

        <div class="extended-center-grid">
          <template v-if="当前形态 === 'channels'">
            <section class="panel">
              <header class="panel-head">
                <div>
                  <h2>通道配置状态</h2>
                  <p>凭据加密保存，页面不回显历史明文。</p>
                </div>
              </header>
              <div class="panel-body flush">
                <div v-if="!通道列表.length" class="war-empty">
                  渠道配置接口当前不可用，以下为通道清单占位。
                </div>
                <table class="data-table">
                  <thead>
                    <tr><th>渠道</th><th>状态</th><th>最近测试</th></tr>
                  </thead>
                  <tbody>
                    <tr v-for="通道 in 通道视图" :key="通道代码(通道)">
                      <td><span class="record-title">{{ 通道名称(通道) }}</span></td>
                      <td>
                        <span class="status" :class="通道状态色调(通道)">{{ 通道状态文本(通道) }}</span>
                      </td>
                      <td>
                        {{ 通道.lastTestedAt ? 日期文本(文本(通道.lastTestedAt)) : "从未测试" }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section class="panel">
              <header class="panel-head">
                <div>
                  <h2>投递状态</h2>
                  <p>外部通道最近投递结果。</p>
                </div>
              </header>
              <div class="panel-body">
                <div class="info-grid">
                  <div class="info-item"><span>投递总数</span><strong>{{ 投递列表.length }} 条</strong></div>
                  <div class="info-item"><span>成功</span><strong>{{ 投递成功.length }} 条</strong></div>
                  <div class="info-item"><span>失败</span><strong>{{ 投递失败.length }} 条</strong></div>
                  <div class="info-item">
                    <span>最近投递</span>
                    <strong>{{ 投递列表.length ? 日期时间文本(文本(投递列表[0]?.createdAt)) : "暂无" }}</strong>
                  </div>
                </div>
              </div>
            </section>
          </template>

          <template v-else>
            <section class="panel">
              <header class="panel-head">
                <div>
                  <h2>业务事件规则</h2>
                  <p>事件触发后生成站内与外部提醒。</p>
                </div>
              </header>
              <div class="panel-body flush">
                <table class="data-table">
                  <thead>
                    <tr><th>事件</th><th>通道</th><th>接收人</th><th>状态</th></tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="(规则, 序号) in 规则列表.filter((项) => 文本(项.reminderType) !== 'reminder').slice(0, 12)"
                      :key="序号"
                    >
                      <td><span class="record-title">{{ 规则名称(规则) }}</span></td>
                      <td>{{ 渠道文本(规则) }}</td>
                      <td>{{ 接收人文本(规则) }}</td>
                      <td><span class="status green">{{ 规则状态文本(规则) }}</span></td>
                    </tr>
                    <tr v-if="!规则列表.length">
                      <td colspan="4" class="war-empty">暂无提醒规则。</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section class="panel">
              <header class="panel-head">
                <div>
                  <h2>消息模板</h2>
                  <p>按通道维护的标题与正文模板。</p>
                </div>
              </header>
              <div class="panel-body flush">
                <table class="data-table">
                  <thead>
                    <tr><th>模板</th><th>通道</th><th>事件</th></tr>
                  </thead>
                  <tbody>
                    <tr v-for="(模板, 序号) in 模板列表.slice(0, 12)" :key="序号">
                      <td>
                        <span class="record-title">
                          {{
                            文本(模板.titleTemplate) ||
                            文本(任务模板列表.find((项) => 文本(项.templateCode) === 文本(模板.templateCode))?.templateName) ||
                            "消息模板"
                          }}
                        </span>
                      </td>
                      <td>{{ 通道名称映射[文本(模板.channelCode)] || 中文名或默认(文本(模板.channelCode), {}, "站内消息") }}</td>
                      <td>{{ 事件中文名(模板.eventCode) }}</td>
                    </tr>
                    <tr v-if="!模板列表.length">
                      <td colspan="3" class="war-empty">暂无消息模板。</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          </template>
        </div>
      </template>

      <template #right>
        <article class="right-card highlight">
          <div class="right-card-title">
            <strong>{{ 当前形态 === "channels" ? "投递状态" : "规则状态" }}</strong>
            <span>实时快照</span>
          </div>
          <div class="info-grid">
            <template v-if="当前形态 === 'channels'">
              <div class="info-item"><span>投递总数</span><strong>{{ 投递列表.length }} 条</strong></div>
              <div class="info-item"><span>成功</span><strong>{{ 投递成功.length }} 条</strong></div>
              <div class="info-item"><span>失败</span><strong>{{ 投递失败.length }} 条</strong></div>
              <div class="info-item"><span>未就绪</span><strong>{{ 通道视图.filter((通道) => !通道已配置(通道)).length }} 类</strong></div>
            </template>
            <template v-else>
              <div class="info-item"><span>业务事件</span><strong>{{ 规则列表.filter((项) => 文本(项.reminderType) !== "reminder").length }} 条</strong></div>
              <div class="info-item"><span>到期提醒</span><strong>{{ 到期提醒规则.length }} 条</strong></div>
              <div class="info-item"><span>消息模板</span><strong>{{ 模板列表.length }} 个</strong></div>
              <div class="info-item"><span>任务模板</span><strong>{{ 任务模板列表.length }} 个</strong></div>
            </template>
          </div>
        </article>

        <article class="right-card">
          <div class="right-card-title">
            <strong>{{ 当前形态 === "channels" ? "通道切换" : "通道切换" }}</strong>
            <span>入口</span>
          </div>
          <button
            type="button"
            class="button primary"
            @click="切换形态(当前形态 === 'channels' ? 'rules' : 'channels')"
          >
            {{ 当前形态 === "channels" ? "查看提醒规则与模板" : "查看消息渠道配置" }}
          </button>
        </article>

        <article v-if="错误" class="right-card">
          <div class="right-card-title"><strong>加载提示</strong><span>提示</span></div>
          <p class="war-note">{{ 错误 }}</p>
        </article>
      </template>
    </WarLayout>
  </div>
</template>

<style scoped>
/* 返回按钮固定在中间栏第一行左侧，与全站统一返回样式一致。 */
.消息返回行 {
  padding: 12px 18px 0;
}

.消息返回行 .返回按钮 {
  margin: 0;
}

.war-note {
  margin: 8px 0 0;
  color: var(--text-3);
  font-size: 11px;
  line-height: 1.6;
}

.war-empty {
  display: grid;
  place-items: center;
  min-height: 60px;
  padding: 14px;
  color: var(--text-3);
  font-size: 11px;
}
</style>
