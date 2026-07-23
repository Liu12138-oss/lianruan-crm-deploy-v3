import crypto from "node:crypto";

import { z } from "zod";

const 健康任务载荷结构 = z
  .object({
    taskId: z.string().trim().min(1, "任务编号不能为空。").max(128),
    requestedAt: z.string().datetime("请求时间必须是ISO时间。"),
    source: z.string().trim().min(1).max(64).default("stage-1-health"),
  })
  .strict();

export type 健康任务载荷 = z.infer<typeof 健康任务载荷结构>;

export interface 健康任务结果 {
  status: "success";
  taskId: string;
  message: string;
  processedAt: string;
}

export async function 处理健康任务(原始载荷: unknown): Promise<健康任务结果> {
  const 载荷 = 校验健康任务载荷(原始载荷);
  return {
    status: "success",
    taskId: 载荷.taskId,
    message: "健康任务执行完成，未产生业务副作用。",
    processedAt: new Date().toISOString(),
  };
}

export function 创建健康任务载荷(taskId: string = crypto.randomUUID()): 健康任务载荷 {
  return {
    taskId,
    requestedAt: new Date().toISOString(),
    source: "stage-1-health",
  };
}

export function 校验健康任务载荷(原始载荷: unknown): 健康任务载荷 {
  const 解析结果 = 健康任务载荷结构.safeParse(原始载荷);
  if (!解析结果.success) {
    const 原因 = 解析结果.error.issues.map((问题) => 问题.message).join("；");
    throw new Error(`健康任务载荷校验失败：${原因}`);
  }

  return 解析结果.data;
}
