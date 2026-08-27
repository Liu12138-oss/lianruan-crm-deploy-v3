import type { 应用配置 } from "@lianruan/config";
import { Queue, Worker } from "bullmq";

import {
  type 关键消息任务载荷,
  type 外部投递任务载荷,
  type 维护消息任务载荷,
} from "./message-task.js";
import { 创建Redis连接配置 } from "./redis.js";

export function 创建关键消息队列(config: 应用配置): Queue<关键消息任务载荷> {
  return 创建消息队列(config.message.queues.notification, config);
}

export function 创建外部投递队列(config: 应用配置): Queue<外部投递任务载荷> {
  return 创建消息队列(config.message.queues.integration, config);
}

export function 创建维护消息队列(config: 应用配置): Queue<维护消息任务载荷> {
  return 创建消息队列(config.message.queues.maintenance, config);
}

export function 创建关键消息工作器(
  config: 应用配置,
  处理: (载荷: 关键消息任务载荷) => Promise<void>,
): Worker<关键消息任务载荷> {
  return new Worker(config.message.queues.notification, (任务) => 处理(任务.data), {
    concurrency: config.message.concurrency.critical,
    connection: 创建Redis连接配置(config),
  });
}

export function 创建外部投递工作器(
  config: 应用配置,
  处理: (载荷: 外部投递任务载荷) => Promise<void>,
): Worker<外部投递任务载荷> {
  return new Worker(config.message.queues.integration, (任务) => 处理(任务.data), {
    concurrency: config.message.concurrency.integration,
    connection: 创建Redis连接配置(config),
    limiter: { max: 读取外部通道分钟限额(config), duration: 60_000 },
  });
}

export function 创建维护消息工作器(
  config: 应用配置,
  处理: (载荷: 维护消息任务载荷) => Promise<void>,
): Worker<维护消息任务载荷> {
  return new Worker(config.message.queues.maintenance, (任务) => 处理(任务.data), {
    concurrency: config.message.concurrency.maintenance,
    connection: 创建Redis连接配置(config),
  });
}

function 创建消息队列<T>(队列名称: string, config: 应用配置): Queue<T> {
  return new Queue<T>(队列名称, {
    connection: 创建Redis连接配置(config),
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: "exponential", delay: 30_000 },
      removeOnComplete: 100,
      removeOnFail: 100,
    },
  });
}

/**
 * BullMQ 限流在同一队列内全局生效。多个通道同时启用时按更严格的限额保护供应商。
 */
function 读取外部通道分钟限额(config: 应用配置): number {
  const 限额集合 = [
    ...(config.message.channels.wecomGroup.enabled
      ? [config.message.channels.wecomGroup.maxPerMinute]
      : []),
    ...(config.message.channels.wecomApp.enabled
      ? [config.message.channels.wecomApp.maxPerMinute]
      : []),
    ...(config.message.channels.sms.enabled ? [config.message.channels.sms.maxPerMinute] : []),
    ...(config.message.channels.email.enabled ? [config.message.channels.email.maxPerMinute] : []),
  ];
  return 限额集合.length > 0 ? Math.min(...限额集合) : 1;
}
