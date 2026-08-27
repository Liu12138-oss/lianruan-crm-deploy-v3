import type { 构建信息 } from "@lianruan/shared";
import { 创建成功响应, 应用错误 } from "@lianruan/shared";
import type { NextFunction, Request, Response } from "express";
import { Router } from "express";

import { 读取请求会话用户名, 读取请求会话角色 } from "./auth-routes.js";
import {
  创建目录同步数据服务,
  type 目录同步差异筛选,
  type 目录同步数据服务,
} from "./org-sync-store.js";
import type { 企业微信通讯录适配器 } from "./wecom-directory-adapter.js";

export interface 目录同步路由参数 {
  build: 构建信息;
  sessionSecret: string;
  databaseUrl?: string;
  env?: NodeJS.ProcessEnv;
  service?: 目录同步数据服务;
  adapter?: 企业微信通讯录适配器;
}

/**
 * 首期只读同步接口。即使请求 apply 或 pause，也始终拒绝，确保不会改写业务主体。
 * 应用挂载由调用方显式完成，避免影响现有 /api、认证和 V2 兼容入口。
 */
export function 创建目录同步路由(参数: 目录同步路由参数): Router {
  const router = Router();
  let service = 参数.service;
  const 获取服务 = (): 目录同步数据服务 => {
    if (!service)
      service = 创建目录同步数据服务({
        ...(参数.databaseUrl ? { databaseUrl: 参数.databaseUrl } : {}),
        ...(参数.adapter ? { adapter: 参数.adapter } : {}),
      });
    return service;
  };
  const 执行 =
    (处理: (req: Request) => Promise<unknown>) =>
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        res.json(
          创建成功响应({
            data: await 处理(req),
            requestId: req.requestId || "",
            build: 参数.build,
          }),
        );
      } catch (error) {
        next(error);
      }
    };

  router.get(
    "/status",
    执行(async (req) => {
      const 操作人 = 读取目录同步管理员(req, 参数);
      const 已启用 =
        读取开关(参数.env, "V3_ORGANIZATION_ENABLED") &&
        读取开关(参数.env, "V3_DIRECTORY_SYNC_ENABLED");
      if (!已启用)
        return {
          enabled: false,
          applyEnabled: false,
          mode: "disabled",
          requestedBy: 操作人.username,
        };
      return { ...((await 获取服务().查询状态()) as object), enabled: true, applyEnabled: false };
    }),
  );

  router.post(
    "/test-connection",
    执行(async (req) => {
      断言只读同步已启用(参数);
      const 操作人 = 读取目录同步管理员(req, 参数);
      return 获取服务().测试连接(操作人, 读取可选连接器编号(req));
    }),
  );

  router.post(
    "/preview",
    执行(async (req) => {
      断言只读同步已启用(参数);
      const 操作人 = 读取目录同步管理员(req, 参数);
      return 获取服务().创建只读预览(操作人, 读取可选连接器编号(req));
    }),
  );

  router.get(
    "/runs",
    执行(async (req) => {
      断言只读同步已启用(参数);
      读取目录同步管理员(req, 参数);
      return 获取服务().查询批次(读取分页(req));
    }),
  );

  router.get(
    "/runs/:id",
    执行(async (req) => {
      断言只读同步已启用(参数);
      读取目录同步管理员(req, 参数);
      return 获取服务().查询批次详情(读取UUID(req.params.id));
    }),
  );

  router.get(
    "/changes",
    执行(async (req) => {
      断言只读同步已启用(参数);
      读取目录同步管理员(req, 参数);
      return 获取服务().查询差异(读取差异筛选(req));
    }),
  );

  router.post(
    "/runs/:id/apply",
    执行(async (req) => {
      断言只读同步已启用(参数);
      读取目录同步管理员(req, 参数);
      读取UUID(req.params.id);
      throw new 应用错误(
        "DIRECTORY_SYNC_APPLY_DISABLED",
        "企微组织同步当前仅支持只读预览，尚未开放审批应用。",
        409,
      );
    }),
  );

  router.post(
    "/runs/:id/pause",
    执行(async (req) => {
      断言只读同步已启用(参数);
      读取目录同步管理员(req, 参数);
      读取UUID(req.params.id);
      throw new 应用错误(
        "DIRECTORY_SYNC_APPLY_DISABLED",
        "企微组织同步当前仅支持只读预览，无应用任务可暂停。",
        409,
      );
    }),
  );
  return router;
}

