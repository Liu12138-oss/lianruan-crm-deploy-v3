import { createReadStream, createWriteStream } from "node:fs";
import * as fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";

export {
  type 正式报价单数据,
  type 正式报价单明细,
  type 正式报价单明细类型,
  生成正式报价单PDF,
  生成订单预审采购内容,
  type 订单预审报价单,
} from "./formal-quote-pdf.js";
export {
  事件代码集合,
  事件目录,
  到期数据源代码集合,
  到期数据源目录,
  接收人类型目录,
  type 提醒任务类型,
  type 提醒变量定义,
  type 提醒接收人类型,
  type 提醒渠道代码,
  提醒渠道目录,
  查找事件,
  查找到期数据源,
} from "./message-catalog.js";

export type 应用环境 = "development" | "test" | "staging" | "production";

export type 日志级别 = "debug" | "info" | "warn" | "error";

export type 日志字段 = Record<string, unknown>;

export interface 日志器 {
  debug(message: string, fields?: 日志字段): void;
  info(message: string, fields?: 日志字段): void;
  warn(message: string, fields?: 日志字段): void;
  error(message: string, fields?: 日志字段): void;
  child(fields: 日志字段): 日志器;
  flush(): Promise<void>;
}

export interface 日志文件配置 {
  enabled: boolean;
  dir: string;
  fileName?: string;
  maxBytes?: number;
  maxFiles?: number;
  compressRotated?: boolean;
}

export interface 结构化日志配置 {
  service: string;
  appEnv: 应用环境;
  minLevel?: 日志级别;
  defaultFields?: 日志字段;
  file?: 日志文件配置;
}

const 日志级别权重: Record<日志级别, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const 最大日志文本长度 = 2000;
const 最大日志对象深度 = 6;
const 默认日志文件最大字节数 = 10 * 1024 * 1024;
const 默认日志备份文件数 = 10;
const 敏感字段模式 =
  /(password|passwd|secret|token|authorization|cookie|session|credential|signature|appsecret|accesskey|privatekey|sso|密码|密钥|令牌|凭证|签名|授权|会话)/i;
const 敏感诊断字段模式 =
  /(fingerprint|指纹|digest|摘要|length|长度|present|存在|enabled|启用|written|写入|cleared|清理|secure|安全)$/i;

export function 创建结构化日志器(配置: 结构化日志配置): 日志器 {
  return 创建结构化日志器实例(配置, 创建日志文件写入器(配置));
}

function 创建结构化日志器实例(
  配置: 结构化日志配置,
  文件写入器: 日志文件写入器 | undefined,
): 日志器 {
  const 最小级别 = 配置.minLevel || "info";
  const 基础字段 = 清理日志字段(配置.defaultFields || {}) as 日志字段;
  const 输出 = (level: 日志级别, message: string, fields: 日志字段 = {}) => {
    if (日志级别权重[level] < 日志级别权重[最小级别]) return;
    const line = JSON.stringify(
      清理日志字段({
        ...基础字段,
        ...fields,
        time: new Date().toISOString(),
        level,
        service: 配置.service,
        appEnv: 配置.appEnv,
        message,
      }),
    );
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
    文件写入器?.write(line);
  };

  return {
    debug: (message, fields) => 输出("debug", message, fields),
    info: (message, fields) => 输出("info", message, fields),
    warn: (message, fields) => 输出("warn", message, fields),
    error: (message, fields) => 输出("error", message, fields),
    child: (fields) =>
      创建结构化日志器实例(
        {
          ...配置,
          defaultFields: { ...基础字段, ...(清理日志字段(fields) as 日志字段) },
        },
        文件写入器,
      ),
    flush: () => 文件写入器?.flush() || Promise.resolve(),
  };
}

interface 日志文件写入器 {
  write(line: string): void;
  flush(): Promise<void>;
}

