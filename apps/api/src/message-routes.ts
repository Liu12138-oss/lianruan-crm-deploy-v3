import type { 构建信息 } from "@lianruan/shared";
import { 创建成功响应, 应用错误 } from "@lianruan/shared";
import type { Request, Router } from "express";
import { Router as createRouter } from "express";

import { 读取移动端会话身份, 读取请求会话用户名 } from "./auth-routes.js";
import { 创建消息数据服务, type 消息偏好更新, type 消息数据服务 } from "./message-store.js";

export interface 消息路由参数 {
  build: 构建信息;
  databaseUrl?: string | undefined;
  sessionSecret: string;
  env?: NodeJS.ProcessEnv | undefined;
  service?: 消息数据服务 | undefined;
}

/**
 * 新消息域仅服务四套 V3 正式页面。它不会读取或写入旧通知接口的数据。
 */
export function 创建消息路由(参数: 消息路由参数): Router {
  const router = createRouter();
  const service =
    参数.service ||
    创建消息数据服务({
      ...(参数.databaseUrl ? { databaseUrl: 参数.databaseUrl } : {}),
    });

  router.get("/notifications", async (req, res, next) => {
    try {
      const 用户 = 读取消息会话主体(req, 参数);
      const data = await service.查询通知(用户, {
        category: 读取查询文本(req, "category"),
        status: 读取查询文本(req, "status"),
        keyword: 读取查询文本(req, "keyword"),
        cursor: 读取查询文本(req, "cursor"),
        limit: 读取通知条数(req),
      });
      res.json(成功(req, 参数.build, data));
    } catch (error) {
      next(error);
    }
  });

  router.get("/notifications/unread-count", async (req, res, next) => {
    try {
      const data = await service.查询未读数(读取消息会话主体(req, 参数));
      res.json(成功(req, 参数.build, data));
    } catch (error) {
      next(error);
    }
  });

  router.put("/notifications/read-all", async (req, res, next) => {
    try {
      const data = await service.标记全部已读(读取消息会话主体(req, 参数));
      res.json(成功(req, 参数.build, data));
    } catch (error) {
      next(error);
    }
  });

  router.put("/notifications/:id/read", async (req, res, next) => {
    try {
      const data = await service.标记已读(读取消息会话主体(req, 参数), 读取路由参数(req, "id"));
      res.json(成功(req, 参数.build, data));
    } catch (error) {
      next(error);
    }
  });

  router.put("/notifications/:id/archive", async (req, res, next) => {
    try {
      const data = await service.归档通知(读取消息会话主体(req, 参数), 读取路由参数(req, "id"));
      res.json(成功(req, 参数.build, data));
    } catch (error) {
      next(error);
    }
  });

  router.get("/preferences", async (req, res, next) => {
    try {
      const data = await service.查询偏好(读取消息会话主体(req, 参数));
      res.json(成功(req, 参数.build, data));
    } catch (error) {
      next(error);
    }
  });

  router.put("/preferences", async (req, res, next) => {
    try {
      const 输入 = 读取偏好更新(req);
      const data = await service.更新偏好(读取消息会话主体(req, 参数), 输入);
      res.json(成功(req, 参数.build, data));
    } catch (error) {
      next(error);
    }
  });

  return router;
}

function 成功(req: Request, build: 构建信息, data: unknown) {
  return 创建成功响应({ data, requestId: req.requestId, build });
}

function 读取消息会话主体(req: Request, 参数: 消息路由参数): { username: string } {
  const 会话参数 = {
    sessionSecret: 参数.sessionSecret,
    ...(参数.env ? { env: 参数.env } : {}),
  };
  const Cookie用户名 = 读取请求会话用户名(req, 会话参数);
  if (Cookie用户名) return { username: Cookie用户名 };
  const 移动端身份 = 读取移动端会话身份(req, 会话参数);
  if (移动端身份?.username) return { username: 移动端身份.username };
  throw new 应用错误("V3_MESSAGE_AUTH_REQUIRED", "请先登录后再查看消息。", 401);
}

