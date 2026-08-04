import type { 构建信息 } from "@lianruan/shared";
import { 创建成功响应, 应用错误 } from "@lianruan/shared";
import type { Request, Response, Router } from "express";
import { Router as createRouter } from "express";

import { 读取请求会话用户名 } from "./auth-routes.js";
import {
  type 业务数据服务,
  创建业务数据服务,
  type 当前业务用户,
  type 阶段9模块,
} from "./business-store.js";

interface 业务路由参数 {
  build: 构建信息;
  databaseUrl?: string;
  sessionSecret?: string;
  env?: NodeJS.ProcessEnv;
  service?: 业务数据服务;
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
            { ...req.body, status: "rejected" },
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

  router.get("/mobile/:module", 移动列表处理器(service, 参数.build, 读取用户));
  router.get("/mobile/:module/:id", 移动详情处理器(service, 参数.build, 读取用户));
  router.post("/mobile/registrations", async (req, res, next) => {
    try {
      res.json(成功(req, 参数.build, await service.创建报备(req.body, 读取用户(req))));
    } catch (error) {
      next(error);
    }
  });
  router.post("/mobile/opportunities", async (req, res, next) => {
    try {
      res.json(成功(req, 参数.build, await service.创建商机(req.body, 读取用户(req))));
    } catch (error) {
      next(error);
    }
  });
  router.post("/mobile/opportunities/:id/follow-ups", async (req, res, next) => {
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
  router.post("/mobile/quotes/:id/convert-order", async (req, res, next) => {
    try {
      res.json(
        成功(
          req,
          参数.build,
          await service.创建订单({ ...req.body, quoteId: 读取路由参数(req, "id") }, 读取用户(req)),
        ),
      );
    } catch (error) {
      next(error);
    }
  });
  router.put("/mobile/registrations/:id/status", async (req, res, next) => {
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
  router.get("/mobile/pending-approvals", 列表处理器(service, 参数.build, "approvals", 读取用户));
  router.get("/mobile/partners", 列表处理器(service, 参数.build, "partners", 读取用户));
  router.get("/mobile/partners/:id", 详情处理器(service, 参数.build, "partners", 读取用户));
  router.post("/mobile/logout", (_req, res) => {
    res.json(成功(_req, 参数.build, { loggedOut: true }));
  });

  router.post("/open/v1/auth/token", async (req, res, next) => {
    try {
      res.json(成功(req, 参数.build, await service.签发开放接口令牌(req.body, 读取客户端IP(req))));
    } catch (error) {
      next(error);
    }
  });

  router.get("/open/v1/auth/me", async (req, res, next) => {
    try {
      res.json(成功(req, 参数.build, await service.读取开放接口身份(读取开放接口令牌(req))));
    } catch (error) {
      next(error);
    }
  });

  router.get("/open/v1/:module", async (req, res, next) => {
    const startedAt = performance.now();
    const resource = 读取路由参数(req, "module");
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
      username: 会话用户名,
      displayName: 会话用户名,
      roleName: "V3登录用户",
    };
  }

  const v2用户名 = 读取V2令牌用户名(req);
  if (v2用户名) {
    return {
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
      return parsed;
    } catch {
      return null;
    }
  }

  const operatorId = 读取查询文本(req, "operatorId") || 读取请求体文本(req, "operatorId");
  if (!operatorId) return null;
  return {
    username: operatorId,
    externalUserId: operatorId,
    displayName: 读取请求体文本(req, "operatorName") || operatorId,
    roleName: 读取请求体文本(req, "operatorRole") || "兼容操作用户",
  };
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
