import type { 应用环境 } from "@lianruan/shared";
import { z } from "zod";

const 环境结构 = z.object({
  APP_ENV: z.enum(["development", "test", "staging", "production"]).default("development"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  API_HOST: z.string().default("0.0.0.0"),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3100),
  REQUEST_BODY_LIMIT: z.string().default("1mb"),
  TRUSTED_PROXY_IPS: z.string().default("127.0.0.1,::1"),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  SESSION_SECRET: z.string().optional(),
  DATABASE_URL: z.string().optional(),
  REDIS_URL: z.string().optional(),
  HEALTH_DEPENDENCY_MODE: z.enum(["mock", "real"]).default("mock"),
  WORKER_ENABLED: z.enum(["true", "false"]).default("true"),
  WORKER_HEALTH_QUEUE: z.string().default("v3-health"),
  V3_BUILD_VERSION: z.string().default("3.0.0-alpha.1"),
  V3_BUILD_COMMIT: z.string().default("local"),
  V3_BUILD_TIME: z.string().optional(),
});

export interface 应用配置 {
  appEnv: 应用环境;
  logLevel: "debug" | "info" | "warn" | "error";
  api: {
    host: string;
    port: number;
    requestBodyLimit: string;
    trustedProxyIps: string[];
    corsOrigin: string;
  };
  session: {
    secret: string;
  };
  database: {
    url?: string;
  };
  redis: {
    url?: string;
    healthQueue: string;
  };
  worker: {
    enabled: boolean;
  };
  health: {
    dependencyMode: "mock" | "real";
  };
  build: {
    version: string;
    commit: string;
    time?: string;
  };
}

export class 配置错误 extends Error {
  public readonly issues: string[];

  public constructor(issues: string[]) {
    super(issues.join("；"));
    this.name = "配置错误";
    this.issues = issues;
  }
}

export function 读取应用配置(env: NodeJS.ProcessEnv = process.env): 应用配置 {
  const 解析结果 = 环境结构.safeParse(env);
  if (!解析结果.success) {
    const 问题 = 解析结果.error.issues.map(
      (项) => "环境变量 " + 项.path.join(".") + " 不合法：" + 项.message,
    );
    throw new 配置错误(问题);
  }

  const 原始 = 解析结果.data;
  const 问题: string[] = [];
  if (原始.APP_ENV === "production") {
    if (!原始.DATABASE_URL) 问题.push("生产环境必须配置 DATABASE_URL");
    if (!原始.REDIS_URL) 问题.push("生产环境必须配置 REDIS_URL");
    if (!原始.SESSION_SECRET || 原始.SESSION_SECRET.length < 32) {
      问题.push("生产环境 SESSION_SECRET 长度必须不少于32位");
    }
  }
  if (问题.length) throw new 配置错误(问题);

  const 数据库配置: 应用配置["database"] = 原始.DATABASE_URL ? { url: 原始.DATABASE_URL } : {};
  const Redis配置: 应用配置["redis"] = 原始.REDIS_URL
    ? { url: 原始.REDIS_URL, healthQueue: 原始.WORKER_HEALTH_QUEUE }
    : { healthQueue: 原始.WORKER_HEALTH_QUEUE };
  const 构建配置: 应用配置["build"] = 原始.V3_BUILD_TIME
    ? { version: 原始.V3_BUILD_VERSION, commit: 原始.V3_BUILD_COMMIT, time: 原始.V3_BUILD_TIME }
    : { version: 原始.V3_BUILD_VERSION, commit: 原始.V3_BUILD_COMMIT };

  return {
    appEnv: 原始.APP_ENV,
    logLevel: 原始.LOG_LEVEL,
    api: {
      host: 原始.API_HOST,
      port: 原始.API_PORT,
      requestBodyLimit: 原始.REQUEST_BODY_LIMIT,
      trustedProxyIps: 原始.TRUSTED_PROXY_IPS.split(",")
        .map((项) => 项.trim())
        .filter(Boolean),
      corsOrigin: 原始.CORS_ORIGIN,
    },
    session: {
      secret: 原始.SESSION_SECRET || "local-dev-session-secret-change-me",
    },
    database: 数据库配置,
    redis: Redis配置,
    worker: {
      enabled: 原始.WORKER_ENABLED === "true",
    },
    health: {
      dependencyMode: 原始.HEALTH_DEPENDENCY_MODE,
    },
    build: 构建配置,
  };
}

export function 掩码敏感配置(config: 应用配置): 应用配置 {
  return {
    ...config,
    session: { secret: "***已隐藏***" },
    database: config.database.url ? { url: 掩码连接串(config.database.url) } : {},
    redis: config.redis.url
      ? { ...config.redis, url: 掩码连接串(config.redis.url) }
      : { healthQueue: config.redis.healthQueue },
  };
}

function 掩码连接串(value: string): string {
  try {
    const url = new URL(value);
    if (url.password) url.password = "***";
    if (url.username) url.username = "***";
    return url.toString();
  } catch {
    return "***已隐藏***";
  }
}
