import { 校验消息通道配置加密密钥 } from "@lianruan/config";
import type { 构建信息 } from "@lianruan/shared";
import { 创建成功响应, 应用错误 } from "@lianruan/shared";
import type { Request, Router } from "express";
import { Router as createRouter } from "express";

import { 读取请求会话用户名, 读取请求会话角色 } from "./auth-routes.js";
import {
  创建消息平台数据服务,
  type 平台通道代码,
  type 消息平台数据服务,
} from "./message-platform-store.js";

export interface 消息平台路由参数 {
  build: 构建信息;
  sessionSecret: string;
  databaseUrl?: string;
  encryptionKey?: string;
  corsOrigin?: string;
  messageWorkerEnabled?: boolean;
  messageEventCutoverAt?: string;
  env?: NodeJS.ProcessEnv;
  service?: 消息平台数据服务;
}

export function 创建消息平台路由(参数: 消息平台路由参数): Router {
  const router = createRouter();
  const encryptionKey = 参数.encryptionKey
    ? 校验消息通道配置加密密钥(参数.encryptionKey)
    : undefined;
  const service =
    参数.service ||
    创建消息平台数据服务({
      ...(参数.databaseUrl ? { databaseUrl: 参数.databaseUrl } : {}),
      ...(encryptionKey ? { encryptionKey } : {}),
    });

  router.get("/channels", async (req, res, next) => {
    try {
      res.json(成功(req, 参数.build, await service.查询通道(读取超级管理员(req, 参数))));
    } catch (error) {
      next(error);
    }
  });
  router.get("/channels/readiness", (req, res, next) => {
    try {
      读取超级管理员(req, 参数);
      res.json(
        成功(req, 参数.build, {
          encryptionKeyConfigured: Boolean(encryptionKey),
          messageWorkerEnabled: 参数.messageWorkerEnabled === true,
          cutoverAtConfigured: Boolean(参数.messageEventCutoverAt),
          testDeliveryRequiresIntegrationWorker: true,
        }),
      );
    } catch (error) {
      next(error);
    }
  });
  router.put("/channels/:channelCode", async (req, res, next) => {
    try {
      校验同源写请求(req, 参数.corsOrigin);
      const 通道 = 读取通道(req);
      res.json(
        成功(
          req,
          参数.build,
          await service.保存通道(读取超级管理员(req, 参数), 通道, 读取对象请求体(req)),
        ),
      );
    } catch (error) {
      next(error);
    }
  });
  router.post("/channels/:channelCode/enable", async (req, res, next) => {
    try {
      校验同源写请求(req, 参数.corsOrigin);
      校验二次确认(req);
      const 通道 = 读取通道(req);
      res.json(
        成功(req, 参数.build, await service.切换通道(读取超级管理员(req, 参数), 通道, true)),
      );
    } catch (error) {
      next(error);
    }
  });
  router.post("/channels/:channelCode/disable", async (req, res, next) => {
    try {
      校验同源写请求(req, 参数.corsOrigin);
      校验二次确认(req);
      const 通道 = 读取通道(req);
      res.json(
        成功(req, 参数.build, await service.切换通道(读取超级管理员(req, 参数), 通道, false)),
      );
    } catch (error) {
      next(error);
    }
  });
  router.post("/channels/:channelCode/test", async (req, res, next) => {
    try {
      校验同源写请求(req, 参数.corsOrigin);
      校验二次确认(req);
      if (参数.messageWorkerEnabled !== true) {
        throw new 应用错误(
          "V3_MESSAGE_INTEGRATION_WORKER_REQUIRED",
          "消息投递进程尚未启用，无法执行网络与通道测试。请先由部署人员启动消息投递角色。",
          409,
        );
      }
      const 通道 = 读取通道(req);
      res.json(
        成功(
          req,
          参数.build,
          await service.创建测试投递(读取超级管理员(req, 参数), 通道, 读取对象请求体(req)),
        ),
      );
    } catch (error) {
      next(error);
    }
  });
  router.get("/tests/:deliveryId", async (req, res, next) => {
    try {
      res.json(
        成功(
          req,
          参数.build,
          await service.查询测试投递(
            读取超级管理员(req, 参数),
            String(req.params.deliveryId || ""),
          ),
        ),
      );
    } catch (error) {
      next(error);
    }
  });
  router.get("/deliveries", async (req, res, next) => {
    try {
      const rawChannel = typeof req.query.channelCode === "string" ? req.query.channelCode : "";
      const channel = rawChannel ? 读取通道代码(rawChannel) : undefined;
      const rawLimit = Number(req.query.limit || 20);
      const limit = Number.isInteger(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 20;
      res.json(
        成功(req, 参数.build, await service.查询投递(读取超级管理员(req, 参数), channel, limit)),
      );
    } catch (error) {
      next(error);
    }
  });
  return router;
}

function 成功(req: Request, build: 构建信息, data: unknown) {
  return 创建成功响应({ data, requestId: req.requestId, build });
}

export function 读取超级管理员(req: Request, 参数: 消息平台路由参数) {
  const session = { sessionSecret: 参数.sessionSecret, ...(参数.env ? { env: 参数.env } : {}) };
  const username = 读取请求会话用户名(req, session);
  const role = 读取请求会话角色(req, session);
  if (!username)
    throw new 应用错误("V3_MESSAGE_PLATFORM_AUTH_REQUIRED", "请先登录后再管理消息通道。", 401);
  if (role !== "superadmin")
    throw new 应用错误(
      "V3_MESSAGE_PLATFORM_PERMISSION_DENIED",
      "仅超级管理员可管理消息平台。",
      403,
    );
  return { username, requestId: req.requestId };
}

function 读取通道(req: Request): 平台通道代码 {
  return 读取通道代码(String(req.params.channelCode || ""));
}

function 读取通道代码(value: string): 平台通道代码 {
  if (value === "wecom" || value === "wecom_app" || value === "sms" || value === "email")
    return value;
  throw new 应用错误("V3_MESSAGE_CHANNEL_INVALID", "消息通道不存在。", 404);
}

function 读取对象请求体(req: Request): Record<string, unknown> {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    throw new 应用错误("V3_MESSAGE_CHANNEL_CONFIG_INVALID", "通道配置请求格式无效。", 400);
  }
  return req.body as Record<string, unknown>;
}

export function 校验二次确认(req: Request): void {
  if (读取对象请求体(req).confirm !== "确认") {
    throw new 应用错误("V3_MESSAGE_CHANNEL_CONFIRM_REQUIRED", "请填写“确认”后再执行该操作。", 400);
  }
}

export function 校验同源写请求(req: Request, corsOrigin?: string): void {
  const origin = req.get("origin");
  if (!origin) return;
  try {
    const 来源地址 = new URL(origin);
    const 同源 = 来源地址.host === req.get("host");
    const 受信任前端来源 = corsOrigin && 来源地址.origin === new URL(corsOrigin).origin;
    if (!同源 && !受信任前端来源) throw new Error("跨域");
  } catch {
    throw new 应用错误("V3_MESSAGE_PLATFORM_ORIGIN_INVALID", "消息平台管理仅接受同源请求。", 403);
  }
}
