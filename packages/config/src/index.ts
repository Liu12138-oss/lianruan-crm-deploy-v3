import type { 应用环境 } from "@lianruan/shared";
import { z } from "zod";

import { 校验消息通道配置加密密钥 as 校验通道密钥 } from "./message-channel-secrets.js";

export {
  加密消息通道配置,
  校验消息通道配置加密密钥,
  type 消息通道密文,
  生成消息通道配置加密密钥,
  解密消息通道配置,
} from "./message-channel-secrets.js";

const 环境结构 = z.object({
  APP_ENV: z.enum(["development", "test", "staging", "production"]).default("development"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  LOG_TO_FILE: z.enum(["true", "false"]).default("false"),
  LOG_DIR: z.string().default("/app/logs"),
  LOG_MAX_BYTES: z.coerce
    .number()
    .int()
    .min(1)
    .default(10 * 1024 * 1024),
  LOG_MAX_FILES: z.coerce.number().int().min(1).default(10),
  LOG_COMPRESS_ROTATED: z.enum(["true", "false"]).default("true"),
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
  V3_ORGANIZATION_CHANNEL_PHONE_EDIT_ENABLED: z.enum(["true", "false"]).default("false"),
  V3_AUTH_ACCOUNT_STATUS_CHECK_ENABLED: z.enum(["true", "false"]).default("false"),
  V3_ORGANIZATION_OFFBOARDING_ENABLED: z.enum(["true", "false"]).default("false"),
  V3_ORGANIZATION_OFFBOARDING_POLL_INTERVAL_MS: z.coerce
    .number()
    .int()
    .min(1_000)
    .max(60_000)
    .default(5_000),
  ORDER_PREAPPROVAL_WORKER_ENABLED: z.enum(["true", "false"]).default("false"),
  ORDER_PREAPPROVAL_EVENT_CUTOVER_AT: z.string().datetime({ offset: true }).optional(),
  ORDER_PREAPPROVAL_POLL_INTERVAL_MS: z.coerce.number().int().min(1_000).max(60_000).default(5_000),
  ORDER_PREAPPROVAL_REQUEST_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(1_000)
    .max(60_000)
    .default(15_000),
  ORDER_PREAPPROVAL_FILE_DIR: z.string().trim().min(1).default("/app/uploads/order-preapproval"),
  ORDER_PREAPPROVAL_ETEAMS_ORIGIN: z.string().url().optional(),
  ORDER_PREAPPROVAL_ETEAMS_CORP_ID: z.string().trim().min(1).max(256).optional(),
  ORDER_PREAPPROVAL_ETEAMS_APP_KEY: z.string().trim().min(1).max(256).optional(),
  ORDER_PREAPPROVAL_ETEAMS_APP_SECRET: z.string().trim().min(16).max(1024).optional(),
  MESSAGE_WORKER_ENABLED: z.enum(["true", "false"]).default("false"),
  MESSAGE_WORKER_ROLE: z.enum(["critical", "integration", "maintenance"]).default("critical"),
  MESSAGE_EVENT_CUTOVER_AT: z.string().datetime({ offset: true }).optional(),
  MESSAGE_NOTIFICATION_QUEUE: z.string().trim().min(1).default("v3-notification"),
  MESSAGE_INTEGRATION_QUEUE: z.string().trim().min(1).default("v3-integration"),
  MESSAGE_MAINTENANCE_QUEUE: z.string().trim().min(1).default("v3-maintenance"),
  MESSAGE_CRITICAL_CONCURRENCY: z.coerce.number().int().min(1).max(20).default(3),
  MESSAGE_INTEGRATION_CONCURRENCY: z.coerce.number().int().min(1).max(20).default(3),
  MESSAGE_MAINTENANCE_CONCURRENCY: z.coerce.number().int().min(1).max(10).default(1),
  MESSAGE_CLAIM_BATCH_SIZE: z.coerce.number().int().min(1).max(500).default(100),
  MESSAGE_REMINDER_BATCH_SIZE: z.coerce.number().int().min(1).max(1000).default(200),
  MESSAGE_REMINDER_ADVANCE_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  MESSAGE_REMINDER_DIGEST_MINUTES: z.coerce
    .number()
    .int()
    .refine((value) => value === 0 || value === 15 || value === 60, "仅允许 0、15 或 60")
    .transform((value) => value as 0 | 15 | 60)
    .default(0),
  MESSAGE_DEFAULT_DIGEST_MINUTES: z.coerce.number().int().min(0).max(1440).default(0),
  MESSAGE_TASK_FAILURE_THRESHOLD: z.coerce.number().int().min(1).max(100).default(5),
  MESSAGE_CHANNEL_CONFIG_ENCRYPTION_KEY: z.string().trim().min(40).optional(),
  MESSAGE_WECOM_GROUP_ENABLED: z.enum(["true", "false"]).default("false"),
  MESSAGE_WECOM_GROUP_WEBHOOK: z.string().url().optional(),
  MESSAGE_WECOM_GROUP_MAX_PER_MINUTE: z.coerce.number().int().min(1).max(200).default(20),
  MESSAGE_WECOM_APP_ENABLED: z.enum(["true", "false"]).default("false"),
  MESSAGE_WECOM_APP_CORP_ID: z.string().trim().min(1).max(128).optional(),
  MESSAGE_WECOM_APP_AGENT_ID: z.coerce.number().int().min(1).max(9_999_999_999).optional(),
  MESSAGE_WECOM_APP_SECRET: z.string().trim().min(16).max(1024).optional(),
  MESSAGE_WECOM_APP_MAX_PER_MINUTE: z.coerce.number().int().min(1).max(200).default(20),
  MESSAGE_EXTERNAL_REQUEST_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(1_000)
    .max(60_000)
    .default(10_000),
  MESSAGE_SMS_ENABLED: z.enum(["true", "false"]).default("false"),
  MESSAGE_SMS_PROVIDER_CODE: z.literal("generic_http_v1").default("generic_http_v1"),
  MESSAGE_SMS_ENDPOINT: z.string().url().optional(),
  MESSAGE_SMS_API_KEY: z.string().trim().min(8).optional(),
  MESSAGE_SMS_API_SECRET: z.string().trim().min(16).optional(),
  MESSAGE_SMS_TEMPLATE_ID: z.string().trim().min(1).max(128).optional(),
  MESSAGE_SMS_SENDER: z.string().trim().min(1).max(64).optional(),
  MESSAGE_SMS_MAX_PER_MINUTE: z.coerce.number().int().min(1).max(1_000).default(20),
  MESSAGE_EMAIL_ENABLED: z.enum(["true", "false"]).default("false"),
  MESSAGE_EMAIL_SMTP_HOST: z.string().trim().min(1).max(253).optional(),
  MESSAGE_EMAIL_SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  MESSAGE_EMAIL_SMTP_SECURITY: z.enum(["starttls", "tls"]).default("starttls"),
  MESSAGE_EMAIL_SMTP_USERNAME: z.string().trim().min(1).max(320).optional(),
  MESSAGE_EMAIL_SMTP_PASSWORD: z.string().trim().min(8).max(1024).optional(),
  MESSAGE_EMAIL_FROM: z.string().trim().email().max(320).optional(),
  MESSAGE_EMAIL_MAX_PER_MINUTE: z.coerce.number().int().min(1).max(1000).default(20),
  V3_BUILD_VERSION: z.string().default("3.0.0-stage9.20260727"),
  V3_BUILD_COMMIT: z.string().default("local"),
  V3_BUILD_TIME: z.string().optional(),
});

type 已解析环境变量 = z.output<typeof 环境结构>;

export interface 应用配置 {
  appEnv: 应用环境;
  logLevel: "debug" | "info" | "warn" | "error";
  log: {
    file: {
      enabled: boolean;
      dir: string;
      maxBytes: number;
      maxFiles: number;
      compressRotated: boolean;
    };
  };
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
  organization: {
    channelPhoneEditEnabled: boolean;
    accountStatusCheckEnabled: boolean;
    offboardingEnabled: boolean;
    offboardingPollIntervalMs: number;
  };
  orderPreapproval: {
    enabled: boolean;
    eventCutoverAt?: string;
    pollIntervalMs: number;
    requestTimeoutMs: number;
    fileDir: string;
    eteams: {
      origin?: string;
      corpId?: string;
      appKey?: string;
      appSecret?: string;
    };
  };
  message: {
    enabled: boolean;
    role: "critical" | "integration" | "maintenance";
    eventCutoverAt?: string;
    queues: {
      notification: string;
      integration: string;
      maintenance: string;
    };
    concurrency: {
      critical: number;
      integration: number;
      maintenance: number;
    };
    claimBatchSize: number;
    reminderBatchSize: number;
    reminderAdvanceDays: number;
    reminderDigestMinutes: 0 | 15 | 60;
    defaultDigestMinutes: number;
    taskFailureThreshold: number;
    channelConfigEncryptionKey?: string;
    channels: {
      wecomGroup: {
        enabled: boolean;
        webhook?: string;
        maxPerMinute: number;
      };
      wecomApp: {
        enabled: boolean;
        corpId?: string;
        agentId?: number;
        secret?: string;
        maxPerMinute: number;
      };
      sms: {
        enabled: boolean;
        providerCode: "generic_http_v1";
        endpoint?: string;
        apiKey?: string;
        apiSecret?: string;
        templateId?: string;
        sender?: string;
        maxPerMinute: number;
      };
      email: {
        enabled: boolean;
        smtpHost?: string;
        smtpPort: number;
        security: "starttls" | "tls";
        username?: string;
        password?: string;
        from?: string;
        maxPerMinute: number;
      };
      requestTimeoutMs: number;
    };
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
  if (原始.MESSAGE_CHANNEL_CONFIG_ENCRYPTION_KEY) {
    try {
      校验通道密钥(原始.MESSAGE_CHANNEL_CONFIG_ENCRYPTION_KEY);
    } catch (error) {
      throw new 配置错误([error instanceof Error ? error.message : "消息通道配置加密密钥不合法。"]);
    }
  }
  const 问题 = 校验运行时配置(原始);
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
    log: {
      file: {
        enabled: 原始.LOG_TO_FILE === "true",
        dir: 原始.LOG_DIR,
        maxBytes: 原始.LOG_MAX_BYTES,
        maxFiles: 原始.LOG_MAX_FILES,
        compressRotated: 原始.LOG_COMPRESS_ROTATED === "true",
      },
    },
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
    organization: {
      channelPhoneEditEnabled: 原始.V3_ORGANIZATION_CHANNEL_PHONE_EDIT_ENABLED === "true",
      accountStatusCheckEnabled: 原始.V3_AUTH_ACCOUNT_STATUS_CHECK_ENABLED === "true",
      offboardingEnabled: 原始.V3_ORGANIZATION_OFFBOARDING_ENABLED === "true",
      offboardingPollIntervalMs: 原始.V3_ORGANIZATION_OFFBOARDING_POLL_INTERVAL_MS,
    },
    orderPreapproval: 构建订单预审配置(原始),
    message: 构建消息配置(原始),
    health: {
      dependencyMode: 原始.HEALTH_DEPENDENCY_MODE,
    },
    build: 构建配置,
  };
}

function 校验运行时配置(原始: 已解析环境变量): string[] {
  const 问题: string[] = [];
  if (原始.APP_ENV === "production") {
    if (!原始.DATABASE_URL) 问题.push("生产环境必须配置 DATABASE_URL");
    if (!原始.REDIS_URL) 问题.push("生产环境必须配置 REDIS_URL");
    if (!原始.SESSION_SECRET || 原始.SESSION_SECRET.length < 32) {
      问题.push("生产环境 SESSION_SECRET 长度必须不少于32位");
    }
  }
  if (原始.MESSAGE_WORKER_ENABLED === "true" && !原始.MESSAGE_EVENT_CUTOVER_AT) {
    问题.push("启用消息任务进程时必须配置 MESSAGE_EVENT_CUTOVER_AT");
  }
  if (
    原始.V3_ORGANIZATION_OFFBOARDING_ENABLED === "true" &&
    原始.V3_AUTH_ACCOUNT_STATUS_CHECK_ENABLED !== "true"
  ) {
    问题.push(
      "启用账号停用归档与交接时必须同时启用 V3_AUTH_ACCOUNT_STATUS_CHECK_ENABLED，确保停用账号的旧会话立即失效",
    );
  }
  if (原始.ORDER_PREAPPROVAL_WORKER_ENABLED === "true") {
    if (!原始.ORDER_PREAPPROVAL_EVENT_CUTOVER_AT) {
      问题.push("启用订单预审任务进程时必须配置 ORDER_PREAPPROVAL_EVENT_CUTOVER_AT");
    }
    if (
      !原始.ORDER_PREAPPROVAL_ETEAMS_ORIGIN ||
      !是安全HTTPS地址(原始.ORDER_PREAPPROVAL_ETEAMS_ORIGIN)
    ) {
      问题.push("启用订单预审任务进程时 ORDER_PREAPPROVAL_ETEAMS_ORIGIN 必须是 HTTPS 地址");
    }
    if (!原始.ORDER_PREAPPROVAL_ETEAMS_CORP_ID) {
      问题.push("启用订单预审任务进程时必须配置 ORDER_PREAPPROVAL_ETEAMS_CORP_ID");
    }
    if (!原始.ORDER_PREAPPROVAL_ETEAMS_APP_KEY) {
      问题.push("启用订单预审任务进程时必须配置 ORDER_PREAPPROVAL_ETEAMS_APP_KEY");
    }
    if (!原始.ORDER_PREAPPROVAL_ETEAMS_APP_SECRET) {
      问题.push("启用订单预审任务进程时必须配置 ORDER_PREAPPROVAL_ETEAMS_APP_SECRET");
    }
    if (!原始.MESSAGE_CHANNEL_CONFIG_ENCRYPTION_KEY) {
      问题.push(
        "启用订单预审任务进程时必须配置 MESSAGE_CHANNEL_CONFIG_ENCRYPTION_KEY，以受控读取企微建群应用",
      );
    }
  }
  if (原始.MESSAGE_WECOM_GROUP_ENABLED === "true" && !原始.MESSAGE_WECOM_GROUP_WEBHOOK) {
    问题.push("启用企微群机器人时必须配置 MESSAGE_WECOM_GROUP_WEBHOOK");
  }
  if (原始.MESSAGE_WECOM_GROUP_WEBHOOK && !是企微群机器人地址(原始.MESSAGE_WECOM_GROUP_WEBHOOK)) {
    问题.push("MESSAGE_WECOM_GROUP_WEBHOOK 必须是企微群机器人 HTTPS 地址");
  }
  if (原始.MESSAGE_WECOM_APP_ENABLED === "true") {
    if (!原始.MESSAGE_WECOM_APP_CORP_ID)
      问题.push("启用企微应用时必须配置 MESSAGE_WECOM_APP_CORP_ID");
    if (!原始.MESSAGE_WECOM_APP_AGENT_ID)
      问题.push("启用企微应用时必须配置 MESSAGE_WECOM_APP_AGENT_ID");
    if (!原始.MESSAGE_WECOM_APP_SECRET)
      问题.push("启用企微应用时必须配置 MESSAGE_WECOM_APP_SECRET");
  }
  if (原始.MESSAGE_SMS_ENABLED === "true") {
    if (!原始.MESSAGE_SMS_ENDPOINT || !是安全短信网关地址(原始.MESSAGE_SMS_ENDPOINT)) {
      问题.push("启用短信通道时 MESSAGE_SMS_ENDPOINT 必须是 HTTPS 地址");
    }
    if (!原始.MESSAGE_SMS_API_KEY) 问题.push("启用短信通道时必须配置 MESSAGE_SMS_API_KEY");
    if (!原始.MESSAGE_SMS_API_SECRET) 问题.push("启用短信通道时必须配置 MESSAGE_SMS_API_SECRET");
    if (!原始.MESSAGE_SMS_TEMPLATE_ID) 问题.push("启用短信通道时必须配置 MESSAGE_SMS_TEMPLATE_ID");
  }
  if (原始.MESSAGE_EMAIL_ENABLED === "true") {
    if (!原始.MESSAGE_EMAIL_SMTP_HOST) 问题.push("启用邮箱通道时必须配置 MESSAGE_EMAIL_SMTP_HOST");
    if (!原始.MESSAGE_EMAIL_SMTP_USERNAME)
      问题.push("启用邮箱通道时必须配置 MESSAGE_EMAIL_SMTP_USERNAME");
    if (!原始.MESSAGE_EMAIL_SMTP_PASSWORD)
      问题.push("启用邮箱通道时必须配置 MESSAGE_EMAIL_SMTP_PASSWORD");
    if (!原始.MESSAGE_EMAIL_FROM) 问题.push("启用邮箱通道时必须配置 MESSAGE_EMAIL_FROM");
  }
  return 问题;
}

function 构建消息配置(原始: 已解析环境变量): 应用配置["message"] {
  return {
    enabled: 原始.MESSAGE_WORKER_ENABLED === "true",
    role: 原始.MESSAGE_WORKER_ROLE,
    ...(原始.MESSAGE_EVENT_CUTOVER_AT ? { eventCutoverAt: 原始.MESSAGE_EVENT_CUTOVER_AT } : {}),
    queues: {
      notification: 原始.MESSAGE_NOTIFICATION_QUEUE,
      integration: 原始.MESSAGE_INTEGRATION_QUEUE,
      maintenance: 原始.MESSAGE_MAINTENANCE_QUEUE,
    },
    concurrency: {
      critical: 原始.MESSAGE_CRITICAL_CONCURRENCY,
      integration: 原始.MESSAGE_INTEGRATION_CONCURRENCY,
      maintenance: 原始.MESSAGE_MAINTENANCE_CONCURRENCY,
    },
    claimBatchSize: 原始.MESSAGE_CLAIM_BATCH_SIZE,
    reminderBatchSize: 原始.MESSAGE_REMINDER_BATCH_SIZE,
    reminderAdvanceDays: 原始.MESSAGE_REMINDER_ADVANCE_DAYS,
    reminderDigestMinutes: 原始.MESSAGE_REMINDER_DIGEST_MINUTES,
    defaultDigestMinutes: 原始.MESSAGE_DEFAULT_DIGEST_MINUTES,
    taskFailureThreshold: 原始.MESSAGE_TASK_FAILURE_THRESHOLD,
    ...(原始.MESSAGE_CHANNEL_CONFIG_ENCRYPTION_KEY
      ? { channelConfigEncryptionKey: 原始.MESSAGE_CHANNEL_CONFIG_ENCRYPTION_KEY }
      : {}),
    channels: {
      wecomGroup: {
        enabled: 原始.MESSAGE_WECOM_GROUP_ENABLED === "true",
        ...(原始.MESSAGE_WECOM_GROUP_WEBHOOK ? { webhook: 原始.MESSAGE_WECOM_GROUP_WEBHOOK } : {}),
        maxPerMinute: 原始.MESSAGE_WECOM_GROUP_MAX_PER_MINUTE,
      },
      wecomApp: {
        enabled: 原始.MESSAGE_WECOM_APP_ENABLED === "true",
        ...(原始.MESSAGE_WECOM_APP_CORP_ID ? { corpId: 原始.MESSAGE_WECOM_APP_CORP_ID } : {}),
        ...(原始.MESSAGE_WECOM_APP_AGENT_ID ? { agentId: 原始.MESSAGE_WECOM_APP_AGENT_ID } : {}),
        ...(原始.MESSAGE_WECOM_APP_SECRET ? { secret: 原始.MESSAGE_WECOM_APP_SECRET } : {}),
        maxPerMinute: 原始.MESSAGE_WECOM_APP_MAX_PER_MINUTE,
      },
      sms: {
        enabled: 原始.MESSAGE_SMS_ENABLED === "true",
        providerCode: 原始.MESSAGE_SMS_PROVIDER_CODE,
        ...(原始.MESSAGE_SMS_ENDPOINT ? { endpoint: 原始.MESSAGE_SMS_ENDPOINT } : {}),
        ...(原始.MESSAGE_SMS_API_KEY ? { apiKey: 原始.MESSAGE_SMS_API_KEY } : {}),
        ...(原始.MESSAGE_SMS_API_SECRET ? { apiSecret: 原始.MESSAGE_SMS_API_SECRET } : {}),
        ...(原始.MESSAGE_SMS_TEMPLATE_ID ? { templateId: 原始.MESSAGE_SMS_TEMPLATE_ID } : {}),
        ...(原始.MESSAGE_SMS_SENDER ? { sender: 原始.MESSAGE_SMS_SENDER } : {}),
        maxPerMinute: 原始.MESSAGE_SMS_MAX_PER_MINUTE,
      },
      email: {
        enabled: 原始.MESSAGE_EMAIL_ENABLED === "true",
        ...(原始.MESSAGE_EMAIL_SMTP_HOST ? { smtpHost: 原始.MESSAGE_EMAIL_SMTP_HOST } : {}),
        smtpPort: 原始.MESSAGE_EMAIL_SMTP_PORT,
        security: 原始.MESSAGE_EMAIL_SMTP_SECURITY,
        ...(原始.MESSAGE_EMAIL_SMTP_USERNAME ? { username: 原始.MESSAGE_EMAIL_SMTP_USERNAME } : {}),
        ...(原始.MESSAGE_EMAIL_SMTP_PASSWORD ? { password: 原始.MESSAGE_EMAIL_SMTP_PASSWORD } : {}),
        ...(原始.MESSAGE_EMAIL_FROM ? { from: 原始.MESSAGE_EMAIL_FROM } : {}),
        maxPerMinute: 原始.MESSAGE_EMAIL_MAX_PER_MINUTE,
      },
      requestTimeoutMs: 原始.MESSAGE_EXTERNAL_REQUEST_TIMEOUT_MS,
    },
  };
}

function 构建订单预审配置(原始: 已解析环境变量): 应用配置["orderPreapproval"] {
  return {
    enabled: 原始.ORDER_PREAPPROVAL_WORKER_ENABLED === "true",
    ...(原始.ORDER_PREAPPROVAL_EVENT_CUTOVER_AT
      ? { eventCutoverAt: 原始.ORDER_PREAPPROVAL_EVENT_CUTOVER_AT }
      : {}),
    pollIntervalMs: 原始.ORDER_PREAPPROVAL_POLL_INTERVAL_MS,
    requestTimeoutMs: 原始.ORDER_PREAPPROVAL_REQUEST_TIMEOUT_MS,
    fileDir: 原始.ORDER_PREAPPROVAL_FILE_DIR,
    eteams: {
      ...(原始.ORDER_PREAPPROVAL_ETEAMS_ORIGIN
        ? { origin: 原始.ORDER_PREAPPROVAL_ETEAMS_ORIGIN }
        : {}),
      ...(原始.ORDER_PREAPPROVAL_ETEAMS_CORP_ID
        ? { corpId: 原始.ORDER_PREAPPROVAL_ETEAMS_CORP_ID }
        : {}),
      ...(原始.ORDER_PREAPPROVAL_ETEAMS_APP_KEY
        ? { appKey: 原始.ORDER_PREAPPROVAL_ETEAMS_APP_KEY }
        : {}),
      ...(原始.ORDER_PREAPPROVAL_ETEAMS_APP_SECRET
        ? { appSecret: 原始.ORDER_PREAPPROVAL_ETEAMS_APP_SECRET }
        : {}),
    },
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
    orderPreapproval: {
      ...config.orderPreapproval,
      eteams: {
        ...(config.orderPreapproval.eteams.origin
          ? { origin: config.orderPreapproval.eteams.origin }
          : {}),
        ...(config.orderPreapproval.eteams.corpId ? { corpId: "***已隐藏***" } : {}),
        ...(config.orderPreapproval.eteams.appKey ? { appKey: "***已隐藏***" } : {}),
        ...(config.orderPreapproval.eteams.appSecret ? { appSecret: "***已隐藏***" } : {}),
      },
    },
    message: {
      ...config.message,
      ...(config.message.channelConfigEncryptionKey
        ? { channelConfigEncryptionKey: "***已隐藏***" }
        : {}),
      channels: {
        ...config.message.channels,
        wecomGroup: {
          enabled: config.message.channels.wecomGroup.enabled,
          ...(config.message.channels.wecomGroup.webhook ? { webhook: "***已隐藏***" } : {}),
          maxPerMinute: config.message.channels.wecomGroup.maxPerMinute,
        },
        wecomApp: {
          enabled: config.message.channels.wecomApp.enabled,
          ...(config.message.channels.wecomApp.corpId ? { corpId: "***已隐藏***" } : {}),
          ...(config.message.channels.wecomApp.agentId
            ? { agentId: config.message.channels.wecomApp.agentId }
            : {}),
          ...(config.message.channels.wecomApp.secret ? { secret: "***已隐藏***" } : {}),
          maxPerMinute: config.message.channels.wecomApp.maxPerMinute,
        },
        sms: {
          enabled: config.message.channels.sms.enabled,
          providerCode: config.message.channels.sms.providerCode,
          ...(config.message.channels.sms.endpoint
            ? { endpoint: config.message.channels.sms.endpoint }
            : {}),
          ...(config.message.channels.sms.apiKey ? { apiKey: "***已隐藏***" } : {}),
          ...(config.message.channels.sms.apiSecret ? { apiSecret: "***已隐藏***" } : {}),
          ...(config.message.channels.sms.templateId
            ? { templateId: config.message.channels.sms.templateId }
            : {}),
          ...(config.message.channels.sms.sender
            ? { sender: config.message.channels.sms.sender }
            : {}),
          maxPerMinute: config.message.channels.sms.maxPerMinute,
        },
        email: {
          enabled: config.message.channels.email.enabled,
          ...(config.message.channels.email.smtpHost
            ? { smtpHost: config.message.channels.email.smtpHost }
            : {}),
          smtpPort: config.message.channels.email.smtpPort,
          security: config.message.channels.email.security,
          ...(config.message.channels.email.username ? { username: "***已隐藏***" } : {}),
          ...(config.message.channels.email.password ? { password: "***已隐藏***" } : {}),
          ...(config.message.channels.email.from
            ? { from: config.message.channels.email.from }
            : {}),
          maxPerMinute: config.message.channels.email.maxPerMinute,
        },
      },
    },
  };
}

function 是企微群机器人地址(value: string): boolean {
  try {
    const 地址 = new URL(value);
    return (
      地址.protocol === "https:" &&
      地址.hostname === "qyapi.weixin.qq.com" &&
      地址.pathname === "/cgi-bin/webhook/send" &&
      Boolean(地址.searchParams.get("key")?.trim())
    );
  } catch {
    return false;
  }
}

function 是安全短信网关地址(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function 是安全HTTPS地址(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
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
