import fs from "node:fs";
import path from "node:path";

import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const 数据库地址 = process.env.V3_TEST_DATABASE_URL;
const 描述真实数据库 = 数据库地址 ? describe.sequential : describe.skip;
const 迁移路径 = path.resolve(
  process.cwd(),
  "../../database/migrations/20260916_S10_024_微盾硬件收益核算.sql",
);
const 回退路径 = path.resolve(
  process.cwd(),
  "../../database/migrations/20260916_S10_024_微盾硬件收益核算.rollback.sql",
);

let pool: Pool | null = null;

描述真实数据库("微盾收益数据库迁移", () => {
  beforeAll(() => {
    if (数据库地址) pool = new Pool({ connectionString: 数据库地址 });
  });

  afterAll(async () => {
    await pool?.end();
  });

  it("正向迁移包含范围、成本版本、计算快照、冻结保护和13个型号种子", () => {
    const sql = fs.readFileSync(迁移路径, "utf8");
    expect(sql).toContain("hardware_profit_cost_rules");
    expect(sql).toContain("quote_profit_calculations");
    expect(sql).toContain("防止硬件收益成本规则有效期重叠");
    expect(sql).toContain("禁止修改已冻结收益");
    expect(sql.match(/\('(?:LV|准入|UNACC|安渡|P)[^']*'/g)?.length).toBe(13);
  });

  it("回退迁移包含合法存在性检查和业务数据阻断", () => {
    const sql = fs.readFileSync(回退路径, "utf8");
    expect(sql).toContain("IF to_regclass('crm.quote_profit_calculations') IS NOT NULL");
    expect(sql).not.toContain(
      "FROM to_regclass('crm.quote_profit_calculations')::text IS NOT NULL",
    );
    expect(sql).toContain("hardwareQuantityVersion");
    expect(sql).toContain("收益核算回退被阻断");
  });

  it("测试库已应用迁移且稳定保留13条初始成本规则", async () => {
    if (!pool) throw new Error("测试库连接未初始化。");
    const 规则 = await pool.query<{ count: string; missing_annual: string }>(
      `SELECT count(*)::text AS count,
              count(*) FILTER (WHERE annual_warranty_maintenance_cost IS NULL)::text AS missing_annual
       FROM catalog.hardware_profit_cost_rules
       WHERE source_code='excel'`,
    );
    expect(规则.rows[0]?.count).toBe("13");
    expect(规则.rows[0]?.missing_annual).toBe("1");
    const 范围 = await pool.query<{ profit_scope_code: string; count: string }>(
      `SELECT profit_scope_code,count(*)::text AS count FROM catalog.product_categories GROUP BY profit_scope_code ORDER BY profit_scope_code`,
    );
    expect(范围.rows).toEqual(
      expect.arrayContaining([
        { profit_scope_code: "weidun", count: "1" },
        { profit_scope_code: "xcad", count: "1" },
      ]),
    );
  });
});
