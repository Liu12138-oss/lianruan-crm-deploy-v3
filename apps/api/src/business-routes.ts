import crypto from "node:crypto";

import type { 日志器, 日志字段, 构建信息 } from "@lianruan/shared";
import { 创建成功响应, 应用错误 } from "@lianruan/shared";
import type { Request, Response, Router } from "express";
import { Router as createRouter } from "express";

import { 读取移动端会话身份, 读取请求会话用户名, 读取请求会话角色 } from "./auth-routes.js";
import {
  type 业务数据服务,
  创建业务数据服务,
  type 当前业务用户,
  type 移动端幂等参数,
  type 阶段9模块,
} from "./business-store.js";

interface 业务路由参数 {
  build: 构建信息;
  databaseUrl?: string;
  sessionSecret?: string;
  env?: NodeJS.ProcessEnv;
  service?: 业务数据服务;
  logger?: 日志器;
}

const 模块映射: Record<string, 阶段9模块> = {
  registrations: "registrations",
  opportunities: "opportunities",
  quotes: "quotes",
  orders: "orders",
  partners: "partners",
  products: "products",
  users: "users",
  "audit-logs": "audit",
  audit: "audit",
  openapi: "openapi",
  "open-api": "openapi",
  workload: "workload",
  importExport: "importExport",
  "import-export": "importExport",
  approvals: "approvals",
  "pending-approvals": "approvals",
  notifications: "notifications",
};

const 开放资源模块映射: Record<string, 阶段9模块> = {
  users: "users",
  partners: "partners",
  registrations: "registrations",
  opportunities: "opportunities",
  quotes: "quotes",
  orders: "orders",
  products: "products",
  features: "products",
  hardware: "products",
  packages: "products",
  "product-tree": "products",
  "product-stats": "products",
  "audit-logs": "audit",
  "workload-mappings": "workload",
  "workload-delivery-rules": "workload",
  "workload-rules": "workload",
  notifications: "notifications",
  "pending-approvals": "approvals",
  "dashboard-stats": "registrations",
};

