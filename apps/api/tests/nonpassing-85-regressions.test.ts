import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import { join } from "node:path";

import { 创建测试环境变量 } from "@lianruan/testing";
import { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { 创建应用 } from "../src/index.js";
import { 执行审计维护删除 } from "./审计维护清理.js";

const 环境变量 = 创建测试环境变量({
  V3_DELIVERY_AUTH_ENABLED: "true",
  V3_DELIVERY_AUTH_COOKIE_SECURE: "false",
  V3_DELIVERY_AUTH_USERS_JSON: "[]",
  V3_AUTH_ACCOUNT_STATUS_CHECK_ENABLED: "false",
  V3_ORGANIZATION_ENABLED: "true",
  V3_ORGANIZATION_WRITE_ENABLED: "true",
});

const 应用 = 创建应用({ env: 环境变量 });
const 连接池 = new Pool({ connectionString: 环境变量.DATABASE_URL });

function 读取Cookie(响应: request.Response): string {
  const cookie = 响应.headers["set-cookie"]?.[0];
  if (!cookie) throw new Error("登录响应缺少会话 Cookie。");
  return cookie;
}

async function 登录(用户名: string, 密码 = "LrCRM@2026!"): Promise<string> {
  const 响应 = await request(应用)
    .post("/api/v2/auth/login")
    .send({ username: 用户名, password: 密码 });
  expect(响应.status).toBe(200);
  return 读取Cookie(响应);
}

async function 登录超级管理员(): Promise<string> {
  const 结果 = await 连接池.query<{ username: string }>(
    `SELECT u.username::text AS username
       FROM iam.users u
       JOIN iam.user_roles ur ON ur.user_id=u.id
       JOIN iam.roles r ON r.id=ur.role_id
      WHERE u.status_code='active' AND r.role_code='superadmin'
      ORDER BY CASE WHEN u.username::text='liulonghai' THEN 0 ELSE 1 END,u.created_at
      LIMIT 1`,
  );
  const 用户名 = 结果.rows[0]?.username;
  if (!用户名) throw new Error("测试库缺少可用的超级管理员账号。");
  return 登录(用户名);
}

function 生成测试手机号(前缀: string): string {
  return `${前缀}${String(Date.now()).slice(-8)}`;
}

async function 创建报价测试上下文(后缀: string) {
  const cookie = await 登录超级管理员();
  const 客户名称 = `85项回归-${后缀}-${randomUUID()}`;
  const 商机 = await request(应用)
    .post("/api/opportunities")
    .set("Cookie", cookie)
    .send({ customer: 客户名称, name: `${客户名称}-商机` })
    .expect(200);
  const 产品 = await 连接池.query<{ id: string }>(
    `SELECT f.id::text AS id
       FROM catalog.product_features f
       JOIN catalog.product_modules m ON m.id=f.module_id
       JOIN catalog.product_categories c ON c.id=m.category_id
      WHERE f.status_code='active' AND f.published=true
        AND f.list_price > 0 AND c.category_code <> 'CAT-MAINTENANCE'
      ORDER BY f.id LIMIT 1`,
  );
  const 产品编号 = 产品.rows[0]?.id;
  if (!产品编号) throw new Error("测试库缺少可用于报价的软件功能。");
  const 商机编号 = String(商机.body.data.id);
  const 报价 = await request(应用)
    .post("/api/quotes")
    .set("Cookie", cookie)
    .send({
      opportunityId: 商机编号,
      endpoints: 10,
      productIds: [产品编号],
      quoteMode: "自定义报价",
    })
    .expect(200);
  return { cookie, 客户名称, 商机编号, 产品编号, 报价编号: String(报价.body.data.id) };
}

async function 清理报价测试上下文(上下文: { 客户名称: string }): Promise<void> {
  await 连接池
    .query(
      `WITH 目标客户 AS (
       SELECT id FROM crm.customers WHERE customer_name=$1
     ), 目标商机 AS (
       SELECT id FROM crm.opportunities WHERE customer_id IN (SELECT id FROM 目标客户)
     ), 目标报价 AS (
       SELECT id FROM crm.quotes WHERE customer_id IN (SELECT id FROM 目标客户)
     ), 目标订单 AS (
       SELECT id FROM crm.orders WHERE customer_id IN (SELECT id FROM 目标客户)
     )
     DELETE FROM crm.maintenance_order_product_orders
      WHERE maintenance_order_id IN (SELECT id FROM 目标订单)
         OR product_order_id IN (SELECT id FROM 目标订单)`,
      [上下文.客户名称],
    )
    .catch(() => undefined);
  await 连接池
    .query(
      `WITH 目标客户 AS (SELECT id FROM crm.customers WHERE customer_name=$1),
          目标订单 AS (SELECT id FROM crm.orders WHERE customer_id IN (SELECT id FROM 目标客户)),
          目标商机 AS (SELECT id FROM crm.opportunities WHERE customer_id IN (SELECT id FROM 目标客户))
     DELETE FROM crm.maintenance_opportunity_product_orders
      WHERE opportunity_id IN (SELECT id FROM 目标商机) OR product_order_id IN (SELECT id FROM 目标订单)`,
      [上下文.客户名称],
    )
    .catch(() => undefined);
  await 连接池
    .query(
      `WITH 目标客户 AS (SELECT id FROM crm.customers WHERE customer_name=$1),
          目标订单 AS (SELECT id FROM crm.orders WHERE customer_id IN (SELECT id FROM 目标客户)),
          目标报价 AS (SELECT id FROM crm.quotes WHERE customer_id IN (SELECT id FROM 目标客户))
     DELETE FROM ops.approval_events WHERE approval_id IN (
       SELECT id FROM ops.approvals WHERE target_id IN (SELECT id FROM 目标订单)
     );
     WITH 目标客户 AS (SELECT id FROM crm.customers WHERE customer_name=$1),
          目标订单 AS (SELECT id FROM crm.orders WHERE customer_id IN (SELECT id FROM 目标客户))
     DELETE FROM ops.approvals WHERE target_id IN (SELECT id FROM 目标订单);
     WITH 目标客户 AS (SELECT id FROM crm.customers WHERE customer_name=$1),
          目标订单 AS (SELECT id FROM crm.orders WHERE customer_id IN (SELECT id FROM 目标客户))
     DELETE FROM ops.outbox_events WHERE aggregate_id IN (SELECT id FROM 目标订单);
     WITH 目标客户 AS (SELECT id FROM crm.customers WHERE customer_name=$1),
          目标订单 AS (SELECT id FROM crm.orders WHERE customer_id IN (SELECT id FROM 目标客户))
     DELETE FROM crm.order_items WHERE order_id IN (SELECT id FROM 目标订单);
     WITH 目标客户 AS (SELECT id FROM crm.customers WHERE customer_name=$1),
          目标订单 AS (SELECT id FROM crm.orders WHERE customer_id IN (SELECT id FROM 目标客户))
     DELETE FROM crm.order_status_history WHERE order_id IN (SELECT id FROM 目标订单);
     WITH 目标客户 AS (SELECT id FROM crm.customers WHERE customer_name=$1),
          目标订单 AS (SELECT id FROM crm.orders WHERE customer_id IN (SELECT id FROM 目标客户))
     DELETE FROM crm.orders WHERE id IN (SELECT id FROM 目标订单);
     WITH 目标客户 AS (SELECT id FROM crm.customers WHERE customer_name=$1),
          目标报价 AS (SELECT id FROM crm.quotes WHERE customer_id IN (SELECT id FROM 目标客户))
     DELETE FROM crm.quote_profit_calculations WHERE quote_id IN (SELECT id FROM 目标报价);
     WITH 目标客户 AS (SELECT id FROM crm.customers WHERE customer_name=$1),
          目标报价 AS (SELECT id FROM crm.quotes WHERE customer_id IN (SELECT id FROM 目标客户))
     DELETE FROM crm.quote_snapshots WHERE quote_id IN (SELECT id FROM 目标报价);
     WITH 目标客户 AS (SELECT id FROM crm.customers WHERE customer_name=$1),
          目标报价 AS (SELECT id FROM crm.quotes WHERE customer_id IN (SELECT id FROM 目标客户))
     DELETE FROM crm.quote_status_history WHERE quote_id IN (SELECT id FROM 目标报价);
     WITH 目标客户 AS (SELECT id FROM crm.customers WHERE customer_name=$1),
          目标报价 AS (SELECT id FROM crm.quotes WHERE customer_id IN (SELECT id FROM 目标客户))
     DELETE FROM crm.quote_items WHERE quote_id IN (SELECT id FROM 目标报价);
     WITH 目标客户 AS (SELECT id FROM crm.customers WHERE customer_name=$1)
     DELETE FROM crm.quotes WHERE customer_id IN (SELECT id FROM 目标客户);
     WITH 目标客户 AS (SELECT id FROM crm.customers WHERE customer_name=$1)
     DELETE FROM crm.opportunities WHERE customer_id IN (SELECT id FROM 目标客户);
     DELETE FROM crm.customers WHERE customer_name=$1;`,
      [上下文.客户名称],
    )
    .catch(() => undefined);
}

async function 清理测试账号(用户名: string): Promise<void> {
  await 连接池
    .query(
      `WITH 目标账号 AS (SELECT id FROM iam.users WHERE username::text=$1)
     DELETE FROM channel.partner_members WHERE user_id IN (SELECT id FROM 目标账号);
     WITH 目标账号 AS (SELECT id FROM iam.users WHERE username::text=$1)
     DELETE FROM org.staff_assignments WHERE user_id IN (SELECT id FROM 目标账号);
     WITH 目标账号 AS (SELECT id FROM iam.users WHERE username::text=$1)
     DELETE FROM iam.user_roles WHERE user_id IN (SELECT id FROM 目标账号);
     WITH 目标账号 AS (SELECT id FROM iam.users WHERE username::text=$1)
     DELETE FROM iam.password_credentials WHERE user_id IN (SELECT id FROM 目标账号);
     WITH 目标账号 AS (SELECT id FROM iam.users WHERE username::text=$1)
     DELETE FROM iam.external_identities WHERE user_id IN (SELECT id FROM 目标账号);
     DELETE FROM iam.users WHERE username::text=$1;`,
      [用户名],
    )
    .catch(() => undefined);
}

function 拍平树(
  节点列表: Array<Record<string, unknown>>,
  结果: Array<Record<string, unknown>> = [],
): Array<Record<string, unknown>> {
  for (const 节点 of 节点列表) {
    const 子节点 = Array.isArray(节点.children)
      ? (节点.children as Array<Record<string, unknown>>)
      : [];
    结果.push(节点, ...[]);
    拍平树(子节点, 结果);
  }
  return 结果;
}

beforeAll(async () => {
  await 连接池.query("SELECT 1");
});

afterAll(async () => {
  await 连接池.end();
});

describe("新增161项非通过用例定向回归", () => {
  it("AUD-只读：审计日志普通会话禁止改删，显式维护会话仅允许清理", async () => {
    const 请求编号 = `AUD-READONLY-${randomUUID()}`;
    const 插入 = await 连接池.query<{ id: string }>(
      `INSERT INTO audit.audit_logs(created_at,request_id,module_code,action_code,result_code)
       VALUES(now(),$1,'audit','readonly_probe','success')
       RETURNING id::text AS id`,
      [请求编号],
    );
    const 记录编号 = 插入.rows[0]?.id;
    if (!记录编号) throw new Error("创建审计只读探针失败。");
    try {
      await expect(
        连接池.query("UPDATE audit.audit_logs SET message='篡改' WHERE request_id=$1", [请求编号]),
      ).rejects.toMatchObject({ code: "42501" });
      await expect(
        连接池.query("DELETE FROM audit.audit_logs WHERE request_id=$1", [请求编号]),
      ).rejects.toMatchObject({ code: "42501" });
      const 删除前 = await 连接池.query<{ total: string }>(
        "SELECT COUNT(*)::text AS total FROM audit.audit_logs WHERE request_id=$1",
        [请求编号],
      );
      expect(删除前.rows[0]?.total).toBe("1");

      await 执行审计维护删除(连接池, "request_id=$1", [请求编号]);
      const 删除后 = await 连接池.query<{ total: string }>(
        "SELECT COUNT(*)::text AS total FROM audit.audit_logs WHERE request_id=$1",
        [请求编号],
      );
      expect(删除后.rows[0]?.total).toBe("0");
    } finally {
      await 执行审计维护删除(连接池, "request_id=$1", [请求编号]).catch(() => undefined);
    }
  });

  it("IMP-08：审计关键词可按订单、报价、商机、报备业务编号和请求号命中", async () => {
    const cookie = await 登录超级管理员();
    const 样本 = await 连接池.query<{
      registration_id: string;
      registration_no: string;
      opportunity_id: string;
      opportunity_no: string;
      quote_id: string;
      quote_no: string;
      order_id: string;
      order_no: string;
      order_source_id: string | null;
    }>(
      `SELECT r.id::text AS registration_id,r.registration_no,
              o.id::text AS opportunity_id,o.opportunity_no,
              q.id::text AS quote_id,q.quote_no,
              od.id::text AS order_id,od.order_no,od.v2_source_id AS order_source_id
         FROM crm.orders od
         JOIN crm.quotes q ON q.id=od.quote_id
         JOIN crm.opportunities o ON o.id=q.opportunity_id
         JOIN crm.registrations r ON r.id=o.registration_id
        WHERE r.registration_no IS NOT NULL AND o.opportunity_no IS NOT NULL
          AND q.quote_no IS NOT NULL AND od.order_no IS NOT NULL
        LIMIT 1`,
    );
    const 业务 = 样本.rows[0];
    if (!业务) throw new Error("测试库缺少订单、报价、商机和报备完整链路样本。");
    const 标记 = `AUD-BIZ-${randomUUID()}`;
    const 历史审批编号 = randomUUID();
    const 历史来源标记 = 业务.order_source_id ? `${标记}-历史来源` : null;
    await 连接池.query(
      `INSERT INTO ops.approvals(id,approval_type_code,target_type,target_id,status_code,extra_json)
       VALUES($1::uuid,'order','order',$2::uuid,'pending',$3::jsonb)`,
      [历史审批编号, 业务.order_id, JSON.stringify({ targetNo: 业务.order_no })],
    );
    const 插入 = await 连接池.query<{ id: string; target_type: string }>(
      `INSERT INTO audit.audit_logs(
         created_at,request_id,actor_username,actor_name,actor_role,module_code,action_code,
         target_type,target_id,target_name,result_code,message,extra_json
       ) VALUES
         (now(),$1,'audit_probe','审计联查探针','superadmin','test','probe','registration',$2,'无业务编号报备','success','业务编号联查探针',$4::jsonb),
         (now(),$1,'audit_probe','审计联查探针','superadmin','test','probe','opportunity',$3,'无业务编号商机','success','业务编号联查探针',$4::jsonb),
         (now(),$1,'audit_probe','审计联查探针','superadmin','test','probe','quote',$5,'无业务编号报价','success','业务编号联查探针',$4::jsonb),
         (now(),$1,'audit_probe','审计联查探针','superadmin','test','probe','order',$6,'无业务编号订单','success','业务编号联查探针',$4::jsonb),
         (now(),$1,'audit_probe','审计联查探针','superadmin','test','approval.probe','approval',$8,'历史审批审计','success','历史审批按业务编号联查探针',$4::jsonb)
         ${历史来源标记 ? `,(now(),$1,'audit_probe','审计联查探针','superadmin','test','probe','order',$7,'历史来源订单','success','历史审计来源号联查探针',$4::jsonb)` : ""}
       RETURNING id::text AS id,target_type`,
      [
        标记,
        业务.registration_id,
        业务.opportunity_id,
        JSON.stringify({ probe: 标记 }),
        业务.quote_id,
        业务.order_id,
        业务.order_source_id,
        历史审批编号,
      ],
    );
    try {
      const 探针编号 = new Map(插入.rows.map((行) => [行.target_type, 行.id]));
      for (const [类型, 编号] of [
        ["registration", 业务.registration_no],
        ["opportunity", 业务.opportunity_no],
        ["quote", 业务.quote_no],
        ["order", 业务.order_no],
      ] as const) {
        const 探针 = 探针编号.get(类型);
        expect(探针).toBeTruthy();
        const 检索 = await request(应用)
          .get(`/api/v2/audit-logs?keyword=${encodeURIComponent(编号)}&pageSize=100`)
          .set("Cookie", cookie)
          .expect(200);
        const 编号列表 = (检索.body.data as Array<{ id: string }>).map((item) => item.id);
        expect(编号列表).toEqual(expect.arrayContaining([探针]));
      }
      const 历史审批检索 = await request(应用)
        .get(`/api/v2/audit-logs?keyword=${encodeURIComponent(业务.order_no)}&pageSize=100`)
        .set("Cookie", cookie)
        .expect(200);
      expect(
        (历史审批检索.body.data as Array<{ target_id: string }>).map((item) => item.target_id),
      ).toContain(历史审批编号);
      const 新UI订单审计 = await request(应用)
        .get(`/api/stage9/audit?keyword=${encodeURIComponent(业务.order_no)}&pageSize=100`)
        .set("Cookie", cookie)
        .expect(200);
      const 新UI审计记录 = Array.isArray(新UI订单审计.body.data)
        ? (新UI订单审计.body.data as Array<{ id: string }>)
        : ((新UI订单审计.body.data?.数据 || []) as Array<{ id: string }>);
      expect(新UI审计记录.map((item) => item.id)).toEqual(
        expect.arrayContaining([探针编号.get("order")]),
      );
      const 兼容别名订单审计 = await request(应用)
        .get(`/api/audit-logs?keyword=${encodeURIComponent(业务.order_no)}&pageSize=100`)
        .set("Cookie", cookie)
        .expect(200);
      const 兼容审计记录 = Array.isArray(兼容别名订单审计.body.data)
        ? (兼容别名订单审计.body.data as Array<{ id: string }>)
        : ((兼容别名订单审计.body.data?.数据 || []) as Array<{ id: string }>);
      expect(兼容审计记录.map((item) => item.id)).toEqual(
        expect.arrayContaining([探针编号.get("order")]),
      );
      if (业务.order_source_id) {
        const 历史来源审计 = await request(应用)
          .get(`/api/v2/audit-logs?keyword=${encodeURIComponent(业务.order_no)}&pageSize=100`)
          .set("Cookie", cookie)
          .expect(200);
        const 历史来源命中 = (历史来源审计.body.data as Array<{ target_id: string }>).filter(
          (item) => item.target_id === 业务.order_source_id,
        );
        expect(历史来源命中.length).toBeGreaterThan(0);
      }
      const 请求号检索 = await request(应用)
        .get(`/api/v2/audit-logs?keyword=${encodeURIComponent(标记)}&pageSize=20`)
        .set("Cookie", cookie)
        .expect(200);
      const 报备探针 = 探针编号.get("registration");
      expect(报备探针).toBeTruthy();
      expect((请求号检索.body.data as Array<{ id: string }>).map((item) => item.id)).toEqual(
        expect.arrayContaining([报备探针]),
      );
    } finally {
      await 执行审计维护删除(连接池, "request_id=$1", [标记]);
      await 连接池.query("DELETE FROM ops.approvals WHERE id=$1::uuid", [历史审批编号]);
    }
  });

  it("AUD-13/14：审计导出按当前条件导出、结束日包含全天且敏感字段脱敏", async () => {
    const 标记 = `AUD-EXPORT-${randomUUID()}`;
    const 操作账号 = `audit_export_${Date.now()}`;
    await 连接池.query(
      `INSERT INTO audit.audit_logs(
         created_at,request_id,actor_username,actor_name,actor_role,module_code,
         action_code,target_type,target_id,target_name,result_code,message,extra_json
       ) VALUES
       (now(),$1,$2,'审计导出甲','superadmin','orders','order.exported','order',$3,$3,'success','password=SecretValue token=abc123',$5::jsonb),
       (now(),$1,$2,'审计导出乙','superadmin','orders','order.exported','order',$4,$4,'success',$6,$5::jsonb)`,
      [
        标记,
        操作账号,
        `订单-${标记}-甲`,
        `订单-${标记}-乙`,
        JSON.stringify({ 标记 }),
        `正常业务说明-${标记}`,
      ],
    );
    const cookie = await 登录超级管理员();
    const 今日 = new Date().toISOString().slice(0, 10);
    const 查询串 = new URLSearchParams({
      keyword: 标记,
      dateFrom: 今日,
      dateTo: 今日,
      pageSize: "100",
    });

    const 列表 = await request(应用)
      .get(`/api/v2/audit-logs?${查询串.toString()}`)
      .set("Cookie", cookie)
      .expect(200);
    expect(列表.body.total).toBe(2);
    expect(列表.body.data.map((项: { request_id: string }) => 项.request_id)).toEqual([标记, 标记]);

    const 导出 = await request(应用)
      .get(`/api/v2/audit-logs/export?${查询串.toString()}`)
      .set("Cookie", cookie)
      .expect(200);
    expect(导出.headers["content-type"]).toContain("text/csv");
    const 文本 = 导出.text;
    expect(文本.charCodeAt(0)).toBe(0xfeff);
    expect(文本).toContain("操作人账号");
    expect(文本).toContain(`订单-${标记}-甲`);
    expect(文本).toContain(`订单-${标记}-乙`);
    expect(文本).toContain("[已脱敏]");
    expect(文本).not.toContain("SecretValue");
    expect(文本).not.toContain("abc123");

    const 兼容导出 = await request(应用)
      .get(`/api/v2/export/audit?${查询串.toString()}`)
      .set("Cookie", cookie)
      .expect(200);
    expect(兼容导出.headers["content-type"]).toContain("text/csv");

    const 正式别名导出 = await request(应用)
      .get(`/api/audit-logs/export?${查询串.toString()}`)
      .set("Cookie", cookie)
      .expect(200);
    expect(正式别名导出.headers["content-type"]).toContain("text/csv");
    expect(正式别名导出.text.charCodeAt(0)).toBe(0xfeff);
    expect(正式别名导出.text).toContain(`订单-${标记}-甲`);
    expect(正式别名导出.text).toContain("[已脱敏]");
    expect(正式别名导出.text).not.toContain("SecretValue");
  });

  it("SEC-02/PRD-20：区管可新建本区域待审批渠道，但产品目录等管理写入仍返回403并记录审计", async () => {
    const 超管Cookie = await 登录超级管理员();
    const 批次 = `PERM-${Date.now()}`;
    const 区域 = await 连接池.query<{ region_name: string }>(
      "SELECT region_name FROM org.regions WHERE status_code='active' AND region_level='region' ORDER BY region_name LIMIT 1",
    );
    const 区域名称 = 区域.rows[0]?.region_name || "江苏区";
    const 用户名 = `region_guard_${批次}`;
    const 创建用户 = await request(应用)
      .post("/api/v2/users")
      .set("Cookie", 超管Cookie)
      .send({
        username: 用户名,
        name: `${批次}-区管`,
        role: "region_manager",
        region: 区域名称,
        password: "LrCRM@2026!",
        status: "active",
      })
      .expect(200);
    expect(创建用户.body.success).toBe(true);
    const 区管Cookie = await 登录(用户名);

    const 渠道名称 = `区管渠道-${批次}`;
    const 渠道写入 = await request(应用)
      .post("/api/v2/partners")
      .set("Cookie", 区管Cookie)
      .send({ id: 批次, name: 渠道名称, city: "南京市", region: 区域名称 })
      .expect(200);
    expect(渠道写入.body.data).toMatchObject({ status: "pending", region: 区域名称 });

    const 产品写入 = await request(应用)
      .post("/api/v2/categories")
      .set("Cookie", 区管Cookie)
      .send({ name: `越权产品大类-${批次}` })
      .expect(403);
    expect(产品写入.body.error.code).toBe("V3_ADMIN_CONFIG_FORBIDDEN");

    const 未落库 = await 连接池.query<{ total: string }>(
      "SELECT COUNT(*)::text AS total FROM channel.partners WHERE partner_name=$1",
      [渠道名称],
    );
    expect(未落库.rows[0]?.total).toBe("1");
    const 越权审计 = await 连接池.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM audit.audit_logs
        WHERE actor_username=$1 AND action_code='admin_config.forbidden' AND result_code='failure'`,
      [用户名],
    );
    expect(Number(越权审计.rows[0]?.total || 0)).toBeGreaterThanOrEqual(1);
  });

  it("SEC-04：会话 Cookie 具备基础防护，跨站 Origin 写请求被拒绝", async () => {
    const 登录响应 = await request(应用)
      .post("/api/v2/auth/login")
      .send({ username: "liulonghai", password: "LrCRM@2026!" });
    const cookie = 读取Cookie(登录响应);
    const 全部Cookie = (登录响应.headers["set-cookie"] as unknown as string[]).join("\n");
    expect(全部Cookie).toContain("HttpOnly");
    expect(全部Cookie).toContain("SameSite=Lax");

    const 请求正文 = { endpoints: 10, productIds: [], hardwareItems: [] };
    const 跨站请求 = await request(应用)
      .post("/api/quotes/workload-preview")
      .set("Cookie", cookie)
      .set("Host", "10.9.86.66")
      .set("Origin", "https://example.com")
      .send(请求正文)
      .expect(403);
    expect(跨站请求.body.error?.code).toBe("V3_CSRF_ORIGIN_FORBIDDEN");

    await request(应用)
      .post("/api/quotes/workload-preview")
      .set("Cookie", cookie)
      .set("Host", "10.9.86.66")
      .set("Origin", "http://10.9.86.66")
      .send(请求正文)
      .expect(200);
  });

  it("SEC-07/REG-22：附件校验内容、双扩展名、大小、路径和下载登录态", async () => {
    const 安全应用 = 创建应用({
      env: {
        ...环境变量,
        V3_BUSINESS_LEGACY_IDENTITY_ENABLED: "false",
      },
    });
    const 管理员 = await 连接池.query<{ username: string }>(
      `SELECT u.username::text AS username
         FROM iam.users u
         JOIN iam.user_roles ur ON ur.user_id=u.id
         JOIN iam.roles r ON r.id=ur.role_id
        WHERE r.role_code='superadmin' AND u.status_code='active'
        ORDER BY CASE WHEN u.username::text='liulonghai' THEN 0 ELSE 1 END,u.created_at
        LIMIT 1`,
    );
    const 管理员账号 = 管理员.rows[0]?.username;
    if (!管理员账号) throw new Error("测试库缺少超级管理员账号。");
    const 登录响应 = await request(安全应用)
      .post("/api/v2/auth/login")
      .send({ username: 管理员账号, password: "LrCRM@2026!" })
      .expect(200);
    const cookie = 读取Cookie(登录响应);
    const 有效PDF = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n", "utf8");
    let 已上传存储名 = "";
    try {
      await request(安全应用)
        .post("/api/registrations/attachments")
        .attach("file", 有效PDF, { filename: "未登录.pdf", contentType: "application/pdf" })
        .expect(401);

      const PE伪装 = await request(安全应用)
        .post("/api/registrations/attachments")
        .set("Cookie", cookie)
        .attach("file", Buffer.from("MZ\x90\x00PE\x00\x00", "binary"), {
          filename: "伪装文件.pdf",
          contentType: "application/pdf",
        })
        .expect(400);
      expect(PE伪装.body.error?.code).toBe("V3_REGISTRATION_ATTACHMENT_CONTENT_INVALID");

      const 双扩展名 = await request(安全应用)
        .post("/api/registrations/attachments")
        .set("Cookie", cookie)
        .attach("file", 有效PDF, {
          filename: "危险程序.exe.pdf",
          contentType: "application/pdf",
        })
        .expect(400);
      expect(双扩展名.body.error?.code).toBe("V3_REGISTRATION_ATTACHMENT_TYPE_INVALID");

      const 路径穿越 = await request(安全应用)
        .post("/api/registrations/attachments")
        .set("Cookie", cookie)
        .attach("file", 有效PDF, {
          filename: "../../安全资料.pdf",
          contentType: "application/pdf",
        })
        .expect(200);
      expect(路径穿越.body.data.文件名).toBe("安全资料.pdf");
      expect(路径穿越.body.data.存储名).toMatch(/^[0-9a-f-]{36}\.pdf$/i);
      expect(路径穿越.body.data.存储名).not.toContain("..");
      已上传存储名 = String(路径穿越.body.data.存储名);

      const 超大文件 = await request(安全应用)
        .post("/api/registrations/attachments")
        .set("Cookie", cookie)
        .attach("file", Buffer.alloc(10 * 1024 * 1024 + 1, 0x61), {
          filename: "超大附件.pdf",
          contentType: "application/pdf",
        })
        .expect(400);
      expect(超大文件.body.error?.code).toBe("V3_REGISTRATION_ATTACHMENT_TOO_LARGE");

      await request(安全应用)
        .get(`/api/registrations/attachments/${encodeURIComponent(已上传存储名)}`)
        .expect(401);
      const 下载 = await request(安全应用)
        .get(`/api/registrations/attachments/${encodeURIComponent(已上传存储名)}`)
        .set("Cookie", cookie)
        .expect(200);
      expect(下载.headers["content-type"]).toContain("application/octet-stream");
      expect(下载.body.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    } finally {
      if (已上传存储名) {
        await rm(join(process.cwd(), "uploads", "registration-attachments", 已上传存储名), {
          force: true,
        });
      }
    }
  });

  it("SEC-08：登录失败限流、账号枚举、会话固定和成功清零", async () => {
    const 第二应用 = 创建应用({ env: 环境变量 });
    const 不存在账号 = `no_such_${randomUUID()}`;
    for (let 次数 = 1; 次数 <= 6; 次数 += 1) {
      const 响应 = await request(次数 % 2 === 1 ? 第二应用 : 应用)
        .post("/api/auth/login")
        .send({ username: 不存在账号, password: "错误密码A1!" })
        .expect(次数 === 6 ? 429 : 401);
      if (次数 === 6) expect(响应.body.error?.code).toBe("V3_AUTH_RATE_LIMITED");
    }

    const 共享计数 = await 连接池.query<{ attempt_count: number }>(
      `SELECT attempt_count FROM ops.auth_login_attempts
        WHERE attempt_key LIKE '%|' || $1
        ORDER BY updated_at DESC LIMIT 1`,
      [不存在账号],
    );
    expect(Number(共享计数.rows[0]?.attempt_count || 0)).toBe(5);
    const 限流审计 = await 连接池.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM audit.audit_logs
        WHERE action_code='auth.login.rate_limited' AND target_name=$1`,
      [不存在账号],
    );
    expect(Number(限流审计.rows[0]?.total || 0)).toBeGreaterThan(0);

    const 管理员 = await 连接池.query<{ username: string }>(
      `SELECT u.username::text AS username
         FROM iam.users u
         JOIN iam.user_roles ur ON ur.user_id=u.id
         JOIN iam.roles r ON r.id=ur.role_id
        WHERE r.role_code='superadmin' AND u.status_code='active'
        ORDER BY CASE WHEN u.username::text='liulonghai' THEN 0 ELSE 1 END,u.created_at
        LIMIT 1`,
    );
    const 管理员账号 = 管理员.rows[0]?.username;
    if (!管理员账号) throw new Error("测试库缺少超级管理员账号。");
    await 连接池.query("DELETE FROM ops.auth_login_attempts WHERE attempt_key LIKE '%|' || $1", [
      管理员账号,
    ]);

    const 错误密码响应 = await request(应用)
      .post("/api/auth/login")
      .send({ username: 管理员账号, password: "错误密码B2!" })
      .expect(401);
    const 不存在账号响应 = await request(应用)
      .post("/api/auth/login")
      .send({ username: `no_such_compare_${randomUUID()}`, password: "错误密码B2!" })
      .expect(401);
    expect(不存在账号响应.body.error?.code).toBe(错误密码响应.body.error?.code);
    expect(不存在账号响应.body.error?.message).toBe(错误密码响应.body.error?.message);

    const 首次登录 = await request(应用)
      .post("/api/auth/login")
      .send({ username: 管理员账号, password: "LrCRM@2026!" })
      .expect(200);
    const 登录审计 = await 连接池.query<{ action_code: string }>(
      `SELECT action_code FROM audit.audit_logs
        WHERE module_code='auth' AND actor_username=$1
          AND action_code IN ('auth.login.succeeded','auth.login.failed')
        ORDER BY created_at DESC LIMIT 10`,
      [管理员账号],
    );
    expect(登录审计.rows.map((项) => 项.action_code)).toEqual(
      expect.arrayContaining(["auth.login.succeeded", "auth.login.failed"]),
    );
    const 首次Cookie = 读取Cookie(首次登录);
    const 再次登录 = await request(应用)
      .post("/api/auth/login")
      .set("Cookie", 首次Cookie)
      .send({ username: 管理员账号, password: "LrCRM@2026!" })
      .expect(200);
    expect(读取Cookie(再次登录)).not.toBe(首次Cookie);

    for (let 次数 = 1; 次数 <= 4; 次数 += 1) {
      await request(应用)
        .post("/api/auth/login")
        .send({ username: 管理员账号, password: "错误密码C3!" })
        .expect(401);
    }
    await request(应用)
      .post("/api/auth/login")
      .send({ username: 管理员账号, password: "LrCRM@2026!" })
      .expect(200);
    await request(应用)
      .post("/api/auth/login")
      .send({ username: 管理员账号, password: "错误密码D4!" })
      .expect(401);
  });

  it("ORG-21：部门/成员导入先预览行级错误、生成任务并支持错误报告下载", async () => {
    const cookie = await 登录超级管理员();
    const 部门 = await 连接池.query<{ unit_name: string }>(
      "SELECT unit_name FROM org.org_units WHERE unit_type NOT LIKE 'channel_%' AND status_code IN ('active','draft') ORDER BY unit_name LIMIT 1",
    );
    const 用户 = await 连接池.query<{ username: string }>(
      "SELECT username::text AS username FROM iam.users WHERE status_code='active' ORDER BY username LIMIT 1",
    );
    const 部门名称 = 部门.rows[0]?.unit_name;
    const 用户名 = 用户.rows[0]?.username;
    expect(部门名称).toBeTruthy();
    expect(用户名).toBeTruthy();

    const 部门预览 = await request(应用)
      .post("/api/org/units/import/preview")
      .set("Cookie", cookie)
      .send({
        rows: [
          { name: `预览合法部门-${Date.now()}`, parentName: 部门名称, statusCode: "active" },
          {
            name: `预览失败部门-${Date.now()}`,
            parentName: "不存在的上级部门",
            statusCode: "active",
          },
        ],
      })
      .expect(200);
    expect(部门预览.body.data).toMatchObject({ totalCount: 2, validCount: 1, errorCount: 1 });
    const 部门任务 = await request(应用)
      .get(`/api/org/units/import/tasks/${部门预览.body.data.taskId}`)
      .set("Cookie", cookie)
      .expect(200);
    expect(部门任务.body.data.rows[1].errors.join("；")).toContain("上级部门不存在");
    const 部门错误报告 = await request(应用)
      .get(部门预览.body.data.errorReportUrl)
      .set("Cookie", cookie)
      .expect(200);
    expect(部门错误报告.text.charCodeAt(0)).toBe(0xfeff);
    expect(部门错误报告.text).toContain("上级部门不存在");

    const 成员预览 = await request(应用)
      .post("/api/org/staff/import/preview")
      .set("Cookie", cookie)
      .send({
        rows: [
          { username: 用户名, departmentName: 部门名称 },
          { username: `不存在用户-${Date.now()}`, departmentName: 部门名称 },
        ],
      })
      .expect(200);
    expect(成员预览.body.data).toMatchObject({ totalCount: 2, validCount: 1, errorCount: 1 });
    const 成员错误报告 = await request(应用)
      .get(成员预览.body.data.errorReportUrl)
      .set("Cookie", cookie)
      .expect(200);
    expect(成员错误报告.text).toContain("用户不存在或不可用");

    const 部门数 = await 连接池.query<{ total: string }>(
      "SELECT COUNT(*)::text AS total FROM org.org_units WHERE unit_type NOT LIKE 'channel_%'",
    );
    const 错误执行 = await request(应用)
      .post("/api/org/units/import")
      .set("Cookie", cookie)
      .send({
        rows: [
          {
            name: `执行前拦截部门-${Date.now()}`,
            parentName: "执行前不存在的上级部门",
            statusCode: "active",
          },
        ],
      })
      .expect(400);
    expect(错误执行.body.error.code).toBe("ORG_IMPORT_VALIDATION_FAILED");
    expect(错误执行.body.error.details.rows[0].errors.join("；")).toContain("上级部门不存在");
    const 部门数后 = await 连接池.query<{ total: string }>(
      "SELECT COUNT(*)::text AS total FROM org.org_units WHERE unit_type NOT LIKE 'channel_%'",
    );
    expect(部门数后.rows[0]?.total).toBe(部门数.rows[0]?.total);

    const 任职数 = await 连接池.query<{ total: string }>(
      "SELECT COUNT(*)::text AS total FROM org.staff_assignments",
    );
    const 成员错误执行 = await request(应用)
      .post("/api/org/staff/import")
      .set("Cookie", cookie)
      .send({ rows: [{ username: `执行前不存在用户-${Date.now()}`, departmentName: 部门名称 }] })
      .expect(400);
    expect(成员错误执行.body.error.code).toBe("ORG_IMPORT_VALIDATION_FAILED");
    const 任职数后 = await 连接池.query<{ total: string }>(
      "SELECT COUNT(*)::text AS total FROM org.staff_assignments",
    );
    expect(任职数后.rows[0]?.total).toBe(任职数.rows[0]?.total);
  });

  it("ORG-21：存在错误行时只导入通过行，不得删除未涉及的组织和任职", async () => {
    const cookie = await 登录超级管理员();
    const 批次 = `ORG-PARTIAL-${randomUUID()}`;
    const 基准部门 = await 连接池.query<{ id: string; unit_name: string }>(
      `SELECT id::text AS id, unit_name
         FROM org.org_units
        WHERE unit_type NOT LIKE 'channel_%' AND status_code IN ('active','draft')
        ORDER BY path_code LIMIT 1`,
    );
    const 基准部门编号 = 基准部门.rows[0]?.id;
    const 基准部门名称 = 基准部门.rows[0]?.unit_name;
    if (!基准部门编号 || !基准部门名称) throw new Error("测试库缺少内部基准部门。");

    const 合并部门 = await 连接池.query<{ id: string }>(
      `INSERT INTO org.org_units(unit_code,unit_name,unit_type,parent_unit_id,status_code)
       VALUES($1,$2,'department',$3::uuid,'draft') RETURNING id::text AS id`,
      [`${批次}-UNIT`, `${批次}-合并部门`, 基准部门编号],
    );
    const 合并部门编号 = 合并部门.rows[0]!.id;
    const 对照部门 = await 连接池.query<{ id: string }>(
      `INSERT INTO org.org_units(unit_code,unit_name,unit_type,parent_unit_id,status_code)
       VALUES($1,$2,'department',$3::uuid,'active') RETURNING id::text AS id`,
      [`${批次}-CONTROL`, `${批次}-对照部门`, 基准部门编号],
    );
    const 对照部门编号 = 对照部门.rows[0]!.id;
    const 用户 = await 连接池.query<{ id: string }>(
      `INSERT INTO iam.users(username,display_name,status_code)
       VALUES($1,$2,'active') RETURNING id::text AS id`,
      [`${批次}_user`, `${批次}成员`],
    );
    const 用户编号 = 用户.rows[0]!.id;
    const 对照用户 = await 连接池.query<{ id: string }>(
      `INSERT INTO iam.users(username,display_name,status_code)
       VALUES($1,$2,'active') RETURNING id::text AS id`,
      [`${批次}_control`, `${批次}对照成员`],
    );
    const 对照用户编号 = 对照用户.rows[0]!.id;
    const 待调整任职 = await 连接池.query<{ id: string }>(
      `INSERT INTO org.staff_assignments(user_id,org_unit_id,position_id,is_primary,effective_at)
       VALUES($1::uuid,$2::uuid,NULL,true,now()) RETURNING id::text AS id`,
      [用户编号, 合并部门编号],
    );
    const 对照任职 = await 连接池.query<{ id: string }>(
      `INSERT INTO org.staff_assignments(user_id,org_unit_id,position_id,is_primary,effective_at)
       VALUES($1::uuid,$2::uuid,NULL,true,now()) RETURNING id::text AS id`,
      [对照用户编号, 对照部门编号],
    );

    try {
      const 部门预览 = await request(应用)
        .post("/api/org/units/import/preview")
        .set("Cookie", cookie)
        .send({
          rows: [
            { name: `${批次}-合并部门`, parentName: 基准部门名称, statusCode: "active" },
            { name: `${批次}-失败部门`, parentName: `${批次}-不存在`, statusCode: "active" },
          ],
        })
        .expect(200);
      const 部门通过行 = 部门预览.body.data.rows
        .filter((行: { status: string }) => 行.status === "valid")
        .map((行: { data: Record<string, unknown> }) => 行.data);
      await request(应用)
        .post("/api/org/units/import")
        .set("Cookie", cookie)
        .send({ rows: 部门通过行, replaceAll: false, taskId: 部门预览.body.data.taskId })
        .expect(200);
      const 部门结果 = await 连接池.query<{ 对照状态: string; 合并状态: string }>(
        `SELECT (SELECT status_code FROM org.org_units WHERE id=$2::uuid) AS "对照状态",
                (SELECT status_code FROM org.org_units WHERE id=$1::uuid) AS "合并状态"`,
        [合并部门编号, 对照部门编号],
      );
      expect(部门结果.rows[0]?.对照状态).toBe("active");
      expect(部门结果.rows[0]?.合并状态).toBe("active");

      const 成员预览 = await request(应用)
        .post("/api/org/staff/import/preview")
        .set("Cookie", cookie)
        .send({
          rows: [
            { username: `${批次}_user`, departmentName: `${批次}-对照部门` },
            { username: `${批次}_missing`, departmentName: `${批次}-对照部门` },
          ],
        })
        .expect(200);
      const 成员通过行 = 成员预览.body.data.rows
        .filter((行: { status: string }) => 行.status === "valid")
        .map((行: { data: Record<string, unknown> }) => 行.data);
      await request(应用)
        .post("/api/org/staff/import")
        .set("Cookie", cookie)
        .send({ rows: 成员通过行, replaceAll: false, taskId: 成员预览.body.data.taskId })
        .expect(200);
      const 任职结果 = await 连接池.query<{ 对照任职存在: boolean; 调整后部门: string }>(
        `SELECT EXISTS(SELECT 1 FROM org.staff_assignments WHERE id=$1::uuid) AS "对照任职存在",
                (SELECT org_unit_id::text FROM org.staff_assignments WHERE id=$2::uuid) AS "调整后部门"`,
        [对照任职.rows[0]!.id, 待调整任职.rows[0]!.id],
      );
      expect(任职结果.rows[0]?.对照任职存在).toBe(true);
      expect(任职结果.rows[0]?.调整后部门).toBe(对照部门编号);
    } finally {
      await 连接池.query("DELETE FROM org.staff_assignments WHERE user_id IN ($1::uuid,$2::uuid)", [
        用户编号,
        对照用户编号,
      ]);
      await 连接池.query("DELETE FROM iam.users WHERE id IN ($1::uuid,$2::uuid)", [
        用户编号,
        对照用户编号,
      ]);
      await 连接池.query("DELETE FROM org.org_units WHERE id IN ($1::uuid,$2::uuid)", [
        合并部门编号,
        对照部门编号,
      ]);
    }
  });

  it("ORG-22：树节点直属成员数与成员接口一致，子部门由页面统一递归汇总", async () => {
    const cookie = await 登录超级管理员();
    const 组织树 = await request(应用).get("/api/org/units/tree").set("Cookie", cookie).expect(200);
    const 节点 = 拍平树(组织树.body.data.items).find(
      (项) => Array.isArray(项.members) && (项.members as unknown[]).length > 0,
    );
    expect(节点).toBeTruthy();
    const 成员接口 = await request(应用)
      .get(`/api/org/staff?orgUnitId=${encodeURIComponent(String(节点?.id))}`)
      .set("Cookie", cookie)
      .expect(200);
    expect(成员接口.body.data.items).toHaveLength((节点?.members as unknown[]).length);

    const 成员 = 节点?.members as Array<{ userId: string }>;
    const 样本成员 = 成员[0];
    if (!样本成员) throw new Error("组织节点缺少可测试成员。");
    const 已过期 = await 连接池.query<{ id: string }>(
      `INSERT INTO org.staff_assignments(
         user_id,org_unit_id,position_id,is_primary,effective_at,expired_at,created_by_user_id
       ) VALUES($1::uuid,$2::uuid,NULL,false,now()-interval '2 day',now()-interval '1 day',$1::uuid)
       RETURNING id::text AS id`,
      [样本成员.userId, 节点?.id],
    );
    try {
      const 过滤后接口 = await request(应用)
        .get(`/api/org/staff?orgUnitId=${encodeURIComponent(String(节点?.id))}`)
        .set("Cookie", cookie)
        .expect(200);
      expect(过滤后接口.body.data.items).toHaveLength(成员.length);
    } finally {
      await 连接池.query("DELETE FROM org.staff_assignments WHERE id=$1::uuid", [
        已过期.rows[0]?.id,
      ]);
    }
  });

  it("CHN-20：渠道核心档案、渠道详情与成员维护使用同一成员口径", async () => {
    const cookie = await 登录超级管理员();
    const 渠道 = await 连接池.query<{ partner_code: string; member_count: string }>(
      `SELECT COALESCE(p.v2_source_id,p.partner_code,p.id::text) AS partner_code,
              COUNT(pm.id)::text AS member_count
         FROM channel.partners p
         JOIN channel.partner_members pm ON pm.partner_id=p.id AND pm.archived_at IS NULL
        WHERE p.status_code='active'
        GROUP BY p.id,p.v2_source_id,p.partner_code
        ORDER BY COUNT(pm.id) DESC,p.id
        LIMIT 1`,
    );
    const 样本 = 渠道.rows[0];
    if (!样本) throw new Error("测试库缺少带成员的渠道商样本。");
    const 详情 = await request(应用)
      .get(`/api/v2/partners/${encodeURIComponent(样本.partner_code)}`)
      .set("Cookie", cookie)
      .expect(200);
    const 档案 = await request(应用)
      .get(`/api/v2/partners/${encodeURIComponent(样本.partner_code)}/profile`)
      .set("Cookie", cookie)
      .expect(200);
    expect(详情.body.data.staff).toHaveLength(Number(样本.member_count));
    expect(档案.body.data.memberCount).toBe(Number(样本.member_count));
  });

  it("PERF-05：桌面创建接口使用同一幂等键只落库一次，不同内容复用同键返回409", async () => {
    const cookie = await 登录超级管理员();
    const 后缀 = randomUUID();
    const 幂等键 = `desktop-create-${后缀}`;
    const 客户名称 = `桌面幂等客户-${后缀}`;
    const 首次 = await request(应用)
      .post("/api/registrations")
      .set("Cookie", cookie)
      .set("Idempotency-Key", 幂等键)
      .send({ customerName: 客户名称, contact: "幂等测试联系人" })
      .expect(200);
    const 重试 = await request(应用)
      .post("/api/registrations")
      .set("Cookie", cookie)
      .set("Idempotency-Key", 幂等键)
      .send({ customerName: 客户名称, contact: "幂等测试联系人" })
      .expect(200);
    expect(重试.body.data).toEqual(首次.body.data);

    const 冲突 = await request(应用)
      .post("/api/registrations")
      .set("Cookie", cookie)
      .set("Idempotency-Key", 幂等键)
      .send({ customerName: `${客户名称}-不同内容`, contact: "幂等测试联系人" })
      .expect(409);
    expect(冲突.body.error.code).toMatch(/IDEMPOTENCY_CONFLICT/);

    const 列表 = await request(应用)
      .get(`/api/registrations?keyword=${encodeURIComponent(客户名称)}&pageSize=100`)
      .set("Cookie", cookie)
      .expect(200);
    expect(
      (列表.body.data.数据 as Array<{ 客户名称?: string; 标题?: string }>).filter(
        (项) => 项.客户名称 === 客户名称 || 项.标题 === 客户名称,
      ),
    ).toHaveLength(1);
  });

  it("OPP-16：桌面商机更新接口拒绝空沟通内容、超长内容和仅空白内容", async () => {
    const 上下文 = await 创建报价测试上下文("商机跟进校验");
    try {
      const 基础请求 = {
        changeReason: "自动化验证沟通内容最终校验",
        stage: "contacted",
      };
      for (const 空内容 of ["", "   ", "\n\t"]) {
        const 响应 = await request(应用)
          .put(`/api/opportunities/${上下文.商机编号}`)
          .set("Cookie", 上下文.cookie)
          .send({ ...基础请求, followup: 空内容 })
          .expect(400);
        expect(响应.body.error?.code).toBe("V3_OPPORTUNITY_FOLLOWUP_CONTENT_REQUIRED");
      }

      const 超长 = await request(应用)
        .put(`/api/opportunities/${上下文.商机编号}`)
        .set("Cookie", 上下文.cookie)
        .send({ ...基础请求, followup: "跟".repeat(2001) })
        .expect(400);
      expect(超长.body.error?.code).toBe("V3_OPPORTUNITY_FOLLOWUP_CONTENT_TOO_LONG");

      const 脚本内容 = `<img src=x onerror="window.__OPP_XSS__=1"> 客户确认方案`;
      await request(应用)
        .put(`/api/opportunities/${上下文.商机编号}`)
        .set("Cookie", 上下文.cookie)
        .send({ ...基础请求, followup: 脚本内容, followupMethod: "电话" })
        .expect(200);
      const 详情 = await request(应用)
        .get(`/api/opportunities/${上下文.商机编号}`)
        .set("Cookie", 上下文.cookie)
        .expect(200);
      const 跟进记录 = (详情.body.data?.原始数据?.followups || []) as Array<{
        content?: string;
      }>;
      expect(跟进记录.some((项) => 项.content === 脚本内容)).toBe(true);
    } finally {
      await 清理报价测试上下文(上下文);
    }
  });

  it("XROLE-18：超级管理员可转移客户与商机负责人，并写审计和通知", async () => {
    const 上下文 = await 创建报价测试上下文("负责人转移");
    let 报备编号 = "";
    try {
      const 目标成员 = await 连接池.query<{
        user_id: string;
        partner_id: string;
        display_name: string;
      }>(
        `SELECT u.id::text AS user_id, pm.partner_id::text AS partner_id,
                u.display_name AS display_name
           FROM iam.users u
           JOIN channel.partner_members pm ON pm.user_id=u.id
          WHERE u.status_code='active' AND pm.status_code='active' AND pm.archived_at IS NULL
          ORDER BY u.created_at DESC, u.id
          LIMIT 1`,
      );
      const 成员 = 目标成员.rows[0];
      if (!成员) throw new Error("测试库缺少可用的渠道成员账号。");

      const 报备 = await request(应用)
        .post("/api/registrations")
        .set("Cookie", 上下文.cookie)
        .send({ customerName: `${上下文.客户名称}-客户转移`, contact: "负责人转移测试" })
        .expect(200);
      报备编号 = String(报备.body.data.id);
      await request(应用)
        .put(`/api/registrations/${报备编号}`)
        .set("Cookie", 上下文.cookie)
        .send({
          partnerId: 成员.partner_id,
          ownerUserId: 成员.user_id,
          notes: "XROLE-18 客户负责人转移",
        })
        .expect(200);

      await request(应用)
        .put(`/api/opportunities/${上下文.商机编号}`)
        .set("Cookie", 上下文.cookie)
        .send({
          partnerId: 成员.partner_id,
          ownerUserId: 成员.user_id,
          changeReason: "XROLE-18 商机负责人转移",
          stage: "contacted",
        })
        .expect(200);

      const 商机归属 = await 连接池.query<{ owner_user_id: string; partner_id: string }>(
        `SELECT owner_user_id::text AS owner_user_id, partner_id::text AS partner_id
           FROM crm.opportunities WHERE id=$1::uuid`,
        [上下文.商机编号],
      );
      expect(商机归属.rows[0]).toEqual({
        owner_user_id: 成员.user_id,
        partner_id: 成员.partner_id,
      });

      const 审计 = await 连接池.query<{ action_code: string }>(
        `SELECT action_code FROM audit.audit_logs
          WHERE target_id=$1
            AND action_code IN ('registration.owner_transferred','opportunity.owner_transferred')
          ORDER BY created_at`,
        [上下文.商机编号],
      );
      expect(审计.rows.map((项) => 项.action_code)).toContain("opportunity.owner_transferred");

      const 通知 = await 连接池.query<{ total: string }>(
        `SELECT COUNT(*)::text AS total FROM message.notifications
          WHERE recipient_user_id=$1::uuid
            AND aggregate_type='opportunity' AND aggregate_id=$2::uuid`,
        [成员.user_id, 上下文.商机编号],
      );
      expect(Number(通知.rows[0]?.total || 0)).toBeGreaterThan(0);
    } finally {
      await 连接池
        .query(
          "DELETE FROM message.notifications WHERE aggregate_id=$1::uuid OR aggregate_id=$2::uuid",
          [上下文.商机编号, 报备编号 || "00000000-0000-0000-0000-000000000000"],
        )
        .catch(() => undefined);
      await 清理报价测试上下文(上下文);
    }
  });

  it("SEC-05：客户、商机、跟进和审计中的脚本均按纯文本保存", async () => {
    const 上下文 = await 创建报价测试上下文("存储型XSS校验");
    const 脚本名称 = `<img src=x onerror="window.__SEC05_NAME__=1">商机`;
    const 脚本跟进 = `<script>window.__SEC05_FOLLOW__=1</script>客户确认`;
    const 脚本原因 = `<svg onload="window.__SEC05_REASON__=1">阶段变更</svg>`;
    try {
      await request(应用)
        .put(`/api/opportunities/${上下文.商机编号}`)
        .set("Cookie", 上下文.cookie)
        .send({
          name: 脚本名称,
          changeReason: 脚本原因,
          stage: "contacted",
          followup: 脚本跟进,
          followupMethod: "电话",
        })
        .expect(200);

      const 详情 = await request(应用)
        .get(`/api/opportunities/${上下文.商机编号}`)
        .set("Cookie", 上下文.cookie)
        .expect(200);
      expect(详情.body.data.原始数据.name).toBe(脚本名称);
      const 跟进记录 = 详情.body.data.原始数据.followups as Array<{ content?: string }>;
      expect(跟进记录.some((项) => 项.content === 脚本跟进)).toBe(true);

      const 审计 = await 连接池.query<{ message: string; after_json: { changeReason?: string } }>(
        `SELECT message, after_json
           FROM audit.audit_logs
          WHERE target_id=$1
            AND action_code='opportunity.updated'
            AND module_code='opportunities'
          ORDER BY created_at DESC
          LIMIT 1`,
        [上下文.商机编号],
      );
      expect(审计.rows[0]?.message).toContain(脚本原因);
      expect(审计.rows[0]?.after_json.changeReason).toBe(脚本原因);

      const 危险客户名称 = `<script>window.__SEC05_CUSTOMER__=1</script>客户-${randomUUID()}`;
      const 危险客户名 = await request(应用)
        .post("/api/opportunities")
        .set("Cookie", 上下文.cookie)
        .send({ customer: 危险客户名称, name: "危险客户名测试" })
        .expect(200);
      expect(危险客户名.body.data.原始数据.customerName).toBe(危险客户名称);
      const 危险客户详情 = await request(应用)
        .get(`/api/opportunities/${encodeURIComponent(String(危险客户名.body.data.id))}`)
        .set("Cookie", 上下文.cookie)
        .expect(200);
      expect(危险客户详情.body.data.客户名称).toBe(危险客户名称);
      await 清理报价测试上下文({ 客户名称: 危险客户名称 });
    } finally {
      await 清理报价测试上下文(上下文);
    }
  });

  it("APR-13：审批驳回必须填写原因且原因长度受限", async () => {
    const cookie = await 登录超级管理员();
    const 审批编号 = randomUUID();
    await 连接池.query(
      `INSERT INTO ops.approvals(v2_source_id,approval_type_code,target_type,status_code,extra_json)
       VALUES($1,'registration','registration','pending','{"source":"自动化补测"}'::jsonb)`,
      [`APPROVAL-${审批编号}`],
    );
    const 审批业务编号 = `APPROVAL-${审批编号}`;
    const 空原因 = await request(应用)
      .put(`/api/v2/pending-approvals/${审批业务编号}`)
      .set("Cookie", cookie)
      .send({ action: "reject", approvedBy: "补测审批人" })
      .expect(400);
    expect(空原因.body.error).toContain("驳回时必须填写驳回原因");

    const 超长原因 = await request(应用)
      .put(`/api/v2/pending-approvals/${审批业务编号}`)
      .set("Cookie", cookie)
      .send({ action: "reject", approvedBy: "补测审批人", reason: "超".repeat(501) })
      .expect(400);
    expect(超长原因.body.error).toContain("驳回原因不能超过 500 个字符");

    const 正常 = await request(应用)
      .put(`/api/v2/pending-approvals/${审批业务编号}`)
      .set("Cookie", cookie)
      .send({ action: "reject", approvedBy: "补测审批人", reason: "资料不完整，请补充。" })
      .expect(200);
    expect(正常.body.success).toBe(true);
  });

  it("QTE-22：报价端点只接受 1 至一亿的整数，0、负数和非数字均拒绝", async () => {
    for (const 非法值 of [0, -1, "abc", 1.5]) {
      const 响应 = await request(应用)
        .post("/api/quotes/workload-preview")
        .send({ endpoints: 非法值, productIds: [], hardwareItems: [] })
        .expect(400);
      expect(响应.body.error?.code).toBe("V3_QUOTE_ENDPOINTS_INVALID");
    }
    for (const 合法值 of [1, 500, 501, 100_000_000]) {
      const 响应 = await request(应用)
        .post("/api/quotes/workload-preview")
        .send({ endpoints: 合法值, productIds: [], hardwareItems: [] })
        .expect(200);
      expect(响应.body.data.endpoints).toBe(合法值);
      expect(Number.isFinite(Number(响应.body.data.total))).toBe(true);
    }
  });

  it("PRD-17：工作量映射支持新增、试算生效、删除停用和审计留痕", async () => {
    const cookie = await 登录超级管理员();
    const 批次 = `WORKLOAD-CRUD-${randomUUID()}`;
    const 模块 = await 连接池.query<{ id: string }>(
      "SELECT id::text AS id FROM catalog.product_modules WHERE status_code='active' ORDER BY id LIMIT 1",
    );
    const 模块编号 = 模块.rows[0]?.id;
    if (!模块编号) throw new Error("测试库缺少可用产品模块。");
    const 功能 = await 连接池.query<{ id: string }>(
      `INSERT INTO catalog.product_features(
         module_id,feature_code,feature_name,unit_name,list_price,published,status_code,extra_json
       ) VALUES($1::uuid,$2,$2,'端点',10,true,'active',$3::jsonb)
       RETURNING id::text AS id`,
      [
        模块编号,
        `${批次}-FEATURE`,
        JSON.stringify({ id: `${批次}-FEATURE`, name: `${批次}-工作量功能`, testTag: 批次 }),
      ],
    );
    const 功能编号 = 功能.rows[0]?.id;
    if (!功能编号) throw new Error("创建工作量映射测试功能失败。");

    try {
      const 初始映射 = await request(应用)
        .get(`/api/workload/mappings?keyword=${encodeURIComponent(批次)}`)
        .set("Cookie", cookie)
        .expect(200);
      expect(
        初始映射.body.data.find((项: { featureId: string }) => 项.featureId === 功能编号),
      ).toMatchObject({ active: false, deliveryTags: [] });

      const 新增 = await request(应用)
        .post("/api/workload/mappings")
        .set("Cookie", cookie)
        .send({ productId: 功能编号, deliveryTags: ["EPP_BASE"], active: true })
        .expect(201);
      expect(新增.body.data).toMatchObject({
        featureId: 功能编号,
        deliveryTags: ["EPP_BASE"],
        active: true,
      });

      const 生效试算 = await request(应用)
        .post("/api/quotes/workload-preview")
        .set("Cookie", cookie)
        .send({ endpoints: 120, productIds: [功能编号] })
        .expect(200);
      expect(生效试算.body.data.workloadSummary).toContain("EPP");

      const 删除 = await request(应用)
        .delete(`/api/workload/mappings/${功能编号}`)
        .set("Cookie", cookie)
        .expect(200);
      expect(删除.body.data).toMatchObject({
        featureId: 功能编号,
        deliveryTags: [],
        active: false,
      });

      const 删除后试算 = await request(应用)
        .post("/api/quotes/workload-preview")
        .set("Cookie", cookie)
        .send({ endpoints: 120, productIds: [功能编号] })
        .expect(200);
      expect(删除后试算.body.data.workloadSummary).toContain("未命中产品工作量映射");

      const 审计 = await 连接池.query<{ action_code: string }>(
        `SELECT action_code
           FROM audit.audit_logs
          WHERE module_code='workload'
            AND target_id=$1
            AND action_code IN ('update_mapping','delete_mapping')
          ORDER BY created_at`,
        [功能编号],
      );
      expect(审计.rows.map((项) => 项.action_code)).toEqual(["update_mapping", "delete_mapping"]);
    } finally {
      await 执行审计维护删除(连接池, "module_code='workload' AND target_id=$1", [功能编号]);
      await 连接池.query(
        "DELETE FROM catalog.workload_mappings WHERE product_ref_id=$1::uuid OR feature_id=$1::uuid",
        [功能编号],
      );
      await 连接池.query("DELETE FROM catalog.product_features WHERE id=$1::uuid", [功能编号]);
    }
  });

  it("QTE-26：未来区域价不参与当前报价，已生效区域价按覆盖规则取价", async () => {
    const 批次 = `PRICE-EFFECTIVE-${randomUUID()}`;
    const 模块 = await 连接池.query<{ id: string }>(
      "SELECT id::text AS id FROM catalog.product_modules WHERE status_code='active' ORDER BY id LIMIT 1",
    );
    const 模块编号 = 模块.rows[0]?.id;
    if (!模块编号) throw new Error("测试库缺少可用产品模块。");
    const 功能编号 = await 连接池.query<{ id: string }>(
      `INSERT INTO catalog.product_features(
         module_id,feature_code,feature_name,unit_name,list_price,published,status_code,extra_json
       ) VALUES($1::uuid,$2,$2,'端点',10,true,'active',$3::jsonb)
       RETURNING id::text AS id`,
      [
        模块编号,
        `${批次}-FEATURE`,
        JSON.stringify({
          id: `${批次}-FEATURE`,
          name: `${批次}-价格有效期功能`,
          unit: "端点",
          priceFixed: 10,
          tiers: [{ min: 1, max: 100, price: 10 }],
          regionPriceOverrides: [
            {
              region: `${批次}-未来区域`,
              enabled: true,
              effectiveAt: "2099-01-01",
              tiers: [{ min: 1, max: 100, price: 99 }],
            },
            {
              region: `${批次}-生效区域`,
              enabled: true,
              effectiveAt: "2020-01-01",
              effectiveTo: "2098-12-31",
              tiers: [{ min: 1, max: 100, price: 88 }],
            },
            {
              region: `${批次}-停用区域`,
              enabled: false,
              tiers: [{ min: 1, max: 100, price: 77 }],
            },
          ],
        }),
      ],
    );
    const 功能ID = 功能编号.rows[0]?.id;
    if (!功能ID) throw new Error("创建价格有效期测试功能失败。");
    try {
      for (const [区域, 预期单价] of [
        [`${批次}-未来区域`, 10],
        [`${批次}-生效区域`, 88],
        [`${批次}-停用区域`, 10],
      ] as const) {
        const 试算 = await request(应用)
          .post("/api/quotes/workload-preview")
          .send({ endpoints: 10, productIds: [功能ID], region: 区域 })
          .expect(200);
        expect(试算.body.data.items[0].定价明细.最终单价).toBe(预期单价);
      }
    } finally {
      await 连接池.query("DELETE FROM catalog.product_features WHERE id=$1::uuid", [功能ID]);
    }
  });

  it("QTE-30：同一草稿报价并发保存只允许一个版本成功，另一个返回409", async () => {
    const 上下文 = await 创建报价测试上下文("并发报价");
    try {
      const 版本 = await 连接池.query<{ row_version: number }>(
        "SELECT row_version FROM crm.quotes WHERE id=$1::uuid",
        [上下文.报价编号],
      );
      const 请求体 = {
        opportunityId: 上下文.商机编号,
        endpoints: 20,
        productIds: [上下文.产品编号],
        quoteMode: "自定义报价",
        rowVersion: Number(版本.rows[0]?.row_version),
      };
      const [甲, 乙] = await Promise.all([
        request(应用)
          .put(`/api/quotes/${上下文.报价编号}`)
          .set("Cookie", 上下文.cookie)
          .send(请求体),
        request(应用)
          .put(`/api/quotes/${上下文.报价编号}`)
          .set("Cookie", 上下文.cookie)
          .send({
            ...请求体,
            endpoints: 30,
          }),
      ]);
      expect([甲.status, 乙.status].sort((左, 右) => 左 - 右)).toEqual([200, 409]);
      const 冲突 = 甲.status === 409 ? 甲 : 乙;
      expect(冲突.body.error?.code).toBe("V3_QUOTE_VERSION_CONFLICT");
      const 最终 = await 连接池.query<{ row_version: string; endpoints: string }>(
        "SELECT row_version::text, COALESCE(extra_json->>'endpoints','') AS endpoints FROM crm.quotes WHERE id=$1::uuid",
        [上下文.报价编号],
      );
      expect(Number(最终.rows[0]?.row_version)).toBe(Number(请求体.rowVersion) + 1);
      expect(["20", "30"]).toContain(最终.rows[0]?.endpoints);
    } finally {
      await 清理报价测试上下文(上下文);
    }
  });

  it("PERF-04：同一报价并发转单只生成一张订单，重复请求返回409而不是500", async () => {
    const 上下文 = await 创建报价测试上下文("并发转单");
    try {
      const [甲, 乙] = await Promise.all([
        request(应用)
          .post("/api/orders")
          .set("Cookie", 上下文.cookie)
          .send({ quoteId: 上下文.报价编号 }),
        request(应用)
          .post("/api/orders")
          .set("Cookie", 上下文.cookie)
          .send({ quoteId: 上下文.报价编号 }),
      ]);
      expect([甲.status, 乙.status].sort((左, 右) => 左 - 右)).toEqual([200, 409]);
      const 冲突 = 甲.status === 409 ? 甲 : 乙;
      expect(冲突.body.error?.code).toBe("V3_QUOTE_ALREADY_CONVERTED");
      const 订单数 = await 连接池.query<{ total: string }>(
        "SELECT COUNT(*)::text AS total FROM crm.orders WHERE quote_id=$1::uuid",
        [上下文.报价编号],
      );
      expect(订单数.rows[0]?.total).toBe("1");
    } finally {
      await 清理报价测试上下文(上下文);
    }
  });

  it("PRD-14/PRD-15：重叠价格档、重叠区域有效期和重复套餐组合均在保存前拒绝", async () => {
    const cookie = await 登录超级管理员();
    const 模块 = await 连接池.query<{ id: string }>(
      "SELECT id::text AS id FROM catalog.product_modules WHERE status_code='active' ORDER BY id LIMIT 1",
    );
    const 模块编号 = 模块.rows[0]?.id;
    if (!模块编号) throw new Error("测试库缺少可用产品模块。");
    const 批次 = `PRICE-VALIDATION-${randomUUID()}`;
    const 重叠档位 = await request(应用)
      .post("/api/v2/features")
      .set("Cookie", cookie)
      .send({
        id: 批次,
        productCode: 批次,
        name: `${批次}-重叠档位`,
        moduleId: 模块编号,
        unit: "端点",
        published: true,
        tiers: [
          { min: 1, max: 10, price: 10 },
          { min: 10, max: 20, price: 9 },
        ],
      })
      .expect(400);
    expect(String(重叠档位.body.error)).toContain("重叠档位");

    const 重叠区域 = await request(应用)
      .post("/api/v2/features")
      .set("Cookie", cookie)
      .send({
        id: `${批次}-REGION`,
        productCode: `${批次}-REGION`,
        name: `${批次}-重叠区域`,
        moduleId: 模块编号,
        unit: "端点",
        published: true,
        tiers: [{ min: 1, max: 10, price: 10 }],
        regionPriceOverrides: [
          {
            region: "江苏区",
            effectiveAt: "2026-01-01",
            effectiveTo: "2026-12-31",
            tiers: [{ min: 1, max: 10, price: 8 }],
          },
          {
            region: "江苏区",
            effectiveAt: "2026-06-01",
            effectiveTo: "2027-01-01",
            tiers: [{ min: 1, max: 10, price: 7 }],
          },
        ],
      })
      .expect(400);
    expect(String(重叠区域.body.error)).toContain("有效期重叠");

    const 重复套餐 = await request(应用)
      .post("/api/v2/packages")
      .set("Cookie", cookie)
      .send({ id: `${批次}-PACKAGE`, name: `${批次}-重复套餐`, featureIds: ["F-A", "F-A"] })
      .expect(400);
    expect(String(重复套餐.body.error)).toContain("重复功能");
  });

  it("APR-12：渠道账号访问审批列表和待审批接口均返回403", async () => {
    const cookie = await 登录超级管理员();
    const 用户名 = `apr12_partner_${randomUUID().slice(0, 8)}`;
    try {
      await request(应用)
        .post("/api/v2/users")
        .set("Cookie", cookie)
        .send({
          username: 用户名,
          name: "审批越权测试渠道账号",
          role: "partner_admin",
          password: "LrCRM@2026!",
          phone: 生成测试手机号("186"),
          status: "active",
        })
        .expect(200);
      const 渠道Cookie = await 登录(用户名);
      for (const 路径 of ["/api/v2/approvals", "/api/v2/pending-approvals"]) {
        const 响应 = await request(应用).get(路径).set("Cookie", 渠道Cookie).expect(403);
        expect(响应.body.error?.code).toBe("V3_APPROVAL_CENTER_FORBIDDEN");
      }
    } finally {
      await 清理测试账号(用户名);
    }
  });

  it("PRD-19：开放接口客户端操作可按对象名称检索到审计记录", async () => {
    const cookie = await 登录超级管理员();
    const 名称 = `85项审计检索-${randomUUID()}`;
    const 超管 = await 连接池.query<{ username: string }>(
      `SELECT u.username::text AS username
         FROM iam.users u
         JOIN iam.user_roles ur ON ur.user_id=u.id
         JOIN iam.roles r ON r.id=ur.role_id
        WHERE u.status_code='active' AND r.role_code='superadmin'
        ORDER BY CASE WHEN u.username::text='liulonghai' THEN 0 ELSE 1 END,u.created_at
        LIMIT 1`,
    );
    const 用户名 = 超管.rows[0]?.username;
    if (!用户名) throw new Error("测试库缺少可用的超级管理员账号。");
    const 创建 = await request(应用)
      .post("/api/open-api/clients")
      .set("Cookie", cookie)
      .send({
        name: 名称,
        boundUserId: 用户名,
        allowedResources: ["orders"],
        status: "active",
      })
      .expect(200);
    const 客户端编号 = String(创建.body.data.id || "");
    try {
      const 审计 = await request(应用)
        .get(`/api/audit-logs?keyword=${encodeURIComponent(名称)}&pageSize=20`)
        .set("Cookie", cookie)
        .expect(200);
      expect(审计.body.data.数据).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            原始数据: expect.objectContaining({ targetName: 名称, targetId: 客户端编号 }),
          }),
        ]),
      );
    } finally {
      if (客户端编号) {
        await 连接池.query(
          "DELETE FROM integration.open_api_permissions WHERE client_id=$1::uuid",
          [客户端编号],
        );
        await 连接池.query(
          "DELETE FROM integration.open_api_client_secrets WHERE client_id=$1::uuid",
          [客户端编号],
        );
        await 连接池.query("DELETE FROM integration.open_api_clients WHERE id=$1::uuid", [
          客户端编号,
        ]);
      }
    }
  });

  it("APR-09/14/15/16：审批详情可追溯、终态待办过滤、类型筛选和计数同步", async () => {
    const cookie = await 登录超级管理员();
    const 批次 = `APR-COUNT-${randomUUID()}`;
    const 待审批渠道 = await 连接池.query<{ id: string }>(
      `INSERT INTO channel.partners(partner_code,partner_name,normalized_name,partner_level_code,status_code,extra_json)
       VALUES($1,$1,$1,'none','pending','{}'::jsonb) RETURNING id::text AS id`,
      [`${批次}-待审批渠道`],
    );
    const 终态渠道 = await 连接池.query<{ id: string }>(
      `INSERT INTO channel.partners(partner_code,partner_name,normalized_name,partner_level_code,status_code,extra_json)
       VALUES($1,$1,$1,'none','active','{}'::jsonb) RETURNING id::text AS id`,
      [`${批次}-终态渠道`],
    );
    const 待审批订单 = await 连接池.query<{ id: string }>(
      `INSERT INTO crm.orders(order_no,status_code,total_amount,business_type_code,extra_json)
       VALUES($1,'primary_confirmed',1000,'product','{}'::jsonb) RETURNING id::text AS id`,
      [`${批次}-待审批订单`],
    );
    const 终态订单 = await 连接池.query<{ id: string }>(
      `INSERT INTO crm.orders(order_no,status_code,total_amount,business_type_code,extra_json)
       VALUES($1,'confirmed',1000,'product','{}'::jsonb) RETURNING id::text AS id`,
      [`${批次}-终态订单`],
    );
    const 待审批编号 = `${批次}-APPROVAL-PENDING`;
    const 终态编号 = `${批次}-APPROVAL-TERMINAL`;
    const 订单编号 = `${批次}-APPROVAL-ORDER`;
    const 终态订单编号 = `${批次}-APPROVAL-ORDER-TERMINAL`;
    const 历史审批业务编号 = `${批次}-历史审批业务编号`;
    const 审批记录 = await 连接池.query<{ id: string }>(
      `INSERT INTO ops.approvals(v2_source_id,approval_type_code,target_type,target_id,status_code,extra_json)
       VALUES($1,'partner','partner',$2::uuid,'pending','{}'::jsonb),
             ($3,'partner','partner',$4::uuid,'pending','{}'::jsonb),
             ($5,'order','order',$6::uuid,'pending',$9::jsonb),
             ($7,'order','order',$8::uuid,'pending',$9::jsonb)
       RETURNING id::text AS id`,
      [
        待审批编号,
        待审批渠道.rows[0]?.id,
        终态编号,
        终态渠道.rows[0]?.id,
        订单编号,
        待审批订单.rows[0]?.id,
        终态订单编号,
        终态订单.rows[0]?.id,
        JSON.stringify({ targetNo: 历史审批业务编号 }),
      ],
    );
    try {
      const 详情 = await request(应用)
        .get(`/api/v2/approvals/${encodeURIComponent(待审批编号)}`)
        .set("Cookie", cookie)
        .expect(200);
      expect(详情.body.data.approvalId).toBe(审批记录.rows[0]?.id);

      // 审批列表展示的订单业务编号必须能定位回同一条审批；历史 targetNo 仅作为兜底，
      // 不能被继续优先展示，否则页面展示旧编号时详情接口会返回 404。
      const 业务编号详情 = await request(应用)
        .get(`/api/v2/approvals/${encodeURIComponent(`${批次}-待审批订单`)}`)
        .set("Cookie", cookie)
        .expect(200);
      expect(业务编号详情.body.data.approvalId).toBe(审批记录.rows[2]?.id);
      expect(业务编号详情.body.data.targetNo).toBe(`${批次}-待审批订单`);
      expect(业务编号详情.body.data.targetNo).not.toBe(历史审批业务编号);

      const 待办 = await request(应用)
        .get("/api/v2/pending-approvals?pageSize=1000")
        .set("Cookie", cookie)
        .expect(200);
      const 待办编号 = (待办.body.data as Array<Record<string, unknown>>).map((项) =>
        String(项.code || 项.id),
      );
      expect(待办编号).toContain(待审批编号);
      expect(待办编号).not.toContain(终态编号);
      expect(待办编号).not.toContain(终态订单编号);

      const 订单待办 = await request(应用)
        .get("/api/v2/pending-approvals?type=order&pageSize=1000")
        .set("Cookie", cookie)
        .expect(200);
      expect(订单待办.body.data.length).toBeGreaterThan(0);
      expect(
        (订单待办.body.data as Array<Record<string, unknown>>).every(
          (项) => 项.targetType === "order",
        ),
      ).toBe(true);
      expect(
        (订单待办.body.data as Array<Record<string, unknown>>).some(
          (项) => 项.approvalId === 审批记录.rows[2]?.id,
        ),
      ).toBe(true);
      expect(
        (订单待办.body.data as Array<Record<string, unknown>>).some(
          (项) => 项.approvalId === 审批记录.rows[3]?.id,
        ),
      ).toBe(false);

      const 概览前 = await request(应用)
        .get("/api/v2/dashboard/stats")
        .set("Cookie", cookie)
        .expect(200);
      await request(应用)
        .put(`/api/v2/pending-approvals/${encodeURIComponent(待审批编号)}`)
        .set("Cookie", cookie)
        .send({ action: "approve", approvedBy: "自动化补测" })
        .expect(200);
      const 概览后 = await request(应用)
        .get("/api/v2/dashboard/stats")
        .set("Cookie", cookie)
        .expect(200);
      expect(Number(概览后.body.data.pendingApprovals)).toBeLessThan(
        Number(概览前.body.data.pendingApprovals),
      );
      const 审批后 = await request(应用)
        .get(`/api/v2/approvals/${encodeURIComponent(待审批编号)}`)
        .set("Cookie", cookie)
        .expect(200);
      expect(审批后.body.data.status).toBe("approved");
    } finally {
      await 连接池
        .query(
          `WITH 目标审批 AS (
           SELECT id FROM ops.approvals WHERE v2_source_id = ANY($1::text[])
         )
         DELETE FROM ops.approval_events WHERE approval_id IN (SELECT id FROM 目标审批);
         DELETE FROM ops.approvals WHERE v2_source_id = ANY($1::text[]);
         DELETE FROM crm.orders WHERE id = ANY($2::uuid[]);
         DELETE FROM channel.partners WHERE id = ANY($3::uuid[]);`,
          [
            [待审批编号, 终态编号, 订单编号, 终态订单编号],
            [待审批订单.rows[0]?.id, 终态订单.rows[0]?.id],
            [待审批渠道.rows[0]?.id, 终态渠道.rows[0]?.id],
          ],
        )
        .catch(() => undefined);
    }
  }, 30_000);

  it("CHN-18：渠道摘要三处同口径、排除失效订单，并支持管理员按渠道下钻", async () => {
    const cookie = await 登录超级管理员();
    const 批次 = `CHN18-${randomUUID()}`;
    const 渠道 = await 连接池.query<{ id: string }>(
      `INSERT INTO channel.partners(
         partner_code,partner_name,normalized_name,partner_level_code,status_code,extra_json
       ) VALUES($1,$1,$1,'primary','active','{}'::jsonb)
       RETURNING id::text AS id`,
      [批次],
    );
    const 渠道编号 = 渠道.rows[0]?.id;
    if (!渠道编号) throw new Error("创建渠道摘要测试渠道失败。");
    const 客户名称 = `${批次}-客户`;
    const 客户 = await 连接池.query<{ id: string }>(
      `INSERT INTO crm.customers(customer_name,normalized_name,owner_partner_id,status_code)
       VALUES($1,$1,$2::uuid,'active') RETURNING id::text AS id`,
      [客户名称, 渠道编号],
    );
    const 客户编号 = 客户.rows[0]?.id;
    if (!客户编号) throw new Error("创建渠道摘要测试客户失败。");
    try {
      await 连接池.query(
        `INSERT INTO crm.registrations(
           registration_no,customer_id,partner_id,status_code,extra_json
         ) VALUES
           ($1,$5::uuid,$6::uuid,'pending','{}'::jsonb),
           ($2,$5::uuid,$6::uuid,'approved','{}'::jsonb),
           ($3,$5::uuid,$6::uuid,'converted','{}'::jsonb),
           ($4,$5::uuid,$6::uuid,'rejected','{}'::jsonb)`,
        [`${批次}-REG-1`, `${批次}-REG-2`, `${批次}-REG-3`, `${批次}-REG-4`, 客户编号, 渠道编号],
      );
      await 连接池.query(
        `INSERT INTO crm.opportunities(
           opportunity_no,customer_id,partner_id,stage_code,status_code,expected_amount,extra_json
         ) VALUES
           ($1,$4::uuid,$5::uuid,'10','active',100,'{}'::jsonb),
           ($2,$4::uuid,$5::uuid,'20','won',200,'{}'::jsonb),
           ($3,$4::uuid,$5::uuid,'10','cancelled',999,'{}'::jsonb)`,
        [`${批次}-OPP-1`, `${批次}-OPP-2`, `${批次}-OPP-3`, 客户编号, 渠道编号],
      );
      await 连接池.query(
        `INSERT INTO crm.quotes(
           quote_no,customer_id,partner_id,status_code,total_amount,extra_json
         ) VALUES
           ($1,$5::uuid,$6::uuid,'draft',50,'{}'::jsonb),
           ($2,$5::uuid,$6::uuid,'approved',80,'{}'::jsonb),
           ($3,$5::uuid,$6::uuid,'rejected',30,'{}'::jsonb),
           ($4,$5::uuid,$6::uuid,'cancelled',20,'{}'::jsonb)`,
        [
          `${批次}-QUOTE-1`,
          `${批次}-QUOTE-2`,
          `${批次}-QUOTE-3`,
          `${批次}-QUOTE-4`,
          客户编号,
          渠道编号,
        ],
      );
      await 连接池.query(
        `INSERT INTO crm.orders(
           order_no,customer_id,partner_id,status_code,total_amount,business_type_code,extra_json
         ) VALUES
           ($1,$5::uuid,$6::uuid,'confirmed',1000,'product','{}'::jsonb),
           ($2,$5::uuid,$6::uuid,'primary_rejected',500,'product','{}'::jsonb),
           ($3,$5::uuid,$6::uuid,'cancelled',700,'product','{}'::jsonb),
           ($4,$5::uuid,$6::uuid,'rejected',600,'product','{}'::jsonb)`,
        [
          `${批次}-ORDER-1`,
          `${批次}-ORDER-2`,
          `${批次}-ORDER-3`,
          `${批次}-ORDER-4`,
          客户编号,
          渠道编号,
        ],
      );

      const 预期摘要 = {
        // 客户数按去重客户主体统计：同一客户的多条报备不能重复计数。
        客户数: 1,
        商机数: 2,
        // 只统计有效报价：草稿、驳回和取消均不计入。
        报价单数: 1,
        订单数: 1,
        商机金额: 300,
        订单金额: 1000,
        客户转商机率: 200,
        商机转报价率: 50,
        报价转订单率: 100,
        全链路转化率: 100,
      };
      const 列表 = await request(应用)
        .get(`/api/v2/partners?keyword=${encodeURIComponent(批次)}&pageSize=20`)
        .set("Cookie", cookie)
        .expect(200);
      const 列表记录 = (列表.body.data as Array<Record<string, unknown>>).find(
        (item) => item.uuid === 渠道编号,
      );
      expect(列表记录?.经营摘要).toMatchObject(预期摘要);

      const 核心档案 = await request(应用)
        .get(`/api/v2/partners/${encodeURIComponent(渠道编号)}/profile`)
        .set("Cookie", cookie)
        .expect(200);
      expect(核心档案.body.data.businessSummary).toMatchObject(预期摘要);

      const 独立摘要 = await request(应用)
        .get(`/api/v2/partners/${encodeURIComponent(渠道编号)}/business-summary`)
        .set("Cookie", cookie)
        .expect(200);
      expect(独立摘要.body.data).toMatchObject(预期摘要);

      const 下钻 = await request(应用)
        .get(`/api/v2/orders?partnerId=${encodeURIComponent(渠道编号)}&pageSize=100`)
        .set("Cookie", cookie)
        .expect(200);
      expect(下钻.body.data).toHaveLength(4);
      expect(
        (下钻.body.data as Array<Record<string, unknown>>).every(
          (item) => item.partnerUuid === 渠道编号,
        ),
      ).toBe(true);
    } finally {
      await 连接池
        .query("DELETE FROM crm.orders WHERE order_no LIKE $1", [`${批次}-%`])
        .catch(() => undefined);
      await 连接池
        .query("DELETE FROM crm.quotes WHERE quote_no LIKE $1", [`${批次}-%`])
        .catch(() => undefined);
      await 连接池
        .query("DELETE FROM crm.opportunities WHERE opportunity_no LIKE $1", [`${批次}-%`])
        .catch(() => undefined);
      await 连接池
        .query("DELETE FROM crm.registrations WHERE registration_no LIKE $1", [`${批次}-%`])
        .catch(() => undefined);
      await 连接池
        .query("DELETE FROM crm.customers WHERE id=$1::uuid", [客户编号])
        .catch(() => undefined);
      await 连接池
        .query("DELETE FROM channel.partners WHERE id=$1::uuid", [渠道编号])
        .catch(() => undefined);
    }
  }, 30_000);

  it("CHN-19：渠道区域、等级和关键词组合筛选同时生效且分页一致", async () => {
    const cookie = await 登录超级管理员();
    const 批次 = `CHN19-${randomUUID()}`;
    const 区域 = `${批次}-区域`;
    const 共同关键词 = `${批次}-共同`;
    const 渠道 = await 连接池.query<{ id: string }>(
      `INSERT INTO channel.partners(
         partner_code,partner_name,normalized_name,partner_level_code,status_code,extra_json
       ) VALUES
         ($1,$1,$1,'none','active',$3::jsonb),
         ($2,$2,$2,'none','active',$3::jsonb),
         ($4,$4,$4,'none','active',$3::jsonb)
       RETURNING id::text AS id`,
      [
        `${共同关键词}-一级渠道`,
        `${共同关键词}-二级渠道`,
        JSON.stringify({ partnerLevel: "", region: 区域 }),
        `${共同关键词}-历史一级渠道`,
      ],
    );
    const 一级编号 = 渠道.rows[0]?.id;
    const 二级编号 = 渠道.rows[1]?.id;
    const 历史一级编号 = 渠道.rows[2]?.id;
    if (!一级编号 || !二级编号 || !历史一级编号) {
      throw new Error("创建渠道组合筛选测试数据失败。");
    }
    try {
      await 连接池.query(
        `UPDATE channel.partners
            SET extra_json = extra_json || $1::jsonb
          WHERE id = ANY($2::uuid[])`,
        [JSON.stringify({ partnerLevel: "primary" }), [一级编号]],
      );
      await 连接池.query(
        `UPDATE channel.partners
            SET extra_json = extra_json || $1::jsonb
          WHERE id = $2::uuid`,
        [JSON.stringify({ partnerLevel: "secondary" }), 二级编号],
      );
      await 连接池.query(
        `UPDATE channel.partners
            SET extra_json = extra_json || $1::jsonb
          WHERE id = $2::uuid`,
        [JSON.stringify({ partnerLevel: "none", level: "primary" }), 历史一级编号],
      );

      const 一级筛选 = await request(应用)
        .get(
          `/api/stage9/partners?region=${encodeURIComponent(区域)}&level=primary&keyword=${encodeURIComponent(共同关键词)}&page=1&pageSize=1`,
        )
        .set("Cookie", cookie)
        .expect(200);
      expect(一级筛选.body.data.分页).toEqual({ 页码: 1, 每页: 1, 总数: 2 });
      expect(一级筛选.body.data.数据).toHaveLength(1);

      const 二级筛选 = await request(应用)
        .get(
          `/api/stage9/partners?region=${encodeURIComponent(区域)}&level=secondary&keyword=${encodeURIComponent(共同关键词)}&page=1&pageSize=10`,
        )
        .set("Cookie", cookie)
        .expect(200);
      expect(二级筛选.body.data.分页.总数).toBe(1);
      expect(二级筛选.body.data.数据.map((项: { id: string }) => 项.id)).toEqual([二级编号]);

      const 空结果 = await request(应用)
        .get(
          `/api/stage9/partners?region=${encodeURIComponent(区域)}&level=primary&keyword=${encodeURIComponent(`${批次}-不存在`)}&page=1&pageSize=10`,
        )
        .set("Cookie", cookie)
        .expect(200);
      expect(空结果.body.data.分页.总数).toBe(0);
      expect(空结果.body.data.数据).toEqual([]);

      const 第一页 = await request(应用)
        .get(
          `/api/stage9/partners?region=${encodeURIComponent(区域)}&keyword=${encodeURIComponent(共同关键词)}&page=1&pageSize=1`,
        )
        .set("Cookie", cookie)
        .expect(200);
      const 第二页 = await request(应用)
        .get(
          `/api/stage9/partners?region=${encodeURIComponent(区域)}&keyword=${encodeURIComponent(共同关键词)}&page=2&pageSize=1`,
        )
        .set("Cookie", cookie)
        .expect(200);
      expect(第一页.body.data.分页.总数).toBe(3);
      expect(第二页.body.data.分页.总数).toBe(3);
      expect(new Set([第一页.body.data.数据[0].id, 第二页.body.data.数据[0].id]).size).toBe(2);
    } finally {
      await 连接池
        .query("DELETE FROM channel.partners WHERE id = ANY($1::uuid[])", [
          [一级编号, 二级编号, 历史一级编号],
        ])
        .catch(() => undefined);
    }
  }, 30_000);

  it("CHN-21：成员手机号带空格或 +86 时仍按同一号码拒绝重复", async () => {
    const cookie = await 登录超级管理员();
    const 批次 = `chn21_${randomUUID().slice(0, 8)}`;
    const 本地号码 = 生成测试手机号("199");
    try {
      await request(应用)
        .post("/api/v2/users")
        .set("Cookie", cookie)
        .send({
          username: `${批次}_a`,
          name: "手机号规范化甲",
          role: "staff",
          password: "LrCRM@2026!",
          phone: `${本地号码.slice(0, 3)} ${本地号码.slice(3, 7)} ${本地号码.slice(7)}`,
          status: "active",
        })
        .expect(200);
      const 冲突 = await request(应用)
        .post("/api/v2/users")
        .set("Cookie", cookie)
        .send({
          username: `${批次}_b`,
          name: "手机号规范化乙",
          role: "staff",
          password: "LrCRM@2026!",
          phone: `+86 ${本地号码}`,
          status: "active",
        })
        .expect(409);
      expect(冲突.body.error).toContain("联系电话已被账号");
    } finally {
      await 清理测试账号(`${批次}_a`);
      await 清理测试账号(`${批次}_b`);
    }
  });
});
