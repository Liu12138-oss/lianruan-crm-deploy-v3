/**
 * 统一消息领域的稳定契约。事件载荷只允许包含接收人解析和脱敏渲染所需字段。
 */
export const 消息事件代码 = {
  订单审批待处理: "crm.order.approval.pending",
  订单状态已变更: "crm.order.status.changed",
  订单已确认: "crm.order.confirmed",
  报备已通过: "crm.registration.approved",
  报备已驳回: "crm.registration.rejected",
  消息任务连续失败: "task.failed.excessive",
} as const;

export type 消息事件类型 = (typeof 消息事件代码)[keyof typeof 消息事件代码];

export type 消息分类代码 = "todo" | "business" | "system" | "security";
export type 消息优先级代码 = "normal" | "strong" | "forced";
export type 消息通知状态 = "unread" | "read" | "archived";
export type 消息目标动作 = "view" | "process" | "approve";

export interface 消息事件契约 {
  code: 消息事件类型;
  version: 1;
  producer: "crm" | "worker";
  aggregateType: "order" | "registration" | "task";
  allowedPayloadFields: readonly string[];
}

export const M1消息事件契约: readonly 消息事件契约[] = [
  {
    code: 消息事件代码.订单审批待处理,
    version: 1,
    producer: "crm",
    aggregateType: "order",
    allowedPayloadFields: ["orderId", "status", "step"],
  },
  {
    code: 消息事件代码.订单状态已变更,
    version: 1,
    producer: "crm",
    aggregateType: "order",
    allowedPayloadFields: ["orderId", "fromStatus", "toStatus", "priceAdjusted"],
  },
  {
    code: 消息事件代码.订单已确认,
    version: 1,
    producer: "crm",
    aggregateType: "order",
    allowedPayloadFields: ["orderId", "status"],
  },
  {
    code: 消息事件代码.报备已通过,
    version: 1,
    producer: "crm",
    aggregateType: "registration",
    allowedPayloadFields: ["registrationId", "status"],
  },
  {
    code: 消息事件代码.报备已驳回,
    version: 1,
    producer: "crm",
    aggregateType: "registration",
    allowedPayloadFields: ["registrationId", "status", "reason"],
  },
  {
    code: 消息事件代码.消息任务连续失败,
    version: 1,
    producer: "worker",
    aggregateType: "task",
    allowedPayloadFields: ["taskName", "failureCount", "lastErrorSummary"],
  },
] as const;

export interface 消息通知摘要 {
  id: string;
  eventCode: string;
  categoryCode: 消息分类代码;
  priorityCode: 消息优先级代码;
  aggregateType: string;
  aggregateId: string | null;
  targetAction: 消息目标动作;
  title: string;
  body: string;
  statusCode: 消息通知状态;
  createdAt: string;
  readAt: string | null;
  archivedAt: string | null;
  expiresAt: string | null;
}

export interface 消息个人偏好 {
  inAppEnabled: boolean;
  wecomEnabled: boolean;
  smsEnabled: boolean;
  emailEnabled: boolean;
  doNotDisturbStart: string;
  doNotDisturbEnd: string;
}