export function 创建业务路由(参数: 业务路由参数): Router {
  const router = createRouter();
  const service =
    参数.service ||
    (参数.databaseUrl ? 创建业务数据服务({ databaseUrl: 参数.databaseUrl }) : 创建业务数据服务({}));
  const 读取用户 = (req: Request) => 读取当前业务用户(req, 参数);
  const 读取移动用户 = (req: Request) => 读取当前移动端业务用户(req, 参数);

  router.get("/dashboard/stats", async (req, res, next) => {
    try {
      res.json(成功(req, 参数.build, await service.读取概览()));
    } catch (error) {
      next(error);
    }
  });

  router.get("/stage9/overview", async (req, res, next) => {
    try {
      res.json(成功(req, 参数.build, await service.读取概览()));
    } catch (error) {
      next(error);
    }
  });

  router.get("/stage9/:module", async (req, res, next) => {
    try {
      const 模块 = 读取模块(读取路由参数(req, "module"));
      res.json(成功(req, 参数.build, await service.查询列表(模块, 读取查询(req), 读取用户(req))));
    } catch (error) {
      next(error);
    }
  });

  router.get("/stage9/:module/:id", async (req, res, next) => {
    try {
      const 模块 = 读取模块(读取路由参数(req, "module"));
      res.json(
        成功(req, 参数.build, await service.查询详情(模块, 读取路由参数(req, "id"), 读取用户(req))),
      );
    } catch (error) {
      next(error);
    }
  });

  router.get("/notifications", async (req, res, next) => {
    try {
      res.json(
        成功(
          req,
          参数.build,
          await service.查询列表("notifications", 读取查询(req), 读取用户(req)),
        ),
      );
    } catch (error) {
      next(error);
    }
  });

  router.put("/notifications/read", (_req, res) => {
    res.json(
      成功(_req, 参数.build, {
        updated: true,
        message: "通知已标记为已读。",
      }),
    );
  });

  router.get("/registrations", 列表处理器(service, 参数.build, "registrations", 读取用户));
  router.get("/registrations/:id", 详情处理器(service, 参数.build, "registrations", 读取用户));
  router.post("/registrations", async (req, res, next) => {
    try {
      res.json(成功(req, 参数.build, await service.创建报备(req.body, 读取用户(req))));
    } catch (error) {
      next(error);
    }
  });
  router.put("/registrations/:id/status", async (req, res, next) => {
    try {
      res.json(
        成功(
          req,
          参数.build,
          await service.更新报备(读取路由参数(req, "id"), req.body, 读取用户(req)),
        ),
      );
    } catch (error) {
      next(error);
    }
  });
  router.put("/registrations/:id", async (req, res, next) => {
    try {
      res.json(
        成功(
          req,
          参数.build,
          await service.更新报备状态(读取路由参数(req, "id"), req.body, 读取用户(req)),
        ),
      );
    } catch (error) {
      next(error);
    }
  });

  router.get("/opportunities", 列表处理器(service, 参数.build, "opportunities", 读取用户));
  router.get("/opportunities/:id", 详情处理器(service, 参数.build, "opportunities", 读取用户));
  router.post("/opportunities", async (req, res, next) => {
    try {
      res.json(成功(req, 参数.build, await service.创建商机(req.body, 读取用户(req))));
    } catch (error) {
      next(error);
    }
  });
  router.put("/opportunities/:id", async (req, res, next) => {
    try {
      res.json(
        成功(
          req,
          参数.build,
          await service.更新商机(读取路由参数(req, "id"), req.body, 读取用户(req)),
        ),
      );
    } catch (error) {
      next(error);
    }
  });

  router.get("/quotes", 列表处理器(service, 参数.build, "quotes", 读取用户));
  router.get("/quotes/:id", 详情处理器(service, 参数.build, "quotes", 读取用户));
  router.post("/quotes/workload-preview", async (req, res, next) => {
    try {
      res.json(成功(req, 参数.build, await service.试算报价(req.body)));
    } catch (error) {
      next(error);
    }
  });
  router.post("/ipg/quote-preview", async (req, res, next) => {
    try {
      res.json(成功(req, 参数.build, await service.试算报价(req.body)));
    } catch (error) {
      next(error);
    }
  });
  router.post("/quotes", async (req, res, next) => {
    try {
      res.json(成功(req, 参数.build, await service.创建报价(req.body, 读取用户(req))));
    } catch (error) {
      next(error);
    }
  });
  router.put("/quotes/:id", async (req, res, next) => {
    try {
      res.json(
        成功(
          req,
          参数.build,
          await service.更新报价(读取路由参数(req, "id"), req.body, 读取用户(req)),
        ),
      );
    } catch (error) {
      next(error);
    }
  });
  router.put("/quotes/:id/status", async (req, res, next) => {
    try {
      res.json(
        成功(
          req,
          参数.build,
          await service.更新报价状态(读取路由参数(req, "id"), req.body, 读取用户(req)),
        ),
      );
    } catch (error) {
      next(error);
    }
  });

  router.get("/orders", 列表处理器(service, 参数.build, "orders", 读取用户));
  router.get("/orders/:id", 详情处理器(service, 参数.build, "orders", 读取用户));
  router.post("/orders", async (req, res, next) => {
    try {
      res.json(成功(req, 参数.build, await service.创建订单(req.body, 读取用户(req))));
    } catch (error) {
      next(error);
    }
  });
  router.post("/orders/:id/revision-requests", async (req, res, next) => {
    try {
      res.json(
        成功(
          req,
          参数.build,
          await service.申请订单修订(读取路由参数(req, "id"), req.body, 读取用户(req)),
        ),
      );
    } catch (error) {
      next(error);
    }
  });
  router.put("/order-revision-requests/:id/status", async (req, res, next) => {
    try {
      res.json(
        成功(
          req,
          参数.build,
          await service.更新订单修订申请(
            读取路由参数(req, "id"),
            req.body,
            读取用户(req),
          ),
        ),
      );
    } catch (error) {
      next(error);
    }
  });
  router.put("/orders/:id/status", async (req, res, next) => {
    try {
      res.json(
        成功(
          req,
          参数.build,
          await service.更新订单状态(读取路由参数(req, "id"), req.body, 读取用户(req)),
        ),
      );
    } catch (error) {
      next(error);
    }
  });
  router.put("/orders/:id/price-adjust", async (req, res, next) => {
    try {
      res.json(
        成功(
          req,
          参数.build,
          await service.更新订单状态(
            读取路由参数(req, "id"),
            { ...req.body, status: "pending_superadmin_confirm", action: "price_adjust" },
            读取用户(req),
          ),
        ),
      );
    } catch (error) {
      next(error);
    }
  });
  router.put("/orders/:id/primary-confirm", async (req, res, next) => {
    try {
      res.json(
        成功(
          req,
          参数.build,
          await service.更新订单状态(
            读取路由参数(req, "id"),
            { ...req.body, status: "confirmed" },
            读取用户(req),
          ),
        ),
      );
    } catch (error) {
      next(error);
    }
  });
  router.put("/orders/:id/primary-reject", async (req, res, next) => {
    try {
      res.json(
        成功(
          req,
          参数.build,
          await service.更新订单状态(
            读取路由参数(req, "id"),
            { ...req.body, status: "primary_rejected" },
            读取用户(req),
          ),
        ),
      );
    } catch (error) {
      next(error);
    }
  });

  router.get("/partners", 列表处理器(service, 参数.build, "partners", 读取用户));
  router.get("/partners/:id", 详情处理器(service, 参数.build, "partners", 读取用户));
  router.get("/users", 列表处理器(service, 参数.build, "users", 读取用户));
  router.get("/products", 列表处理器(service, 参数.build, "products", 读取用户));
  router.get("/products/stats", async (req, res, next) => {
    try {
      const 列表 = await service.查询列表("products", { page: 1, pageSize: 1000 });
      const 按类型 = 列表.数据.reduce<Record<string, number>>((结果, 项) => {
        结果[项.类型] = (结果[项.类型] || 0) + 1;
        return 结果;
      }, {});
      res.json(成功(req, 参数.build, { total: 列表.分页.总数, byType: 按类型 }));
    } catch (error) {
      next(error);
    }
  });
  router.get("/product-tree", 列表处理器(service, 参数.build, "products", 读取用户));
  router.get("/features", 产品列表处理器(service, 参数.build, "feature", 读取用户));
  router.get("/hardware", 产品列表处理器(service, 参数.build, "hardware", 读取用户));
  router.get("/packages", 产品列表处理器(service, 参数.build, "package", 读取用户));
  router.get("/audit-logs", 列表处理器(service, 参数.build, "audit", 读取用户));
  router.get("/workload/classifications", 列表处理器(service, 参数.build, "workload", 读取用户));
  router.get("/workload/mappings", async (req, res, next) => {
    try {
      res.json(
        成功(req, 参数.build, await service.查询工作量映射(读取查询文本(req, "keyword") || "")),
      );
    } catch (error) {
      next(error);
    }
  });
  router.put("/workload/mappings/:id", async (req, res, next) => {
    try {
      res.json(
        成功(
          req,
          参数.build,
          await service.保存工作量映射(读取路由参数(req, "id"), req.body, 读取用户(req)),
        ),
      );
    } catch (error) {
      next(error);
    }
  });
  router.get("/workload/delivery-rules", async (req, res, next) => {
    try {
      res.json(成功(req, 参数.build, await service.查询交付工作量规则()));
    } catch (error) {
      next(error);
    }
  });
  router.put("/workload/delivery-rules/:id", async (req, res, next) => {
    try {
      res.json(
        成功(
          req,
          参数.build,
          await service.保存交付工作量规则(读取路由参数(req, "id"), req.body, 读取用户(req)),
        ),
      );
    } catch (error) {
      next(error);
    }
  });
  router.get("/workload/rules", 列表处理器(service, 参数.build, "workload", 读取用户));
  router.get("/open-api/overview", async (req, res, next) => {
    try {
      res.json(成功(req, 参数.build, await service.读取开放接口总览(读取接口基准地址(req))));
    } catch (error) {
      next(error);
    }
  });
  router.get("/open-api/docs", async (req, res, next) => {
    try {
      res.json(成功(req, 参数.build, 构建开放接口文档清单(读取接口基准地址(req))));
    } catch (error) {
      next(error);
    }
  });
  router.get("/open-api/docs/:id/download", async (req, res, next) => {
    try {
      发送开放接口文档(res, 读取路由参数(req, "id"), 读取接口基准地址(req));
    } catch (error) {
      next(error);
    }
  });
  router.get("/open-api/clients", async (req, res, next) => {
    try {
      res.json(成功(req, 参数.build, await service.查询开放接口客户端()));
    } catch (error) {
      next(error);
    }
  });
  router.post("/open-api/clients", async (req, res, next) => {
    try {
      res.json(成功(req, 参数.build, await service.创建开放接口客户端(req.body, 读取用户(req))));
    } catch (error) {
      next(error);
    }
  });
  router.put("/open-api/clients/:id", async (req, res, next) => {
    try {
      res.json(
        成功(
          req,
          参数.build,
          await service.更新开放接口客户端(读取路由参数(req, "id"), req.body, 读取用户(req)),
        ),
      );
    } catch (error) {
      next(error);
    }
  });
  router.post("/open-api/clients/:id/reset-secret", async (req, res, next) => {
    try {
      res.json(
        成功(
          req,
          参数.build,
          await service.重置开放接口密钥(读取路由参数(req, "id"), 读取用户(req)),
        ),
      );
    } catch (error) {
      next(error);
    }
  });
  router.get("/open-api/logs", async (req, res, next) => {
    try {
      res.json(成功(req, 参数.build, await service.查询开放接口日志(读取正整数(req, "limit", 80))));
    } catch (error) {
      next(error);
    }
  });
  router.get("/openapi-integration", async (req, res, next) => {
    try {
      res.json(成功(req, 参数.build, await service.读取开放接口总览(读取接口基准地址(req))));
    } catch (error) {
      next(error);
    }
  });
  router.get("/approvals", 列表处理器(service, 参数.build, "approvals", 读取用户));
  router.get("/import-export/tasks", 列表处理器(service, 参数.build, "importExport", 读取用户));

  router.get("/mobile/:module", 移动列表处理器(service, 参数.build, 读取移动用户));
  router.get("/mobile/:module/:id", 移动详情处理器(service, 参数.build, 读取移动用户));
  router.post("/mobile/registrations", async (req, res, next) => {
    try {
      const 用户 = 读取移动用户(req);
      const 数据 = await 执行移动端写入(req, service, 用户, async () =>
        service.创建报备(req.body, 用户),
      );
      res.json(成功(req, 参数.build, 数据));
    } catch (error) {
      next(error);
    }
  });
  router.post("/mobile/opportunities", async (req, res, next) => {
    try {
      const 用户 = 读取移动用户(req);
      const 数据 = await 执行移动端写入(req, service, 用户, async () =>
        service.创建商机(req.body, 用户),
      );
      res.json(成功(req, 参数.build, 数据));
    } catch (error) {
      next(error);
    }
  });
  router.post("/mobile/opportunities/:id/follow-ups", async (req, res, next) => {
    try {
      const 用户 = 读取移动用户(req);
      res.json(
        成功(
          req,
          参数.build,
          await 执行移动端写入(req, service, 用户, async () =>
            service.更新商机(读取路由参数(req, "id"), req.body, 用户),
          ),
        ),
      );
    } catch (error) {
      next(error);
    }
  });
  router.post("/mobile/quotes/:id/convert-order", async (req, res, next) => {
    try {
      const 用户 = 读取移动用户(req);
      res.json(
        成功(
          req,
          参数.build,
          await 执行移动端写入(req, service, 用户, async () =>
            service.创建订单({ ...req.body, quoteId: 读取路由参数(req, "id") }, 用户),
          ),
        ),
      );
    } catch (error) {
      next(error);
    }
  });
  router.put("/mobile/registrations/:id/status", async (req, res, next) => {
    try {
      const 用户 = 读取移动用户(req);
      const 数据 = await 执行移动端写入(req, service, 用户, async () =>
        service.审核移动端报备状态(读取路由参数(req, "id"), req.body, 用户),
      );
      res.json(成功(req, 参数.build, 数据));
    } catch (error) {
      next(error);
    }
  });
  router.put("/mobile/partners/:id/status", async (req, res, next) => {
    try {
      const 用户 = 读取移动用户(req);
      res.json(
        成功(
          req,
          参数.build,
          await 执行移动端写入(req, service, 用户, async () =>
            service.更新渠道商状态(读取路由参数(req, "id"), req.body, 用户),
          ),
        ),
      );
    } catch (error) {
      next(error);
    }
  });
  router.put("/mobile/pending-approvals/:id", async (req, res, next) => {
    try {
      const 用户 = 读取移动用户(req);
      res.json(
        成功(
          req,
          参数.build,
          await 执行移动端写入(req, service, 用户, async () =>
            service.更新待审批状态(读取路由参数(req, "id"), req.body, 用户),
          ),
        ),
      );
    } catch (error) {
      next(error);
    }
  });
  router.get(
    "/mobile/pending-approvals",
    列表处理器(service, 参数.build, "approvals", 读取移动用户),
  );
  router.get("/mobile/partners", 列表处理器(service, 参数.build, "partners", 读取移动用户));
  router.get("/mobile/partners/:id", 详情处理器(service, 参数.build, "partners", 读取移动用户));
  router.post("/mobile/logout", (_req, res) => {
    if (!读取当前移动端业务用户(_req, 参数)) return;
    res.json(成功(_req, 参数.build, { loggedOut: true }));
  });

  router.post("/open/v1/auth/token", async (req, res, next) => {
    const startedAt = performance.now();
    const ip = 读取客户端IP(req);
    const 诊断字段 = 读取开放接口令牌诊断(req, 参数.sessionSecret || "");
    记录开放接口认证事件(参数.logger, "info", "OpenAPI令牌签发开始", {
      event: "auth.open_api_token.started",
      ...读取开放接口请求字段(req),
      ...诊断字段,
    });
    try {
      const 令牌 = await service.签发开放接口令牌(req.body, ip, req.requestId);
      记录开放接口认证事件(参数.logger, "info", "OpenAPI令牌签发成功", {
        event: "auth.open_api_token.succeeded",
        ...读取开放接口请求字段(req),
        ...诊断字段,
        accessTokenFingerprint: 创建开放接口认证指纹(
          令牌.accessToken,
          参数.sessionSecret || "",
          "openapi-access-token",
        ),
        accessTokenLength: 令牌.accessToken.length,
        expiresInSeconds: 令牌.expiresInSeconds,
        allowedResourceCount: 令牌.allowedResources.length,
        durationMs: Math.round(performance.now() - startedAt),
        resultCode: "success",
      });
      res.json(成功(req, 参数.build, 令牌));
    } catch (error) {
      记录开放接口认证失败(参数.logger, "open_api_token", "OpenAPI令牌签发失败", req, error, {
        ...诊断字段,
        durationMs: Math.round(performance.now() - startedAt),
      });
      next(error);
    }
  });

  router.get("/open/v1/auth/me", async (req, res, next) => {
    const startedAt = performance.now();
    const 诊断字段 = 读取开放接口访问令牌诊断(req, 参数.sessionSecret || "");
    记录开放接口认证事件(参数.logger, "info", "OpenAPI访问令牌校验开始", {
      event: "auth.open_api_session.started",
      ...读取开放接口请求字段(req),
      ...诊断字段,
    });
    try {
      const 身份 = await service.读取开放接口身份(读取开放接口令牌(req));
      记录开放接口认证事件(参数.logger, "info", "OpenAPI访问令牌校验成功", {
        event: "auth.open_api_session.succeeded",
        ...读取开放接口请求字段(req),
        ...诊断字段,
        clientId: 身份.clientId,
        clientName: 身份.clientName,
        appKey: 身份.appKey,
        allowedResourceCount: 身份.allowedResources.length,
        boundUserId: 身份.boundUserId,
        boundUserName: 身份.boundUserName,
        durationMs: Math.round(performance.now() - startedAt),
        resultCode: "success",
      });
      res.json(成功(req, 参数.build, 身份));
    } catch (error) {
      记录开放接口认证失败(参数.logger, "open_api_session", "OpenAPI访问令牌校验失败", req, error, {
        ...诊断字段,
        durationMs: Math.round(performance.now() - startedAt),
      });
      next(error);
    }
  });

  router.get("/open/v1/:module", async (req, res, next) => {
    const startedAt = performance.now();
    const resource = 读取路由参数(req, "module");
    const 令牌诊断 = 读取开放接口访问令牌诊断(req, 参数.sessionSecret || "");
    let clientId = "";
    try {
      const 身份 = await service.读取开放接口身份(读取开放接口令牌(req));
      clientId = 身份.clientId;
      校验开放接口资源权限(身份.allowedResources, resource);
      const 模块 = 读取开放资源模块(resource);
      const 数据 = await service.查询列表(模块, 读取查询(req));
      await service.记录开放接口调用({
        clientId,
        requestId: req.requestId,
        resourceCode: resource,
        actionCode: "read",
        resultCode: "success",
        statusCode: 200,
        durationMs: Math.round(performance.now() - startedAt),
        method: req.method,
        path: req.originalUrl,
        ip: 读取客户端IP(req),
        message: "OpenAPI资源读取成功",
        extra: {
          ...令牌诊断,
          appKey: 身份.appKey,
          clientName: 身份.clientName,
          allowedResourceCount: 身份.allowedResources.length,
        },
      });
      res.json(成功(req, 参数.build, 数据));
    } catch (error) {
      await service.记录开放接口调用({
        clientId,
        requestId: req.requestId,
        resourceCode: resource || "unknown",
        actionCode: "read",
        resultCode: "failed",
        statusCode: error instanceof 应用错误 ? error.statusCode : 500,
        durationMs: Math.round(performance.now() - startedAt),
        method: req.method,
        path: req.originalUrl,
        ip: 读取客户端IP(req),
        message: error instanceof Error ? error.message : "OpenAPI资源读取失败",
        extra: {
          ...令牌诊断,
          errorCode: error instanceof 应用错误 ? error.code : "V3_OPEN_API_RESOURCE_INTERNAL_ERROR",
          errorMessage: error instanceof Error ? error.message : "OpenAPI资源读取失败",
        },
      });
      next(error);
    }
  });

  return router;
}

