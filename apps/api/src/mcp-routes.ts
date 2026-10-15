import crypto from "node:crypto";
import fs from "node:fs";

import { 应用错误 } from "@lianruan/shared";
import type { NextFunction, Request, Response, Router } from "express";
import { Router as createRouter } from "express";
import { Pool } from "pg";

import type { 业务数据服务, 当前业务用户,阶段9模块, 阶段9记录 } from "./business-store.js";
import { type McpPrincipalAssertion,验证Mcp主体断言 } from "./mcp-auth.js";

interface Mcp路由参数 {
  service: 业务数据服务;
  databaseUrl: string;
  publicKeyFile: string;
  auditRequired?: boolean;
}

interface Mcp请求 extends Request {
  mcpPrincipal?: McpPrincipalAssertion;
}

const 工具配置: Record<string, { module: 阶段9模块; source: string; detail: boolean }> = {
  v3_product_search: { module: "products", source: "V3产品目录", detail: false },
  v3_registration_list: { module: "registrations", source: "V3客户报备", detail: false },
  v3_registration_get: { module: "registrations", source: "V3客户报备", detail: true },
  v3_opportunity_list: { module: "opportunities", source: "V3商机", detail: false },
  v3_opportunity_get: { module: "opportunities", source: "V3商机", detail: true },
  v3_quote_list: { module: "quotes", source: "V3报价", detail: false },
  v3_quote_get: { module: "quotes", source: "V3报价", detail: true },
  v3_order_list: { module: "orders", source: "V3订单", detail: false },
  v3_order_get: { module: "orders", source: "V3订单", detail: true },
};

export function 创建Mcp路由(参数: Mcp路由参数): { router: Router; close(): Promise<void> } {
  const publicKey = crypto.createPublicKey(fs.readFileSync(参数.publicKeyFile, "utf8"));
  const pool = new Pool({ connectionString: 参数.databaseUrl, max: 4 });
  const router = createRouter();
  router.use(创建主体断言中间件(publicKey));

  for (const [toolCode, config] of Object.entries(工具配置)) {
    router.post(`/${路径片段(toolCode)}`, async (req, res, next) => {
      await 处理工具请求(req as Mcp请求, res, next, 参数, pool, toolCode, config);
    });
  }
  router.post("/context", async (req, res, next) => {
    await 处理上下文请求(req as Mcp请求, res, next, 参数, pool);
  });

  return {
    router,
    async close() {
      await pool.end();
    },
  };
}

function 创建主体断言中间件(publicKey: crypto.KeyObject) {
  return (req: Mcp请求, _res: Response, next: NextFunction) => {
    const header = req.headers["x-v3-mcp-principal"];
    if (typeof header !== "string" || !header.trim()) {
      next(new 应用错误("V3_MCP_PRINCIPAL_REQUIRED", "缺少MCP主体断言。", 401));
      return;
    }
    try {
      req.mcpPrincipal = 验证Mcp主体断言(header, publicKey, req.requestId);
      next();
    } catch (error) {
      next(error);
    }
  };
}

async function 处理上下文请求(
  req: Mcp请求,
  res: Response,
  next: NextFunction,
  参数: Mcp路由参数,
  pool: Pool,
): Promise<void> {
  try {
    const principal = req.mcpPrincipal;
    if (!principal) throw new 应用错误("V3_MCP_PRINCIPAL_REQUIRED", "缺少MCP主体断言。", 401);
    const row = await 读取用户摘要(pool, principal.sub);
    if (!row) throw new 应用错误("V3_MCP_USER_NOT_FOUND", "当前MCP用户不存在或不可用。", 401);
    const data = {
      requestId: req.requestId,
      toolCode: "v3_current_context",
      toolVersion: "1.0.0",
      dataAsOf: new Date().toISOString(),
      user: {
        userId: row.user_id,
        username: row.username,
        displayName: row.display_name,
        personType:
          row.role_codes.includes("partner_admin") || row.role_codes.includes("staff")
            ? "channel"
            : "internal",
        primaryOrganization: row.region_name || "",
        primaryPartner: row.partner_name,
      },
      permissionSummary: row.role_codes,
      source: "V3身份上下文",
    };
    await 写入审计(
      参数,
      pool,
      req,
      principal,
      "v3_current_context",
      "success",
      "MCP身份上下文读取成功",
    );
    res.json({ success: true, data });
  } catch (error) {
    await 记录失败审计(参数, pool, req, "v3_current_context", error);
    next(error);
  }
}

