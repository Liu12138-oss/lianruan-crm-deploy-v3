import { 创建成功响应, 应用错误 } from "@lianruan/shared";
import type { Request, Router } from "express";
import { Router as 创建路由器 } from "express";

import { type Rbac数据服务, type Rbac路由参数, 读取Rbac管理员 } from "./rbac.js";
import { 创建Rbac数据服务 } from "./rbac-store.js";

/**
 * RBAC 管理路由：角色 CRUD、权限字典、用户角色分配。
 * 仅超级管理员可访问，与组织架构门禁保持一致；主链业务接口不经过本模块。
 */
export function 创建Rbac路由(参数: Rbac路由参数): Router {
  const router = 创建路由器();
  let service = 参数.service;
  const 获取服务 = (): Rbac数据服务 => {
    if (!service) service = 创建Rbac数据服务({ databaseUrl: 参数.databaseUrl || "" });
    return service;
  };
  const 读取主体 = (req: Request) => 读取Rbac管理员(req, 参数);
  const 执行 =
    <T>(处理: (req: Request) => Promise<T>) =>
    async (
      req: Request,
      res: Parameters<Router["get"]>[1] extends never ? never : any,
      next: (error: unknown) => void,
    ) => {
      try {
        res.json(
          创建成功响应({ data: await 处理(req), requestId: req.requestId, build: 参数.build }),
        );
      } catch (error) {
        next(error);
      }
    };

  router.get(
    "/roles",
    执行(async (req) => {
      读取主体(req);
      return 获取服务().查询角色列表();
    }),
  );
  router.get(
    "/roles/:id/users",
    执行(async (req) => {
      读取主体(req);
      const keyword = 读取查询文本(req, "keyword");
      return 获取服务().查询角色用户(读取标识(req, "id"), {
        ...(keyword ? { keyword } : {}),
        page: 读取页码(req, "page", 1, 1, 100000),
        pageSize: 读取页码(req, "pageSize", 20, 1, 100),
      });
    }),
  );
  router.get(
    "/accounts",
    执行(async (req) => {
      读取主体(req);
      const keyword = 读取查询文本(req, "keyword");
      if (!keyword) throw new 应用错误("RBAC_REQUEST_INVALID", "请填写账号检索关键词。", 400);
      if (keyword.length > 100)
        throw new 应用错误("RBAC_REQUEST_INVALID", "账号检索关键词不能超过100个字符。", 400);
      return 获取服务().查询账号(keyword);
    }),
  );
  router.post(
    "/roles",
    执行(async (req) => {
      const 主体 = 读取主体(req);
      return 获取服务().新建角色(读取对象(req), 主体);
    }),
  );
  router.put(
    "/roles/:id",
    执行(async (req) => {
      const 主体 = 读取主体(req);
      return 获取服务().更新角色(读取标识(req, "id"), 读取对象(req), 主体);
    }),
  );
  router.post(
    "/roles/:id/status",
    执行(async (req) => {
      const 主体 = 读取主体(req);
      return 获取服务().更新角色状态(读取标识(req, "id"), 读取对象(req), 主体);
    }),
  );
  router.get(
    "/permissions",
    执行(async (req) => {
      读取主体(req);
      return 获取服务().查询权限字典();
    }),
  );
  router.get(
    "/users/:userId/roles",
    执行(async (req) => {
      读取主体(req);
      return 获取服务().查询用户角色(读取标识(req, "userId"));
    }),
  );
  router.put(
    "/users/:userId/roles",
    执行(async (req) => {
      const 主体 = 读取主体(req);
      return 获取服务().覆盖用户角色(读取标识(req, "userId"), 读取对象(req), 主体);
    }),
  );
  return router;
}

function 读取对象(req: Request): Record<string, unknown> {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body))
    throw new 应用错误("RBAC_REQUEST_INVALID", "请求内容必须是对象。", 400);
  return req.body as Record<string, unknown>;
}
function 读取标识(req: Request, key: string): string {
  const value = req.params[key];
  if (typeof value !== "string" || !/^[0-9a-f-]{36}$/i.test(value))
    throw new 应用错误("RBAC_REQUEST_INVALID", "标识格式不合法。", 400);
  return value;
}
function 读取查询文本(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
function 读取页码(
  req: Request,
  key: string,
  默认值: number,
  最小值: number,
  最大值: number,
): number {
  const value = 读取查询文本(req, key);
  if (value === undefined) return 默认值;
  if (!/^\d+$/.test(value)) throw new 应用错误("RBAC_REQUEST_INVALID", `${key}必须是整数。`, 400);
  const number = Number(value);
  if (number < 最小值 || number > 最大值)
    throw new 应用错误("RBAC_REQUEST_INVALID", `${key}超出允许范围。`, 400);
  return number;
}
