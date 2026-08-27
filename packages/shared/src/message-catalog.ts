/**
 * 统一消息提醒平台：提醒任务模板目录与业务常量。
 * 该文件是「提醒任务模板」的单一事实来源：
 * 后端规则接口、到期扫描进程、事件消费进程、前端目录展示共用同一份定义。
 */

export type 提醒渠道代码 = "in_app" | "wecom" | "wecom_app" | "sms" | "email";
export type 提醒任务类型 = "expiry" | "event";
export type 提醒接收人类型 = "dynamic" | "roles" | "users" | "org" | "region" | "partners";

export interface 提醒变量定义 {
  name: string;
  label: string;
}

export interface 到期数据源定义 {
  code: string;
  label: string;
  reminderCode: string;
  aggregateType: "registration" | "opportunity" | "quote" | "order";
  variables: 提醒变量定义[];
}

export interface 事件定义 {
  code: string;
  label: string;
  categoryCode: "todo" | "business" | "system" | "security";
  priorityCode: "normal" | "strong" | "forced";
  variables: 提醒变量定义[];
}

/** 到期提醒数据源白名单。worker 与后端校验共用，禁止出现任意表名或 SQL。 */
export const 到期数据源目录: 到期数据源定义[] = [
  {
    code: "registration_expiring",
    label: "客户报备保护期到期",
    reminderCode: "crm.registration.expiring",
    aggregateType: "registration",
    variables: [
      { name: "customer_name", label: "客户名称" },
      { name: "partner_name", label: "渠道商名称" },
      { name: "submitter_name", label: "提报人" },
      { name: "business_no", label: "报备编号" },
      { name: "due_date", label: "保护期到期日" },
      { name: "days_left", label: "剩余天数" },
      { name: "protect_days", label: "保护天数" },
    ],
  },
  {
    code: "opportunity_expected_close",
    label: "商机预计成交日到期",
    reminderCode: "crm.opportunity.expected_close",
    aggregateType: "opportunity",
    variables: [
      { name: "customer_name", label: "客户名称" },
      { name: "partner_name", label: "渠道商名称" },
      { name: "submitter_name", label: "提报人" },
      { name: "business_no", label: "商机编号" },
      { name: "due_date", label: "预计成交日" },
      { name: "days_left", label: "剩余天数" },
      { name: "expected_amount", label: "预计金额" },
    ],
  },
  {
    code: "quote_valid_until",
    label: "报价有效期到期",
    reminderCode: "crm.quote.expiring",
    aggregateType: "quote",
    variables: [
      { name: "customer_name", label: "客户名称" },
      { name: "partner_name", label: "渠道商名称" },
      { name: "submitter_name", label: "提报人" },
      { name: "business_no", label: "报价编号" },
      { name: "due_date", label: "有效期到期日" },
      { name: "days_left", label: "剩余天数" },
      { name: "total_amount", label: "报价金额" },
    ],
  },
  {
    code: "order_delivery_date",
    label: "订单交付日期到期",
    reminderCode: "crm.order.delivery_date",
    aggregateType: "order",
    variables: [
      { name: "order_name", label: "订单名称" },
      { name: "partner_name", label: "渠道商名称" },
      { name: "submitter_name", label: "提报人" },
      { name: "business_no", label: "订单编号" },
      { name: "due_date", label: "交付日期" },
      { name: "days_left", label: "剩余天数" },
      { name: "total_amount", label: "订单金额" },
    ],
  },
  {
    code: "opportunity_next_action",
    label: "商机下次跟进计划到期",
    reminderCode: "crm.opportunity.next_action",
    aggregateType: "opportunity",
    variables: [
      { name: "customer_name", label: "客户名称" },
      { name: "partner_name", label: "渠道商名称" },
      { name: "submitter_name", label: "提报人" },
      { name: "business_no", label: "商机编号" },
      { name: "due_date", label: "下次跟进日" },
      { name: "days_left", label: "剩余天数" },
    ],
  },
];

