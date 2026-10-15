import { randomUUID } from "node:crypto";

import { 读取应用配置 } from "@lianruan/config";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { 报价收益任务存储 } from "../src/quote-profit-store.js";

const 数据库地址 = process.env.V3_TEST_DATABASE_URL;
const 描述真实数据库 = 数据库地址 ? describe.sequential : describe.skip;
const 测试前缀 = `quote_profit_worker_${Date.now()}_${randomUUID().slice(0, 8)}`;

let pool: Pool | null = null;
let quoteId = "";
let orderId = "";
let hardwareProductId = "";

function 获取连接池(): Pool {
  if (!pool) throw new Error("报价收益 Worker 测试尚未初始化连接池。");
  return pool;
}

描述真实数据库("报价收益异步冻结任务", () => {
  beforeAll(async () => {
    if (!数据库地址) return;
    pool = new Pool({ connectionString: 数据库地址 });
    const 基础 = await 获取连接池().query<{
      opportunity_id: string;
      customer_id: string;
      partner_id: string;
      owner_user_id: string;
      region_id: string;
      feature_id: string;
      feature_price: string;
      hardware_id: string;
      hardware_price: string;
    }>(
      `SELECT o.id::text AS opportunity_id,o.customer_id::text AS customer_id,o.partner_id::text AS partner_id,
              o.owner_user_id::text AS owner_user_id,o.region_id::text AS region_id,
              f.id::text AS feature_id,f.list_price::text AS feature_price,
              h.id::text AS hardware_id,h.list_price::text AS hardware_price
       FROM crm.opportunities o
       JOIN channel.partners p ON p.id=o.partner_id AND p.region_id=o.region_id
       JOIN catalog.product_features f ON true
       JOIN catalog.product_modules m ON m.id=f.module_id
       JOIN catalog.product_categories c ON c.id=m.category_id AND c.category_code='CAT-LEP'
       JOIN catalog.hardware_products h ON h.hardware_code='LV-7050-A'
       WHERE o.region_id IS NOT NULL AND o.customer_id IS NOT NULL AND o.owner_user_id IS NOT NULL
       LIMIT 1`,
    );
    const 行 = 基础.rows[0];
    if (!行) throw new Error("测试库缺少报价收益 Worker 所需基础数据。");
    const 硬件 = await 获取连接池().query<{ id: string }>(
      `INSERT INTO catalog.hardware_products(
         hardware_code,hardware_name,unit_name,list_price,published,status_code,profit_scope_code
       ) VALUES($1,$1,'台',$2,false,'active','weidun') RETURNING id::text AS id`,
      [`${测试前缀}-HW`, Number(行.hardware_price)],
    );
    hardwareProductId = 硬件.rows[0]!.id;
    await 获取连接池().query(
      `INSERT INTO catalog.hardware_profit_cost_rules(
         hardware_product_id,internal_sale_cost,annual_warranty_maintenance_cost,version_no,
         effective_from,status_code,source_code,source_reference
       ) VALUES($1::uuid,8500,NULL,1,'2026-01-01T00:00:00+08:00','active','manual','Worker 初始测试规则')`,
      [hardwareProductId],
    );
    const 软件金额 = Number(行.feature_price);
    const 硬件金额 = Number(行.hardware_price);
    const 总额 = 软件金额 + 硬件金额;
    const 报价 = await 获取连接池().query<{ id: string }>(
      `INSERT INTO crm.quotes(
         quote_no,opportunity_id,customer_id,partner_id,owner_user_id,region_id,status_code,total_amount,extra_json
       ) VALUES($1,$2::uuid,$3::uuid,$4::uuid,$5::uuid,$6::uuid,'converted',$7,$8::jsonb)
       RETURNING id::text AS id`,
      [
        `${测试前缀}-BJ`,
        行.opportunity_id,
        行.customer_id,
        行.partner_id,
        行.owner_user_id,
        行.region_id,
        总额,
        JSON.stringify({ testRun: 测试前缀 }),
      ],
    );
    quoteId = 报价.rows[0]!.id;
    await 获取连接池().query(
      `INSERT INTO crm.quote_items(
         quote_id,product_ref_type,product_ref_id,item_name,quantity,unit_price,line_amount,item_type_code
       ) VALUES
       ($1::uuid,'feature',$2::uuid,'微盾软件',1,$3,$3,'software'),
       ($1::uuid,'hardware',$4::uuid,'LV-7050',1,$5,$5,'hardware')`,
      [quoteId, 行.feature_id, 软件金额, hardwareProductId, 硬件金额],
    );
    const 订单 = await 获取连接池().query<{ id: string }>(
      `INSERT INTO crm.orders(
         order_no,quote_id,customer_id,partner_id,owner_user_id,status_code,total_amount,extra_json
       ) VALUES($1,$2::uuid,$3::uuid,$4::uuid,$5::uuid,'confirmed',$6,$7::jsonb)
       RETURNING id::text AS id`,
      [
        `${测试前缀}-LS`,
        quoteId,
        行.customer_id,
        行.partner_id,
        行.owner_user_id,
        总额,
        JSON.stringify({ testRun: 测试前缀 }),
      ],
    );
    orderId = 订单.rows[0]!.id;
    await 获取连接池().query(
      `DELETE FROM ops.outbox_events
       WHERE event_type IN ('crm.quote.profit.freeze.requested','crm.quote.profit.cost_rule.changed')`,
    );
    await 获取连接池().query(
      `INSERT INTO ops.outbox_events(event_type,aggregate_type,aggregate_id,payload_json)
       VALUES('crm.quote.profit.freeze.requested','quote',$1::uuid,$2::jsonb)
       RETURNING id::text AS id`,
      [
        quoteId,
        JSON.stringify({
          quoteId,
          orderId,
          orderRowVersion: 1,
          approvalRound: 1,
          orderRevisionNo: 0,
          confirmedAt: new Date().toISOString(),
          formulaVersion: "weidun-v1",
        }),
      ],
    );
  });

  afterAll(async () => {
    if (!pool) return;
    if (quoteId)
      await pool.query(`DELETE FROM crm.quote_profit_calculations WHERE quote_id=$1::uuid`, [
        quoteId,
      ]);
    await pool.query(
      `DELETE FROM ops.outbox_events
       WHERE (aggregate_type='quote' AND aggregate_id=$1::uuid)
          OR (aggregate_type='hardware_product' AND aggregate_id=$2::uuid)`,
      [quoteId, hardwareProductId],
    );
    if (orderId) await pool.query(`DELETE FROM crm.orders WHERE id=$1::uuid`, [orderId]);
    if (quoteId) await pool.query(`DELETE FROM crm.quotes WHERE id=$1::uuid`, [quoteId]);
    if (hardwareProductId)
      await pool.query(
        `DELETE FROM catalog.hardware_profit_cost_rules WHERE hardware_product_id=$1::uuid`,
        [hardwareProductId],
      );
    if (hardwareProductId)
      await pool.query(`DELETE FROM catalog.hardware_products WHERE id=$1::uuid`, [
        hardwareProductId,
      ]);
    await pool.end();
  });

  it("订单确认事件可以计算并冻结正式收益", async () => {
    const config = 读取应用配置({
      APP_ENV: "test",
      DATABASE_URL: 数据库地址,
      SESSION_SECRET: "quote-profit-worker-test-session-secret",
      QUOTE_PROFIT_WORKER_ENABLED: "true",
      QUOTE_PROFIT_EVENT_CUTOVER_AT: "2026-01-01T00:00:00.000Z",
    });
    const 存储 = new 报价收益任务存储(config);
    expect(await 存储.处理下一事件()).toBe(true);

    const 未完整记录 = await 获取连接池().query<{ status_code: string }>(
      `SELECT status_code FROM crm.quote_profit_calculations WHERE quote_id=$1::uuid
       ORDER BY calculation_version DESC LIMIT 1`,
      [quoteId],
    );
    expect(未完整记录.rows[0]?.status_code).toBe("incomplete");

    await 获取连接池().query(
      `UPDATE catalog.hardware_profit_cost_rules SET effective_to='2026-09-16T00:00:00+08:00',status_code='disabled'
       WHERE hardware_product_id=$1::uuid AND status_code='active'`,
      [hardwareProductId],
    );
    await 获取连接池().query(
      `INSERT INTO catalog.hardware_profit_cost_rules(
         hardware_product_id,internal_sale_cost,annual_warranty_maintenance_cost,version_no,
         effective_from,status_code,source_code,source_reference
       ) VALUES($1::uuid,8500,500,2,'2026-09-16T00:00:00+08:00','active','manual','Worker 自动重试测试')`,
      [hardwareProductId],
    );
    await 获取连接池().query(
      `INSERT INTO ops.outbox_events(event_type,aggregate_type,aggregate_id,payload_json)
       VALUES('crm.quote.profit.cost_rule.changed','hardware_product',$1::uuid,$2::jsonb)`,
      [hardwareProductId, JSON.stringify({ hardwareProductId })],
    );
    expect(await 存储.处理下一事件()).toBe(true);
    expect(await 存储.处理下一事件()).toBe(true);
    await 存储.close();

    const 记录 = await 获取连接池().query<{
      status_code: string;
      hardware_internal_cost: string;
      project_profit: string;
    }>(
      `SELECT status_code,hardware_internal_cost::text AS hardware_internal_cost,
              project_profit::text AS project_profit
       FROM crm.quote_profit_calculations WHERE quote_id=$1::uuid ORDER BY calculation_version DESC LIMIT 1`,
      [quoteId],
    );
    expect(记录.rows[0]?.status_code).toBe("frozen");
    expect(Number(记录.rows[0]?.hardware_internal_cost)).toBe(8500);
    expect(Number(记录.rows[0]?.project_profit)).toBeGreaterThan(0);
  });
});
