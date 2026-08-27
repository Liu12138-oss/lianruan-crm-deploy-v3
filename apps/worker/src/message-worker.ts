import { pathToFileURL } from "node:url";

import { type 应用配置, 掩码敏感配置, 读取应用配置 } from "@lianruan/config";
import { 创建结构化日志器, type 日志器 } from "@lianruan/shared";
import type { Queue, Worker } from "bullmq";

import { 投递外部消息 } from "./external-delivery.js";
import {
  创建关键消息工作器,
  创建关键消息队列,
  创建外部投递工作器,
  创建外部投递队列,
  创建维护消息工作器,
  创建维护消息队列,
} from "./message-queue.js";
import { 消息消费存储 } from "./message-store.js";
import {
  创建关键消息任务载荷,
  校验关键消息任务载荷,
  校验外部投递任务载荷,
  校验维护消息任务载荷,
  type 维护消息任务载荷,
} from "./message-task.js";

const 扫描周期毫秒 = 60_000;

/**
 * 独立消息进程入口。现有 worker.ts 仍只负责既有健康任务，二者互不启动对方的队列。
 */
export async function 启动消息任务服务(config: 应用配置 = 读取应用配置()) {
  const logger = 创建消息日志器(config);
  if (!config.message.enabled) {
    logger.info("消息任务进程未启用，安全退出。", {
      event: "message.worker.disabled",
      role: config.message.role,
    });
    return { enabled: false as const };
  }
  if (!config.message.eventCutoverAt) {
    throw new Error("消息任务进程启用时必须配置 MESSAGE_EVENT_CUTOVER_AT。");
  }

  const 存储 = new 消息消费存储(config);
  const 服务 = await 按角色启动消息服务(config, 存储, logger);
  注册消息优雅停止(async () => {
    await 服务.close();
    await 存储.close();
  }, logger);
  logger.info("消息任务进程已启动", {
    event: "message.worker.started",
    role: config.message.role,
    queues: config.message.queues,
    config: 掩码敏感配置(config),
  });

  return { enabled: true as const, ...服务 };
}

async function 按角色启动消息服务(config: 应用配置, 存储: 消息消费存储, logger: 日志器) {
  if (config.message.role === "critical") {
    const 队列 = 创建关键消息队列(config);
    const 工作器 = 创建关键消息工作器(config, async (原始载荷) => {
      校验关键消息任务载荷(原始载荷);
      const 已处理数量 = await 存储.处理一批站内消息(
        config,
        config.message.eventCutoverAt ?? "",
        config.message.claimBatchSize,
      );
      logger.info("关键消息批次处理完成", {
        event: "message.critical.batch.completed",
        processedCount: 已处理数量,
      });
    });
    绑定消息工作器日志(工作器, config.message.queues.notification, logger);
    await 等待队列与工作器就绪(队列, 工作器);
    const 定时器 = 创建定时投递器(队列, () => 创建关键消息任务载荷(), "关键消息扫描");
    return 创建角色服务(队列, 工作器, 定时器);
  }

  if (config.message.role === "maintenance") {
    const 队列 = 创建维护消息队列(config);
    const 工作器 = 创建维护消息工作器(config, async (原始载荷) => {
      const 载荷 = 校验维护消息任务载荷(原始载荷);
      await 执行维护任务(载荷, 存储, config, logger);
    });
    绑定消息工作器日志(工作器, config.message.queues.maintenance, logger);
    await 等待队列与工作器就绪(队列, 工作器);
    const 定时器 = 创建维护定时投递器(队列);
    return 创建角色服务(队列, 工作器, 定时器);
  }

  const 队列 = 创建外部投递队列(config);
  const 工作器 = 创建外部投递工作器(config, async (原始载荷) => {
    const 载荷 = 校验外部投递任务载荷(原始载荷);
    const 投递 = await 存储.领取外部投递(
      载荷.deliveryId,
      载荷.channelCode,
      config.message.channelConfigEncryptionKey,
    );
    if (!投递) return;
    try {
      const 通道配置 = await 存储.读取通道运行配置(
        config,
        投递.channelCode,
        投递.templateCode.startsWith("platform_test_"),
      );
      const 结果 = await 投递外部消息(通道配置, 投递);
      await 存储.记录外部投递结果(投递, 结果);
      logger.info("外部消息投递处理完成", {
        event: "message.integration.delivery.completed",
        channelCode: 投递.channelCode,
        statusCode: 结果.statusCode,
        providerCode: 结果.providerCode,
      });
    } catch (错误) {
      await 存储.记录外部投递结果(投递, {
        statusCode: "retry_wait",
        retryable: true,
        providerCode: "worker",
        summary: 脱敏任务错误消息(错误),
      });
      throw 错误;
    }
  });
  绑定消息工作器日志(工作器, config.message.queues.integration, logger);
  await 等待队列与工作器就绪(队列, 工作器);
  const 定时器 = 创建外部投递扫描器(队列, 存储, config.message.claimBatchSize, logger);
  return 创建角色服务(队列, 工作器, 定时器);
}

async function 执行维护任务(
  载荷: 维护消息任务载荷,
  存储: 消息消费存储,
  config: 应用配置,
  logger: 日志器,
): Promise<void> {
  if (载荷.taskCode === "reclaim") {
    const 已回收数量 = await 存储.重新领取过期锁();
    logger.info("消息消费锁回收完成", {
      event: "message.maintenance.reclaim.completed",
      reclaimedCount: 已回收数量,
    });
    return;
  }
  if (载荷.taskCode === "reminder") {
    const 结果 = await 存储.扫描并投递到期提醒(config);
    logger.info("到期提醒扫描完成", {
      event: "message.maintenance.reminder.completed",
      scheduledCount: 结果.scheduledCount,
      notifiedCount: 结果.notifiedCount,
    });
    return;
  }
  logger.info("维护消息任务暂未启用，安全跳过。", {
    event: "message.maintenance.task.skipped",
    taskCode: 载荷.taskCode,
  });
}

