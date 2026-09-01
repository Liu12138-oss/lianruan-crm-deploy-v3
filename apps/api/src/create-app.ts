import type { 应用配置 } from "@lianruan/config";
import { 读取应用配置 } from "@lianruan/config";
import type { 构建信息 } from "@lianruan/shared";
import { 创建构建信息, 创建错误响应, 应用错误 } from "@lianruan/shared";
import cors from "cors";
import type { ErrorRequestHandler, RequestHandler } from "express";
import express from "express";

import { 创建认证路由, 创建门户单点登录路由 } from "./auth-routes.js";
import { 创建业务路由 } from "./business-routes.js";
import type { 依赖检查器 } from "./dependencies.js";
import { 创建依赖检查器 } from "./dependencies.js";
import { 创建健康路由 } from "./health-routes.js";
import {
  创建日志器,
  创建认证流程日志器,
  type 日志器,
  type 认证流程日志器,
  记录请求完成,
} from "./logger.js";
import { 创建消息平台路由 } from "./message-platform-routes.js";
import type { 消息平台数据服务 } from "./message-platform-store.js";
import { 创建消息路由 } from "./message-routes.js";
import { 创建消息规则路由 } from "./message-rule-routes.js";
import type { 消息规则数据服务 } from "./message-rule-store.js";
import type { 消息数据服务 } from "./message-store.js";
import { 创建组织路由 } from "./org-routes.js";
import type { 组织数据服务 } from "./org-store.js";
import { 创建目录同步路由 } from "./org-sync-routes.js";
import type { Rbac数据服务 } from "./rbac.js";
import { 创建Rbac路由 } from "./rbac-routes.js";
import { 请求编号中间件 } from "./request-context.js";
import {
  type 会话账号状态服务,
  创建会话角色实时防护,
  创建会话账号状态服务,
  创建停用账号会话防护,
} from "./session-account-guard.js";
import { 创建V2兼容路由, 创建V2导入导出兼容路由 } from "./v2-compat-routes.js";

export interface 创建应用参数 {
  config?: 应用配置;
  dependencyChecker?: 依赖检查器;
  build?: 构建信息;
  env?: NodeJS.ProcessEnv;
  logger?: 日志器;
  authFlowLogger?: 认证流程日志器;
  messageService?: 消息数据服务;
  messagePlatformService?: 消息平台数据服务;
  messageRuleService?: 消息规则数据服务;
  orgService?: 组织数据服务;
  rbacService?: Rbac数据服务;
  sessionAccountStatusService?: 会话账号状态服务;
}

