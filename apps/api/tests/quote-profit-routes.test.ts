import { 创建测试环境变量 } from "@lianruan/testing";
import { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { 创建密码散列 } from "../src/auth-routes.js";
import { 创建应用 } from "../src/index.js";

const 测试环境变量 = 创建测试环境变量({
  V3_DELIVERY_AUTH_ENABLED: "true",
  V3_DELIVERY_AUTH_COOKIE_SECURE: "false",
  V3_DELIVERY_AUTH_USERS_JSON: "[]",
});

if (!测试环境变量.DATABASE_URL)
  throw new Error("报价收益接口测试必须配置 PostgreSQL DATABASE_URL，禁止回退内存模式。");

const pool = new Pool({ connectionString: 测试环境变量.DATABASE_URL });
const 测试批次 = `QUOTE-PROFIT-${Date.now()}`;
let 多区域绑定编号 = "";

describe("报价收益接口", () => {
  let 超级管理员: request.Agent;
  let 普通管理员: request.Agent;
  let 商机编号 = "";
  let 功能编号 = "";
  let 硬件编号 = "";

  beforeAll(async () => {
    await 清理测试数据();
    const app = 创建应用({ env: 测试环境变量 });
    超级管理员 = request.agent(app);
    普通管理员 = request.agent(app);
    await 超级管理员
      .post("/api/auth/login")
      .send({ username: "liulonghai", password: "LrCRM@2026!" })
      .expect(200);
    await 普通管理员
      .post("/api/auth/login")
      .send({ username: "admin", password: "LrCRM@2026!" })
      .expect(200);

    const 基础 = await pool.query<{
      opportunity_id: string;
      feature_id: string;
      hardware_id: string;
    }>(
      `SELECT o.id::text AS opportunity_id,f.id::text AS feature_id,h.id::text AS hardware_id
       FROM crm.opportunities o
       JOIN channel.partners p ON p.id=o.partner_id
       JOIN catalog.product_features f ON true
       JOIN catalog.product_modules m ON m.id=f.module_id
       JOIN catalog.product_categories c ON c.id=m.category_id AND c.category_code='CAT-LEP'
       JOIN catalog.hardware_products h ON h.hardware_code='LV-7050'
       WHERE o.region_id IS NOT NULL AND p.region_id=o.region_id
         AND (
           f.list_price > 0
           OR EXISTS (
             SELECT 1
             FROM jsonb_array_elements(COALESCE(f.extra_json->'tiers','[]'::jsonb)) tier
             WHERE 10 >= COALESCE((tier->>'min')::numeric,0)
               AND 10 <= COALESCE((tier->>'max')::numeric,9223372036854775807)
               AND COALESCE((tier->>'price')::numeric,0) > 0
           )
         )
       LIMIT 1`,
    );
    const 行 = 基础.rows[0];
    if (!行) throw new Error("测试库缺少报价收益所需的商机、微盾功能和硬件。");
    商机编号 = 行.opportunity_id;
    功能编号 = 行.feature_id;
    硬件编号 = 行.hardware_id;
  });

  afterAll(async () => {
    await 清理测试数据();
    await pool.end();
  });

  it("新建报价支持同型号两台并在收益结果和明细中保留数量", async () => {
    const 创建 = await 超级管理员
      .post("/api/quotes")
      .send({
        oppId: 商机编号,
        endpoints: 10,
        testTag: 测试批次,
        products: [功能编号],
        hardwareItems: [{ productId: 硬件编号, quantity: 2 }],
      })
      .expect(200);
    const quoteId = String(创建.body.data.id);

    const 明细 = await pool.query<{ quantity: string; item_type_code: string }>(
      `SELECT quantity::text AS quantity,item_type_code
       FROM crm.quote_items WHERE quote_id=$1::uuid AND product_ref_type='hardware'`,
      [quoteId],
    );
    expect(明细.rows).toHaveLength(1);
    expect(Number(明细.rows[0]?.quantity)).toBe(2);
    expect(明细.rows[0]?.item_type_code).toBe("hardware");

    const 收益 = await 超级管理员.get(`/api/quotes/${quoteId}/profit-calculation`).expect(200);
    expect(收益.body.data.hardwareLines).toHaveLength(1);
    expect(收益.body.data.hardwareLines[0].quantity).toBe(2);
    expect(Number(收益.body.data.details.hardwareInternalCost)).toBe(26000);
  });

  it("创建和编辑报价均以服务端渠道价重算且总额始终等于明细合计", async () => {
    const 创建 = await 超级管理员
      .post("/api/quotes")
      .send({
        oppId: 商机编号,
        endpoints: 10,
        testTag: 测试批次,
        products: [功能编号],
        total: 999999,
      })
      .expect(200);
    const quoteId = String(创建.body.data.id);

    const 创建后 = await pool.query<{
      quote_total: string;
      item_total: string;
      unit_price: string;
    }>(
      `SELECT q.total_amount::text AS quote_total,
              COALESCE(sum(qi.line_amount),0)::text AS item_total,
              COALESCE(max(qi.unit_price),0)::text AS unit_price
       FROM crm.quotes q
       LEFT JOIN crm.quote_items qi ON qi.quote_id=q.id
       WHERE q.id=$1::uuid
       GROUP BY q.id`,
      [quoteId],
    );
    expect(Number(创建后.rows[0]?.unit_price)).toBeGreaterThan(0);
    expect(Number(创建后.rows[0]?.quote_total)).toBe(Number(创建后.rows[0]?.item_total));
    expect(Number(创建后.rows[0]?.quote_total)).not.toBe(999999);

    await 超级管理员
      .put(`/api/quotes/${quoteId}`)
      .send({
        oppId: 商机编号,
        endpoints: 20,
        testTag: 测试批次,
        products: [功能编号],
        total: 1,
      })
      .expect(200);

    const 编辑后 = await pool.query<{ quote_total: string; item_total: string }>(
      `SELECT q.total_amount::text AS quote_total,
              COALESCE(sum(qi.line_amount),0)::text AS item_total
       FROM crm.quotes q
       LEFT JOIN crm.quote_items qi ON qi.quote_id=q.id
       WHERE q.id=$1::uuid
       GROUP BY q.id`,
      [quoteId],
    );
    expect(Number(编辑后.rows[0]?.quote_total)).toBeGreaterThan(0);
    expect(Number(编辑后.rows[0]?.quote_total)).toBe(Number(编辑后.rows[0]?.item_total));
    expect(Number(编辑后.rows[0]?.quote_total)).not.toBe(1);

    await pool.query(`UPDATE crm.quotes SET total_amount = total_amount + 100 WHERE id=$1::uuid`, [
      quoteId,
    ]);
    const 转订单 = await 超级管理员.post("/api/orders").send({ quoteId }).expect(409);
    expect(转订单.body.error?.code).toBe("V3_QUOTE_AMOUNT_MISMATCH");
  });

  it("保存收益草稿后再次读取返回草稿状态", async () => {
    const 创建 = await 超级管理员
      .post("/api/quotes")
      .send({
        oppId: 商机编号,
        endpoints: 10,
        testTag: 测试批次,
        products: [功能编号],
        hardwareItems: [{ productId: 硬件编号, quantity: 1 }],
      })
      .expect(200);
    const quoteId = String(创建.body.data.id);
    const 预估 = await 超级管理员.get(`/api/quotes/${quoteId}/profit-calculation`).expect(200);
    const 草稿 = await 超级管理员
      .put(`/api/quotes/${quoteId}/profit-calculation/draft`)
      .send({
        warrantyYears: 3,
        procurementMaintenanceYears: 1,
        expectedRowVersion: 预估.body.data.quoteRowVersion,
      })
      .expect(200);
    expect(草稿.body.data.statusCode).toBe("draft");
    expect(草稿.body.data.calculationVersion).toBeGreaterThan(0);
  });

  it("普通管理员不能读取收益和硬件成本规则", async () => {
    const 报价 = await pool.query<{ id: string }>(
      `SELECT q.id::text AS id FROM crm.quotes q JOIN crm.opportunities o ON o.id=q.opportunity_id LIMIT 1`,
    );
    const 渠道账号 = await pool.query<{ username: string }>(
      `SELECT u.username::text AS username
       FROM iam.users u
       JOIN iam.user_roles ur ON ur.user_id=u.id
       JOIN iam.roles r ON r.id=ur.role_id AND r.status_code='active'
       WHERE u.status_code='active' AND r.role_code IN ('staff','partner_admin')
       LIMIT 1`,
    );
    if (渠道账号.rows[0]?.username) {
      普通管理员 = request.agent(创建应用({ env: 测试环境变量 }));
      await 普通管理员
        .post("/api/auth/login")
        .send({ username: 渠道账号.rows[0].username, password: "LrCRM@2026!" })
        .expect(200);
    }
    await 普通管理员.get(`/api/quotes/${报价.rows[0]?.id}/profit-calculation`).expect(403);
    await 普通管理员.get("/api/quote-profit/hardware-cost-rules").expect(403);
  });

  it("多区域区管通过数据范围绑定访问非主区域报价", async () => {
    const 询价 = await pool.query<{ id: string; region_id: string }>(
      `SELECT id::text AS id,region_id::text AS region_id
       FROM crm.quotes WHERE region_id IS NOT NULL ORDER BY created_at DESC LIMIT 1`,
    );
    const 报价 = 询价.rows[0];
    if (!报价) throw new Error("测试库缺少带正式区域的报价。");
    const 其他区域 = await pool.query<{ id: string }>(
      `SELECT id::text AS id FROM org.regions WHERE status_code='active' AND id<>$1::uuid LIMIT 1`,
      [报价.region_id],
    );
    const 主区域 = 其他区域.rows[0]?.id;
    if (!主区域) throw new Error("测试库缺少可用于多区域测试的另一区域。");
    const 用户名 = `profit_multi_${Date.now()}`;
    const 用户 = await pool.query<{ id: string }>(
      `INSERT INTO iam.users(username,display_name,status_code,region_id)
       VALUES($1,'多区域收益测试账号','active',$2::uuid) RETURNING id::text AS id`,
      [用户名, 主区域],
    );
    const userId = 用户.rows[0]!.id;
    await pool.query(
      `INSERT INTO iam.password_credentials(user_id,password_hash,algorithm) VALUES($1::uuid,$2,'scrypt')`,
      [userId, 创建密码散列("LrCRM@2026!")],
    );
    await pool.query(
      `INSERT INTO iam.user_roles(user_id,role_id)
       SELECT $1::uuid,id FROM iam.roles WHERE role_code='region_manager' AND status_code='active'`,
      [userId],
    );
    const 范围绑定 = await pool.query<{ id: string }>(
      `INSERT INTO iam.data_scope_bindings(role_id,resource_code,scope_type,scope_ref_id)
       SELECT id,'quote','region',$1::uuid FROM iam.roles WHERE role_code='region_manager' AND status_code='active'
       ON CONFLICT DO NOTHING RETURNING id::text AS id`,
      [报价.region_id],
    );
    多区域绑定编号 = 范围绑定.rows[0]?.id || "";
    const 区管 = request.agent(创建应用({ env: 测试环境变量 }));
    await 区管
      .post("/api/auth/login")
      .send({ username: 用户名, password: "LrCRM@2026!" })
      .expect(200);
    await 区管.get(`/api/quotes/${报价.id}/profit-calculation`).expect(200);
  });

  it("超级管理员可以新增硬件成本版本并读取历史", async () => {
    const 编号 = `TEST-HW-${Date.now()}`;
    const 硬件 = await pool.query<{ id: string }>(
      `INSERT INTO catalog.hardware_products(hardware_code,hardware_name,unit_name,list_price,published,status_code)
       VALUES($1,$2,'台',1000,false,'active') RETURNING id::text AS id`,
      [编号, 编号],
    );
    const hardwareProductId = 硬件.rows[0]?.id;
    await 超级管理员
      .post("/api/quote-profit/hardware-cost-rules")
      .send({
        hardwareProductId,
        internalSaleCost: "500.00",
        annualWarrantyMaintenanceCost: null,
        effectiveFrom: new Date().toISOString(),
        sourceReference: "自动化测试",
      })
      .expect(200);
    const 列表 = await 超级管理员
      .get(
        `/api/quote-profit/hardware-cost-rules?hardwareProductId=${hardwareProductId}&missingOnly=true`,
      )
      .expect(200);
    expect(列表.body.data.rules).toHaveLength(1);
    expect(列表.body.data.rules[0].currentRule.versionNo).toBe(1);
    expect(列表.body.data.rules[0].currentRule.annualWarrantyMaintenanceCost).toBeNull();
  });
});

async function 清理测试数据(): Promise<void> {
  await pool.query(
    `DELETE FROM crm.orders WHERE quote_id IN (
       SELECT id FROM crm.quotes WHERE extra_json->>'testTag'=$1
     )`,
    [测试批次],
  );
  await pool.query(`DELETE FROM crm.quotes WHERE extra_json->>'testTag'=$1`, [测试批次]);
  await pool.query(
    `DELETE FROM catalog.hardware_profit_cost_rules
     WHERE hardware_product_id IN (SELECT id FROM catalog.hardware_products WHERE hardware_code LIKE 'TEST-HW-%')`,
  );
  await pool.query(`DELETE FROM catalog.hardware_products WHERE hardware_code LIKE 'TEST-HW-%'`);
  await pool.query(`DELETE FROM iam.users WHERE username LIKE 'profit_multi_%'`);
  if (多区域绑定编号)
    await pool.query(`DELETE FROM iam.data_scope_bindings WHERE id=$1::uuid`, [多区域绑定编号]);
}
