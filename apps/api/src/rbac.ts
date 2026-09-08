import type { 构建信息 } from "@lianruan/shared";
import { 应用错误 } from "@lianruan/shared";
import type { Request } from "express";

import { 读取请求会话用户名, 读取请求会话角色 } from "./auth-routes.js";

export interface Rbac路由参数 {
  build: 构建信息;
  sessionSecret: string;
  databaseUrl?: string;
  env?: NodeJS.ProcessEnv;
  service?: Rbac数据服务;
}

export interface Rbac会话主体 {
  username: string;
  requestId: string;
}

export interface Rbac操作人 {
  username: string;
  requestId: string;
}

export interface Rbac数据服务 {
  查询角色列表(): Promise<unknown>;
  查询角色用户(
    roleId: string,
    参数: { keyword?: string; includeInactive?: boolean; page: number; pageSize: number },
  ): Promise<unknown>;
  查询账号(keyword: string): Promise<unknown>;
  新建角色(input: Record<string, unknown>, actor: Rbac操作人): Promise<unknown>;
  更新角色(id: string, input: Record<string, unknown>, actor: Rbac操作人): Promise<unknown>;
  更新角色状态(id: string, input: Record<string, unknown>, actor: Rbac操作人): Promise<unknown>;
  查询权限字典(): Promise<unknown>;
  查询用户角色(userId: string): Promise<unknown>;
  覆盖用户角色(userId: string, input: Record<string, unknown>, actor: Rbac操作人): Promise<unknown>;
}

/**
 * RBAC 模块为独立边界：只接受签名 Cookie 会话，绝不读取业务兼容请求头。
 * 角色管理仅超级管理员可访问，与组织架构门禁保持一致。
 */
export function 读取Rbac管理员(
  req: Request,
  参数: Pick<Rbac路由参数, "sessionSecret" | "env">,
): Rbac会话主体 {
  const 会话参数 = { sessionSecret: 参数.sessionSecret, ...(参数.env ? { env: 参数.env } : {}) };
  const username = 读取请求会话用户名(req, 会话参数);
  const role = 读取请求会话角色(req, 会话参数);
  if (!username) throw new 应用错误("RBAC_AUTH_REQUIRED", "请先登录后再管理角色。", 401);
  if (role !== "superadmin")
    throw new 应用错误("RBAC_PERMISSION_DENIED", "仅超级管理员可管理角色。", 403);
  return { username, requestId: req.requestId };
}