export function 创建应用(参数: 创建应用参数 = {}) {
  const config = 参数.config || 读取应用配置(参数.env);
  const build =
    参数.build ||
    创建构建信息({
      V3_BUILD_VERSION: config.build.version,
      V3_BUILD_COMMIT: config.build.commit,
      V3_BUILD_TIME: config.build.time,
    });
  const logger = 参数.logger || 创建日志器(config);
  const authFlowLogger = 参数.authFlowLogger || 创建认证流程日志器(config);
  const dependencyChecker = 参数.dependencyChecker || 创建依赖检查器(config);
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", (ip: string) => config.api.trustedProxyIps.includes(ip));
  app.use(请求编号中间件);
  app.use(cors({ origin: config.api.corsOrigin, credentials: true }));
  app.use(express.json({ limit: config.api.requestBodyLimit }));
  app.use(express.urlencoded({ extended: true, limit: config.api.requestBodyLimit }));
  app.use(请求日志中间件(logger));

  app.use(
    "/",
    创建门户单点登录路由({
      build,
      sessionSecret: config.session.secret,
      ...(config.database.url ? { databaseUrl: config.database.url } : {}),
      ...(参数.env ? { env: 参数.env } : {}),
      logger,
      authFlowLogger,
    }),
  );
  app.use(
    "/api/auth",
    创建认证路由({
      build,
      sessionSecret: config.session.secret,
      ...(config.database.url ? { databaseUrl: config.database.url } : {}),
      ...(参数.env ? { env: 参数.env } : {}),
      logger,
      authFlowLogger,
    }),
  );
  const 停用账号会话防护已启用 = config.organization.accountStatusCheckEnabled;
  const 会话账号状态服务 =
    参数.sessionAccountStatusService ||
    (config.database.url ? 创建会话账号状态服务(config.database.url) : undefined);
  if (停用账号会话防护已启用 && !会话账号状态服务)
    throw new 应用错误(
      "V3_AUTH_ACCOUNT_CHECK_UNAVAILABLE",
      "已开启账号状态检查，但未配置账号状态检查数据库。",
      503,
    );
  app.locals.关闭资源 = async () => {
    await 会话账号状态服务?.关闭?.();
  };
  app.use(
    "/api",
    创建停用账号会话防护({
      enabled: 停用账号会话防护已启用,
      sessionSecret: config.session.secret,
      ...(参数.env ? { env: 参数.env } : {}),
      ...(会话账号状态服务 ? { service: 会话账号状态服务 } : {}),
    }),
  );
  app.use(
    "/api",
    创建会话角色实时防护({
      sessionSecret: config.session.secret,
      ...(参数.env ? { env: 参数.env } : {}),
      ...(会话账号状态服务 ? { service: 会话账号状态服务 } : {}),
    }),
  );
  app.use(
    "/api/v2",
    创建V2兼容路由({
      build,
      sessionSecret: config.session.secret,
      ...(config.database.url ? { databaseUrl: config.database.url } : {}),
      ...(参数.env ? { env: 参数.env } : {}),
    }),
  );
  app.use(
    "/api",
    创建V2导入导出兼容路由({
      build,
      sessionSecret: config.session.secret,
      ...(config.database.url ? { databaseUrl: config.database.url } : {}),
      ...(参数.env ? { env: 参数.env } : {}),
    }),
  );
  app.use(
    "/api",
    创建业务路由({
      build,
      sessionSecret: config.session.secret,
      ...(config.database.url ? { databaseUrl: config.database.url } : {}),
      ...(参数.env ? { env: 参数.env } : {}),
      logger,
    }),
  );
  app.use(
    "/api/org",
    创建组织路由({
      build,
      sessionSecret: config.session.secret,
      ...(config.database.url ? { databaseUrl: config.database.url } : {}),
      ...(参数.env ? { env: 参数.env } : {}),
      ...(参数.orgService ? { service: 参数.orgService } : {}),
    }),
  );
  app.use(
    "/api/rbac",
    创建Rbac路由({
      build,
      sessionSecret: config.session.secret,
      ...(config.database.url ? { databaseUrl: config.database.url } : {}),
      ...(参数.env ? { env: 参数.env } : {}),
      ...(参数.rbacService ? { service: 参数.rbacService } : {}),
    }),
  );
  app.use(
    "/api/integrations/directory-sync",
    创建目录同步路由({
      build,
      sessionSecret: config.session.secret,
      ...(config.database.url ? { databaseUrl: config.database.url } : {}),
      ...(参数.env ? { env: 参数.env } : {}),
    }),
  );
  app.use(
    "/api/messages",
    创建消息路由({
      build,
      sessionSecret: config.session.secret,
      ...(config.database.url ? { databaseUrl: config.database.url } : {}),
      ...(参数.env ? { env: 参数.env } : {}),
      ...(参数.messageService ? { service: 参数.messageService } : {}),
    }),
  );
  app.use(
    "/api/messages/platform",
    创建消息平台路由({
      build,
      sessionSecret: config.session.secret,
      ...(config.database.url ? { databaseUrl: config.database.url } : {}),
      ...(config.message.channelConfigEncryptionKey
        ? { encryptionKey: config.message.channelConfigEncryptionKey }
        : {}),
      corsOrigin: config.api.corsOrigin,
      messageWorkerEnabled: config.message.enabled,
      ...(config.message.eventCutoverAt
        ? { messageEventCutoverAt: config.message.eventCutoverAt }
        : {}),
      ...(参数.env ? { env: 参数.env } : {}),
      ...(参数.messagePlatformService ? { service: 参数.messagePlatformService } : {}),
    }),
  );
  app.use(
    "/api/messages/platform",
    创建消息规则路由({
      build,
      sessionSecret: config.session.secret,
      ...(config.database.url ? { databaseUrl: config.database.url } : {}),
      corsOrigin: config.api.corsOrigin,
      ...(参数.env ? { env: 参数.env } : {}),
      ...(参数.messageRuleService ? { service: 参数.messageRuleService } : {}),
    }),
  );
  app.use("/health", 创建健康路由({ dependencyChecker, build }));

  app.use((req, _res, next) => {
    next(new 应用错误("V3_ROUTE_NOT_FOUND", "接口不存在：" + req.method + " " + req.path, 404));
  });
  app.use(错误处理中间件(build, logger, config.appEnv === "test"));

  return app;
}

function 请求日志中间件(logger: 日志器): RequestHandler {
  return (req, res, next) => {
    const startedAt = process.hrtime.bigint();
    res.on("finish", () => 记录请求完成(logger, req, res, startedAt));
    next();
  };
}

function 错误处理中间件(
  build: 构建信息,
  logger: 日志器,
  includeStack: boolean,
): ErrorRequestHandler {
  return (error, req, res, _next) => {
    const 应用级错误 =
      error instanceof 应用错误
        ? error
        : new 应用错误("V3_INTERNAL_ERROR", "系统处理失败，请联系管理员。", 500);
    const level = 应用级错误.statusCode >= 500 ? "error" : "warn";
    logger[level]("接口请求失败", {
      event: "api.request.failed",
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      errorCode: 应用级错误.code,
      errorMessage: 应用级错误.message,
      statusCode: 应用级错误.statusCode,
      resultCode: "failed",
      stack: includeStack && error instanceof Error ? error.stack : undefined,
    });
    res.status(应用级错误.statusCode).json(
      创建错误响应({
        error: 应用级错误,
        requestId: req.requestId,
        build,
      }),
    );
  };
}