function 创建日志文件写入器(配置: 结构化日志配置): 日志文件写入器 | undefined {
  const 文件配置 = 配置.file;
  if (!文件配置?.enabled) return undefined;

  const 目录 = path.resolve(文件配置.dir || path.join(os.tmpdir(), "lianruan-crm-v3-logs"));
  const 文件名 = 文件配置.fileName || 配置.service + ".log";
  const 当前文件路径 = path.join(目录, 文件名);
  const 最大字节数 = Math.max(1, 文件配置.maxBytes || 默认日志文件最大字节数);
  const 最大备份数 = Math.max(1, 文件配置.maxFiles || 默认日志备份文件数);
  const 是否压缩 = 文件配置.compressRotated !== false;
  const 文件前缀 = 读取日志文件前缀(文件名);
  let 当前字节数: number | undefined;
  let 轮转序号 = 0;
  let 写入队列 = Promise.resolve();

  const 写入 = async (line: string) => {
    const 内容 = line + "\n";
    const 内容字节数 = Buffer.byteLength(内容);
    await fs.mkdir(目录, { recursive: true });
    当前字节数 = 当前字节数 ?? (await 读取文件字节数(当前文件路径));
    if (当前字节数 > 0 && 当前字节数 + 内容字节数 > 最大字节数) {
      await 轮转日志文件();
    }
    await fs.appendFile(当前文件路径, 内容, "utf8");
    当前字节数 += 内容字节数;
  };

  const 轮转日志文件 = async () => {
    const 原始字节数 = await 读取文件字节数(当前文件路径);
    if (原始字节数 <= 0) {
      当前字节数 = 0;
      return;
    }

    const 轮转文件路径 = path.join(目录, 创建轮转日志文件名(文件前缀, ++轮转序号));
    await fs.rename(当前文件路径, 轮转文件路径);
    当前字节数 = 0;
    if (是否压缩) {
      const 压缩文件路径 = 轮转文件路径 + ".gz";
      await pipeline(createReadStream(轮转文件路径), createGzip(), createWriteStream(压缩文件路径));
      await fs.unlink(轮转文件路径);
    }
    await 清理过期日志文件(目录, 文件前缀, 最大备份数);
  };

  return {
    write(line) {
      写入队列 = 写入队列.then(() => 写入(line)).catch((错误) => 报告日志文件写入失败(配置, 错误));
    },
    async flush() {
      await 写入队列;
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

function 读取日志文件前缀(文件名: string): string {
  return 文件名.endsWith(".log") ? 文件名.slice(0, -4) : 文件名;
}

function 创建轮转日志文件名(文件前缀: string, 序号: number): string {
  const 时间 = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
  return 文件前缀 + "-" + 时间 + "-" + String(序号).padStart(4, "0") + ".log";
}

async function 清理过期日志文件(目录: string, 文件前缀: string, 最大备份数: number): Promise<void> {
  const 文件列表 = await fs.readdir(目录);
  const 备份文件 = (
    await Promise.all(
      文件列表
        .filter((文件名) => 文件名.startsWith(文件前缀 + "-") && /\.log(\.gz)?$/.test(文件名))
        .map(async (文件名) => {
          const 文件路径 = path.join(目录, 文件名);
          return { 文件路径, 修改时间: (await fs.stat(文件路径)).mtimeMs };
        }),
    )
  ).sort((左, 右) => 右.修改时间 - 左.修改时间);

  await Promise.all(备份文件.slice(最大备份数).map((文件) => fs.unlink(文件.文件路径)));
}

function 报告日志文件写入失败(配置: 结构化日志配置, 错误: unknown): void {
  const line = JSON.stringify({
    time: new Date().toISOString(),
    level: "error",
    service: 配置.service,
    appEnv: 配置.appEnv,
    event: "logger.file_write_failed",
    message: "日志文件写入失败",
    errorMessage: 错误 instanceof Error ? 错误.message : "未知错误",
  });
  console.error(line);
}

function 读取错误编号(错误: unknown): string {
  return typeof 错误 === "object" && 错误 !== null && "code" in 错误
    ? String((错误 as { code?: unknown }).code)
    : "";
}

export function 清理日志字段(value: unknown): unknown {
  return 清理日志值(value, new WeakSet<object>(), 0);
}

function 清理日志值(value: unknown, 已访问对象: WeakSet<object>, 深度: number): unknown {
  if (value === undefined) return undefined;
  if (value === null || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "string") return 截断日志文本(value);
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) {
    return 清理日志对象(
      {
        name: value.name,
        message: value.message,
        stack: value.stack,
      },
      已访问对象,
      深度 + 1,
    );
  }
  if (Array.isArray(value)) {
    if (深度 >= 最大日志对象深度) return "[对象过深]";
    return value.map((项) => 清理日志值(项, 已访问对象, 深度 + 1));
  }
  if (typeof value === "object") {
    if (已访问对象.has(value)) return "[循环引用]";
    if (深度 >= 最大日志对象深度) return "[对象过深]";
    已访问对象.add(value);
    return 清理日志对象(value as Record<string, unknown>, 已访问对象, 深度 + 1);
  }
  return String(value);
}

function 清理日志对象(
  value: Record<string, unknown>,
  已访问对象: WeakSet<object>,
  深度: number,
): 日志字段 {
  const 结果: 日志字段 = {};
  for (const [key, 原始值] of Object.entries(value)) {
    if (原始值 === undefined) continue;
    结果[key] =
      敏感字段模式.test(key) && !敏感诊断字段模式.test(key)
        ? "***已隐藏***"
        : 清理日志值(原始值, 已访问对象, 深度);
  }
  return 结果;
}

function 截断日志文本(value: string): string {
  if (value.length <= 最大日志文本长度) return value;
  return value.slice(0, 最大日志文本长度) + "...[已截断]";
}

export interface 构建信息 {
  版本: string;
  提交: string;
  构建时间: string;
}

export interface 标准成功响应<T数据> {
  success: true;
  data: T数据;
  meta: {
    requestId: string;
    build: 构建信息;
  };
}

export interface 标准错误响应 {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta: {
    requestId: string;
    build: 构建信息;
  };
}

export type 标准响应<T数据> = 标准成功响应<T数据> | 标准错误响应;

export interface 健康依赖状态 {
  name: "config" | "postgres" | "redis" | "migration" | "worker";
  status: "ok" | "failed" | "skipped";
  message: string;
  checkedAt: string;
  latencyMs?: number;
}

export interface 健康检查结果 {
  status: "ok" | "degraded" | "failed";
  service: string;
  checkedAt: string;
  dependencies: 健康依赖状态[];
}

export class 应用错误 extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: unknown;

  public constructor(code: string, message: string, statusCode = 500, details?: unknown) {
    super(message);
    this.name = "应用错误";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function 创建构建信息(env: NodeJS.ProcessEnv = process.env): 构建信息 {
  return {
    版本: env.V3_BUILD_VERSION || "3.0.0-stage9.20260727",
    提交: env.V3_BUILD_COMMIT || "local",
    构建时间: env.V3_BUILD_TIME || new Date().toISOString(),
  };
}

export function 创建成功响应<T数据>(参数: {
  data: T数据;
  requestId: string;
  build: 构建信息;
}): 标准成功响应<T数据> {
  return {
    success: true,
    data: 参数.data,
    meta: {
      requestId: 参数.requestId,
      build: 参数.build,
    },
  };
}

export function 创建错误响应(参数: {
  error: Error | 应用错误;
  requestId: string;
  build: 构建信息;
}): 标准错误响应 {
  const 应用级错误 = 参数.error instanceof 应用错误 ? 参数.error : null;
  return {
    success: false,
    error: {
      code: 应用级错误?.code || "V3_INTERNAL_ERROR",
      message: 应用级错误?.message || "系统处理失败，请联系管理员。",
      details: 应用级错误?.details,
    },
    meta: {
      requestId: 参数.requestId,
      build: 参数.build,
    },
  };
}

export function 判断健康状态(依赖集合: 健康依赖状态[]): 健康检查结果["status"] {
  if (依赖集合.some((依赖) => 依赖.status === "failed")) return "failed";
  if (依赖集合.some((依赖) => 依赖.status === "skipped")) return "degraded";
  return "ok";
}