type 当前用户读取器 = (req: Request) => 当前业务用户 | null;

function 列表处理器(
  service: 业务数据服务,
  build: 构建信息,
  模块: 阶段9模块,
  读取用户: 当前用户读取器,
) {
  return async (
    req: Request,
    res: { json(value: unknown): void },
    next: (error: unknown) => void,
  ) => {
    try {
      res.json(成功(req, build, await service.查询列表(模块, 读取查询(req), 读取用户(req))));
    } catch (error) {
      next(error);
    }
  };
}

function 产品列表处理器(
  service: 业务数据服务,
  build: 构建信息,
  productType: "feature" | "hardware" | "package",
  读取用户: 当前用户读取器,
) {
  return async (
    req: Request,
    res: { json(value: unknown): void },
    next: (error: unknown) => void,
  ) => {
    try {
      res.json(
        成功(
          req,
          build,
          await service.查询列表("products", { ...读取查询(req), productType }, 读取用户(req)),
        ),
      );
    } catch (error) {
      next(error);
    }
  };
}

function 详情处理器(
  service: 业务数据服务,
  build: 构建信息,
  模块: 阶段9模块,
  读取用户: 当前用户读取器,
) {
  return async (
    req: Request,
    res: { json(value: unknown): void },
    next: (error: unknown) => void,
  ) => {
    try {
      res.json(
        成功(req, build, await service.查询详情(模块, 读取路由参数(req, "id"), 读取用户(req))),
      );
    } catch (error) {
      next(error);
    }
  };
}

