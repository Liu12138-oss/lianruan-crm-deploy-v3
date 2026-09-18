import { 创建测试环境变量 } from "@lianruan/testing";
import { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { 创建应用 } from "../src/index.js";

const 测试环境变量 = 创建测试环境变量({
  V3_DELIVERY_AUTH_ENABLED: "true",
  V3_DELIVERY_AUTH_COOKIE_SECURE: "false",
});
if (!测试环境变量.DATABASE_URL)
  throw new Error("报价价格矩阵测试必须配置 PostgreSQL DATABASE_URL，禁止回退内存模式。");

const pool = new Pool({ connectionString: 测试环境变量.DATABASE_URL });
const 测试批次 = `QUOTE-PRICE-MATRIX-${Date.now()}`;

interface 价格档 {
  min: number;
  max: number;
  price: number;
}

interface 模块价格配置 {
  code: string;
  name: string;
  base: 价格档[];
  primary: 价格档[];
  secondary: 价格档[];
}

const 区域模块配置: 模块价格配置[] = [
  {
    code: "A",
    name: "矩阵区域模块A",
    base: [
      { min: 1, max: 19, price: 58 },
      { min: 20, max: 49, price: 54 },
      { min: 50, max: 500, price: 50 },
    ],
    primary: [
      { min: 1, max: 19, price: 11.6 },
      { min: 20, max: 49, price: 10.8 },
      { min: 50, max: 500, price: 10 },
    ],
    secondary: [
      { min: 1, max: 19, price: 17.4 },
      { min: 20, max: 49, price: 16.2 },
      { min: 50, max: 500, price: 15 },
    ],
  },
  {
    code: "B",
    name: "矩阵区域模块B",
    base: [
      { min: 1, max: 19, price: 100 },
      { min: 20, max: 49, price: 90 },
      { min: 50, max: 500, price: 80 },
    ],
    primary: [
      { min: 1, max: 19, price: 20 },
      { min: 20, max: 49, price: 18 },
      { min: 50, max: 500, price: 16 },
    ],
    secondary: [
      { min: 1, max: 19, price: 30 },
      { min: 20, max: 49, price: 27 },
      { min: 50, max: 500, price: 24 },
    ],
  },
];

const 全国模块配置: 模块价格配置[] = [
  {
    code: "C",
    name: "矩阵全国模块C",
    base: [
      { min: 1, max: 19, price: 75 },
      { min: 20, max: 49, price: 70 },
      { min: 50, max: 500, price: 65 },
    ],
    primary: [
      { min: 1, max: 19, price: 15 },
      { min: 20, max: 49, price: 14 },
      { min: 50, max: 500, price: 13 },
    ],
    secondary: [
      { min: 1, max: 19, price: 22.5 },
      { min: 20, max: 49, price: 21 },
      { min: 50, max: 500, price: 19.5 },
    ],
  },
  {
    code: "D",
    name: "矩阵全国模块D",
    base: [
      { min: 1, max: 19, price: 120 },
      { min: 20, max: 49, price: 110 },
      { min: 50, max: 500, price: 100 },
    ],
    primary: [
      { min: 1, max: 19, price: 24 },
      { min: 20, max: 49, price: 22 },
      { min: 50, max: 500, price: 20 },
    ],
    secondary: [
      { min: 1, max: 19, price: 36 },
      { min: 20, max: 49, price: 33 },
      { min: 50, max: 500, price: 30 },
    ],
  },
];

describe("报价价格矩阵演练", () => {
  let 超级管理员: request.Agent;
  let 区域编号 = "";
  let 区域名称 = "";
  let 区域一级渠道编号 = "";
  let 区域二级渠道编号 = "";
  let 无等级渠道编号 = "";
  let 客户编号 = "";
  let 区域功能编号: string[] = [];
  let 全国功能编号: string[] = [];
  const 商机编号 = new Map<string, string>();

  beforeAll(async () => {
    await 清理测试数据();
    超级管理员 = request.agent(创建应用({ env: 测试环境变量 }));
    await 超级管理员
      .post("/api/auth/login")
      .send({ username: "liulonghai", password: "LrCRM@2026!" })
      .expect(200);

    const 超级管理员编号 = await 查询单项<string>(
      pool,
      `SELECT id::text AS value FROM iam.users WHERE username='liulonghai' LIMIT 1`,
    );
    if (!超级管理员编号) throw new Error("测试库缺少超级管理员 liulonghai。");

    区域编号 = await 插入单项<string>(
      pool,
      `INSERT INTO org.regions(region_code,region_name,region_level,status_code)
       VALUES($1,$2,'region','active') RETURNING id::text AS value`,
      [`${测试批次}-REGION`, `${测试批次}-区域`],
    );
    区域名称 = `${测试批次}-区域`;

    区域一级渠道编号 = await 插入渠道("区域一级渠道", "primary");
    区域二级渠道编号 = await 插入渠道("区域二级渠道", "secondary");
    无等级渠道编号 = await 插入渠道("全国无等级渠道", "none");
    await pool.query(
      `INSERT INTO channel.partner_relations(parent_partner_id,child_partner_id,relation_code)
       VALUES($1::uuid,$2::uuid,'primary_secondary')`,
      [区域一级渠道编号, 区域二级渠道编号],
    );

    客户编号 = await 插入单项<string>(
      pool,
      `INSERT INTO crm.customers(customer_name,normalized_name,region_id,owner_user_id,owner_partner_id,status_code,extra_json)
       VALUES($1,$2,$3::uuid,$4::uuid,$5::uuid,'active',$6::jsonb)
       RETURNING id::text AS value`,
      [
        `${测试批次}-客户`,
        `${测试批次}-客户`,
        区域编号,
        超级管理员编号,
        区域一级渠道编号,
        JSON.stringify({ testTag: 测试批次 }),
      ],
    );

    区域功能编号 = await 创建测试功能(区域模块配置, true);
    全国功能编号 = await 创建测试功能(全国模块配置, false);

    for (const 模式 of ["区域", "全国"] as const) {
      for (const 等级 of ["primary", "secondary", "none"] as const) {
        const 渠道编号 =
          等级 === "primary"
            ? 区域一级渠道编号
            : 等级 === "secondary"
              ? 区域二级渠道编号
              : 无等级渠道编号;
        const 编号 = await 插入单项<string>(
          pool,
          `INSERT INTO crm.opportunities(
             opportunity_no,customer_id,partner_id,owner_user_id,region_id,stage_code,status_code,extra_json
           ) VALUES($1,$2::uuid,$3::uuid,$4::uuid,$5::uuid,'proposal','active',$6::jsonb)
           RETURNING id::text AS value`,
          [
            `${测试批次}-${模式}-${等级}`,
            客户编号,
            渠道编号,
            超级管理员编号,
            区域编号,
            JSON.stringify({ testTag: 测试批次, mode: 模式, level: 等级 }),
          ],
        );
        商机编号.set(`${模式}:${等级}`, 编号);
      }
    }
  });

  afterAll(async () => {
    await 清理测试数据();
    await pool.end();
  });

  it("区域覆盖、全国基础价、不同模块、不同点数和渠道等级在创建、编辑和转订单时金额守恒", async () => {
    for (const 模式 of ["区域", "全国"] as const) {
      const 功能编号 = 模式 === "区域" ? 区域功能编号 : 全国功能编号;
      const 配置 = 模式 === "区域" ? 区域模块配置 : 全国模块配置;
      for (const 等级 of ["primary", "secondary", "none"] as const) {
        const 商机 = 商机编号.get(`${模式}:${等级}`);
        if (!商机) throw new Error(`缺少价格矩阵商机：${模式}:${等级}`);
        const 创建 = await 超级管理员
          .post("/api/quotes")
          .send({
            oppId: 商机,
            endpoints: 10,
            products: 功能编号,
            total: 999999,
            testTag: 测试批次,
            region: 区域名称,
          })
          .expect(200);
        const quoteId = String(创建.body.data.id);
        await 校验报价金额(quoteId, 等级, 配置, 10);

        for (const 点数 of [30, 60]) {
          await 超级管理员
            .put(`/api/quotes/${quoteId}`)
            .send({
              oppId: 商机,
              endpoints: 点数,
              products: 功能编号,
              total: 1,
              testTag: 测试批次,
              region: 区域名称,
            })
            .expect(200);
          await 校验报价金额(quoteId, 等级, 配置, 点数);
        }

        const 订单 = await 超级管理员.post("/api/orders").send({ quoteId }).expect(200);
        const 订单编号 = String(订单.body.data.id);
        const 订单金额 = await pool.query<{
          order_total: string;
          item_total: string;
        }>(
          `SELECT o.total_amount::text AS order_total,
                  COALESCE(sum(oi.line_amount),0)::text AS item_total
             FROM crm.orders o
             LEFT JOIN crm.order_items oi ON oi.order_id=o.id
            WHERE o.id=$1::uuid
            GROUP BY o.id`,
          [订单编号],
        );
        expect(Number(订单金额.rows[0]?.order_total)).toBe(Number(订单金额.rows[0]?.item_total));
        expect(Number(订单金额.rows[0]?.order_total)).toBe(计算预期金额(配置, 等级, 60));
      }
    }
  });

  async function 插入渠道(名称: string, 等级: "primary" | "secondary" | "none") {
    return 插入单项<string>(
      pool,
      `INSERT INTO channel.partners(
         partner_code,partner_name,normalized_name,partner_level_code,region_id,status_code,extra_json
       ) VALUES($1,$2,$2,$3,$4::uuid,'active',$5::jsonb)
       RETURNING id::text AS value`,
      [
        `${测试批次}-${名称}`,
        `${测试批次}-${名称}`,
        等级,
        区域编号,
        JSON.stringify({ region: 区域名称, testTag: 测试批次 }),
      ],
    );
  }

  async function 创建测试功能(配置: 模块价格配置[], 区域覆盖: boolean): Promise<string[]> {
    const 分类编号 = await 插入单项<string>(
      pool,
      `INSERT INTO catalog.product_categories(category_code,category_name,product_type_code,status_code,extra_json)
       VALUES($1,$1,'software','active',$2::jsonb) RETURNING id::text AS value`,
      [`${测试批次}-${区域覆盖 ? "REG" : "NAT"}-CAT`, JSON.stringify({ testTag: 测试批次 })],
    );
    const 模块编号 = await 插入单项<string>(
      pool,
      `INSERT INTO catalog.product_modules(category_id,module_code,module_name,status_code,extra_json)
       VALUES($1::uuid,$2,$2,'active',$3::jsonb) RETURNING id::text AS value`,
      [
        分类编号,
        `${测试批次}-${区域覆盖 ? "REG" : "NAT"}-MOD`,
        JSON.stringify({ testTag: 测试批次 }),
      ],
    );

    const ids: string[] = [];
    for (const 项 of 配置) {
      const 区域覆盖配置 = 区域覆盖
        ? [
            {
              region: 区域名称,
              enabled: true,
              tiers: 项.base,
              priceForPrimary: 项.primary,
              priceForSecondary: 项.secondary,
              priceRatioPrimary: 20,
              priceRatioSecondary: 30,
            },
          ]
        : [];
      ids.push(
        await 插入单项<string>(
          pool,
          `INSERT INTO catalog.product_features(
             module_id,feature_code,feature_name,unit_name,list_price,published,status_code,extra_json
           ) VALUES($1::uuid,$2,$3,'端点',0,true,'active',$4::jsonb)
           RETURNING id::text AS value`,
          [
            模块编号,
            `${测试批次}-${区域覆盖 ? "REG" : "NAT"}-${项.code}`,
            项.name,
            JSON.stringify({
              id: `${测试批次}-${区域覆盖 ? "REG" : "NAT"}-${项.code}`,
              name: 项.name,
              unit: "端点",
              listPrice: 0,
              priceFixed: 0,
              tiers: 项.base,
              priceForPrimary: 项.primary,
              priceForSecondary: 项.secondary,
              priceRatioPrimary: 20,
              priceRatioSecondary: 30,
              regionPriceOverrides: 区域覆盖配置,
              testTag: 测试批次,
            }),
          ],
        ),
      );
    }
    return ids;
  }

  async function 校验报价金额(
    quoteId: string,
    等级: "primary" | "secondary" | "none",
    配置: 模块价格配置[],
    点数: number,
  ) {
    const 结果 = await pool.query<{
      quote_total: string;
      item_total: string;
      item_count: string;
    }>(
      `SELECT q.total_amount::text AS quote_total,
              COALESCE(sum(qi.line_amount),0)::text AS item_total,
              count(qi.id)::text AS item_count
         FROM crm.quotes q
         LEFT JOIN crm.quote_items qi ON qi.quote_id=q.id
        WHERE q.id=$1::uuid
        GROUP BY q.id`,
      [quoteId],
    );
    const 预期金额 = 计算预期金额(配置, 等级, 点数);
    expect(Number(结果.rows[0]?.item_count)).toBe(配置.length);
    if (Number(结果.rows[0]?.quote_total) !== 预期金额) {
      const 明细 = await pool.query(
        `SELECT qi.item_name,qi.quantity,qi.unit_price,qi.line_amount,f.feature_code,f.extra_json
           FROM crm.quote_items qi
           LEFT JOIN catalog.product_features f ON f.id=qi.product_ref_id
          WHERE qi.quote_id=$1::uuid
          ORDER BY qi.sort_order`,
        [quoteId],
      );
      throw new Error(
        `价格矩阵失败，等级=${等级}，点数=${点数}，预期=${预期金额}，实际=${结果.rows[0]?.quote_total}，明细=${JSON.stringify(明细.rows)}`,
      );
    }
    expect(Number(结果.rows[0]?.quote_total)).toBe(预期金额);
    expect(Number(结果.rows[0]?.item_total)).toBe(预期金额);
  }

  function 计算预期金额(
    配置: 模块价格配置[],
    等级: "primary" | "secondary" | "none",
    点数: number,
  ): number {
    return 配置.reduce((合计, 项) => {
      const 档位 = 等级 === "none" ? 项.base : 项[等级];
      const 命中 = 档位.find((价格) => 点数 >= 价格.min && 点数 <= 价格.max);
      if (!命中) throw new Error(`价格配置缺少点数档：${项.name}/${点数}`);
      return 合计 + 命中.price * 点数;
    }, 0);
  }
});

async function 插入单项<T>(数据库: Pool, sql: string, 参数: unknown[]): Promise<T> {
  const result = await 数据库.query<{ value: T }>(sql, 参数);
  const value = result.rows[0]?.value;
  if (value === undefined || value === null) throw new Error("测试数据写入未返回有效编号。");
  return value;
}

async function 查询单项<T>(数据库: Pool, sql: string): Promise<T | undefined> {
  const result = await 数据库.query<{ value: T }>(sql);
  return result.rows[0]?.value;
}

async function 清理测试数据(): Promise<void> {
  const 报价结果 = await pool.query<{ id: string }>(
    `SELECT id::text AS id FROM crm.quotes WHERE extra_json->>'testTag'=$1`,
    [测试批次],
  );
  const 报价编号 = 报价结果.rows.map((项) => 项.id);
  const 订单结果 = 报价编号.length
    ? await pool.query<{ id: string }>(
        `SELECT id::text AS id FROM crm.orders WHERE quote_id=ANY($1::uuid[])`,
        [报价编号],
      )
    : { rows: [] as Array<{ id: string }> };
  const 订单编号 = 订单结果.rows.map((项) => 项.id);

  if (订单编号.length) {
    await pool.query(
      `DELETE FROM ops.approval_events
        WHERE approval_id IN (
          SELECT id FROM ops.approvals WHERE target_type='order' AND target_id=ANY($1::uuid[])
        )`,
      [订单编号],
    );
    await pool.query(
      `DELETE FROM ops.approvals WHERE target_type='order' AND target_id=ANY($1::uuid[])`,
      [订单编号],
    );
    await pool.query(`DELETE FROM crm.order_status_history WHERE order_id=ANY($1::uuid[])`, [
      订单编号,
    ]);
    await pool.query(`DELETE FROM ops.outbox_events WHERE aggregate_id=ANY($1::uuid[])`, [
      订单编号,
    ]);
    await pool.query(`DELETE FROM crm.order_items WHERE order_id=ANY($1::uuid[])`, [订单编号]);
    await pool.query(`DELETE FROM crm.orders WHERE id=ANY($1::uuid[])`, [订单编号]);
  }

  if (报价编号.length) {
    await pool.query(`DELETE FROM crm.quote_profit_calculations WHERE quote_id=ANY($1::uuid[])`, [
      报价编号,
    ]);
    await pool.query(`DELETE FROM crm.quote_snapshots WHERE quote_id=ANY($1::uuid[])`, [报价编号]);
    await pool.query(`DELETE FROM crm.quote_status_history WHERE quote_id=ANY($1::uuid[])`, [
      报价编号,
    ]);
    await pool.query(`DELETE FROM crm.quote_items WHERE quote_id=ANY($1::uuid[])`, [报价编号]);
    await pool.query(`DELETE FROM crm.quotes WHERE id=ANY($1::uuid[])`, [报价编号]);
  }

  await pool.query(
    `DELETE FROM ops.approvals WHERE target_id IN (
    SELECT id FROM crm.opportunities WHERE extra_json->>'testTag'=$1
  )`,
    [测试批次],
  );
  await pool.query(`DELETE FROM crm.opportunities WHERE extra_json->>'testTag'=$1`, [测试批次]);
  await pool.query(`DELETE FROM crm.customers WHERE normalized_name=$1`, [`${测试批次}-客户`]);
  await pool.query(`DELETE FROM catalog.product_features WHERE feature_code LIKE $1`, [
    `${测试批次}%`,
  ]);
  await pool.query(`DELETE FROM catalog.product_modules WHERE module_code LIKE $1`, [
    `${测试批次}%`,
  ]);
  await pool.query(`DELETE FROM catalog.product_categories WHERE category_code LIKE $1`, [
    `${测试批次}%`,
  ]);
  await pool.query(
    `DELETE FROM channel.partner_relations WHERE child_partner_id IN (
    SELECT id FROM channel.partners WHERE partner_code LIKE $1
  ) OR parent_partner_id IN (SELECT id FROM channel.partners WHERE partner_code LIKE $1)`,
    [`${测试批次}%`],
  );
  await pool.query(`DELETE FROM channel.partners WHERE partner_code LIKE $1`, [`${测试批次}%`]);
  await pool.query(`DELETE FROM org.regions WHERE region_code=$1`, [`${测试批次}-REGION`]);
}
