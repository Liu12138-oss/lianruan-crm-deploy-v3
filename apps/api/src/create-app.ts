import type { 应用配置 } from "@lianruan/config";
import { 读取应用配置 } from "@lianruan/config";
import type { 构建信息 } from "@lianruan/shared";
import { 创建构建信息, 创建错误响应, 应用错误 } from "@lianruan/shared";
import cors from "cors";
import type { ErrorRequestHandler, RequestHandler } from "express";
import express from "express";

import { 创建认证路由 } from "./auth-routes.js";
import { 创建业务路由 } from "./business-routes.js";
import type { 依赖检查器 } from "./dependencies.js";
import { 创建依赖检查器 } from "./dependencies.js";
import { 创建健康路由 } from "./health-routes.js";
import { 创建日志器, 记录请求完成 } from "./logger.js";
import { 请求编号中间件 } from "./request-context.js";
import { 创建V2兼容路由, 创建V2导入导出兼容路由 } from "./v2-compat-routes.js";

export interface 创建应用参数 {
  config?: 应用配置;
  dependencyChecker?: 依赖检查器;
  build?: 构建信息;
  env?: NodeJS.ProcessEnv;
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
  const logger = 创建日志器(config);
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
    "/api/auth",
    创建认证路由({
      build,
      sessionSecret: config.session.secret,
      ...(config.database.url ? { databaseUrl: config.database.url } : {}),
      ...(参数.env ? { env: 参数.env } : {}),
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
    }),
  );
  app.use("/health", 创建健康路由({ dependencyChecker, build }));

  app.use((req, _res, next) => {
    next(new 应用错误("V3_ROUTE_NOT_FOUND", "接口不存在：" + req.method + " " + req.path, 404));
  });
  app.use(错误处理中间件(build, logger, config.appEnv === "test"));

  return app;
}

function 请求日志中间件(logger: ReturnType<typeof 创建日志器>): RequestHandler {
  return (req, res, next) => {
    const startedAt = process.hrtime.bigint();
    res.on("finish", () => 记录请求完成(logger, req, res, startedAt));
    next();
  };
}

function 错误处理中间件(
  build: 构建信息,
  logger: ReturnType<typeof 创建日志器>,
  includeStack: boolean,
): ErrorRequestHandler {
  return (error, req, res, _next) => {
    const 应用级错误 =
      error instanceof 应用错误
        ? error
        : new 应用错误("V3_INTERNAL_ERROR", "系统处理失败，请联系管理员。", 500);
    logger.error("接口请求失败", {
      requestId: req.requestId,
      code: 应用级错误.code,
      message: 应用级错误.message,
      statusCode: 应用级错误.statusCode,
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
