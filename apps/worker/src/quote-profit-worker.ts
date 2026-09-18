import { pathToFileURL } from "node:url";

import { type 应用配置, 掩码敏感配置, 读取应用配置 } from "@lianruan/config";
import { 创建结构化日志器, type 日志器 } from "@lianruan/shared";

import { 报价收益任务存储 } from "./quote-profit-store.js";

export async function 启动报价收益任务服务(config: 应用配置 = 读取应用配置()) {
  const logger = 创建收益日志器(config);
  if (!config.quoteProfit.enabled) {
    logger.info("报价收益任务进程保持关闭", { event: "quote_profit.worker.disabled" });
    return { enabled: false as const, close: async () => undefined };
  }
  const 存储 = new 报价收益任务存储(config);
  let 正在执行 = false;
  const 执行 = async () => {
    if (正在执行) return;
    正在执行 = true;
    try {
      while (await 存储.处理下一事件()) {
        // 每条收益事件通过数据库租约领取，本轮清空后等待下一次轮询。
      }
    } catch (错误) {
      logger.error("报价收益任务轮询失败", {
        event: "quote_profit.worker.poll_failed",
        errorMessage: 脱敏错误消息(错误),
      });
    } finally {
      正在执行 = false;
    }
  };
  const 定时器 = setInterval(() => void 执行(), config.quoteProfit.pollIntervalMs);
  void 执行();
  logger.info("报价收益任务进程已启动", {
    event: "quote_profit.worker.started",
    pollIntervalMs: config.quoteProfit.pollIntervalMs,
    maxRetries: config.quoteProfit.maxRetries,
    config: 掩码敏感配置(config),
  });
  return {
    enabled: true as const,
    close: async () => {
      clearInterval(定时器);
      await 存储.close();
    },
  };
}

function 创建收益日志器(config: 应用配置): 日志器 {
  return 创建结构化日志器({
    service: "quote-profit-worker",
    appEnv: config.appEnv,
    minLevel: config.logLevel,
    defaultFields: { buildVersion: config.build.version, buildCommit: config.build.commit },
    file: { ...config.log.file, fileName: "quote-profit-worker.log" },
  });
}

function 注册优雅停止(关闭: () => Promise<void>, logger: 日志器): void {
  let 正在停止 = false;
  const 停止 = async (信号: NodeJS.Signals) => {
    if (正在停止) return;
    正在停止 = true;
    logger.info("报价收益任务进程收到停止信号", {
      event: "quote_profit.worker.stop_signal",
      signal: 信号,
    });
    try {
      await 关闭();
      logger.info("报价收益任务进程已优雅停止", { event: "quote_profit.worker.stopped" });
      process.exit(0);
    } catch (错误) {
      logger.error("报价收益任务进程停止失败", {
        event: "quote_profit.worker.stop_failed",
        errorMessage: 脱敏错误消息(错误),
      });
      process.exit(1);
    }
  };
  process.once("SIGINT", 停止);
  process.once("SIGTERM", 停止);
}

function 脱敏错误消息(错误: unknown): string {
  return (错误 instanceof Error ? 错误.message : "报价收益任务失败，原因未知。")
    .replace(/https?:\/\/[^\s]+/g, "[地址已隐藏]")
    .slice(0, 500);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  启动报价收益任务服务()
    .then((服务) => {
      if (服务.enabled) 注册优雅停止(服务.close, 创建收益日志器(读取应用配置()));
    })
    .catch((错误) => {
      const logger = 创建结构化日志器({
        service: "quote-profit-worker",
        appEnv: "development",
        minLevel: "info",
      });
      logger.error("报价收益任务进程启动失败", {
        event: "quote_profit.worker.start_failed",
        errorMessage: 脱敏错误消息(错误),
      });
      process.exit(1);
    });
}
