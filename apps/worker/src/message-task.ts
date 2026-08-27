import { z } from "zod";

export const 消息消费者代码 = "message.m1.in_app.v1";

export const 关键消息任务失败监控代码 = "message-worker:critical";
export const 关键消息任务失败聚合编号 = "e1a2d4c8-5b76-4e4c-9c20-5f2d69e1a001";

export const M1事件代码集合 = [
  "crm.order.approval.pending",
  "crm.order.status.changed",
  "crm.order.confirmed",
  "crm.registration.approved",
  "crm.registration.rejected",
  "crm.registration.approval.pending",
  "iam.account.approval.pending",
  "channel.partner.approval.pending",
  "task.failed.excessive",
] as const;

export type M1事件代码 = (typeof M1事件代码集合)[number];

const 关键消息任务载荷结构 = z
  .object({
    requestedAt: z.string().datetime({ offset: true }),
    source: z.string().trim().min(1).max(64).default("message-critical"),
  })
  .strict();

const 外部投递任务载荷结构 = z
  .object({
    deliveryId: z.string().uuid("投递编号必须为 UUID。"),
    channelCode: z.enum(["wecom", "wecom_app", "sms", "email"]),
  })
  .strict();

const 维护消息任务载荷结构 = z
  .object({
    taskCode: z.enum(["retry", "reclaim", "reminder", "cleanup"]),
    requestedAt: z.string().datetime({ offset: true }),
  })
  .strict();

export interface 关键消息任务载荷 {
  requestedAt: string;
  source: string;
}

export interface 外部投递任务载荷 {
  deliveryId: string;
  channelCode: "wecom" | "wecom_app" | "sms" | "email";
}

export interface 维护消息任务载荷 {
  taskCode: "retry" | "reclaim" | "reminder" | "cleanup";
  requestedAt: string;
}

export function 创建关键消息任务载荷(): 关键消息任务载荷 {
  return { requestedAt: new Date().toISOString(), source: "message-critical" };
}

export function 校验关键消息任务载荷(原始载荷: unknown): 关键消息任务载荷 {
  const 载荷 = 解析任务载荷(关键消息任务载荷结构, 原始载荷, "关键消息任务");
  return { requestedAt: 载荷.requestedAt, source: 载荷.source ?? "message-critical" };
}

export function 校验外部投递任务载荷(原始载荷: unknown): 外部投递任务载荷 {
  const 载荷 = 解析任务载荷(外部投递任务载荷结构, 原始载荷, "外部投递任务");
  return { deliveryId: 载荷.deliveryId, channelCode: 载荷.channelCode };
}

export function 校验维护消息任务载荷(原始载荷: unknown): 维护消息任务载荷 {
  const 载荷 = 解析任务载荷(维护消息任务载荷结构, 原始载荷, "维护消息任务");
  return { taskCode: 载荷.taskCode, requestedAt: 载荷.requestedAt };
}

/**
 * 同一轮连续失败只在首次跨过阈值时生成告警；成功后由持久化状态重置该标记。
 */
export function 应生成连续失败事件(
  连续失败次数: number,
  阈值: number,
  已生成阈值事件: boolean,
): boolean {
  return 连续失败次数 >= 阈值 && !已生成阈值事件;
}

function 解析任务载荷<T>(结构: z.ZodType<T>, 原始载荷: unknown, 任务名称: string): T {
  const 解析结果 = 结构.safeParse(原始载荷);
  if (!解析结果.success) {
    const 原因 = 解析结果.error.issues.map((问题) => 问题.message).join("；");
    throw new Error(`${任务名称}载荷校验失败：${原因}`);
  }
  return 解析结果.data;
}
