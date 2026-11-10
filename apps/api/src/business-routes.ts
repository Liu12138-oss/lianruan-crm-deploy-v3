import crypto from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import type { 日志器, 日志字段, 构建信息 } from "@lianruan/shared";
import { 创建成功响应, 应用错误 } from "@lianruan/shared";
import type { Request, RequestHandler, Response, Router } from "express";
import { Router as createRouter } from "express";
import multer from "multer";

import { 审计导出文件名, type 审计导出行, 生成审计导出CSV } from "./audit-export.js";
import { 读取移动端会话身份, 读取请求会话用户名, 读取请求会话角色 } from "./auth-routes.js";
import {
  type 业务数据服务,
  创建业务数据服务,
  type 当前业务用户,
  type 移动端幂等参数,
  type 阶段9模块,
} from "./business-store.js";
import { 移除产品价格字段 } from "./product-price-visibility.js";
import { 构建报价试算公开视图, 解析报价类型 } from "./quote-visibility.js";
import { 移除敏感字段 } from "./sensitive-fields.js";

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

const 报备附件大小上限 = 10 * 1024 * 1024;
const 报备附件允许扩展名 = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".png",
  ".jpg",
  ".jpeg",
  ".zip",
]);
const 报备附件上传 = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 报备附件大小上限, files: 1 },
});

const 商机跟进附件大小上限 = 10 * 1024 * 1024;
const 商机跟进附件允许扩展名 = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".png",
  ".jpg",
  ".jpeg",
  ".zip",
]);
const 商机跟进附件上传 = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 商机跟进附件大小上限, files: 1 },
});

const 订单合同附件大小上限 = 20 * 1024 * 1024;
const 订单合同附件数量上限 = 10;
const 订单合同附件允许扩展名 = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".png",
  ".jpg",
  ".jpeg",
]);
const 订单合同附件上传 = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 订单合同附件大小上限, files: 订单合同附件数量上限 },
});