function 移动列表处理器(service: 业务数据服务, build: 构建信息, 读取用户: 当前用户读取器) {
  return async (
    req: Request,
    res: { json(value: unknown): void },
    next: (error: unknown) => void,
  ) => {
    try {
      const 模块 = 读取模块(读取路由参数(req, "module"));
      res.json(成功(req, build, await service.查询列表(模块, 读取查询(req), 读取用户(req))));
    } catch (error) {
      next(error);
    }
  };
}

function 移动详情处理器(service: 业务数据服务, build: 构建信息, 读取用户: 当前用户读取器) {
  return async (
    req: Request,
    res: { json(value: unknown): void },
    next: (error: unknown) => void,
  ) => {
    try {
      const 模块 = 读取模块(读取路由参数(req, "module"));
      res.json(
        成功(req, build, await service.查询详情(模块, 读取路由参数(req, "id"), 读取用户(req))),
      );
    } catch (error) {
      next(error);
    }
  };
}

function 成功<T>(req: Request, build: 构建信息, data: T) {
  return 创建成功响应({ data, requestId: req.requestId, build });
}

function 记录开放接口认证事件(
  logger: 日志器 | undefined,
  level: "info" | "warn" | "error",
  message: string,
  fields: 日志字段,
): void {
  logger?.[level](message, fields);
}

