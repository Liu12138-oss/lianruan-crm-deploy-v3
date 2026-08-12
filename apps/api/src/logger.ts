import { createReadStream, createWriteStream } from "node:fs";
import * as fs from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";

import type { 应用配置 } from "@lianruan/config";
import { 创建结构化日志器, type 日志器 } from "@lianruan/shared";
import type { Request, Response } from "express";

export type { 日志器 } from "@lianruan/shared";

export interface 认证流程日志器 {
  write(line: string): void;
  flush(): Promise<void>;
}

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

export function 创建认证流程日志器(config: 应用配置): 认证流程日志器 | undefined {
  if (!config.log.file.enabled) return undefined;
  const 目录 = path.resolve(config.log.file.dir);
  const 当前文件路径 = path.join(目录, "auth-flow.log");
  const 最大字节数 = Math.max(1, config.log.file.maxBytes);
  const 最大备份数 = Math.max(1, config.log.file.maxFiles);
  const 是否压缩 = config.log.file.compressRotated;
  let 当前字节数: number | undefined;
  let 轮转序号 = 0;
  let 写入队列 = Promise.resolve();

  const 写入 = async (line: string) => {
    const 内容 = line + "\n";
    const 内容字节数 = Buffer.byteLength(内容);
    await fs.mkdir(目录, { recursive: true });
    当前字节数 = 当前字节数 ?? (await 读取文件字节数(当前文件路径));
    if (当前字节数 > 0 && 当前字节数 + 内容字节数 > 最大字节数) {
      await 轮转认证流程日志();
    }
    await fs.appendFile(当前文件路径, 内容, "utf8");
    当前字节数 += 内容字节数;
  };

  const 轮转认证流程日志 = async () => {
    const 原始字节数 = await 读取文件字节数(当前文件路径);
    if (原始字节数 <= 0) {
      当前字节数 = 0;
      return;
    }
    const 轮转文件路径 = path.join(目录, 创建轮转日志文件名("auth-flow", ++轮转序号));
    await fs.rename(当前文件路径, 轮转文件路径);
    当前字节数 = 0;
    if (是否压缩) {
      const 压缩文件路径 = 轮转文件路径 + ".gz";
      await pipeline(createReadStream(轮转文件路径), createGzip(), createWriteStream(压缩文件路径));
      await fs.unlink(轮转文件路径);
    }
    await 清理过期认证流程日志(目录, 最大备份数);
  };

  return {
    write(line) {
      写入队列 = 写入队列
        .then(() => 写入(line))
        .catch((错误) => 报告认证流程日志写入失败(config, 错误));
    },
    flush() {
      return 写入队列;
    },
  };
}

async function 读取文件字节数(文件路径: string): Promise<number> {
  try {
    return (await fs.stat(文件路径)).size;
  } catch (错误) {
    if (读取错误编号(错误) === "ENOENT") return 0;
    throw 错误;
  }
}

function 创建轮转日志文件名(文件前缀: string, 序号: number): string {
  const 时间 = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
  return 文件前缀 + "-" + 时间 + "-" + String(序号).padStart(4, "0") + ".log";
}

async function 清理过期认证流程日志(目录: string, 最大备份数: number): Promise<void> {
  const 文件列表 = await fs.readdir(目录);
  const 备份文件 = (
    await Promise.all(
      文件列表
        .filter((文件名) => 文件名.startsWith("auth-flow-") && /\.log(\.gz)?$/.test(文件名))
        .map(async (文件名) => {
          const 文件路径 = path.join(目录, 文件名);
          return { 文件路径, 修改时间: (await fs.stat(文件路径)).mtimeMs };
        }),
    )
  ).sort((左, 右) => 右.修改时间 - 左.修改时间);

  await Promise.all(备份文件.slice(最大备份数).map((文件) => fs.unlink(文件.文件路径)));
}

function 报告认证流程日志写入失败(config: 应用配置, 错误: unknown): void {
  const line = JSON.stringify({
    time: new Date().toISOString(),
    level: "error",
    service: "api",
    appEnv: config.appEnv,
    event: "logger.auth_flow_file_write_failed",
    message: "认证流程摘要日志写入失败",
    errorMessage: 错误 instanceof Error ? 错误.message : "未知错误",
  });
  console.error(line);
}

function 读取错误编号(错误: unknown): string {
  return typeof 错误 === "object" && 错误 !== null && "code" in 错误
    ? String((错误 as { code?: unknown }).code)
    : "";
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
