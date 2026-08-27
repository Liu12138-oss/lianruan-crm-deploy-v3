import type { Server } from "node:http";
import { pathToFileURL } from "node:url";

import { type 应用配置, 掩码敏感配置, 读取应用配置 } from "@lianruan/config";
import { 创建结构化日志器 } from "@lianruan/shared";

import { 创建应用 } from "./create-app.js";
import { 创建日志器, type 日志器 } from "./logger.js";

export function 启动接口服务(config: 应用配置 = 读取应用配置()): Server {
  const logger = 创建日志器(config);
  const app = 创建应用({ config, logger });
  const 服务 = app.listen(config.api.port, config.api.host, () => {
    logger.info("接口服务已启动", {
      event: "api.service.started",
      host: config.api.host,
      port: config.api.port,
      config: 掩码敏感配置(config),
    });
  });

  注册优雅停止(服务, logger, async () => {
    const 关闭资源 = app.locals.关闭资源 as (() => Promise<void>) | undefined;
    await 关闭资源?.();
  });
  return 服务;
}

function 注册优雅停止(服务: Server, logger: 日志器, 关闭资源: () => Promise<void>) {
  let 正在停止 = false;

  const 停止 = (信号: NodeJS.Signals) => {
    if (正在停止) {
      return;
    }

    正在停止 = true;
    logger.info("接口服务收到停止信号", {
      event: "api.service.stop_signal",
      signal: 信号,
    });
    const 强制退出计时器 = setTimeout(() => {
      logger.error("接口服务停止超时，执行强制退出", {
        event: "api.service.stop_timeout",
        timeoutMs: 10000,
      });
      process.exit(1);
    }, 10000);

    服务.close(async (错误) => {
      clearTimeout(强制退出计时器);
      if (错误) {
        logger.error("接口服务停止失败", {
          event: "api.service.stop_failed",
          errorMessage: 错误.message,
        });
        process.exit(1);
      }

      try {
        await 关闭资源();
        logger.info("接口服务已优雅停止", {
          event: "api.service.stopped",
        });
        process.exit(0);
      } catch (关闭错误) {
        logger.error("接口服务资源关闭失败", {
          event: "api.service.resource_close_failed",
          errorMessage: 关闭错误 instanceof Error ? 关闭错误.message : "原因未知",
        });
        process.exit(1);
      }
    });
  };

  process.once("SIGINT", 停止);
  process.once("SIGTERM", 停止);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    启动接口服务();
  } catch (错误) {
    记录接口服务启动失败(错误);
    process.exit(1);
  }
}

function 记录接口服务启动失败(错误: unknown): void {
  const logger = 创建结构化日志器({
    service: "api",
    appEnv: "development",
    minLevel: "info",
  });
  logger.error("接口服务启动失败", {
    event: "api.service.start_failed",
    errorMessage: 错误 instanceof Error ? 错误.message : "接口服务启动失败，原因未知。",
    stack: 错误 instanceof Error ? 错误.stack : undefined,
  });
}