function 记录开放接口认证失败(
  logger: 日志器 | undefined,
  流程: string,
  message: string,
  req: Request,
  error: unknown,
  fields: 日志字段 = {},
): void {
  const 应用级错误 = error instanceof 应用错误 ? error : null;
  const statusCode = 应用级错误?.statusCode || 500;
  记录开放接口认证事件(logger, statusCode >= 500 ? "error" : "warn", message, {
    event: "auth." + 流程 + ".failed",
    ...读取开放接口请求字段(req),
    ...fields,
    errorCode: 应用级错误?.code || "V3_OPEN_API_AUTH_INTERNAL_ERROR",
    errorMessage: error instanceof Error ? error.message : "OpenAPI认证失败，原因未知。",
    statusCode,
    resultCode: "failed",
  });
}

function 读取开放接口请求字段(req: Request): 日志字段 {
  return {
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    route: 读取匹配路由(req),
    queryKeys: Object.keys(req.query).sort(),
    bodyKeys: Object.keys(读取请求体对象(req)).sort(),
    ip: 读取客户端IP(req),
    userAgent: req.get("user-agent") || "",
    referer: req.get("referer") || "",
  };
}

function 读取开放接口令牌诊断(req: Request, sessionSecret: string): 日志字段 {
  const appKey = 读取请求体文本(req, "appKey") || 读取请求体文本(req, "clientId");
  const appSecret = 读取请求体文本(req, "appSecret") || 读取请求体文本(req, "clientSecret");
  return {
    appKey,
    appKeyPresent: Boolean(appKey),
    appSecretPresent: Boolean(appSecret),
    appSecretLength: appSecret.length,
    appSecretFingerprint: 创建开放接口认证指纹(appSecret, sessionSecret, "openapi-app-secret"),
  };
}

