import type { 应用配置 } from "@lianruan/config";
import { 创建结构化日志器, type 日志器 } from "@lianruan/shared";
import type { Request, Response } from "express";

export type { 日志器 } from "@lianruan/shared";

export function 创建日志器(config: 应用配置): 日志器 {
  return 创建结构化日志器({
    service: "api",
    appEnv: config.appEnv,
    minLevel: config.logLevel,
    defaultFields: {
      buildVersion: config.build.version,
      buildCommit: config.build.commit,
    },
    file: {
      ...config.log.file,
      fileName: "api.log",
    },
  });
}

export function 记录请求完成(logger: 日志器, req: Request, res: Response, startedAt: bigint): void {
  const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
  const level = 选择请求日志级别(res.statusCode);
  logger[level]("接口请求完成", {
    event: "api.request.completed",
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    route: 读取匹配路由(req),
    statusCode: res.statusCode,
    statusFamily: 读取状态码族(res.statusCode),
    resultCode: res.statusCode >= 400 ? "failed" : "success",
    durationMs: Math.round(durationMs),
    queryKeys: 读取查询字段(req),
    responseBytes: 读取响应字节数(res),
    ip: 读取客户端IP(req),
    userAgent: req.get("user-agent") || "",
    referer: req.get("referer") || "",
  });
}

function 选择请求日志级别(statusCode: number): "info" | "warn" | "error" {
  if (statusCode >= 500) return "error";
  if (statusCode >= 400) return "warn";
  return "info";
}

function 读取状态码族(statusCode: number): string {
  return Math.floor(statusCode / 100) + "xx";
}

function 读取查询字段(req: Request): string[] {
  return Object.keys(req.query).sort();
}

function 读取响应字节数(res: Response): number | undefined {
  const value = res.getHeader("content-length");
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function 读取客户端IP(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim())
    return forwarded.split(",")[0]?.trim() || "";
  return req.ip || req.socket.remoteAddress || "";
}

function 读取匹配路由(req: Request): string {
  const 路由 = req.route as { path?: string } | undefined;
  if (!路由?.path) return "";
  if (typeof 路由.path === "string") return 路由.path;
  return "";
}
