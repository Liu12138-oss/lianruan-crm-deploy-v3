import type { 应用配置 } from "@lianruan/config";
import type { Request, Response } from "express";

export interface 日志器 {
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
}

export function 创建日志器(config: 应用配置): 日志器 {
  const 输出 = (
    level: "info" | "warn" | "error",
    message: string,
    fields: Record<string, unknown> = {},
  ) => {
    const line = JSON.stringify({
      level,
      message,
      appEnv: config.appEnv,
      time: new Date().toISOString(),
      ...fields,
    });
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
  };
  return {
    info: (message, fields) => 输出("info", message, fields),
    warn: (message, fields) => 输出("warn", message, fields),
    error: (message, fields) => 输出("error", message, fields),
  };
}

export function 记录请求完成(logger: 日志器, req: Request, res: Response, startedAt: bigint): void {
  const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
  logger.info("接口请求完成", {
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    statusCode: res.statusCode,
    durationMs: Math.round(durationMs),
    ip: req.ip,
  });
}