function 读取查询文本(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function 读取通知条数(req: Request): number {
  const value = 读取查询文本(req, "limit");
  if (!value) return 20;
  const numberValue = Number(value);
  if (!Number.isInteger(numberValue) || numberValue < 1 || numberValue > 100) {
    throw new 应用错误("V3_MESSAGE_LIMIT_INVALID", "通知条数必须为 1 至 100 的整数。", 400);
  }
  return numberValue;
}

function 读取路由参数(req: Request, key: string): string {
  const value = req.params[key];
  return typeof value === "string" ? value : "";
}

function 读取偏好更新(req: Request): 消息偏好更新 {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    throw new 应用错误("V3_MESSAGE_PREFERENCE_INVALID", "消息偏好请求格式无效。", 400);
  }
  const body = req.body as Record<string, unknown>;
  const 允许字段 = new Set([
    "inAppEnabled",
    "wecomEnabled",
    "smsEnabled",
    "emailEnabled",
    "doNotDisturbStart",
    "doNotDisturbEnd",
    "categoryPreferences",
  ]);
  for (const key of Object.keys(body)) {
    if (!允许字段.has(key)) {
      throw new 应用错误("V3_MESSAGE_PREFERENCE_INVALID", "消息偏好包含不支持的字段。", 400);
    }
  }
  for (const key of ["inAppEnabled", "wecomEnabled", "smsEnabled", "emailEnabled"] as const) {
    if (body[key] !== undefined && typeof body[key] !== "boolean") {
      throw new 应用错误("V3_MESSAGE_PREFERENCE_INVALID", "消息渠道开关必须为布尔值。", 400);
    }
  }
  for (const key of ["doNotDisturbStart", "doNotDisturbEnd"] as const) {
    if (body[key] !== undefined && typeof body[key] !== "string") {
      throw new 应用错误("V3_MESSAGE_PREFERENCE_INVALID", "免打扰时间必须为文本。", 400);
    }
  }
  let categoryPreferences:
    | Record<
        string,
        { inAppEnabled: boolean; wecomEnabled: boolean; smsEnabled: boolean; emailEnabled: boolean }
      >
    | undefined;
  if (body.categoryPreferences !== undefined) {
    if (
      !body.categoryPreferences ||
      typeof body.categoryPreferences !== "object" ||
      Array.isArray(body.categoryPreferences)
    ) {
      throw new 应用错误("V3_MESSAGE_PREFERENCE_INVALID", "消息分类偏好格式无效。", 400);
    }
    const 分类集合 = new Set(["todo", "business", "system", "security"]);
    const 渠道集合 = ["inAppEnabled", "wecomEnabled", "smsEnabled", "emailEnabled"] as const;
    categoryPreferences = {};
    for (const [分类, 偏好] of Object.entries(
      body.categoryPreferences as Record<string, unknown>,
    )) {
      if (!分类集合.has(分类)) {
        throw new 应用错误("V3_MESSAGE_PREFERENCE_INVALID", "消息分类偏好包含未知分类。", 400);
      }
      if (!偏好 || typeof 偏好 !== "object" || Array.isArray(偏好)) {
        throw new 应用错误("V3_MESSAGE_PREFERENCE_INVALID", "消息分类偏好格式无效。", 400);
      }
      const 项 = 偏好 as Record<string, unknown>;
      const 结果 = {} as Record<(typeof 渠道集合)[number], boolean>;
      for (const 渠道 of 渠道集合) {
        if (typeof 项[渠道] !== "boolean") {
          throw new 应用错误(
            "V3_MESSAGE_PREFERENCE_INVALID",
            "消息分类渠道开关必须为布尔值。",
            400,
          );
        }
        结果[渠道] = 项[渠道] as boolean;
      }
      categoryPreferences[分类] = 结果;
    }
  }
  return {
    ...(typeof body.inAppEnabled === "boolean" ? { inAppEnabled: body.inAppEnabled } : {}),
    ...(typeof body.wecomEnabled === "boolean" ? { wecomEnabled: body.wecomEnabled } : {}),
    ...(typeof body.smsEnabled === "boolean" ? { smsEnabled: body.smsEnabled } : {}),
    ...(typeof body.emailEnabled === "boolean" ? { emailEnabled: body.emailEnabled } : {}),
    ...(typeof body.doNotDisturbStart === "string"
      ? { doNotDisturbStart: body.doNotDisturbStart }
      : {}),
    ...(typeof body.doNotDisturbEnd === "string" ? { doNotDisturbEnd: body.doNotDisturbEnd } : {}),
    ...(categoryPreferences ? { categoryPreferences } : {}),
  };
}
