import { randomUUID } from "node:crypto";

import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { 计算订单收益表 } from "../src/quote-profit-calculation.js";

const 数据库地址 = process.env.V3_TEST_DATABASE_URL;
const 描述真实数据库 = 数据库地址 ? describe.sequential : describe.skip;
const 测试前缀 = `quote_profit_total_${Date.now()}_${randomUUID().slice(0, 8)}`;

let pool: Pool | null = null;
let quoteId = "";
let featureId = "";

描述真实数据库("调价订单总价收益计算", () => {
  beforeAll(async () => {
    if (!数据库地址) return;
    pool = new Pool({ connectionString: 数据库地址 });
    const 功能 = await pool.query<{ id: string }>(
      `SELECT f.id::text AS id
       FROM catalog.product_features f
       JOIN catalog.product_modules m ON m.id=f.module_id
       JOIN catalog.product_categories c ON c.id=m.category_id AND c.profit_scope_code='weidun'
       WHERE f.list_price > 0
       LIMIT 1`,
    );
    featureId = 功能.rows[0]?.id || "";
    if (!featureId) throw new Error("测试库缺少可用于调价收益测试的微盾功能模块。");
    const 报价 = await pool.query<{ id: string }>(
      `INSERT INTO crm.quotes(
         quote_no,status_code,total_amount,extra_json
       ) VALUES($1,'converted',6630,$2::jsonb)
       RETURNING id::text AS id`,
      [
        `${测试前缀}-BJ`,
        JSON.stringify({
          priceAdjustment: {
            mode: "total_contract",
            productContractAmount: 6630,
            serviceContractAmount: 0,
            warrantyYears: 3,
            procurementMaintenanceYears: 0,
            formulaVersion: "weidun-v2-total-input",
          },
        }),
      ],
    );
    quoteId = 报价.rows[0]!.id;
    await pool.query(
      `INSERT INTO crm.quote_items(
         quote_id,product_ref_type,product_ref_id,item_name,quantity,unit_price,line_amount,item_type_code
       ) VALUES
       ($1::uuid,'feature',$2::uuid,'软件模块一',40,8.1,324,'software'),
       ($1::uuid,'feature',$2::uuid,'软件模块二',40,8.1,324,'software'),
       ($1::uuid,'feature',$2::uuid,'软件模块三',40,48.6,1944,'software')`,
      [quoteId, featureId],
    );
  });

  afterAll(async () => {
    if (!pool) return;
    if (quoteId) await pool.query(`DELETE FROM crm.quotes WHERE id=$1::uuid`, [quoteId]);
    await pool.end();
  });

  it("区管仅调整总价时仍按产品合同额计算收益", async () => {
    const 结果 = await 计算订单收益表(
      pool!,
      quoteId,
      "6630",
      { warrantyYears: 3, procurementMaintenanceYears: 0 },
      "2026-09-23T00:00:00.000Z",
    );
    expect(结果.formulaVersion).toBe("weidun-v2-total-input");
    expect(Number(结果.details.productContractAmount)).toBe(6630);
    expect(Number(结果.details.serviceContractAmount)).toBe(0);
  });
});