function 读取开放接口访问令牌诊断(req: Request, sessionSecret: string): 日志字段 {
  const header = req.headers.authorization || "";
  const accessToken = 读取请求授权令牌(req);
  return {
    authorizationHeaderPresent: Boolean(header),
    authorizationHeaderLength: String(header).length,
    authScheme: accessToken ? "Bearer" : "",
    accessTokenPresent: Boolean(accessToken),
    accessTokenLength: accessToken.length,
    accessTokenFingerprint: 创建开放接口认证指纹(
      accessToken,
      sessionSecret,
      "openapi-access-token",
    ),
  };
}

function 读取请求授权令牌(req: Request): string {
  const header = req.headers.authorization || "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1]?.trim() || "";
}

function 创建开放接口认证指纹(value: string, sessionSecret: string, purpose: string): string {
  if (!value) return "";
  const secret =
    sessionSecret || process.env.SESSION_SECRET || "local-dev-session-secret-change-me";
  return crypto
    .createHmac("sha256", secret)
    .update("log-fingerprint:")
    .update(purpose)
    .update(":")
    .update(value)
    .digest("hex")
    .slice(0, 16);
}

function 读取请求体对象(req: Request): Record<string, unknown> {
  return req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
}

function 读取匹配路由(req: Request): string {
  const 路由 = req.route as { path?: string } | undefined;
  if (!路由?.path) return "";
  if (typeof 路由.path === "string") return 路由.path;
  return "";
}

function 读取模块(value: string | undefined): 阶段9模块 {
  const 模块 = value ? 模块映射[value] : null;
  if (!模块) throw new 应用错误("V3_STAGE9_MODULE_NOT_FOUND", "阶段9业务模块不存在。", 404);
  return 模块;
}

