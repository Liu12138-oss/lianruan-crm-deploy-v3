import { pathToFileURL } from "node:url";

import { type 应用配置, 掩码敏感配置, 读取应用配置 } from "@lianruan/config";
import { 创建结构化日志器, type 日志器 } from "@lianruan/shared";

import { 创建健康任务工作器, 创建健康任务队列 } from "./queue.js";

export async function 启动任务服务(config: 应用配置 = 读取应用配置()) {
  const logger = 创建任务日志器(config);
  const 队列 = 创建健康任务队列(config);
  const 工作器 = 创建健康任务工作器(config);

  工作器.on("completed", (任务) => {
    logger.info("健康任务完成", {
      event: "worker.health_job.completed",
      queueName: config.redis.healthQueue,
      jobId: 任务.id || "",
      jobName: 任务.name,
      taskId: 任务.data.taskId,
      attemptsMade: 任务.attemptsMade,
    });
  });

  工作器.on("failed", (任务, 错误) => {
    logger.error("健康任务失败", {
      event: "worker.health_job.failed",
      queueName: config.redis.healthQueue,
      jobId: 任务?.id || "",
      jobName: 任务?.name || "",
      taskId: 任务?.data.taskId || "",
      attemptsMade: 任务?.attemptsMade || 0,
      errorMessage: 错误.message,
      stack: config.appEnv === "test" ? 错误.stack : undefined,
    });
  });

  await 队列.waitUntilReady();
  await 工作器.waitUntilReady();
  logger.info("任务服务已启动", {
    event: "worker.service.started",
    queueName: config.redis.healthQueue,
    config: 掩码敏感配置(config),
  });

  注册优雅停止(async () => {
    await 工作器.close();
    await 队列.close();
  }, logger);

  return { 队列, 工作器 };
}

function 注册优雅停止(关闭: () => Promise<void>, logger: 日志器) {
  let 正在停止 = false;
  const 停止 = async (信号: NodeJS.Signals) => {
    if (正在停止) {
      return;
    }

    正在停止 = true;
    logger.info("任务服务收到停止信号", {
      event: "worker.service.stop_signal",
      signal: 信号,
    });
    try {
      await 关闭();
      logger.info("任务服务已优雅停止", {
        event: "worker.service.stopped",
      });
      process.exit(0);
    } catch (错误) {
      const 消息 = 错误 instanceof Error ? 错误.message : "任务服务停止失败，原因未知。";
      logger.error("任务服务停止失败", {
        event: "worker.service.stop_failed",
        errorMessage: 消息,
        stack: 错误 instanceof Error ? 错误.stack : undefined,
      });
      process.exit(1);
    }
  };

  process.once("SIGINT", 停止);
  process.once("SIGTERM", 停止);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  启动任务服务().catch((错误) => {
    记录任务服务启动失败(错误);
    process.exit(1);
  });
}

function 创建任务日志器(config: 应用配置): 日志器 {
  return 创建结构化日志器({
    service: "worker",
    appEnv: config.appEnv,
    minLevel: config.logLevel,
    defaultFields: {
      buildVersion: config.build.version,
      buildCommit: config.build.commit,
    },
    file: {
      ...config.log.file,
      fileName: "worker.log",
    },
  });
}

function 记录任务服务启动失败(错误: unknown): void {
  const logger = 创建结构化日志器({
    service: "worker",
    appEnv: "development",
    minLevel: "info",
  });
  logger.error("任务服务启动失败", {
    event: "worker.service.start_failed",
    errorMessage: 错误 instanceof Error ? 错误.message : "任务服务启动失败，原因未知。",
    stack: 错误 instanceof Error ? 错误.stack : undefined,
  });
}