export function 创建业务路由(参数: 业务路由参数): Router {
  const router = createRouter();
  const service =
    参数.service ||
    (参数.databaseUrl ? 创建业务数据服务({ databaseUrl: 参数.databaseUrl }) : 创建业务数据服务({}));
  const 读取用户 = (req: Request) => 读取当前业务用户(req, 参数);
  const 读取移动用户 = (req: Request) => 读取当前移动端业务用户(req, 参数);
  const 报备附件目录 = path.resolve(
    参数.env?.V3_UPLOAD_DIR ||
      process.env.V3_UPLOAD_DIR ||
      (process.env.NODE_ENV === "production"
        ? "/app/uploads/registration-attachments"
        : path.join(process.cwd(), "uploads", "registration-attachments")),
  );
  const 订单合同附件目录 = path.resolve(
    参数.env?.V3_UPLOAD_DIR ||
      process.env.V3_UPLOAD_DIR ||
      (process.env.NODE_ENV === "production"
        ? "/app/uploads"
        : path.join(process.cwd(), "uploads")),
    "order-contract-attachments",
  );
  const 商机跟进附件目录 = path.resolve(
    参数.env?.V3_UPLOAD_DIR ||
      process.env.V3_UPLOAD_DIR ||
      (process.env.NODE_ENV === "production"
        ? "/app/uploads"
        : path.join(process.cwd(), "uploads")),
    "opportunity-followup-attachments",
  );

  router.use((req, _res, next) => {
    if (!是受保护业务路由(req) || 是公开业务路由(req) || 使用独立认证的业务路由(req)) {
      next();
      return;
    }
    if (!读取用户(req)) {
      next(new 应用错误("V3_AUTH_REQUIRED", "请先登录后再访问业务接口。", 401));
      return;
    }
    next();
  });

  // 管理配置类接口只允许超级管理员访问，避免前端隐藏入口但服务端仍可直连读取。
  router.use(async (req, _res, next) => {
    if (!是超级管理员专属业务接口(req)) {
      next();
      return;
    }
    try {
      const 用户 = 读取用户(req);
      const 上下文 = await service.读取当前用户上下文(用户);
      if ((上下文?.roleCode || 用户?.roleCode) !== "superadmin") {
        throw new 应用错误("V3_PERMISSION_DENIED", "只有超级管理员可以访问管理配置。", 403);
      }
      next();
    } catch (error) {
      next(error);
    }
  });

  router.get("/dashboard/stats", async (req, res, next) => {
    try {
      res.json(成功(req, 参数.build, await service.读取概览(读取用户(req))));
    } catch (error) {
      next(error);
    }
  });

  router.get("/stage9/overview", async (req, res, next) => {
    try {
      res.json(成功(req, 参数.build, await service.读取概览(读取用户(req))));
    } catch (error) {
      next(error);
    }
  });

  router.get(["/stage9/audit/export", "/audit-logs/export"], async (req, res, next) => {
    try {
      const 用户 = 读取用户(req);
      const 结果 = await service.查询列表(
        "audit",
        { ...读取查询(req), page: 1, pageSize: 100000 },
        用户,
      );
      const 导出数据: 审计导出行[] = 结果.数据.map((记录) => {
        const 原始 = (记录.原始数据 || {}) as Record<string, unknown>;
        return {
          时间: 记录.创建时间,
          操作人账号: 文本值(原始.actorUsername, 记录.负责人),
          操作人姓名: 文本值(原始.actorName, 记录.负责人),
          角色: 文本值(原始.actorRole),
          审计分类: 文本值(原始.moduleCode, 记录.标题),
          模块编码: 文本值(原始.moduleCode),
          动作编码: 文本值(原始.actionCode),
          对象类型: 文本值(原始.targetType),
          对象编号: 文本值(原始.targetId),
          对象名称: 文本值(原始.targetName),
          结果: 文本值(原始.result, 记录.状态),
          说明: 文本值(原始.message, 记录.标题),
          IP: 文本值(原始.ip),
          请求编号: 文本值(原始.requestId),
        };
      });
      const buffer = 生成审计导出CSV(导出数据);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename*=UTF-8''${encodeURIComponent(审计导出文件名())}`,
      );
      res.send(buffer);
    } catch (error) {
      next(error);
    }
  });

  router.get("/stage9/:module", async (req, res, next) => {
    try {
      const 模块 = 读取模块(读取路由参数(req, "module"));
      const 用户 = 读取用户(req);
      const 查询 = 读取查询(req);
      const 数据 = await service.查询列表(模块, 查询, 用户);
      await 记录审计检索留痕(service, req, 模块, 查询, 数据, 用户);
      res.json(
        成功(
          req,
          参数.build,
          模块 === "products" ? await 按角色清理产品价格(service, 用户, 数据) : 数据,
        ),
      );
    } catch (error) {
      next(error);
    }
  });

  router.get("/stage9/:module/:id", async (req, res, next) => {
    try {
      const 模块 = 读取模块(读取路由参数(req, "module"));
      const 用户 = 读取用户(req);
      const 数据 = await service.查询详情(模块, 读取路由参数(req, "id"), 用户);
      res.json(
        成功(
          req,
          参数.build,
          模块 === "products" ? await 按角色清理产品价格(service, 用户, 数据) : 数据,
        ),
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

  router.put("/notifications/read", async (req, res, next) => {
    try {
      const 用户 = 读取用户(req);
      if (!用户) {
        next(new 应用错误("V3_AUTH_REQUIRED", "请先登录后再访问业务接口。", 401));
        return;
      }
      // 历史实现直接返回成功但不落库，属于静默假成功；这里改为真实更新当前数据源。
      const 正文 = (req.body || {}) as Record<string, unknown>;
      // notificationId 为 V2 兼容页面（admin-app.js）沿用的字段名，只取通知主键；
      // 请求体里的 userId 一律忽略，接收人只能取自登录会话，避免越权改他人通知。
      const 通知编号 = String(正文.id || 正文.通知编号 || 正文.notificationId || "").trim();
      const 结果 = await service.标记通知已读(用户, 通知编号 || undefined);
      res.json(
        成功(req, 参数.build, {
          updated: 结果.更新数 > 0,
          更新数: 结果.更新数,
          message: 结果.更新数 > 0 ? "通知已标记为已读。" : "没有需要标记的未读通知。",
        }),
      );
    } catch (error) {
      next(error);
    }
  });

  router.post(
    "/registrations/attachments",
    解析报备附件上传(报备附件上传.single("file")),
    async (req, res, next) => {
      try {
        const 文件 = req.file;
        if (!文件) {
          throw new 应用错误(
            "V3_REGISTRATION_ATTACHMENT_REQUIRED",
            "请选择需要上传的资料附件。",
            400,
          );
        }
        const 原文件名 = 标准化上传文件名(文件.originalname);
        const 扩展名 = path.extname(原文件名).toLowerCase();
        const 文件名片段 = 原文件名.toLowerCase().split(".");
        const 含危险中间扩展名 = 文件名片段
          .slice(0, -1)
          .some((片段) =>
            ["exe", "bat", "cmd", "com", "js", "vbs", "ps1", "sh", "msi", "scr"].includes(片段),
          );
        if (!报备附件允许扩展名.has(扩展名) || 含危险中间扩展名) {
          throw new 应用错误(
            "V3_REGISTRATION_ATTACHMENT_TYPE_INVALID",
            "资料附件仅支持 PDF、Word、Excel、图片或 ZIP 文件。",
            400,
          );
        }
        if (!文件内容符合扩展名(文件.buffer, 扩展名)) {
          throw new 应用错误(
            "V3_REGISTRATION_ATTACHMENT_CONTENT_INVALID",
            "文件内容与扩展名不一致，请上传真实的 PDF、Word、Excel、图片或 ZIP 文件。",
            400,
          );
        }
        await mkdir(报备附件目录, { recursive: true });
        const id = crypto.randomUUID();
        const 存储名 = `${id}${扩展名}`;
        await writeFile(path.join(报备附件目录, 存储名), 文件.buffer, { flag: "wx" });
        res.json(
          成功(req, 参数.build, {
            id,
            文件名: 原文件名,
            大小: 文件.size,
            MIME类型: 文件.mimetype,
            存储名,
            下载地址: `/api/registrations/attachments/${encodeURIComponent(存储名)}`,
            上传时间: new Date().toISOString(),
          }),
        );
      } catch (error) {
        next(error);
      }
    },
  );
  router.get("/registrations/attachments/:storageName", async (req, res, next) => {
    try {
      const 存储名 = 读取路由参数(req, "storageName");
      if (!/^[0-9a-f-]{36}\.(pdf|docx?|xlsx?|png|jpe?g|zip)$/i.test(存储名)) {
        throw new 应用错误("V3_REGISTRATION_ATTACHMENT_NOT_FOUND", "资料附件不存在。", 404);
      }
      const 完整路径 = path.join(报备附件目录, 存储名);
      const 内容 = await readFile(完整路径);
      const 下载名 = 标准化下载文件名(读取查询文本(req, "name") || "", 存储名);
      res.setHeader("content-type", "application/octet-stream");
      res.setHeader(
        "content-disposition",
        `attachment; filename*=UTF-8''${encodeURIComponent(下载名)}`,
      );
      res.send(内容);
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
        next(new 应用错误("V3_REGISTRATION_ATTACHMENT_NOT_FOUND", "资料附件不存在。", 404));
        return;
      }
      next(error);
    }
  });
  router.get("/registrations", 列表处理器(service, 参数.build, "registrations", 读取用户));
  router.get("/registrations/:id", 详情处理器(service, 参数.build, "registrations", 读取用户));
  router.post("/registrations", async (req, res, next) => {
    try {
      const 用户 = 读取用户(req);
      res.json(
        成功(
          req,
          参数.build,
          await 执行桌面端写入(req, service, 用户, () => service.创建报备(req.body, 用户)),
        ),
      );
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
          // 正式审核只负责状态流转；客户资料编辑与驳回后重提走 PUT /registrations/:id。
          await service.更新报备状态(读取路由参数(req, "id"), req.body, 读取用户(req)),
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
          // 资料更新：维护客户档案等字段，未显式传状态时保持当前状态不变。
          await service.更新报备(读取路由参数(req, "id"), req.body, 读取用户(req)),
        ),
      );
    } catch (error) {
      next(error);
    }
  });

  router.get("/opportunities", 列表处理器(service, 参数.build, "opportunities", 读取用户));
  router.post(
    "/opportunities/followup-attachments",
    解析商机跟进附件上传(商机跟进附件上传.single("file")),
    async (req, res, next) => {
      try {
        const 文件 = req.file;
        if (!文件) {
          throw new 应用错误(
            "V3_OPPORTUNITY_ATTACHMENT_REQUIRED",
            "请选择需要上传的跟进附件。",
            400,
          );
        }
        const 原文件名 = 标准化上传文件名(文件.originalname);
        const 扩展名 = path.extname(原文件名).toLowerCase();
        const 文件名片段 = 原文件名.toLowerCase().split(".");
        const 含危险中间扩展名 = 文件名片段
          .slice(0, -1)
          .some((片段) =>
            ["exe", "bat", "cmd", "com", "js", "vbs", "ps1", "sh", "msi", "scr"].includes(片段),
          );
        if (!商机跟进附件允许扩展名.has(扩展名) || 含危险中间扩展名) {
          throw new 应用错误(
            "V3_OPPORTUNITY_ATTACHMENT_TYPE_INVALID",
            "跟进附件仅支持 PDF、Word、Excel、图片或 ZIP 文件。",
            400,
          );
        }
        if (!文件内容符合扩展名(文件.buffer, 扩展名)) {
          throw new 应用错误(
            "V3_OPPORTUNITY_ATTACHMENT_CONTENT_INVALID",
            "文件内容与扩展名不一致，请上传真实的附件文件。",
            400,
          );
        }
        await mkdir(商机跟进附件目录, { recursive: true });
        const id = crypto.randomUUID();
        const 存储名 = `${id}${扩展名}`;
        await writeFile(path.join(商机跟进附件目录, 存储名), 文件.buffer, { flag: "wx" });
        res.json(
          成功(req, 参数.build, {
            id,
            文件名: 原文件名,
            大小: 文件.size,
            MIME类型: 文件.mimetype || "application/octet-stream",
            存储名,
            下载地址: `/api/opportunities/followup-attachments/${encodeURIComponent(存储名)}/download`,
            上传时间: new Date().toISOString(),
          }),
        );
      } catch (error) {
        next(error);
      }
    },
  );
  router.get(
    "/opportunities/followup-attachments/:storageName/download",
    async (req, res, next) => {
      try {
        const 存储名 = 读取路由参数(req, "storageName");
        if (!/^[0-9a-f-]{36}\.(pdf|docx?|xlsx?|png|jpe?g|zip)$/i.test(存储名)) {
          throw new 应用错误("V3_OPPORTUNITY_ATTACHMENT_NOT_FOUND", "跟进附件不存在。", 404);
        }
        const 内容 = await readFile(path.join(商机跟进附件目录, 存储名));
        const 查询名 = String(req.query.filename || "").trim();
        const 下载名 = 查询名 ? 标准化上传文件名(查询名) : `跟进附件${path.extname(存储名)}`;
        res
          .status(200)
          .setHeader("Content-Type", "application/octet-stream")
          .setHeader("Content-Length", String(内容.length))
          .setHeader("X-Content-Type-Options", "nosniff")
          .setHeader(
            "Content-Disposition",
            `attachment; filename*=UTF-8''${encodeURIComponent(下载名)}`,
          )
          .send(内容);
      } catch (error) {
        if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
          next(new 应用错误("V3_OPPORTUNITY_ATTACHMENT_NOT_FOUND", "跟进附件不存在。", 404));
          return;
        }
        next(error);
      }
    },
  );
  router.get("/opportunities/:id", 详情处理器(service, 参数.build, "opportunities", 读取用户));
  router.post("/opportunities", async (req, res, next) => {
    try {
      const 用户 = 读取用户(req);
      res.json(
        成功(
          req,
          参数.build,
          await 执行桌面端写入(req, service, 用户, () => service.创建商机(req.body, 用户)),
        ),
      );
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
  router.get("/quotes/:id/pdf", async (req, res, next) => {
    try {
      const 文件 = await service.生成正式报价单(读取路由参数(req, "id"), 读取用户(req));
      res
        .status(200)
        .setHeader("Content-Type", "application/pdf")
        .setHeader("Content-Length", String(文件.内容.length))
        .setHeader(
          "Content-Disposition",
          `attachment; filename*=UTF-8''${encodeURIComponent(文件.文件名)}`,
        )
        .send(文件.内容);
    } catch (error) {
      next(error);
    }
  });
  router.post("/quotes/workload-preview", async (req, res, next) => {
    try {
      const 报价类型 = 解析报价类型(req.body?.quoteTypeCode ?? req.body?.报价类型);
      res.json(
        成功(req, 参数.build, 构建报价试算公开视图(await service.试算报价(req.body), 报价类型)),
      );
    } catch (error) {
      next(error);
    }
  });
  router.post("/ipg/quote-preview", async (req, res, next) => {
    try {
      const 报价类型 = 解析报价类型(req.body?.quoteTypeCode ?? req.body?.报价类型);
      res.json(
        成功(req, 参数.build, 构建报价试算公开视图(await service.试算报价(req.body), 报价类型)),
      );
    } catch (error) {
      next(error);
    }
  });
  router.post("/quotes", async (req, res, next) => {
    try {
      const 用户 = 读取用户(req);
      res.json(
        成功(
          req,
          参数.build,
          await 执行桌面端写入(req, service, 用户, () => service.创建报价(req.body, 用户)),
        ),
      );
    } catch (error) {
      next(error);
    }
  });
  router.get("/quotes/:id/parent-partners", async (req, res, next) => {
    try {
      res.json(
        成功(
          req,
          参数.build,
          await service.查询报价一级渠道商(读取路由参数(req, "id"), 读取用户(req)),
        ),
      );
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
  router.get("/orders/:id/contract-attachments", async (req, res, next) => {
    try {
      res.json(
        成功(
          req,
          参数.build,
          await service.查询订单合同附件(读取路由参数(req, "id"), 读取用户(req)),
        ),
      );
    } catch (error) {
      next(error);
    }
  });
  router.get("/orders/:id/contract-attachments/:attachmentId/download", async (req, res, next) => {
    try {
      const 附件 = await service.读取订单合同附件(
        读取路由参数(req, "id"),
        读取路由参数(req, "attachmentId"),
        读取用户(req),
      );
      res
        .status(200)
        .setHeader("Content-Type", "application/octet-stream")
        .setHeader("Content-Length", String(附件.内容.length))
        .setHeader("X-Content-Type-Options", "nosniff")
        .setHeader(
          "Content-Disposition",
          `attachment; filename*=UTF-8''${encodeURIComponent(附件.文件名)}`,
        )
        .send(附件.内容);
    } catch (error) {
      next(error);
    }
  });
  router.post(
    "/orders/from-quote",
    解析订单合同附件上传(订单合同附件上传.array("contractFiles", 订单合同附件数量上限)),
    async (req, res, next) => {
      const 已写入文件: string[] = [];
      try {
        const 文件列表 = Array.isArray(req.files) ? req.files : [];
        const 合同附件: Array<Record<string, unknown>> = [];
        if (文件列表.length) await mkdir(订单合同附件目录, { recursive: true });
        for (const 文件 of 文件列表) {
          const 原文件名 = 标准化上传文件名(文件.originalname);
          const 扩展名 = path.extname(原文件名).toLowerCase();
          const 文件名片段 = 原文件名.toLowerCase().split(".");
          const 含危险中间扩展名 = 文件名片段
            .slice(0, -1)
            .some((片段) =>
              ["exe", "bat", "cmd", "com", "js", "vbs", "ps1", "sh", "msi", "scr"].includes(片段),
            );
          if (!订单合同附件允许扩展名.has(扩展名) || 含危险中间扩展名) {
            throw new 应用错误(
              "V3_ORDER_ATTACHMENT_TYPE_INVALID",
              "合同附件仅支持 JPG、PNG、PDF、Word 和 Excel 文件。",
              400,
            );
          }
          if (!文件内容符合扩展名(文件.buffer, 扩展名)) {
            throw new 应用错误(
              "V3_ORDER_ATTACHMENT_CONTENT_INVALID",
              "文件内容与扩展名不一致，请上传真实的合同文件。",
              400,
            );
          }
          const 存储名 = `${crypto.randomUUID()}${扩展名}`;
          const 完整路径 = path.join(订单合同附件目录, 存储名);
          await writeFile(完整路径, 文件.buffer, { flag: "wx" });
          已写入文件.push(完整路径);
          合同附件.push({
            文件名: 原文件名,
            MIME类型: 文件.mimetype || "application/octet-stream",
            大小: 文件.size,
            存储名,
            sha256: crypto.createHash("sha256").update(文件.buffer).digest("hex"),
          });
        }
        const 用户 = 读取用户(req);
        const 输入 = {
          ...(读取请求体对象(req) || {}),
          合同附件,
          严格履约: true,
        };
        const 订单 = await 执行桌面端写入(req, service, 用户, () => service.创建订单(输入, 用户));
        res.json(成功(req, 参数.build, 订单));
      } catch (error) {
        await Promise.all(已写入文件.map((路径) => unlink(路径).catch(() => undefined)));
        next(error);
      }
    },
  );
  router.post("/orders", async (req, res, next) => {
    try {
      const 用户 = 读取用户(req);
      res.json(
        成功(
          req,
          参数.build,
          await 执行桌面端写入(req, service, 用户, () => service.创建订单(req.body, 用户)),
        ),
      );
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
          await service.更新订单修订申请(读取路由参数(req, "id"), req.body, 读取用户(req)),
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
  router.put("/orders/:id/warranty", async (req, res, next) => {
    try {
      res.json(
        成功(
          req,
          参数.build,
          await service.更新订单质保(读取路由参数(req, "id"), req.body, 读取用户(req)),
        ),
      );
    } catch (error) {
      next(error);
    }
  });
  router.put("/orders/:id/resubmit", async (req, res, next) => {
    try {
      res.json(
        成功(
          req,
          参数.build,
          await service.重新提交订单(读取路由参数(req, "id"), req.body, 读取用户(req)),
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
            { ...req.body, status: "confirmed", action: "primary_confirm" },
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
            {
              ...req.body,
              status: "returned_to_secondary",
              returnTarget: "secondary",
              action: "primary_return",
            },
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
  router.get("/audit-logs/customer-duplicate-weekly", async (req, res, next) => {
    try {
      res.json(成功(req, 参数.build, await service.查询客户查重周报(读取用户(req))));
    } catch (error) {
      next(error);
    }
  });
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
  router.post("/workload/mappings", async (req, res, next) => {
    try {
      const 请求体 = (req.body || {}) as Record<string, unknown>;
      const 产品编号 = String(
        请求体.productId ?? 请求体.featureId ?? 请求体.productRefId ?? "",
      ).trim();
      if (!产品编号) {
        throw new 应用错误(
          "V3_WORKLOAD_PRODUCT_REQUIRED",
          "新增工作量映射必须指定产品或硬件编号。",
          400,
        );
      }
      res
        .status(201)
        .json(成功(req, 参数.build, await service.保存工作量映射(产品编号, 请求体, 读取用户(req))));
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
  router.delete("/workload/mappings/:id", async (req, res, next) => {
    try {
      res.json(
        成功(
          req,
          参数.build,
          await service.保存工作量映射(
            读取路由参数(req, "id"),
            { active: false, deliveryTags: [], deleteMode: true },
            读取用户(req),
          ),
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
  router.post("/workload/delivery-rules", async (req, res, next) => {
    try {
      res
        .status(201)
        .json(成功(req, 参数.build, await service.保存交付工作量规则("", req.body, 读取用户(req))));
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
  router.delete("/workload/delivery-rules/:id", async (req, res, next) => {
    try {
      res.json(
        成功(
          req,
          参数.build,
          await service.保存交付工作量规则(
            读取路由参数(req, "id"),
            { active: false, deleteMode: true },
            读取用户(req),
          ),
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
  router.use("/approvals", (req, _res, next) => {
    const 用户 = 读取用户(req);
    if (用户?.roleCode === "partner_admin" || 用户?.roleCode === "staff") {
      next(new 应用错误("V3_APPROVAL_CENTER_FORBIDDEN", "渠道账号不能访问审核中心。", 403));
      return;
    }
    next();
  });
  router.put("/approvals/:id/status", async (req, res, next) => {
    try {
      res.json(
        成功(
          req,
          参数.build,
          await service.更新待审批状态(读取路由参数(req, "id"), req.body, 读取用户(req)),
        ),
      );
    } catch (error) {
      next(error);
    }
  });
  router.get("/approvals/:id", 详情处理器(service, 参数.build, "approvals", 读取用户));
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
      const 跟进内容 = String(
        req.body?.followup ?? req.body?.content ?? req.body?.["跟进内容"] ?? "",
      ).trim();
      if (!跟进内容) {
        throw new 应用错误("V3_OPPORTUNITY_FOLLOWUP_CONTENT_REQUIRED", "请填写本次沟通内容。", 400);
      }
      if (跟进内容.length > 2000) {
        throw new 应用错误(
          "V3_OPPORTUNITY_FOLLOWUP_CONTENT_TOO_LONG",
          "本次沟通内容不能超过 2000 个字符。",
          400,
        );
      }
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
  router.post("/mobile/quotes/workload-preview", async (req, res, next) => {
    try {
      // 移动端试算与桌面端共用同一取价口径，标准报价必须在出口统一脱敏。
      读取移动用户(req);
      const 报价类型 = 解析报价类型(req.body?.quoteTypeCode ?? req.body?.报价类型);
      res.json(
        成功(req, 参数.build, 构建报价试算公开视图(await service.试算报价(req.body), 报价类型)),
      );
    } catch (error) {
      next(error);
    }
  });
  router.post("/mobile/quotes", async (req, res, next) => {
    try {
      const 用户 = 读取移动用户(req);
      res.json(
        成功(
          req,
          参数.build,
          await 执行移动端写入(req, service, 用户, async () => service.创建报价(req.body, 用户)),
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
  router.put("/mobile/orders/:id/status", async (req, res, next) => {
    try {
      const 用户 = 读取移动用户(req);
      res.json(
        成功(
          req,
          参数.build,
          await 执行移动端写入(req, service, 用户, async () =>
            service.更新订单状态(读取路由参数(req, "id"), req.body, 用户),
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
      const 用户 = 读取开放接口业务用户(req, 身份);
      const 数据 = await service.查询列表(模块, 读取查询(req), 用户);
      const 响应数据 = 模块 === "products" ? await 按角色清理产品价格(service, 用户, 数据) : 数据;
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
      res.json(成功(req, 参数.build, 响应数据));
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
      const 数据 = await service.查询列表(模块, 读取查询(req), 读取用户(req));
      await 记录审计检索留痕(service, req, 模块, 读取查询(req), 数据, 读取用户(req));
      res.json(
        成功(
          req,
          build,
          模块 === "products" ? await 按角色清理产品价格(service, 读取用户(req), 数据) : 数据,
        ),
      );
    } catch (error) {
      next(error);
    }
  };
}

const 审计检索留痕窗口毫秒 = 30_000;
const 最近审计检索留痕 = new Map<string, number>();

/** 只记录用户主动提交的检索条件，分类计数、翻页和页面初始化不写“检索审计”。 */
async function 记录审计检索留痕(
  service: 业务数据服务,
  req: Request,
  模块: 阶段9模块,
  查询: ReturnType<typeof 读取查询>,
  数据: { 分页?: { 总数?: number }; 数据?: unknown[] },
  用户: 当前业务用户 | null,
): Promise<void> {
  if (模块 !== "audit" || req.headers["x-audit-search"] !== "1") return;
  if (!查询.keyword && !查询.module && !查询.from && !查询.to) return;
  if (!service.记录审计检索) return;
  const 键 = JSON.stringify({
    username: 用户?.username || "anonymous",
    keyword: 查询.keyword || "",
    module: 查询.module || "",
    from: 查询.from || "",
    to: 查询.to || "",
  });
  const 当前 = Date.now();
  for (const [缓存键, 时间] of 最近审计检索留痕) {
    if (当前 - 时间 > 审计检索留痕窗口毫秒) 最近审计检索留痕.delete(缓存键);
  }
  const 上次 = 最近审计检索留痕.get(键) || 0;
  if (当前 - 上次 < 审计检索留痕窗口毫秒) return;
  最近审计检索留痕.set(键, 当前);
  try {
    await service.记录审计检索(用户, 查询, Number(数据.分页?.总数 || 数据.数据?.length || 0));
  } catch {
    // 审计旁路失败不能阻断检索本身；数据库恢复后下一次检索会继续留痕。
    最近审计检索留痕.delete(键);
  }
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
      const 数据 = await service.查询列表(
        "products",
        { ...读取查询(req), productType },
        读取用户(req),
      );
      res.json(成功(req, build, await 按角色清理产品价格(service, 读取用户(req), 数据)));
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
      const 用户 = 读取用户(req);
      const 数据 = await service.查询列表(模块, 读取查询(req), 用户);
      res.json(
        成功(
          req,
          build,
          模块 === "products" ? await 按角色清理产品价格(service, 用户, 数据) : 数据,
        ),
      );
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
      const 用户 = 读取用户(req);
      const 数据 = await service.查询详情(模块, 读取路由参数(req, "id"), 用户);
      res.json(
        成功(
          req,
          build,
          模块 === "products" ? await 按角色清理产品价格(service, 用户, 数据) : 数据,
        ),
      );
    } catch (error) {
      next(error);
    }
  };
}

function 成功<T>(req: Request, build: 构建信息, data: T) {
  return 创建成功响应({ data: 移除敏感字段(data), requestId: req.requestId, build });
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

function 文本值(...值列表: unknown[]): string {
  for (const 值 of 值列表) {
    if (值 === null || 值 === undefined) continue;
    const 文本 = String(值).trim();
    if (文本) return 文本;
  }
  return "";
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
    module: 读取查询文本(req, "module"),
    status: 读取查询文本(req, "status"),
    type: 读取查询文本(req, "type"),
    level: 读取查询文本(req, "level"),
    region: 读取查询文本(req, "region"),
    userId: 读取查询文本(req, "userId"),
    partnerId: 读取查询文本(req, "partnerId") || 读取查询文本(req, "assignedPartnerId"),
    operatorId: 读取查询文本(req, "operatorId"),
    from: 读取查询文本(req, "from"),
    to: 读取查询文本(req, "to"),
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

function 是公开业务路由(req: Request): boolean {
  const path = req.path;
  if (req.method !== "GET") return false;
  return (
    path === "/products" ||
    path === "/products/stats" ||
    path === "/product-tree" ||
    path === "/features" ||
    path === "/hardware" ||
    path === "/packages"
  );
}

function 使用独立认证的业务路由(req: Request): boolean {
  return (
    req.path.startsWith("/open/v1/") || req.path === "/open/v1" || req.path.startsWith("/mobile/")
  );
}

function 是受保护业务路由(req: Request): boolean {
  const path = req.path;
  return [
    "/dashboard/stats",
    "/stage9",
    "/notifications",
    "/registrations",
    "/opportunities",
    "/quotes",
    "/orders",
    "/order-revision-requests",
    "/partners",
    "/users",
    "/audit-logs",
    "/workload",
    "/open-api",
    "/openapi-integration",
    "/approvals",
    "/import-export",
  ].some((prefix) => path === prefix || path.startsWith(prefix + "/"));
}

function 是超级管理员专属业务接口(req: Request): boolean {
  const path = req.path;
  return [
    "/audit-logs",
    "/stage9/audit",
    "/stage9/audit-logs",
    "/open-api",
    "/openapi-integration",
    "/stage9/open-api",
    "/stage9/openapi",
    "/workload",
    "/stage9/workload",
    "/users",
    "/stage9/users",
    "/import-export",
    "/stage9/import-export",
    "/stage9/importExport",
  ].some((prefix) => path === prefix || path.startsWith(prefix + "/"));
}

function 读取当前业务用户(req: Request, 参数: 业务路由参数): 当前业务用户 | null {
  const 会话参数 = {
    sessionSecret: 参数.sessionSecret || "",
    ...(参数.env ? { env: 参数.env } : {}),
  };
  const 会话用户名 = 读取请求会话用户名(req, 会话参数);
  if (会话用户名) {
    const 会话角色 = 读取请求会话角色(req, 会话参数);
    return {
      requestId: req.requestId,
      username: 会话用户名,
      displayName: 会话用户名,
      ...(会话角色 ? { roleCode: 会话角色 } : {}),
      roleName: 角色显示名称(会话角色),
    };
  }
  if (参数.env?.V3_BUSINESS_LEGACY_IDENTITY_ENABLED === "true") {
    return 读取兼容业务用户(req, 参数.env);
  }
  return null;
}

function 读取兼容业务用户(req: Request, env: NodeJS.ProcessEnv): 当前业务用户 | null {
  const v2用户名 = 读取V2令牌用户名(req);
  if (v2用户名) {
    return {
      requestId: req.requestId,
      username: v2用户名,
      displayName: v2用户名,
      roleName: "V2兼容用户",
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
  if (operatorId) {
    return {
      requestId: req.requestId,
      username: operatorId,
      externalUserId: operatorId,
      displayName: 读取请求体文本(req, "operatorName") || operatorId,
      roleName: 读取请求体文本(req, "operatorRole") || "兼容操作用户",
    };
  }
  const 测试默认用户 = env.V3_BUSINESS_LEGACY_DEFAULT_USER?.trim();
  const 是测试环境 = env.NODE_ENV === "test" || env.APP_ENV === "test";
  if (测试默认用户 && 是测试环境) {
    return {
      requestId: req.requestId,
      username: 测试默认用户,
      displayName: "测试兼容用户",
      roleName: "兼容测试用户",
    };
  }
  return null;
}

function 读取开放接口业务用户(
  req: Request,
  身份: { boundUserId: string; boundUserName: string },
): 当前业务用户 {
  if (!身份.boundUserId) {
    throw new 应用错误("V3_OPEN_API_USER_REQUIRED", "开放接口未绑定有效业务用户。", 403);
  }
  return {
    requestId: req.requestId,
    userId: 身份.boundUserId,
    username: 身份.boundUserName,
    displayName: 身份.boundUserName,
    roleName: "OpenAPI绑定用户",
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

async function 执行桌面端写入<T>(
  req: Request,
  service: 业务数据服务,
  用户: 当前业务用户 | null,
  操作: () => Promise<T>,
): Promise<T> {
  const 幂等键 = 读取业务幂等键(req);
  if (!幂等键) return 操作();
  return service.执行移动端幂等(
    {
      作用域: `business:${用户?.username || "anonymous"}:${req.method}:${req.path}`,
      幂等键,
      请求哈希: 创建业务请求哈希(req),
    },
    操作,
  );
}

function 读取业务幂等键(req: Request): string {
  const value = req.headers["idempotency-key"];
  if (typeof value !== "string") return "";
  const key = value.trim();
  if (!key) return "";
  if (key.length > 200) {
    throw new 应用错误("V3_IDEMPOTENCY_KEY_INVALID", "幂等键长度不能超过200个字符。", 400);
  }
  return key;
}

function 创建业务请求哈希(req: Request): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify({ method: req.method, path: req.path, body: req.body || null }), "utf8")
    .digest("hex");
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

/** 审计与操作记录面向业务用户展示，角色代码不能原样落成“V3登录用户”。 */
function 角色显示名称(roleCode: string): string {
  return (
    {
      superadmin: "超级管理员",
      admin: "管理员",
      region_manager: "区域管理员",
      region_admin: "区域管理员",
      partner_admin: "渠道管理员",
      staff: "内部员工",
      auditor: "审计员",
    }[roleCode] || "内部用户"
  );
}

/**
 * 产品、模块、描述可供渠道用户浏览，价格与渠道等级比例只对内部管理员返回。
 * 未登录、会话失效或无法解析角色时默认隐藏，避免公开接口意外泄露价格。
 */
async function 按角色清理产品价格<T>(
  service: 业务数据服务,
  用户: 当前业务用户 | null,
  数据: T,
): Promise<T> {
  if (!用户) return 移除产品价格字段(数据);
  try {
    const 上下文 = await service.读取当前用户上下文(用户);
    const 角色 = 上下文?.roleCode || 用户.roleCode || "";
    const 是内部管理员 = ["superadmin", "admin", "region_manager"].includes(角色);
    return 是内部管理员 ? 数据 : 移除产品价格字段(数据);
  } catch {
    return 移除产品价格字段(数据);
  }
}

/** 将 multer 的上传异常转换成业务可读的中文提示，避免页面出现底层错误。 */
function 解析报备附件上传(上传: RequestHandler): RequestHandler {
  return (req, res, next) => {
    上传(req, res, (error: unknown) => {
      if (!error) {
        next();
        return;
      }
      if (error instanceof multer.MulterError) {
        if (error.code === "LIMIT_FILE_SIZE") {
          next(
            new 应用错误(
              "V3_REGISTRATION_ATTACHMENT_TOO_LARGE",
              "单个资料附件不能超过 10MB，请压缩或拆分后再上传。",
              400,
            ),
          );
          return;
        }
        next(
          new 应用错误(
            "V3_REGISTRATION_ATTACHMENT_UPLOAD_FAILED",
            "资料附件上传失败，请重新选择文件。",
            400,
          ),
        );
        return;
      }
      next(error);
    });
  };
}

/** 商机跟进附件与报备附件同为 10MB 上限，但错误码独立，便于前端准确提示。 */
function 解析商机跟进附件上传(上传: RequestHandler): RequestHandler {
  return (req, res, next) => {
    上传(req, res, (error: unknown) => {
      if (!error) {
        next();
        return;
      }
      if (error instanceof multer.MulterError) {
        if (error.code === "LIMIT_FILE_SIZE") {
          next(
            new 应用错误(
              "V3_OPPORTUNITY_ATTACHMENT_TOO_LARGE",
              "单个跟进附件不能超过 10MB，请压缩后重新上传。",
              400,
            ),
          );
          return;
        }
        next(
          new 应用错误(
            "V3_OPPORTUNITY_ATTACHMENT_UPLOAD_FAILED",
            "跟进附件上传失败，请重新选择文件。",
            400,
          ),
        );
        return;
      }
      next(error);
    });
  };
}

/** 订单合同附件错误必须使用用户可读中文，且不能暴露 multer 或文件系统细节。 */
function 解析订单合同附件上传(上传: RequestHandler): RequestHandler {
  return (req, res, next) => {
    上传(req, res, (error: unknown) => {
      if (!error) {
        next();
        return;
      }
      if (error instanceof multer.MulterError) {
        if (error.code === "LIMIT_FILE_SIZE") {
          next(
            new 应用错误(
              "V3_ORDER_ATTACHMENT_TOO_LARGE",
              "单个合同附件不能超过 20MB，请压缩或拆分后重新上传。",
              400,
            ),
          );
          return;
        }
        if (error.code === "LIMIT_FILE_COUNT") {
          next(
            new 应用错误("V3_ORDER_ATTACHMENT_TOO_MANY", "每张订单最多上传 10 个合同附件。", 400),
          );
          return;
        }
        next(
          new 应用错误(
            "V3_ORDER_ATTACHMENT_UPLOAD_FAILED",
            "合同附件上传失败，请重新选择文件。",
            400,
          ),
        );
        return;
      }
      next(error);
    });
  };
}

/**
 * 部分浏览器或反向代理会把 UTF-8 文件名按 latin1 传给 multer。
 * 只在转换后不包含替换字符且能形成有效 UTF-8 文本时采用转换结果。
 */
function 标准化上传文件名(文件名: string): string {
  const 原值 = path.basename(String(文件名 || "").trim());
  if (!原值) return "未命名附件";
  const 转码值 = Buffer.from(原值, "latin1").toString("utf8");
  const 可用值 =
    转码值 && !转码值.includes("\uFFFD") && /[\u4e00-\u9fff]/.test(转码值) ? 转码值 : 原值;
  return (
    Array.from(可用值)
      .filter((字符) => {
        const 编码 = 字符.charCodeAt(0);
        return 编码 >= 32 && 编码 !== 127;
      })
      .join("")
      .slice(0, 180) || "未命名附件"
  );
}

function 标准化下载文件名(文件名: string, 存储名: string): string {
  const 原值 = 标准化上传文件名(文件名);
  if (原值 && 原值 !== "未命名附件") return 原值;
  return `资料附件${path.extname(存储名)}`;
}

/** 根据文件头识别真实类型，避免仅凭扩展名接受 PE 等可执行内容。 */
function 文件内容符合扩展名(内容: Buffer, 扩展名: string): boolean {
  const 头部 = 内容.subarray(0, 8);
  const 是Zip = 头部[0] === 0x50 && 头部[1] === 0x4b;
  const 是Pdf = 内容.subarray(0, 5).toString("ascii") === "%PDF-";
  const 是Ole =
    头部.length >= 8 &&
    [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1].every((字节, 序号) => 头部[序号] === 字节);
  const 是Png =
    头部.length >= 8 &&
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((字节, 序号) => 头部[序号] === 字节);
  const 是Jpeg = 头部[0] === 0xff && 头部[1] === 0xd8 && 头部[2] === 0xff;
  if (扩展名 === ".pdf") return 是Pdf;
  if (扩展名 === ".doc" || 扩展名 === ".xls") return 是Ole;
  if ([".docx", ".xlsx", ".zip"].includes(扩展名)) return 是Zip;
  if (扩展名 === ".png") return 是Png;
  if ([".jpg", ".jpeg"].includes(扩展名)) return 是Jpeg;
  return false;
}