function 读取开放资源模块(value: string): 阶段9模块 {
  const 模块 = 开放资源模块映射[value] || 模块映射[value];
  if (!模块) throw new 应用错误("V3_OPEN_API_RESOURCE_NOT_FOUND", "OpenAPI资源不存在。", 404);
  return 模块;
}

function 校验开放接口资源权限(allowedResources: string[], resource: string): void {
  if (allowedResources.includes("*") || allowedResources.includes(resource)) return;
  const 模块 = 开放资源模块映射[resource];
  if (模块 && allowedResources.includes(模块)) return;
  throw new 应用错误("V3_OPEN_API_RESOURCE_FORBIDDEN", "OpenAPI资源未授权。", 403);
}

function 读取路由参数(req: Request, key: string): string {
  const value = req.params[key];
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value[0] || "";
  return "";
}

function 读取查询(req: Request) {
  return {
    keyword: 读取查询文本(req, "keyword") || 读取查询文本(req, "q"),
    status: 读取查询文本(req, "status"),
    level: 读取查询文本(req, "level"),
    region: 读取查询文本(req, "region"),
    userId: 读取查询文本(req, "userId"),
    partnerId: 读取查询文本(req, "partnerId") || 读取查询文本(req, "assignedPartnerId"),
    operatorId: 读取查询文本(req, "operatorId"),
    productType: 读取产品类型(req),
    page: 读取正整数(req, "page", 1),
    pageSize: Math.min(读取正整数(req, "pageSize", 20), 100),
  };
}

function 读取产品类型(req: Request): "feature" | "hardware" | "package" | undefined {
  const value = 读取查询文本(req, "productType") || 读取查询文本(req, "type");
  if (value === "feature" || value === "features" || value === "功能模块") return "feature";
  if (value === "hardware" || value === "hardwareProducts" || value === "硬件产品")
    return "hardware";
  if (value === "package" || value === "packages" || value === "产品套餐") return "package";
  return undefined;
}

function 读取查询文本(req: Request, key: string): string | undefined {
  const value = req.query[key];
  if (typeof value === "string" && value.trim()) return value.trim();
  return undefined;
}

function 读取客户端IP(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim())
    return forwarded.split(",")[0]?.trim() || "";
  return req.ip || req.socket.remoteAddress || "";
}

function 读取开放接口令牌(req: Request): string {
  const header = req.headers.authorization || "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match?.[1]) throw new 应用错误("V3_OPEN_API_TOKEN_REQUIRED", "请提供OpenAPI访问令牌。", 401);
  return match[1].trim();
}

function 读取接口基准地址(req: Request): string {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const forwardedHost = req.headers["x-forwarded-host"];
  const proto =
    typeof forwardedProto === "string" && forwardedProto ? forwardedProto : req.protocol;
  const host =
    typeof forwardedHost === "string" && forwardedHost ? forwardedHost : req.get("host") || "";
  return `${proto}://${host}/api`;
}

function 构建开放接口文档清单(baseUrl: string) {
  const cleanBase = baseUrl.replace(/\/$/, "");
  return [
    {
      id: "openapi-quickstart",
      title: "OpenAPI 对接说明",
      description: "AppKey、AppSecret、Token 和核心资源调用说明。",
      fileName: "OpenAPI对接说明.md",
      available: true,
      downloadUrl: `${cleanBase}/open-api/docs/openapi-quickstart/download`,
    },
    {
      id: "workload-openapi",
      title: "工作量接口说明",
      description: "产品映射、交付规则和报价工作量预览接口说明。",
      fileName: "工作量接口说明.md",
      available: true,
      downloadUrl: `${cleanBase}/open-api/docs/workload-openapi/download`,
    },
  ];
}

function 发送开放接口文档(res: Response, id: string, baseUrl: string): void {
  const 文档 = 生成开放接口文档(id, baseUrl);
  if (!文档) throw new 应用错误("V3_OPEN_API_DOC_NOT_FOUND", "OpenAPI文档不存在。", 404);
  res.setHeader("content-type", "text/markdown; charset=utf-8");
  res.setHeader(
    "content-disposition",
    `attachment; filename="${encodeURIComponent(文档.fileName)}"`,
  );
  res.send(文档.content);
}

function 生成开放接口文档(
  id: string,
  baseUrl: string,
): { fileName: string; content: string } | null {
  const cleanBase = baseUrl.replace(/\/$/, "");
  if (id === "openapi-quickstart") {
    return {
      fileName: "OpenAPI对接说明.md",
      content: [
        "# OpenAPI 对接说明",
        "",
        `Token地址：${cleanBase}/open/v1/auth/token`,
        "",
        "1. 使用后台生成的 AppKey 和 AppSecret 换取 accessToken。",
        "2. 后续请求使用 Authorization: Bearer accessToken。",
        "3. 可访问资源由后台 Client 的资源范围决定。",
        "",
        "示例资源：users、partners、registrations、opportunities、quotes、orders。",
      ].join("\n"),
    };
  }
  if (id === "workload-openapi") {
    return {
      fileName: "工作量接口说明.md",
      content: [
        "# 工作量接口说明",
        "",
        `后台接口：${cleanBase}/workload/mappings`,
        "",
        "工作量映射维护在 catalog.workload_mappings，交付规则维护在 catalog.delivery_workload_rules。",
        "报价试算会读取正式表中的产品映射和交付工作量规则，不再以内存规则作为验收依据。",
      ].join("\n"),
    };
  }
  return null;
}

