import type { 构建信息 } from "@lianruan/shared";
import { 创建成功响应, 应用错误 } from "@lianruan/shared";
import type { Request, Router } from "express";
import { Router as createRouter } from "express";

import { 读取请求会话用户名 } from "./auth-routes.js";
import { 创建收益数据服务, type 收益数据服务 } from "./quote-profit-store.js";

export interface 收益路由参数 {
  build: 构建信息;
  sessionSecret: string;
  databaseUrl?: string;
  env?: NodeJS.ProcessEnv;
  service?: 收益数据服务;
}

const 禁止金额字段 = [
  "total",
  "unitPrice",
  "lineAmount",
  "projectProfit",
  "project_profit",
  "productContractAmount",
  "effectiveContractIncome",
  "warrantyCost",
  "internalSaleCost",
];

export function 创建收益路由(参数: 收益路由参数): Router {
  const router = createRouter();
  const 服务 = 参数.service || (参数.databaseUrl ? 创建收益数据服务(参数.databaseUrl) : null);

  router.use((_req, _res, next) => {
    if (!服务) next(new 应用错误("V3_QUOTE_PROFIT_UNAVAILABLE", "收益服务暂不可用。", 503));
    else next();
  });

  router.get("/quotes/:quoteId/profit-calculation", async (req, res, next) => {
    try {
      const 用户名 = 读取用户名(req, 参数);
      res.json(成功(req, 参数.build, await 服务!.读取收益(读取参数(req, "quoteId"), 用户名)));
    } catch (错误) {
      next(错误);
    }
  });

  router.put("/quotes/:quoteId/profit-calculation/draft", async (req, res, next) => {
    try {
      校验无金额字段(req.body);
      const 用户名 = 读取用户名(req, 参数);
      res.json(
        成功(
          req,
          参数.build,
          await 服务!.保存草稿(读取参数(req, "quoteId"), req.body || {}, 用户名),
        ),
      );
    } catch (错误) {
      next(错误);
    }
  });

  router.post("/quotes/:quoteId/profit-calculation/recalculate", async (req, res, next) => {
    try {
      校验无金额字段(req.body);
      const 用户名 = 读取用户名(req, 参数);
      res.json(
        成功(req, 参数.build, await 服务!.重算(读取参数(req, "quoteId"), req.body || {}, 用户名)),
      );
    } catch (错误) {
      next(错误);
    }
  });

  router.post("/quotes/:quoteId/profit-calculation/freeze", async (req, res, next) => {
    try {
      校验无金额字段(req.body);
      const 用户名 = 读取用户名(req, 参数);
      res.json(
        成功(
          req,
          参数.build,
          await 服务!.投递冻结(读取参数(req, "quoteId"), req.body || {}, 用户名),
        ),
      );
    } catch (错误) {
      next(错误);
    }
  });

  router.get("/quote-profit/hardware-cost-rules", async (req, res, next) => {
    try {
      const 用户名 = 读取用户名(req, 参数);
      res.json(
        成功(
          req,
          参数.build,
          await 服务!.查询成本规则((req.query || {}) as Record<string, unknown>, 用户名),
        ),
      );
    } catch (错误) {
      next(错误);
    }
  });

  router.post("/quote-profit/hardware-cost-rules", async (req, res, next) => {
    try {
      const 用户名 = 读取用户名(req, 参数);
      res.json(成功(req, 参数.build, await 服务!.创建成本规则(req.body || {}, 用户名)));
    } catch (错误) {
      next(错误);
    }
  });

  return router;
}

function 读取用户名(req: Request, 参数: 收益路由参数): string {
  return 读取请求会话用户名(req, {
    sessionSecret: 参数.sessionSecret,
    ...(参数.env ? { env: 参数.env } : {}),
  });
}

function 读取参数(req: Request, 名称: string): string {
  const 值 = req.params[名称];
  const 文本 = Array.isArray(值) ? 值[0] : 值;
  if (!文本) throw new 应用错误("V3_QUOTE_PROFIT_PARAMETER_INVALID", "缺少报价编号。", 400);
  return 文本;
}

function 校验无金额字段(正文: unknown): void {
  if (!正文 || typeof 正文 !== "object" || Array.isArray(正文)) return;
  const 记录 = 正文 as Record<string, unknown>;
  if (禁止金额字段.some((字段) => Object.prototype.hasOwnProperty.call(记录, 字段)))
    throw new 应用错误(
      "V3_QUOTE_PROFIT_AMOUNT_READ_ONLY",
      "收益金额只能由服务端计算，不能由页面提交。",
      400,
    );
}

function 成功(req: Request, build: 构建信息, data: unknown) {
  return 创建成功响应({ requestId: req.requestId, build, data });
}