async function 处理工具请求(
  req: Mcp请求,
  res: Response,
  next: NextFunction,
  参数: Mcp路由参数,
  pool: Pool,
  toolCode: string,
  config: { module: 阶段9模块; source: string; detail: boolean },
): Promise<void> {
  try {
    const principal = req.mcpPrincipal;
    if (!principal) throw new 应用错误("V3_MCP_PRINCIPAL_REQUIRED", "缺少MCP主体断言。", 401);
    const user = 创建业务用户(req, principal);
    const data = config.detail
      ? await 读取详情输出(参数.service, config, user, req, toolCode)
      : await 读取列表输出(参数.service, config, user, req, toolCode);
    await 写入审计(参数, pool, req, principal, toolCode, "success", "MCP只读工具调用成功");
    res.json({ success: true, data });
  } catch (error) {
    await 记录失败审计(参数, pool, req, toolCode, error);
    next(error);
  }
}

async function 读取列表输出(
  service: 业务数据服务,
  config: { module: 阶段9模块; source: string },
  user: 当前业务用户,
  req: Request,
  toolCode: string,
): Promise<Record<string, unknown>> {
  const 查询 = 读取列表查询(req.body);
  const result = await service.查询列表(config.module, 查询, user);
  const pageInfo = {
    nextCursor: 查询.page * 查询.pageSize < result.分页.总数 ? `page:${查询.page + 1}` : null,
    hasNext: 查询.page * 查询.pageSize < result.分页.总数,
    truncated: 查询.page * 查询.pageSize < result.分页.总数,
  };
  return {
    requestId: req.requestId,
    toolCode,
    toolVersion: "1.0.0",
    dataAsOf: new Date().toISOString(),
    scopeSummary: "按当前V3账号权限和数据范围",
    items: result.数据.map(转换记录摘要),
    pageInfo,
    maskedFields: ["contactPhone", "contactEmail", "costPrice", "floorPrice"],
    source: config.source,
    v3Link:
      user.roleCode === "partner_admin" || user.roleCode === "staff"
        ? "/partner.html"
        : "/admin.html",
  };
}

async function 读取详情输出(
  service: 业务数据服务,
  config: { module: 阶段9模块; source: string },
  user: 当前业务用户,
  req: Request,
  toolCode: string,
): Promise<Record<string, unknown>> {
  const id = typeof req.body?.id === "string" ? req.body.id.trim() : "";
  if (!id) throw new 应用错误("V3_MCP_ID_REQUIRED", "缺少id参数。", 400);
  const record = await service.查询详情(config.module, id, user);
  return {
    requestId: req.requestId,
    toolCode,
    toolVersion: "1.0.0",
    dataAsOf: new Date().toISOString(),
    scopeSummary: "按当前V3账号权限和数据范围",
    item: 转换记录摘要(record),
    maskedFields: ["contactPhone", "contactEmail", "costPrice", "floorPrice"],
    source: config.source,
    v3Link:
      user.roleCode === "partner_admin" || user.roleCode === "staff"
        ? "/partner.html"
        : "/admin.html",
  };
}

function 转换记录摘要(record: 阶段9记录): Record<string, unknown> {
  return {
    id: record.id,
    number: record.编号,
    type: record.类型,
    title: record.标题,
    customerName: record.客户名称,
    partnerName: record.渠道名称,
    region: record.区域,
    status: record.状态,
    statusName: record.状态名称,
    amount: String(record.金额),
    createdAt: record.创建时间,
    updatedAt: record.更新时间,
  };
}

function 读取列表查询(body: Record<string, unknown>): {
  keyword?: string;
  status?: string;
  from?: string;
  to?: string;
  page: number;
  pageSize: number;
} {
  const limit = 读取正整数(body.limit, 20, 1, 50);
  const cursor = typeof body.cursor === "string" ? body.cursor : "";
  const pageMatch = /^page:(\d+)$/.exec(cursor);
  const page = pageMatch?.[1] ? Number(pageMatch[1]) : 1;
  return {
    ...(读取文本(body.keyword) ? { keyword: 读取文本(body.keyword) } : {}),
    ...(读取文本(body.status) ? { status: 读取文本(body.status) } : {}),
    ...(读取文本(body.from) ? { from: 读取文本(body.from) } : {}),
    ...(读取文本(body.to) ? { to: 读取文本(body.to) } : {}),
    page: Number.isInteger(page) && page > 0 ? page : 1,
    pageSize: limit,
  };
}