/** 事件提醒白名单。worker 消费进程与业务发件箱共用。 */
export const 事件目录: 事件定义[] = [
  {
    code: "crm.order.approval.pending",
    label: "订单待审批",
    categoryCode: "todo",
    priorityCode: "strong",
    variables: [
      { name: "order_name", label: "订单名称" },
      { name: "partner_name", label: "渠道商名称" },
      { name: "submitter_name", label: "提报人" },
      { name: "business_no", label: "订单编号" },
    ],
  },
  {
    code: "crm.order.status.changed",
    label: "订单状态变更",
    categoryCode: "business",
    priorityCode: "normal",
    variables: [
      { name: "order_name", label: "订单名称" },
      { name: "partner_name", label: "渠道商名称" },
      { name: "submitter_name", label: "提报人" },
      { name: "business_no", label: "订单编号" },
    ],
  },
  {
    code: "crm.order.confirmed",
    label: "订单已确认",
    categoryCode: "business",
    priorityCode: "normal",
    variables: [
      { name: "order_name", label: "订单名称" },
      { name: "partner_name", label: "渠道商名称" },
      { name: "submitter_name", label: "提报人" },
      { name: "business_no", label: "订单编号" },
    ],
  },
  {
    code: "crm.registration.approval.pending",
    label: "客户报备待审批",
    categoryCode: "todo",
    priorityCode: "strong",
    variables: [
      { name: "customer_name", label: "客户名称" },
      { name: "partner_name", label: "渠道商名称" },
      { name: "submitter_name", label: "提报人" },
      { name: "business_no", label: "报备编号" },
    ],
  },
  {
    code: "crm.registration.approved",
    label: "客户报备审批通过",
    categoryCode: "business",
    priorityCode: "strong",
    variables: [
      { name: "customer_name", label: "客户名称" },
      { name: "partner_name", label: "渠道商名称" },
      { name: "submitter_name", label: "提报人" },
      { name: "business_no", label: "报备编号" },
      { name: "due_date", label: "保护期到期日" },
    ],
  },
  {
    code: "crm.registration.rejected",
    label: "客户报备审批驳回",
    categoryCode: "business",
    priorityCode: "strong",
    variables: [
      { name: "customer_name", label: "客户名称" },
      { name: "partner_name", label: "渠道商名称" },
      { name: "submitter_name", label: "提报人" },
      { name: "business_no", label: "报备编号" },
    ],
  },
  {
    code: "iam.account.approval.pending",
    label: "员工账号待审核",
    categoryCode: "todo",
    priorityCode: "strong",
    variables: [
      { name: "target_name", label: "员工姓名" },
      { name: "partner_name", label: "渠道商名称" },
      { name: "submitter_name", label: "提交人" },
    ],
  },
  {
    code: "channel.partner.approval.pending",
    label: "渠道商待审核",
    categoryCode: "todo",
    priorityCode: "strong",
    variables: [
      { name: "partner_name", label: "渠道商名称" },
      { name: "submitter_name", label: "提交人" },
    ],
  },
  {
    code: "crm.quote.approval.pending",
    label: "报价待审批",
    categoryCode: "todo",
    priorityCode: "strong",
    variables: [
      { name: "customer_name", label: "客户名称" },
      { name: "partner_name", label: "渠道商名称" },
      { name: "submitter_name", label: "提报人" },
      { name: "business_no", label: "报价编号" },
      { name: "total_amount", label: "报价金额" },
    ],
  },
  {
    code: "crm.quote.approved",
    label: "报价审批通过",
    categoryCode: "business",
    priorityCode: "normal",
    variables: [
      { name: "customer_name", label: "客户名称" },
      { name: "partner_name", label: "渠道商名称" },
      { name: "submitter_name", label: "提报人" },
      { name: "business_no", label: "报价编号" },
      { name: "total_amount", label: "报价金额" },
    ],
  },
  {
    code: "crm.quote.rejected",
    label: "报价审批驳回",
    categoryCode: "business",
    priorityCode: "normal",
    variables: [
      { name: "customer_name", label: "客户名称" },
      { name: "partner_name", label: "渠道商名称" },
      { name: "submitter_name", label: "提报人" },
      { name: "business_no", label: "报价编号" },
      { name: "total_amount", label: "报价金额" },
    ],
  },
  {
    code: "crm.opportunity.won",
    label: "商机赢单",
    categoryCode: "business",
    priorityCode: "strong",
    variables: [
      { name: "customer_name", label: "客户名称" },
      { name: "partner_name", label: "渠道商名称" },
      { name: "submitter_name", label: "提报人" },
      { name: "business_no", label: "商机编号" },
      { name: "expected_amount", label: "预计金额" },
    ],
  },
  {
    code: "crm.opportunity.lost",
    label: "商机输单",
    categoryCode: "business",
    priorityCode: "strong",
    variables: [
      { name: "customer_name", label: "客户名称" },
      { name: "partner_name", label: "渠道商名称" },
      { name: "submitter_name", label: "提报人" },
      { name: "business_no", label: "商机编号" },
      { name: "expected_amount", label: "预计金额" },
    ],
  },
  {
    code: "crm.opportunity.stage.changed",
    label: "商机阶段变更",
    categoryCode: "business",
    priorityCode: "normal",
    variables: [
      { name: "customer_name", label: "客户名称" },
      { name: "partner_name", label: "渠道商名称" },
      { name: "submitter_name", label: "提报人" },
      { name: "business_no", label: "商机编号" },
      { name: "stage_name", label: "当前阶段" },
    ],
  },
  {
    code: "task.failed.excessive",
    label: "消息任务连续失败",
    categoryCode: "system",
    priorityCode: "forced",
    variables: [],
  },
];

export const 提醒渠道目录: Array<{ code: 提醒渠道代码; label: string }> = [
  { code: "in_app", label: "站内提醒" },
  { code: "wecom_app", label: "企微应用" },
  { code: "wecom", label: "企微群机器人" },
  { code: "email", label: "邮件" },
  { code: "sms", label: "短信" },
];

export const 接收人类型目录: Array<{ code: 提醒接收人类型; label: string }> = [
  { code: "dynamic", label: "业务动态接收人（归属人/审批人）" },
  { code: "roles", label: "按角色" },
  { code: "users", label: "按指定用户" },
  { code: "org", label: "按组织（部门）" },
  { code: "region", label: "按区域" },
  { code: "partners", label: "按渠道商" },
];

export function 查找到期数据源(code: string): 到期数据源定义 | undefined {
  return 到期数据源目录.find((项) => 项.code === code);
}

export function 查找事件(code: string): 事件定义 | undefined {
  return 事件目录.find((项) => 项.code === code);
}

export const 事件代码集合 = 事件目录.map((项) => 项.code);
export const 到期数据源代码集合 = 到期数据源目录.map((项) => 项.code);
