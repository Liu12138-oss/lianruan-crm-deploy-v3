import { randomUUID } from "node:crypto";

import { 创建测试环境变量 } from "@lianruan/testing";
import { Pool } from "pg";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { 创建应用 } from "../src/index.js";

const 测试环境变量 = 创建测试环境变量();
if (!测试环境变量.DATABASE_URL) {
  throw new Error("产品维保业务测试必须配置 PostgreSQL DATABASE_URL。");
}

async function 创建测试客户(pool: Pool, 客户名称: string): Promise<string> {
  const result = await pool.query<{ id: string }>(
    `
    INSERT INTO crm.customers (customer_name, normalized_name, status_code, extra_json)
    VALUES ($1, $2, 'active', $3::jsonb)
    RETURNING id::text AS id
    `,
    [客户名称, 客户名称.toLowerCase(), JSON.stringify({ customerName: 客户名称 })],
  );
  const id = result.rows[0]?.id;
  if (!id) throw new Error("创建测试客户失败。");
  return id;
}

async function 创建测试订单(
  pool: Pool,
  客户编号: string,
  业务类型: "product" | "maintenance",
  状态: "confirmed" | "pending_primary_confirm",
): Promise<string> {
  const 订单编号 = `TEST-${randomUUID()}`;
  const result = await pool.query<{ id: string }>(
    `
    INSERT INTO crm.orders (
      order_no, customer_id, status_code, total_amount, business_type_code, extra_json
    )
    VALUES ($1, $2::uuid, $3, 1000, $4, $5::jsonb)
    RETURNING id::text AS id
    `,
    [
      订单编号,
      客户编号,
      状态,
      业务类型,
      JSON.stringify({
        id: 订单编号,
        customerId: 客户编号,
        businessTypeCode: 业务类型,
        total: 1000,
      }),
    ],
  );
  const id = result.rows[0]?.id;
  if (!id) throw new Error("创建测试订单失败。");
  return id;
}

async function 查询产品编号(
  pool: Pool,
  类型: "maintenance" | "software" | "hardware",
): Promise<string> {
  const sql =
    类型 === "maintenance"
      ? `
        SELECT f.id::text AS id
        FROM catalog.product_features f
        JOIN catalog.product_modules m ON m.id = f.module_id
        JOIN catalog.product_categories c ON c.id = m.category_id
        WHERE c.category_code = 'CAT-MAINTENANCE'
          AND f.status_code = 'active' AND c.status_code = 'active'
        ORDER BY f.list_price DESC, f.id
        LIMIT 1
      `
      : 类型 === "software"
        ? `
          SELECT f.id::text AS id
          FROM catalog.product_features f
          JOIN catalog.product_modules m ON m.id = f.module_id
          JOIN catalog.product_categories c ON c.id = m.category_id
          WHERE c.category_code <> 'CAT-MAINTENANCE'
            AND f.status_code = 'active' AND c.status_code = 'active' AND f.list_price > 0
          ORDER BY f.list_price DESC, f.id
          LIMIT 1
        `
        : `
          SELECT h.id::text AS id
          FROM catalog.hardware_products h
          WHERE h.status_code = 'active'
          ORDER BY h.list_price DESC, h.id
          LIMIT 1
        `;
  const result = await pool.query<{ id: string }>(sql);
  const id = result.rows[0]?.id;
  if (!id) throw new Error(`未找到可用的${类型}产品。`);
  return id;
}

