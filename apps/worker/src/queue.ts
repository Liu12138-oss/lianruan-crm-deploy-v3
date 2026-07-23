import type { 应用配置 } from "@lianruan/config";
import { Queue, Worker } from "bullmq";

import {
  type 健康任务结果,
  type 健康任务载荷,
  处理健康任务,
  校验健康任务载荷,
} from "./health-task.js";
import { 创建Redis连接配置 } from "./redis.js";

export class 内存健康任务队列 {
  private readonly 队列: 健康任务载荷[] = [];

  async enqueue(载荷: unknown): Promise<void> {
    this.队列.push(校验健康任务载荷(载荷));
  }

  size(): number {
    return this.队列.length;
  }

  async runNext(): Promise<健康任务结果 | null> {
    const 载荷 = this.队列.shift();
    if (!载荷) {
      return null;
    }

    return 处理健康任务(载荷);
  }
}

export function 创建健康任务队列(config: 应用配置): Queue<健康任务载荷, 健康任务结果> {
  return new Queue<健康任务载荷, 健康任务结果>(config.redis.healthQueue, {
    connection: 创建Redis连接配置(config),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "fixed", delay: 1000 },
      removeOnComplete: 100,
      removeOnFail: 100,
    },
  });
}

export function 创建健康任务工作器(config: 应用配置): Worker<健康任务载荷, 健康任务结果> {
  return new Worker<健康任务载荷, 健康任务结果>(
    config.redis.healthQueue,
    async (任务) => 处理健康任务(任务.data),
    {
      concurrency: 1,
      connection: 创建Redis连接配置(config),
    },
  );
}

export async function 投递健康任务(队列: Queue<健康任务载荷, 健康任务结果>, 载荷: 健康任务载荷) {
  return 队列.add("健康任务", 载荷);
}