function 创建定时投递器<T>(queue: Queue<T, unknown, string>, 创建载荷: () => T, 任务名称: string) {
  let 正在投递 = false;
  const 投递 = async () => {
    if (正在投递) return;
    正在投递 = true;
    try {
      await queue.add(任务名称 as never, 创建载荷() as never);
    } finally {
      正在投递 = false;
    }
  };
  void 投递();
  return setInterval(() => void 投递(), 扫描周期毫秒);
}

function 创建维护定时投递器(queue: Queue<维护消息任务载荷, unknown, string>): NodeJS.Timeout {
  let 正在投递 = false;
  const 投递 = async () => {
    if (正在投递) return;
    正在投递 = true;
    try {
      const requestedAt = new Date().toISOString();
      await Promise.all([
        queue.add("消息消费锁回收", { taskCode: "reclaim", requestedAt }),
        queue.add("到期提醒扫描", { taskCode: "reminder", requestedAt }),
      ]);
    } finally {
      正在投递 = false;
    }
  };
  void 投递();
  return setInterval(() => void 投递(), 扫描周期毫秒);
}

function 创建外部投递扫描器(
  queue: Queue,
  存储: 消息消费存储,
  批量: number,
  logger: 日志器,
): NodeJS.Timeout {
  let 正在扫描 = false;
  const 扫描 = async () => {
    if (正在扫描) return;
    正在扫描 = true;
    try {
      const 待投递集合 = await 存储.查询待入队外部投递(批量);
      await Promise.all(
        待投递集合.map((投递) =>
          queue.add(
            "外部消息投递",
            { deliveryId: 投递.deliveryId, channelCode: 投递.channelCode },
            {
              jobId: `external-delivery-${投递.deliveryId}-${投递.attemptNumber}`,
            },
          ),
        ),
      );
      if (待投递集合.length) {
        logger.info("外部投递扫描完成", {
          event: "message.integration.scan.completed",
          pendingCount: 待投递集合.length,
        });
      }
    } catch (错误) {
      logger.error("外部投递扫描失败", {
        event: "message.integration.scan.failed",
        errorMessage: 脱敏任务错误消息(错误),
      });
    } finally {
      正在扫描 = false;
    }
  };
  void 扫描();
  return setInterval(() => void 扫描(), 扫描周期毫秒);
}

function 创建角色服务<T>(queue: Queue<T>, worker: Worker<T>, 定时器?: NodeJS.Timeout) {
  return {
    queue,
    worker,
    async close() {
      if (定时器) clearInterval(定时器);
      await worker.close();
      await queue.close();
    },
  };
}

async function 等待队列与工作器就绪<T>(queue: Queue<T>, worker: Worker<T>): Promise<void> {
  await queue.waitUntilReady();
  await worker.waitUntilReady();
}

function 绑定消息工作器日志<T>(worker: Worker<T>, queueName: string, logger: 日志器): void {
  worker.on("completed", (任务) => {
    logger.info("消息任务完成", {
      event: "message.worker.job.completed",
      queueName,
      jobId: 任务.id || "",
      jobName: 任务.name,
      attemptsMade: 任务.attemptsMade,
    });
  });
  worker.on("failed", (任务, 错误) => {
    logger.error("消息任务失败", {
      event: "message.worker.job.failed",
      queueName,
      jobId: 任务?.id || "",
      jobName: 任务?.name || "",
      attemptsMade: 任务?.attemptsMade || 0,
      errorMessage: 脱敏任务错误消息(错误),
    });
  });
}

function 注册消息优雅停止(关闭: () => Promise<void>, logger: 日志器): void {
  let 正在停止 = false;
  const 停止 = async (信号: NodeJS.Signals) => {
    if (正在停止) return;
    正在停止 = true;
    logger.info("消息任务进程收到停止信号", { event: "message.worker.stop_signal", signal: 信号 });
    try {
      await 关闭();
      logger.info("消息任务进程已优雅停止", { event: "message.worker.stopped" });
      process.exit(0);
    } catch (错误) {
      logger.error("消息任务进程停止失败", {
        event: "message.worker.stop_failed",
        errorMessage: 脱敏任务错误消息(错误),
      });
      process.exit(1);
    }
  };
  process.once("SIGINT", 停止);
  process.once("SIGTERM", 停止);
}

function 创建消息日志器(config: 应用配置): 日志器 {
  return 创建结构化日志器({
    service: "message-worker",
    appEnv: config.appEnv,
    minLevel: config.logLevel,
    defaultFields: { buildVersion: config.build.version, buildCommit: config.build.commit },
    file: { ...config.log.file, fileName: "message-worker.log" },
  });
}

function 脱敏任务错误消息(错误: unknown): string {
  return (错误 instanceof Error ? 错误.message : "消息任务失败，原因未知。")
    .replace(/https?:\/\/[^\s]+/g, "[地址已隐藏]")
    .slice(0, 240);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  启动消息任务服务().catch((错误) => {
    const logger = 创建结构化日志器({
      service: "message-worker",
      appEnv: "development",
      minLevel: "info",
    });
    logger.error("消息任务进程启动失败", {
      event: "message.worker.start_failed",
      errorMessage: 脱敏任务错误消息(错误),
    });
    process.exit(1);
  });
}