function 创建业务用户(req: Request, principal: McpPrincipalAssertion): 当前业务用户 {
  return {
    requestId: req.requestId,
    userId: principal.sub,
    username: principal.username,
    displayName: principal.username,
    roleName: "MCP授权用户",
  };
}

async function 读取用户摘要(
  pool: Pool,
  userId: string,
): Promise<{
  user_id: string;
  username: string;
  display_name: string;
  role_codes: string[];
  region_name: string | null;
  partner_name: string | null;
} | null> {
  const result = await pool.query<{
    user_id: string;
    username: string;
    display_name: string;
    role_codes: string[];
    region_name: string | null;
    partner_name: string | null;
  }>(
    `
    SELECT
      u.id::text AS user_id,
      u.username::text AS username,
      u.display_name::text AS display_name,
      COALESCE(array_agg(DISTINCT r.role_code) FILTER (WHERE r.role_code IS NOT NULL), ARRAY[]::text[]) AS role_codes,
      reg.region_name,
      (array_agg(DISTINCT p.partner_name) FILTER (WHERE p.partner_name IS NOT NULL))[1] AS partner_name
    FROM iam.users u
    LEFT JOIN iam.user_roles ur ON ur.user_id = u.id
    LEFT JOIN iam.roles r ON r.id = ur.role_id AND r.status_code = 'active'
    LEFT JOIN org.regions reg ON reg.id = u.region_id
    LEFT JOIN channel.partner_members pm ON pm.user_id = u.id AND pm.archived_at IS NULL
    LEFT JOIN channel.partners p ON p.id = pm.partner_id AND p.status_code = 'active'
    WHERE u.id = $1::uuid AND u.status_code = 'active'
    GROUP BY u.id, u.username, u.display_name, reg.region_name
    `,
    [userId],
  );
  return result.rows[0] || null;
}

async function 写入审计(
  参数: Mcp路由参数,
  pool: Pool,
  req: Request,
  principal: McpPrincipalAssertion,
  toolCode: string,
  resultCode: string,
  message: string,
): Promise<void> {
  try {
    await pool.query(
      `
      INSERT INTO audit.audit_logs(
        created_at, request_id, actor_user_id, actor_username, actor_name, actor_role,
        module_code, action_code, target_type, target_id, result_code, message, extra_json
      )
      VALUES(now(), $1, $2::uuid, $3, $3, 'mcp', 'integration', $4, 'mcp_tool', $5, $6, $7, $8::jsonb)
      `,
      [
        req.requestId,
        principal.sub,
        principal.username,
        `mcp.${toolCode}`,
        toolCode,
        resultCode,
        message,
        JSON.stringify({ clientId: principal.clientId, jti: principal.jti }),
      ],
    );
  } catch (error) {
    if (参数.auditRequired !== false) {
      throw new 应用错误("V3_MCP_AUDIT_UNAVAILABLE", "MCP审计不可用，已拒绝业务工具调用。", 503);
    }
    console.error(
      `[mcp-api] 审计写入失败：${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function 记录失败审计(
  参数: Mcp路由参数,
  pool: Pool,
  req: Request,
  toolCode: string,
  error: unknown,
): Promise<void> {
  const principal = (req as Mcp请求).mcpPrincipal;
  if (!principal) return;
  try {
    await 写入审计(
      参数,
      pool,
      req,
      principal,
      toolCode,
      "failed",
      error instanceof Error ? error.message : "MCP工具调用失败",
    );
  } catch {
    // 原始错误优先返回给调用方，避免审计故障覆盖业务错误。
  }
}

function 路径片段(toolCode: string): string {
  const mapping: Record<string, string> = {
    v3_product_search: "products/search",
    v3_registration_list: "registrations/search",
    v3_registration_get: "registrations/get",
    v3_opportunity_list: "opportunities/search",
    v3_opportunity_get: "opportunities/get",
    v3_quote_list: "quotes/search",
    v3_quote_get: "quotes/get",
    v3_order_list: "orders/search",
    v3_order_get: "orders/get",
  };
  return mapping[toolCode] || toolCode;
}

function 读取文本(value: unknown): string {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function 读取正整数(value: unknown, fallback: number, minimum: number, maximum: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}