async function 清理测试客户数据(pool: Pool, 前缀: string): Promise<void> {
  const 客户匹配 = `${前缀}%`;
  await pool.query(
    `
    WITH 待清理客户 AS (
      SELECT id FROM crm.customers WHERE customer_name LIKE $1
    ), 待清理订单 AS (
      SELECT id FROM crm.orders WHERE customer_id IN (SELECT id FROM 待清理客户)
    ), 待清理报价 AS (
      SELECT id FROM crm.quotes WHERE customer_id IN (SELECT id FROM 待清理客户)
    ), 待清理商机 AS (
      SELECT id FROM crm.opportunities WHERE customer_id IN (SELECT id FROM 待清理客户)
    )
    DELETE FROM crm.maintenance_order_product_orders
    WHERE maintenance_order_id IN (SELECT id FROM 待清理订单)
       OR product_order_id IN (SELECT id FROM 待清理订单)
    `,
    [客户匹配],
  );
  await pool.query(
    `
    WITH 待清理客户 AS (
      SELECT id FROM crm.customers WHERE customer_name LIKE $1
    ), 待清理订单 AS (
      SELECT id FROM crm.orders WHERE customer_id IN (SELECT id FROM 待清理客户)
    ), 待清理商机 AS (
      SELECT id FROM crm.opportunities WHERE customer_id IN (SELECT id FROM 待清理客户)
    )
    DELETE FROM crm.maintenance_opportunity_product_orders
    WHERE opportunity_id IN (SELECT id FROM 待清理商机)
       OR product_order_id IN (SELECT id FROM 待清理订单)
    `,
    [客户匹配],
  );
  await pool.query(
    `
    WITH 待清理客户 AS (
      SELECT id FROM crm.customers WHERE customer_name LIKE $1
    )
    DELETE FROM crm.order_items
    WHERE order_id IN (SELECT id FROM crm.orders WHERE customer_id IN (SELECT id FROM 待清理客户))
    `,
    [客户匹配],
  );
  await pool.query(
    `
    WITH 待清理客户 AS (
      SELECT id FROM crm.customers WHERE customer_name LIKE $1
    )
    DELETE FROM crm.order_status_history
    WHERE order_id IN (SELECT id FROM crm.orders WHERE customer_id IN (SELECT id FROM 待清理客户))
    `,
    [客户匹配],
  );
  await pool.query(
    `
    WITH 待清理客户 AS (
      SELECT id FROM crm.customers WHERE customer_name LIKE $1
    )
    DELETE FROM crm.orders WHERE customer_id IN (SELECT id FROM 待清理客户)
    `,
    [客户匹配],
  );
  await pool.query(
    `
    WITH 待清理客户 AS (
      SELECT id FROM crm.customers WHERE customer_name LIKE $1
    )
    DELETE FROM crm.quote_items
    WHERE quote_id IN (SELECT id FROM crm.quotes WHERE customer_id IN (SELECT id FROM 待清理客户))
    `,
    [客户匹配],
  );
  await pool.query(
    `
    WITH 待清理客户 AS (
      SELECT id FROM crm.customers WHERE customer_name LIKE $1
    )
    DELETE FROM crm.quotes WHERE customer_id IN (SELECT id FROM 待清理客户)
    `,
    [客户匹配],
  );
  await pool.query(
    `
    WITH 待清理客户 AS (
      SELECT id FROM crm.customers WHERE customer_name LIKE $1
    )
    DELETE FROM crm.opportunities WHERE customer_id IN (SELECT id FROM 待清理客户)
    `,
    [客户匹配],
  );
  await pool.query("DELETE FROM crm.customers WHERE customer_name LIKE $1", [客户匹配]);
}

function 业务错误码(body: Record<string, unknown>): string {
  const error = body.error as Record<string, unknown> | undefined;
  return String(error?.code || "");
}