export function 读取目录同步管理员(
  req: Request,
  参数: Pick<目录同步路由参数, "sessionSecret" | "env">,
) {
  const session = { sessionSecret: 参数.sessionSecret, ...(参数.env ? { env: 参数.env } : {}) };
  const username = 读取请求会话用户名(req, session);
  const role = 读取请求会话角色(req, session);
  if (!username)
    throw new 应用错误("DIRECTORY_SYNC_AUTH_REQUIRED", "请先登录后再访问企微组织同步。", 401);
  if (role !== "superadmin")
    throw new 应用错误("DIRECTORY_SYNC_PERMISSION_DENIED", "仅超级管理员可管理企微组织同步。", 403);
  return { username, requestId: req.requestId || "" };
}

function 断言只读同步已启用(参数: Pick<目录同步路由参数, "env">) {
  if (!读取开关(参数.env, "V3_ORGANIZATION_ENABLED"))
    throw new 应用错误("DIRECTORY_SYNC_ORGANIZATION_DISABLED", "组织架构功能尚未启用。", 503);
  if (!读取开关(参数.env, "V3_DIRECTORY_SYNC_ENABLED"))
    throw new 应用错误("DIRECTORY_SYNC_FEATURE_DISABLED", "企微组织同步功能尚未启用。", 503);
}

function 读取开关(env: NodeJS.ProcessEnv | undefined, key: string): boolean {
  return (env || process.env)[key] === "true";
}

function 读取可选连接器编号(req: Request): string | undefined {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    if (req.body === undefined) return undefined;
    throw new 应用错误("DIRECTORY_SYNC_REQUEST_INVALID", "请求内容必须是对象。", 400);
  }
  const value = (req.body as Record<string, unknown>).connectorId;
  if (value === undefined) return undefined;
  if (typeof value !== "string")
    throw new 应用错误("DIRECTORY_SYNC_REQUEST_INVALID", "connectorId 格式不合法。", 400);
  return 读取UUID(value);
}

function 读取分页(req: Request) {
  return {
    page: 读取正整数(req.query.page, 1, 10_000),
    pageSize: 读取正整数(req.query.pageSize, 20, 100),
  };
}

function 读取差异筛选(req: Request): 目录同步差异筛选 {
  const 基础 = 读取分页(req);
  const runId = 读取可选查询UUID(req.query.runId);
  const riskLevel = 读取枚举查询(req.query.riskLevel, ["low", "medium", "high"] as const);
  const approvalStatus = 读取枚举查询(req.query.approvalStatus, [
    "pending",
    "approved",
    "rejected",
  ] as const);
  return {
    ...基础,
    ...(runId ? { runId } : {}),
    ...(riskLevel ? { riskLevel } : {}),
    ...(approvalStatus ? { approvalStatus } : {}),
  };
}

function 读取正整数(value: unknown, fallback: number, maximum: number): number {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !/^\d+$/.test(value))
    throw new 应用错误("DIRECTORY_SYNC_REQUEST_INVALID", "分页参数必须是正整数。", 400);
  const number = Number(value);
  if (number < 1 || number > maximum)
    throw new 应用错误("DIRECTORY_SYNC_REQUEST_INVALID", "分页参数超出允许范围。", 400);
  return number;
}

function 读取可选查询UUID(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string")
    throw new 应用错误("DIRECTORY_SYNC_REQUEST_INVALID", "runId 格式不合法。", 400);
  return 读取UUID(value);
}

function 读取枚举查询<T extends string>(value: unknown, values: readonly T[]): T | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !values.includes(value as T))
    throw new 应用错误("DIRECTORY_SYNC_REQUEST_INVALID", "筛选参数不合法。", 400);
  return value as T;
}

function 读取UUID(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  )
    throw new 应用错误("DIRECTORY_SYNC_REQUEST_INVALID", "标识格式不合法。", 400);
  return value;
}