function 读取正整数(req: Request, key: string, fallback: number): number {
  const value = req.query[key];
  if (typeof value !== "string") return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function 读取当前业务用户(req: Request, 参数: 业务路由参数): 当前业务用户 | null {
  const 会话用户名 = 读取请求会话用户名(req, {
    sessionSecret: 参数.sessionSecret || "",
    ...(参数.env ? { env: 参数.env } : {}),
  });
  if (会话用户名) {
    return {
      requestId: req.requestId,
      username: 会话用户名,
      displayName: 会话用户名,
      roleName: "V3登录用户",
    };
  }

  const v2用户名 = 读取V2令牌用户名(req);
  if (v2用户名) {
    return {
      requestId: req.requestId,
      username: v2用户名,
      displayName: v2用户名,
      roleName: "V2页面用户",
    };
  }

  const header = req.headers["x-v3-delivery-user"];
  if (typeof header === "string") {
    try {
      const parsed = JSON.parse(Buffer.from(header, "base64url").toString("utf8")) as 当前业务用户;
      if (!parsed.username || !parsed.displayName || !parsed.roleName) return null;
      return { ...parsed, requestId: req.requestId };
    } catch {
      return null;
    }
  }

  const operatorId = 读取查询文本(req, "operatorId") || 读取请求体文本(req, "operatorId");
  if (!operatorId) return null;
  return {
    requestId: req.requestId,
    username: operatorId,
    externalUserId: operatorId,
    displayName: 读取请求体文本(req, "operatorName") || operatorId,
    roleName: 读取请求体文本(req, "operatorRole") || "兼容操作用户",
  };
}

function 读取当前移动端业务用户(req: Request, 参数: 业务路由参数): 当前业务用户 {
  const 会话参数 = {
    sessionSecret: 参数.sessionSecret || "",
    ...(参数.env ? { env: 参数.env } : {}),
  };
  const 移动端会话 = 读取移动端会话身份(req, 会话参数);
  const username = 读取请求会话用户名(req, 会话参数) || 移动端会话?.username;
  if (!username) {
    throw new 应用错误("V3_MOBILE_AUTH_REQUIRED", "请先登录后再访问移动端业务。", 401);
  }
  const roleCode = 移动端会话?.role || 转移动端角色代码(读取请求会话角色(req, 会话参数));
  return {
    requestId: req.requestId,
    username,
    displayName: username,
    roleName: "V3移动端登录用户",
    ...(roleCode ? { roleCode } : {}),
  };
}

function 转移动端角色代码(role: string): 当前业务用户["roleCode"] {
  if (role === "superadmin" || role === "admin") return role;
  if (role === "partner_admin" || role === "staff") return role;
  return undefined;
}

async function 执行移动端写入<T>(
  req: Request,
  service: 业务数据服务,
  用户: 当前业务用户,
  操作: () => Promise<T>,
): Promise<T> {
  const 幂等键 = 读取移动端幂等键(req);
  if (!幂等键) return 操作();
  const 参数: 移动端幂等参数 = {
    作用域: `mobile:${用户.username}:${req.method}:${req.path}`,
    幂等键,
    请求哈希: 创建移动端请求哈希(req),
  };
  return service.执行移动端幂等(参数, 操作);
}

function 读取移动端幂等键(req: Request): string {
  const value = req.headers["idempotency-key"];
  if (typeof value !== "string") return "";
  const key = value.trim();
  if (!key) return "";
  if (key.length > 200) {
    throw new 应用错误("V3_MOBILE_IDEMPOTENCY_KEY_INVALID", "幂等键长度不能超过200个字符。", 400);
  }
  return key;
}

function 创建移动端请求哈希(req: Request): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify({ method: req.method, path: req.path, body: req.body || null }), "utf8")
    .digest("hex");
}

function 读取V2令牌用户名(req: Request): string {
  const header = req.headers.authorization || "";
  const match = /^Bearer\s+v2\.([^.]+)\./i.exec(header);
  if (!match?.[1]) return "";
  try {
    return Buffer.from(match[1], "base64url").toString("utf8");
  } catch {
    return "";
  }
}

function 读取请求体文本(req: Request, key: string): string {
  const body = req.body as Record<string, unknown> | undefined;
  const value = body?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}
