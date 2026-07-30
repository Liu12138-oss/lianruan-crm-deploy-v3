export type 应用环境 = "development" | "test" | "staging" | "production";

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