describe("产品与维保业务类型接口", () => {
  it("维保商机必须关联同客户、已确认或已完成的产品订单", async () => {
    const app = 创建应用({ env: 测试环境变量 });
    const pool = new Pool({ connectionString: 测试环境变量.DATABASE_URL });
    const 前缀 = `PM-OPP-${Date.now()}-${randomUUID().slice(0, 8)}`;
    try {
      const 客户A = await 创建测试客户(pool, `${前缀}-客户A`);
      const 客户B = await 创建测试客户(pool, `${前缀}-客户B`);
      const 客户A已确认订单 = await 创建测试订单(pool, 客户A, "product", "confirmed");
      const 客户B已确认订单 = await 创建测试订单(pool, 客户B, "product", "confirmed");
      const 客户B待确认订单 = await 创建测试订单(pool, 客户B, "product", "pending_primary_confirm");

      const 空关联 = await request(app)
        .post("/api/opportunities")
        .send({
          customer: `${前缀}-客户B`,
          name: `${前缀}-空关联商机`,
          businessTypeCode: "maintenance",
        })
        .expect(400);
      expect(业务错误码(空关联.body)).toBe("V3_MAINTENANCE_OPPORTUNITY_PRODUCT_ORDER_REQUIRED");

      const 跨客户 = await request(app)
        .post("/api/opportunities")
        .send({
          customer: `${前缀}-客户B`,
          name: `${前缀}-跨客户商机`,
          businessTypeCode: "maintenance",
          linkedProductOrderIds: [客户A已确认订单],
        })
        .expect(409);
      expect(业务错误码(跨客户.body)).toBe("V3_MAINTENANCE_OPPORTUNITY_CUSTOMER_MISMATCH");

      const 未确认 = await request(app)
        .post("/api/opportunities")
        .send({
          customer: `${前缀}-客户B`,
          name: `${前缀}-未确认订单商机`,
          businessTypeCode: "maintenance",
          linkedProductOrderIds: [客户B待确认订单],
        })
        .expect(409);
      expect(业务错误码(未确认.body)).toBe("V3_MAINTENANCE_OPPORTUNITY_PRODUCT_ORDER_INVALID");

      const 合法 = await request(app)
        .post("/api/opportunities")
        .send({
          customer: `${前缀}-客户B`,
          name: `${前缀}-合法维保商机`,
          businessTypeCode: "maintenance",
          linkedProductOrderIds: [客户B已确认订单],
        })
        .expect(200);
      expect(合法.body.data.原始数据.businessTypeCode).toBe("maintenance");
      expect(合法.body.data.原始数据.linkedProductOrderIds).toContain(客户B已确认订单);
    } finally {
      await 清理测试客户数据(pool, 前缀).catch(() => undefined);
      await pool.end();
    }
  }, 30000);

  it("维保报价只允许维保服务项，产品报价不能混入维保服务", async () => {
    const app = 创建应用({ env: 测试环境变量 });
    const pool = new Pool({ connectionString: 测试环境变量.DATABASE_URL });
    const 前缀 = `PM-QUOTE-${Date.now()}-${randomUUID().slice(0, 8)}`;
    try {
      const 客户 = await 创建测试客户(pool, `${前缀}-客户`);
      const 产品订单 = await 创建测试订单(pool, 客户, "product", "confirmed");
      const 维保商机 = await request(app)
        .post("/api/opportunities")
        .send({
          customer: `${前缀}-客户`,
          name: `${前缀}-维保商机`,
          businessTypeCode: "maintenance",
          linkedProductOrderIds: [产品订单],
        })
        .expect(200);
      const 产品商机 = await request(app)
        .post("/api/opportunities")
        .send({
          customer: `${前缀}-客户`,
          name: `${前缀}-产品商机`,
          businessTypeCode: "product",
        })
        .expect(200);
      const [维保产品编号, 软件产品编号, 硬件产品编号] = await Promise.all([
        查询产品编号(pool, "maintenance"),
        查询产品编号(pool, "software"),
        查询产品编号(pool, "hardware"),
      ]);

      const 混入软件 = await request(app)
        .post("/api/quotes")
        .send({
          opportunityId: 维保商机.body.data.id,
          endpoints: 10,
          productIds: [维保产品编号, 软件产品编号],
        })
        .expect(400);
      expect(业务错误码(混入软件.body)).toBe("V3_MAINTENANCE_QUOTE_ITEM_INVALID");

      const 混入硬件 = await request(app)
        .post("/api/quotes")
        .send({
          opportunityId: 维保商机.body.data.id,
          endpoints: 10,
          productIds: [维保产品编号],
          hardwareItems: [{ productId: 硬件产品编号, quantity: 1 }],
        })
        .expect(400);
      expect(业务错误码(混入硬件.body)).toBe("V3_MAINTENANCE_QUOTE_ITEM_INVALID");

      const 产品混入维保 = await request(app)
        .post("/api/quotes")
        .send({
          opportunityId: 产品商机.body.data.id,
          endpoints: 10,
          productIds: [维保产品编号],
        })
        .expect(400);
      expect(业务错误码(产品混入维保.body)).toBe("V3_PRODUCT_QUOTE_MAINTENANCE_ITEM_INVALID");
    } finally {
      await 清理测试客户数据(pool, 前缀).catch(() => undefined);
      await pool.end();
    }
  }, 30000);

  it("产品与维保报价分别转单，维保订单缺少关联及重复转单被拒绝", async () => {
    const app = 创建应用({ env: 测试环境变量 });
    const pool = new Pool({ connectionString: 测试环境变量.DATABASE_URL });
    const 前缀 = `PM-ORDER-${Date.now()}-${randomUUID().slice(0, 8)}`;
    try {
      const 客户 = await 创建测试客户(pool, `${前缀}-客户`);
      const 产品订单 = await 创建测试订单(pool, 客户, "product", "confirmed");
      const 维保商机 = await request(app)
        .post("/api/opportunities")
        .send({
          customer: `${前缀}-客户`,
          name: `${前缀}-维保商机`,
          businessTypeCode: "maintenance",
          linkedProductOrderIds: [产品订单],
        })
        .expect(200);
      const 产品商机 = await request(app)
        .post("/api/opportunities")
        .send({
          customer: `${前缀}-客户`,
          name: `${前缀}-产品商机`,
          businessTypeCode: "product",
        })
        .expect(200);
      const [维保产品编号, 软件产品编号] = await Promise.all([
        查询产品编号(pool, "maintenance"),
        查询产品编号(pool, "software"),
      ]);

      const 维保报价 = await request(app)
        .post("/api/quotes")
        .send({
          opportunityId: 维保商机.body.data.id,
          endpoints: 10,
          productIds: [维保产品编号],
          quoteMode: "自定义报价",
        })
        .expect(200);
      expect(维保报价.body.data.原始数据.businessTypeCode).toBe("maintenance");
      expect(维保报价.body.data.原始数据.linkedProductOrderIds).toContain(产品订单);

      const 维保订单 = await request(app)
        .post("/api/orders")
        .send({ quoteId: 维保报价.body.data.id })
        .expect(200);
      expect(维保订单.body.data.原始数据.businessTypeCode).toBe("maintenance");
      expect(维保订单.body.data.原始数据.linkedProductOrderIds).toContain(产品订单);

      const 重复转单 = await request(app)
        .post("/api/orders")
        .send({ quoteId: 维保报价.body.data.id })
        .expect(409);
      expect(业务错误码(重复转单.body)).toBe("V3_QUOTE_ALREADY_CONVERTED");

      const 无关联维保报价 = await request(app)
        .post("/api/quotes")
        .send({
          opportunityId: 维保商机.body.data.id,
          endpoints: 10,
          productIds: [维保产品编号],
          quoteMode: "自定义报价",
        })
        .expect(200);
      await pool.query(
        `UPDATE crm.quotes
         SET extra_json = extra_json - 'linkedProductOrderIds' - 'linkedProductOrders'
         WHERE id = $1::uuid`,
        [无关联维保报价.body.data.id],
      );
      const 缺少关联订单 = await request(app)
        .post("/api/orders")
        .send({ quoteId: 无关联维保报价.body.data.id })
        .expect(400);
      expect(业务错误码(缺少关联订单.body)).toBe("V3_MAINTENANCE_ORDER_PRODUCT_ORDER_REQUIRED");

      const 产品报价 = await request(app)
        .post("/api/quotes")
        .send({
          opportunityId: 产品商机.body.data.id,
          endpoints: 10,
          productIds: [软件产品编号],
          quoteMode: "自定义报价",
        })
        .expect(200);
      expect(产品报价.body.data.原始数据.businessTypeCode).toBe("product");
      const 产品订单结果 = await request(app)
        .post("/api/orders")
        .send({ quoteId: 产品报价.body.data.id })
        .expect(200);
      expect(产品订单结果.body.data.原始数据.businessTypeCode).toBe("product");
      expect(产品订单结果.body.data.原始数据.linkedProductOrderIds || []).toHaveLength(0);
    } finally {
      await 清理测试客户数据(pool, 前缀).catch(() => undefined);
      await pool.end();
    }
  }, 30000);
});
