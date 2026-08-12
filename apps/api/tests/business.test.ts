import { 创建测试环境变量 } from "@lianruan/testing";
import { Pool } from "pg";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { 创建密码散列 } from "../src/auth-routes.js";
import { 创建应用 } from "../src/index.js";

function 提取流水号(编号列表: string[]): number[] {
  return 编号列表.map((编号) => Number(编号.slice(-4))).sort((左, 右) => 左 - 右);
}

async function 查询当前业务流水(
  pool: Pool,
  类型: "quote" | "order" | "opportunity",
  提报账号: string,
): Promise<number> {
  const result = await pool.query<{ current_value: number }>(
    `
    SELECT current_value
    FROM crm.business_number_counters
    WHERE document_type = $1
      AND submitter_username = lower($2)
      AND business_date = (now() AT TIME ZONE 'Asia/Shanghai')::date
    `,
    [类型, 提报账号],
  );
  return Number(result.rows[0]?.current_value || 0);
}

async function 生成测试业务编号(
  pool: Pool,
  类型: "quote" | "order" | "opportunity",
  提报账号 = "",
): Promise<string> {
  const result = await pool.query<{ 编号: string }>(
    'SELECT crm.next_business_number($1, $2) AS "编号"',
    [类型, 提报账号],
  );
  const 编号 = result.rows[0]?.编号;
  if (!编号) throw new Error("生成渠道范围测试业务编号失败。");
  return 编号;
}

const 测试环境变量 = 创建测试环境变量();
if (!测试环境变量.DATABASE_URL) {
  throw new Error("阶段9.13业务测试必须配置 PostgreSQL DATABASE_URL，禁止回退内存模式。");
}

describe("阶段9业务兼容接口", () => {
  it("迁移用户可以使用统一初始化密码登录", async () => {
    const app = 创建应用({
      env: 创建测试环境变量({
        V3_DELIVERY_AUTH_ENABLED: "true",
        V3_DELIVERY_AUTH_COOKIE_SECURE: "false",
        V3_DELIVERY_AUTH_USERS_JSON: "[]",
      }),
    });
    const 迁移用户 = await 读取可登录测试用户();
    expect(迁移用户.username).toBeTruthy();

    const agent = request.agent(app);
    const 登录 = await agent
      .post("/api/auth/login")
      .send({ username: 迁移用户.username, password: "LrCRM@2026!" })
      .expect(200);
    expect(登录.body.data.user.username).toBe(迁移用户.username);
    expect(登录.body.data.user.displayName).toBeTruthy();

    const 当前用户 = await agent.get("/api/auth/me").expect(200);
    expect(当前用户.body.data.user.username).toBe(迁移用户.username);
  });

  it("产品目录按V2实体分类返回功能、硬件和套餐", async () => {
    const app = 创建应用({ env: 测试环境变量 });
    const [全部产品, 功能模块, 硬件产品, 产品套餐] = await Promise.all([
      request(app).get("/api/products?pageSize=1").expect(200),
      request(app).get("/api/features?pageSize=1").expect(200),
      request(app).get("/api/hardware?pageSize=1").expect(200),
      request(app).get("/api/packages?pageSize=1").expect(200),
    ]);

    expect(全部产品.body.data.分页.总数).toBe(55);
    expect(功能模块.body.data.分页.总数).toBe(34);
    expect(硬件产品.body.data.分页.总数).toBe(15);
    expect(产品套餐.body.data.分页.总数).toBe(6);
    expect(功能模块.body.data.数据[0].类型).toBe("功能模块");
    expect(硬件产品.body.data.数据[0].类型).toBe("硬件产品");
    expect(产品套餐.body.data.数据[0].类型).toBe("产品套餐");
  });

  it("可以读取阶段8迁移样本的核心业务概览", async () => {
    const app = 创建应用({ env: 测试环境变量 });
    const res = await request(app).get("/api/stage9/overview").expect(200);

    expect(res.body.success).toBe(true);
    expect(
      res.body.data.统计.some(
        (项: { 标题: string; 数量: number }) => 项.标题 === "客户报备" && 项.数量 > 0,
      ),
    ).toBe(true);
    expect(res.body.data.迁移状态.批次编号).toBe("S8-RUN-20260727-001");
  });

  it("可以跑通报备、商机、报价、订单第一闭环", async () => {
    const app = 创建应用({ env: 测试环境变量 });

    const 报备 = await request(app)
      .post("/api/registrations")
      .send({
        customer: "阶段9自动化验收客户",
        creditCode: "91370000V3STAGE900",
        contact: "验收联系人",
        phone: "13800000000",
      })
      .expect(200);
    expect(报备.body.data.状态).toBe("pending");
    expect(报备.body.data.原始数据.creditCode).toBe("91370000V3STAGE900");
    expect(报备.body.data.编号).toMatch(/^BB-.+-\d{8}-\d{4}$/);

    const V2报备详情 = await request(app)
      .get(`/api/v2/registrations/${报备.body.data.id}`)
      .expect(200);
    expect(V2报备详情.body.data.creditCode).toBe("91370000V3STAGE900");

    const 待审核列表 = await request(app)
      .get("/api/stage9/approvals?status=pending&pageSize=20")
      .expect(200);
    expect(
      待审核列表.body.data.数据.some(
        (项: { 客户名称: string; 状态: string }) =>
          项.客户名称 === "阶段9自动化验收客户" && 项.状态 === "pending",
      ),
    ).toBe(true);

    const 审核 = await request(app)
      .put(`/api/registrations/${报备.body.data.id}/status`)
      .send({ status: "approved", reason: "阶段9自动化审核通过" })
      .expect(200);
    expect(审核.body.data.状态).toBe("approved");
    expect(审核.body.data.原始数据.protectDays).toBe(180);
    expect(审核.body.data.原始数据.expireAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const 已审核详情 = await request(app)
      .get(`/api/registrations/${报备.body.data.id}`)
      .expect(200);
    expect(已审核详情.body.data.状态).toBe("approved");
    expect(已审核详情.body.data.原始数据.creditCode).toBe("91370000V3STAGE900");

    const 商机 = await request(app)
      .post("/api/opportunities")
      .send({
        registrationId: 报备.body.data.id,
        name: "阶段9自动化验收商机",
        amount: 88000,
      })
      .expect(200);
    expect(商机.body.data.客户名称).toBe("阶段9自动化验收客户");

    const 创建商机后的报备 = await request(app)
      .get(`/api/registrations/${报备.body.data.id}`)
      .expect(200);
    expect(创建商机后的报备.body.data.状态).toBe("approved");
    expect(创建商机后的报备.body.data.原始数据.convertedOpportunityId).toBe(商机.body.data.id);

    const 产品列表 = await request(app).get("/api/products?pageSize=3").expect(200);
    const 产品编号 = 产品列表.body.data.数据[0].id;
    const 试算 = await request(app)
      .post("/api/quotes/workload-preview")
      .send({ opportunityId: 商机.body.data.id, endpoints: 120, productIds: [产品编号] })
      .expect(200);
    expect(试算.body.data.workloadDays).toBeGreaterThan(0);

    const 报价 = await request(app)
      .post("/api/quotes")
      .send({ opportunityId: 商机.body.data.id, endpoints: 120, productIds: [产品编号] })
      .expect(200);
    expect(报价.body.data.状态).toBe("draft");

    const 订单 = await request(app)
      .post("/api/orders")
      .send({ quoteId: 报价.body.data.id })
      .expect(200);
    expect(订单.body.data.状态).toBe("primary_confirmed");

    const V2订单列表 = await request(app).get("/api/v2/orders?pageSize=20").expect(200);
    const V2订单 = V2订单列表.body.data.find(
      (项: { uuid?: string }) => 项.uuid === 订单.body.data.id,
    );
    expect(V2订单?.id).toMatch(/^LS-.+-\d{8}-\d{4}$/);

    const 区管确认 = await request(app)
      .put(`/api/orders/${订单.body.data.id}/primary-confirm`)
      .send({ reason: "阶段9自动化区管确认" })
      .expect(200);
    expect(区管确认.body.data.状态).toBe("pending_superadmin_confirm");

    const 超管确认 = await request(app)
      .put(`/api/orders/${订单.body.data.id}/status`)
      .send({ status: "confirmed", reason: "阶段9自动化超管确认" })
      .expect(200);
    expect(超管确认.body.data.状态).toBe("confirmed");
  });

  it("既有业务和V2导入数据均统一为当前编号规则，并保留原编号追溯信息", async () => {
    const pool = new Pool({ connectionString: 测试环境变量.DATABASE_URL });
    try {
      const [商机, 报价, 订单, V2追溯] = await Promise.all([
        pool.query<{ 不合规数: string }>(
          "SELECT COUNT(*) FILTER (WHERE opportunity_no !~ '^SJ-[0-9]{8}-[0-9]{4}$') AS \"不合规数\" FROM crm.opportunities",
        ),
        pool.query<{ 不合规数: string }>(
          `
          SELECT COUNT(*) FILTER (
            WHERE q.quote_no !~ '^BJ-.+-[0-9]{8}-[0-9]{4}$'
              OR q.quote_no NOT LIKE 'BJ-' || u.username::text || '-' ||
                to_char((q.created_at AT TIME ZONE 'Asia/Shanghai')::date, 'YYYYMMDD') || '-%'
          ) AS "不合规数"
          FROM crm.quotes q
          JOIN iam.users u ON u.id = q.owner_user_id
          `,
        ),
        pool.query<{ 不合规数: string }>(
          `
          SELECT COUNT(*) FILTER (
            WHERE o.order_no !~ '^LS-.+-[0-9]{8}-[0-9]{4}$'
              OR o.order_no NOT LIKE 'LS-' || u.username::text || '-' ||
                to_char((o.created_at AT TIME ZONE 'Asia/Shanghai')::date, 'YYYYMMDD') || '-%'
          ) AS "不合规数"
          FROM crm.orders o
          JOIN iam.users u ON u.id = o.owner_user_id
          `,
        ),
        pool.query<{ V2总数: string; 已保留原编号数: string }>(
          `
          SELECT
            COUNT(*) FILTER (WHERE v2_source_id IS NOT NULL) AS "V2总数",
            COUNT(*) FILTER (
              WHERE v2_source_id IS NOT NULL
                AND COALESCE(extra_json->>'legacyBusinessNumber', '') = v2_source_id
            ) AS "已保留原编号数"
          FROM (
            SELECT v2_source_id, extra_json FROM crm.opportunities
            UNION ALL
            SELECT v2_source_id, extra_json FROM crm.quotes
            UNION ALL
            SELECT v2_source_id, extra_json FROM crm.orders
          ) AS 业务记录
          `,
        ),
      ]);

      expect(Number(商机.rows[0]?.不合规数 || 0)).toBe(0);
      expect(Number(报价.rows[0]?.不合规数 || 0)).toBe(0);
      expect(Number(订单.rows[0]?.不合规数 || 0)).toBe(0);
      expect(Number(V2追溯.rows[0]?.V2总数 || 0)).toBeGreaterThan(0);
      expect(Number(V2追溯.rows[0]?.已保留原编号数 || 0)).toBe(Number(V2追溯.rows[0]?.V2总数 || 0));
    } finally {
      await pool.end();
    }
  });

  it("报备、商机、报价和订单始终返回同一关联链上的当前业务编号", async () => {
    const app = 创建应用({ env: 测试环境变量 });
    const 订单列表 = await request(app).get("/api/v2/orders?pageSize=20").expect(200);
    const 已关联订单 = 订单列表.body.data.find(
      (item: { quoteNo?: string; opportunityNo?: string; registrationNo?: string }) =>
        item.quoteNo && item.opportunityNo && item.registrationNo,
    );

    expect(已关联订单?.quoteNo).toMatch(/^BJ-.+-\d{8}-\d{4}$/);
    expect(已关联订单?.opportunityNo).toMatch(/^SJ-\d{8}-\d{4}$/);
    expect(已关联订单?.registrationNo).toBeTruthy();
  });

  it("报价和订单按提报登录账号及自然日生成独立递增编号", async () => {
    const app = 创建应用({
      env: 创建测试环境变量({
        V3_DELIVERY_AUTH_ENABLED: "true",
        V3_DELIVERY_AUTH_COOKIE_SECURE: "false",
        V3_DELIVERY_AUTH_USERS_JSON: "[]",
      }),
    });
    const pool = new Pool({ connectionString: 测试环境变量.DATABASE_URL });
    try {
      const 登录用户 = { username: "admin" };
      const 提报账号 = 登录用户.username;
      const 客户名称 = `编号规则客户-${Date.now()}`;
      const agent = request.agent(app);
      await agent
        .post("/api/auth/login")
        .send({ username: 提报账号, password: "LrCRM@2026!" })
        .expect(200);
      const [已有报价流水, 已有订单流水] = await Promise.all([
        查询当前业务流水(pool, "quote", 提报账号),
        查询当前业务流水(pool, "order", 提报账号),
      ]);
      const 商机 = await agent
        .post("/api/opportunities")
        .send({ customer: 客户名称, name: `${客户名称}-商机` })
        .expect(200);

      const 报价响应 = await Promise.all(
        ["报价一", "报价二"].map((名称) =>
          agent
            .post("/api/quotes")
            .send({ opportunityId: 商机.body.data.id, name: 名称 })
            .expect(200),
        ),
      );
      const 报价一 = 报价响应[0];
      const 报价二 = 报价响应[1];
      if (!报价一 || !报价二) throw new Error("创建编号测试报价失败。");
      const 订单响应 = await Promise.all(
        [报价一, 报价二].map((报价) =>
          agent.post("/api/orders").send({ quoteId: 报价.body.data.id }).expect(200),
        ),
      );
      const 订单一 = 订单响应[0];
      const 订单二 = 订单响应[1];
      if (!订单一 || !订单二) throw new Error("创建编号测试订单失败。");

      const 报价编号 = [报价一.body.data.编号, 报价二.body.data.编号].sort();
      const 订单编号 = [订单一.body.data.编号, 订单二.body.data.编号].sort();
      const 编号正则 = new RegExp(`^BJ-${提报账号}-\\d{8}-(\\d{4})$`);
      const 订单编号正则 = new RegExp(`^LS-${提报账号}-\\d{8}-(\\d{4})$`);

      for (const 编号 of 报价编号) expect(编号).toMatch(编号正则);
      for (const 编号 of 订单编号) expect(编号).toMatch(订单编号正则);
      expect(提取流水号(报价编号)).toEqual([已有报价流水 + 1, 已有报价流水 + 2]);
      expect(提取流水号(订单编号)).toEqual([已有订单流水 + 1, 已有订单流水 + 2]);
    } finally {
      await pool.end();
    }
  });

  it("商机按自然日全局递增编号且不关联登录账号", async () => {
    const app = 创建应用({
      env: 创建测试环境变量({
        V3_DELIVERY_AUTH_ENABLED: "true",
        V3_DELIVERY_AUTH_COOKIE_SECURE: "false",
        V3_DELIVERY_AUTH_USERS_JSON: "[]",
      }),
    });
    const pool = new Pool({ connectionString: 测试环境变量.DATABASE_URL });
    try {
      const 登录用户 = { username: "admin" };
      const agent = request.agent(app);
      await agent
        .post("/api/auth/login")
        .send({ username: 登录用户.username, password: "LrCRM@2026!" })
        .expect(200);
      const 已有流水 = await 查询当前业务流水(pool, "opportunity", "global");
      const 批次 = `商机编号规则-${Date.now()}`;

      const 响应 = await Promise.all(
        ["一", "二"].map((后缀) =>
          agent
            .post("/api/opportunities")
            .send({ customer: `${批次}-${后缀}`, name: `${批次}-${后缀}-商机` })
            .expect(200),
        ),
      );
      const 编号列表 = 响应.map((项目) => 项目.body.data.编号).sort();
      for (const 编号 of 编号列表) expect(编号).toMatch(/^SJ-\d{8}-\d{4}$/);
      expect(编号列表.some((编号) => 编号.includes(登录用户.username))).toBe(false);
      expect(提取流水号(编号列表)).toEqual([已有流水 + 1, 已有流水 + 2]);
    } finally {
      await pool.end();
    }
  });

  it("二级分销商报价转订单后必须经过一级、区管和超管确认", async () => {
    const app = 创建应用({ env: 测试环境变量 });
    const pool = new Pool({ connectionString: 测试环境变量.DATABASE_URL });
    const 批次 = `ORDER-FLOW-${Date.now()}`;
    try {
      const 区域编号 = await 准备渠道范围测试区域(pool, 批次);
      await 准备渠道范围测试角色(pool);
      const 一级分销商 = await 创建渠道范围测试渠道(pool, 批次, "一级", 区域编号);
      const 二级分销商 = await 创建渠道范围测试渠道(pool, 批次, "二级", 区域编号);
      await pool.query(
        `
        UPDATE channel.partners
        SET partner_level_code = 'secondary',
            extra_json = extra_json || $2::jsonb,
            updated_at = now()
        WHERE id = $1::uuid
        `,
        [
          二级分销商.id,
          JSON.stringify({
            partnerLevel: "secondary",
            parentPartnerId: 一级分销商.partner_code,
            parentPartnerIds: [一级分销商.partner_code],
          }),
        ],
      );
      await pool.query("DELETE FROM channel.partner_relations WHERE child_partner_id = $1::uuid", [
        二级分销商.id,
      ]);
      await pool.query(
        `
        INSERT INTO channel.partner_relations (parent_partner_id, child_partner_id, relation_code)
        VALUES ($1::uuid, $2::uuid, 'primary_secondary')
        `,
        [一级分销商.id, 二级分销商.id],
      );
      const 二级员工 = await 创建渠道范围测试用户(
        pool,
        批次,
        "secondary_staff",
        "二级员工",
        "staff",
        "self",
        区域编号,
      );
      await 绑定渠道范围测试成员(pool, 二级分销商.id, 二级员工.id, "staff");
      const 客户名称 = `${批次}-二级订单审批客户`;
      const 客户编号 = await 创建渠道范围测试客户(pool, 客户名称, 二级员工.id, 二级分销商.id);
      const 报价编号 = await 生成测试业务编号(pool, "quote", 二级员工.username);
      const 报价结果 = await pool.query<{ id: string }>(
        `
        INSERT INTO crm.quotes (
          quote_no, customer_id, partner_id, owner_user_id, status_code,
          total_amount, discount_amount, extra_json
        )
        VALUES ($1, $2::uuid, $3::uuid, $4::uuid, 'approved', 16800, 0, $5::jsonb)
        ON CONFLICT (quote_no) DO UPDATE
        SET customer_id = EXCLUDED.customer_id,
            partner_id = EXCLUDED.partner_id,
            owner_user_id = EXCLUDED.owner_user_id,
            status_code = EXCLUDED.status_code,
            total_amount = EXCLUDED.total_amount,
            extra_json = crm.quotes.extra_json || EXCLUDED.extra_json,
            updated_at = now()
        RETURNING id::text AS id
        `,
        [
          报价编号,
          客户编号,
          二级分销商.id,
          二级员工.id,
          JSON.stringify({
            id: 报价编号,
            customer: 客户名称,
            customerName: 客户名称,
            partnerId: 二级分销商.partner_code,
            partnerName: 二级分销商.partner_name,
            assignedPartnerId: 一级分销商.partner_code,
            assignedPartnerName: 一级分销商.partner_name,
            assignedStaffId: 二级员工.username,
            assignedStaffName: 二级员工.display_name,
            region: `${批次}-测试区域`,
            total: 16800,
          }),
        ],
      );
      const 报价 = 报价结果.rows[0];
      if (!报价) throw new Error("创建二级订单审批测试报价失败。");

      const 订单 = await request(app)
        .post("/api/orders")
        .send({ quoteId: 报价.id, assignedPartnerId: 一级分销商.partner_code })
        .expect(200);
      expect(订单.body.data.状态).toBe("pending_primary_confirm");

      const 一级待办 = await request(app)
        .get(
          `/api/stage9/approvals?status=pending&keyword=${encodeURIComponent(客户名称)}&pageSize=10`,
        )
        .expect(200);
      expect(
        一级待办.body.data.数据.some(
          (项: { 类型: string; 原始数据?: { step?: string } }) =>
            项.类型 === "订单审批" && 项.原始数据?.step === "primary_confirm",
        ),
      ).toBe(true);

      const 一级确认 = await request(app)
        .put(`/api/orders/${订单.body.data.id}/primary-confirm`)
        .send({ reason: "一级分销商确认" })
        .expect(200);
      expect(一级确认.body.data.状态).toBe("primary_confirmed");

      const 区管确认 = await request(app)
        .put(`/api/orders/${订单.body.data.id}/status`)
        .send({ status: "pending_superadmin_confirm", reason: "区管确认" })
        .expect(200);
      expect(区管确认.body.data.状态).toBe("pending_superadmin_confirm");

      const 超管确认 = await request(app)
        .put(`/api/orders/${订单.body.data.id}/status`)
        .send({ status: "confirmed", reason: "超管确认" })
        .expect(200);
      expect(超管确认.body.data.状态).toBe("confirmed");
    } finally {
      await pool.end();
    }
  });

  it("客户报备初始状态与V2管理员和渠道提交流程一致", async () => {
    const app = 创建应用({ env: 测试环境变量 });
    const 批次 = Date.now();
    const 管理员客户 = `阶段9管理员自动通过客户${批次}`;
    const 渠道客户 = `阶段9渠道待审核客户${批次}`;

    const 管理员报备 = await request(app)
      .post("/api/registrations")
      .send({
        customer: 管理员客户,
        creditCode: `91370000AUTO${批次}`,
        contact: "管理员验收联系人",
        phone: "13800000001",
        status: "approved",
        approvedBy: "联软科技超级管理员",
      })
      .expect(200);
    expect(管理员报备.body.data.状态).toBe("approved");

    const 管理员审批记录 = await request(app)
      .get(`/api/stage9/approvals?keyword=${encodeURIComponent(管理员客户)}&pageSize=5`)
      .expect(200);
    expect(
      管理员审批记录.body.data.数据.some(
        (项: { 客户名称: string; 状态: string }) =>
          项.客户名称 === 管理员客户 && 项.状态 === "approved",
      ),
    ).toBe(true);

    const 渠道报备 = await request(app)
      .post("/api/registrations")
      .send({
        customer: 渠道客户,
        creditCode: `91370000PEND${批次}`,
        contact: "渠道验收联系人",
        phone: "13800000002",
        status: "pending",
      })
      .expect(200);
    expect(渠道报备.body.data.状态).toBe("pending");

    const 待审核记录 = await request(app)
      .get(
        `/api/stage9/approvals?status=pending&keyword=${encodeURIComponent(渠道客户)}&pageSize=5`,
      )
      .expect(200);
    expect(
      待审核记录.body.data.数据.some(
        (项: { 客户名称: string; 状态: string }) =>
          项.客户名称 === 渠道客户 && 项.状态 === "pending",
      ),
    ).toBe(true);
  });

  it("渠道报备和商机按服务端账号范围隔离并支持管理员指派", async () => {
    const app = 创建应用({ env: 测试环境变量 });
    const pool = new Pool({ connectionString: 测试环境变量.DATABASE_URL });
    const 批次 = `KB003-${Date.now()}`;
    try {
      const 数据 = await 准备渠道范围测试数据(pool, 批次);
      const 提醒日期 = new Date();
      提醒日期.setDate(提醒日期.getDate() + 7);
      const 到期日 = 提醒日期.toISOString().slice(0, 10);
      await pool.query(
        `
        UPDATE crm.registrations
        SET extra_json = extra_json || $2::jsonb
        WHERE id = ANY($1::uuid[])
        `,
        [
          [数据.员工本人报备.id, 数据.其他渠道报备.id],
          JSON.stringify({ expireAt: 到期日, protectDays: 180 }),
        ],
      );
      await pool.query(
        `
        UPDATE crm.opportunities
        SET extra_json = extra_json || $2::jsonb
        WHERE id = ANY($1::uuid[])
        `,
        [[数据.员工本人商机.id, 数据.其他渠道商机.id], JSON.stringify({ expectedClose: 到期日 })],
      );
      await pool.query(
        `
        INSERT INTO ops.notifications (v2_source_id, recipient_user_id, title, content, status_code, extra_json)
        VALUES
          ($1, $2::uuid, $3, '仅本人可见', 'unread', $4::jsonb),
          ($5, $6::uuid, $7, '其他渠道不可见', 'unread', $8::jsonb)
        `,
        [
          `${批次}-NOTICE-SELF`,
          数据.员工一.id,
          `${批次}-本人通知`,
          JSON.stringify({ title: `${批次}-本人通知`, unread: true }),
          `${批次}-NOTICE-OTHER`,
          数据.其他渠道员工.id,
          `${批次}-其他渠道通知`,
          JSON.stringify({ title: `${批次}-其他渠道通知`, unread: true }),
        ],
      );
      const 员工列表 = await request(app)
        .get(`/api/v2/registrations?keyword=${批次}&pageSize=50`)
        .set("Authorization", 签发测试V2令牌(数据.员工一.username))
        .expect(200);
      const 员工客户 = 员工列表.body.data.map((item: { customer: string }) => item.customer);
      expect(员工客户).toContain(`${批次}-员工本人客户`);
      expect(员工客户).not.toContain(`${批次}-同企业其他员工客户`);
      expect(员工客户).not.toContain(`${批次}-其他渠道客户`);

      const 员工登录提醒 = await request(app)
        .post("/api/v2/auth/login")
        .send({ username: 数据.员工一.username, password: "LrCRM@2026!" })
        .expect(200);
      const 员工提醒名称 = 员工登录提醒.body.dueReminders.map(
        (item: { targetName: string }) => item.targetName,
      );
      expect(员工提醒名称).toContain(`${批次}-员工本人客户`);
      expect(员工提醒名称).toContain(`${批次}-员工本人商机`);
      expect(员工提醒名称).not.toContain(`${批次}-其他渠道客户`);
      expect(员工提醒名称).not.toContain(`${批次}-其他渠道商机`);

      const 员工通知 = await request(app)
        .get("/api/v2/notifications?pageSize=50")
        .set("Authorization", 签发测试V2令牌(数据.员工一.username))
        .expect(200);
      const 员工通知标题 = 员工通知.body.data.map((item: { title: string }) => item.title);
      expect(员工通知标题).toContain(`${批次}-本人通知`);
      expect(员工通知标题).not.toContain(`${批次}-其他渠道通知`);

      const 未登录通知 = await request(app).get("/api/v2/notifications?pageSize=50").expect(200);
      expect(未登录通知.body.data).toEqual([]);

      const 企业管理员列表 = await request(app)
        .get(`/api/v2/registrations?keyword=${批次}&pageSize=50`)
        .set("Authorization", 签发测试V2令牌(数据.企业管理员.username))
        .expect(200);
      const 企业客户 = 企业管理员列表.body.data.map((item: { customer: string }) => item.customer);
      expect(企业客户).toContain(`${批次}-员工本人客户`);
      expect(企业客户).toContain(`${批次}-同企业其他员工客户`);
      expect(企业客户).not.toContain(`${批次}-其他渠道客户`);

      const 企业管理员兼容列表 = await request(app)
        .get(
          `/api/v2/registrations?keyword=${批次}&operatorId=${数据.企业管理员.username}&pageSize=50`,
        )
        .set("Authorization", 签发测试V2令牌(数据.企业管理员.username))
        .expect(200);
      const 企业兼容客户 = 企业管理员兼容列表.body.data.map(
        (item: { customer: string }) => item.customer,
      );
      expect(企业兼容客户).toContain(`${批次}-员工本人客户`);
      expect(企业兼容客户).toContain(`${批次}-同企业其他员工客户`);
      expect(企业兼容客户).not.toContain(`${批次}-其他渠道客户`);

      const 扩展绑定企业报备 = await request(app)
        .get(`/api/v2/registrations?keyword=${批次}&pageSize=50`)
        .set("Authorization", 签发测试V2令牌(数据.企业管理员仅扩展.username))
        .expect(200);
      const 扩展绑定客户 = 扩展绑定企业报备.body.data.map(
        (item: { customer: string }) => item.customer,
      );
      expect(扩展绑定客户).toContain(`${批次}-员工本人客户`);
      expect(扩展绑定客户).toContain(`${批次}-同企业其他员工客户`);
      expect(扩展绑定客户).not.toContain(`${批次}-其他渠道客户`);

      const 扩展绑定企业商机 = await request(app)
        .get(`/api/v2/opportunities?keyword=${批次}&pageSize=50`)
        .set("Authorization", 签发测试V2令牌(数据.企业管理员仅扩展.username))
        .expect(200);
      expect(扩展绑定企业商机.body.data.map((item: { name: string }) => item.name)).toContain(
        数据.员工本人商机.编号,
      );
      expect(扩展绑定企业商机.body.data.map((item: { name: string }) => item.name)).not.toContain(
        数据.其他渠道商机.编号,
      );

      const 扩展绑定企业报价 = await request(app)
        .get(`/api/v2/quotes?keyword=${encodeURIComponent(批次)}&pageSize=50`)
        .set("Authorization", 签发测试V2令牌(数据.企业管理员仅扩展.username))
        .expect(200);
      expect(扩展绑定企业报价.body.data.map((item: { id: string }) => item.id)).toContain(
        数据.报价.编号,
      );

      const 扩展绑定企业订单 = await request(app)
        .get(`/api/v2/orders?keyword=${encodeURIComponent(批次)}&pageSize=50`)
        .set("Authorization", 签发测试V2令牌(数据.企业管理员仅扩展.username))
        .expect(200);
      expect(扩展绑定企业订单.body.data.map((item: { id: string }) => item.id)).toContain(
        数据.订单.编号,
      );

      const 超管列表参数 = `keyword=${encodeURIComponent(批次)}&operatorId=${encodeURIComponent(数据.超级管理员.username)}&userId=${encodeURIComponent(数据.超级管理员.username)}&userRole=superadmin&pageSize=100`;
      const 超管报备列表 = await request(app)
        .get(`/api/v2/registrations?${超管列表参数}`)
        .set("Authorization", 签发测试V2令牌(数据.超级管理员.username))
        .expect(200);
      const 超管报备客户 = 超管报备列表.body.data.map(
        (item: { customer: string }) => item.customer,
      );
      expect(超管报备客户).toContain(`${批次}-员工本人客户`);
      expect(超管报备客户).toContain(`${批次}-同企业其他员工客户`);
      expect(超管报备客户).toContain(`${批次}-其他渠道客户`);

      const 超管渠道列表 = await request(app)
        .get(`/api/v2/partners?${超管列表参数}`)
        .set("Authorization", 签发测试V2令牌(数据.超级管理员.username))
        .expect(200);
      const 超管渠道名称 = 超管渠道列表.body.data.map((item: { name: string }) => item.name);
      expect(超管渠道名称).toContain(数据.渠道一.partner_name);
      expect(超管渠道名称).toContain(数据.渠道二.partner_name);

      const 超管账号列表 = await request(app)
        .get(
          `/api/v2/users?keyword=${encodeURIComponent(批次)}&operatorId=${encodeURIComponent(数据.超级管理员.username)}&pageSize=100`,
        )
        .set("Authorization", 签发测试V2令牌(数据.超级管理员.username))
        .expect(200);
      const 超管账号 = 超管账号列表.body.data.map((item: { username: string }) => item.username);
      expect(超管账号).toContain(数据.超级管理员.username);
      expect(超管账号).toContain(数据.企业管理员.username);
      expect(超管账号).toContain(数据.员工一.username);

      const 超管报价列表 = await request(app)
        .get(
          `/api/v2/quotes?keyword=${encodeURIComponent(批次)}&operatorId=${encodeURIComponent(数据.超级管理员.username)}&pageSize=50`,
        )
        .set("Authorization", 签发测试V2令牌(数据.超级管理员.username))
        .expect(200);
      expect(超管报价列表.body.data.map((item: { id: string }) => item.id)).toContain(
        数据.报价.编号,
      );

      const 超管订单列表 = await request(app)
        .get(
          `/api/v2/orders?keyword=${encodeURIComponent(批次)}&operatorId=${encodeURIComponent(数据.超级管理员.username)}&pageSize=50`,
        )
        .set("Authorization", 签发测试V2令牌(数据.超级管理员.username))
        .expect(200);
      expect(超管订单列表.body.data.map((item: { id: string }) => item.id)).toContain(
        数据.订单.编号,
      );

      await 创建渠道范围测试订单审批待办(pool, 批次, 数据.订单, 数据.渠道一, 数据.员工一);
      await 创建渠道范围测试订单审批待办(
        pool,
        批次,
        数据.其他区域订单,
        数据.其他区域渠道,
        数据.其他区域员工,
      );

      const 区管报价列表 = await request(app)
        .get(`/api/v2/quotes?keyword=${encodeURIComponent(批次)}&pageSize=100`)
        .set("Authorization", 签发测试V2令牌(数据.区域管理员.username))
        .expect(200);
      const 区管报价编号 = 区管报价列表.body.data.map((item: { id: string }) => item.id);
      expect(区管报价编号).toContain(数据.报价.编号);
      expect(区管报价编号).not.toContain(数据.其他区域报价.编号);
      expect(
        区管报价列表.body.data.find((item: { id: string }) => item.id === 数据.报价.编号)?.region,
      ).toBe(`${批次}-测试区域`);

      const 区管订单列表 = await request(app)
        .get(`/api/v2/orders?keyword=${encodeURIComponent(批次)}&pageSize=100`)
        .set("Authorization", 签发测试V2令牌(数据.区域管理员.username))
        .expect(200);
      const 区管订单编号 = 区管订单列表.body.data.map((item: { id: string }) => item.id);
      expect(区管订单编号).toContain(数据.订单.编号);
      expect(区管订单编号).not.toContain(数据.其他区域订单.编号);
      expect(
        区管订单列表.body.data.find((item: { id: string }) => item.id === 数据.订单.编号)?.region,
      ).toBe(`${批次}-测试区域`);

      const 区管审核列表 = await request(app)
        .get(
          `/api/stage9/approvals?status=pending&keyword=${encodeURIComponent(批次)}&pageSize=100`,
        )
        .set("Authorization", 签发测试V2令牌(数据.区域管理员.username))
        .expect(200);
      const 区管审核编号 = 区管审核列表.body.data.数据.map((item: { 编号: string }) => item.编号);
      expect(区管审核编号).toContain(数据.订单.编号);
      expect(区管审核编号).not.toContain(数据.其他区域订单.编号);

      const 改派报备 = await request(app)
        .put(`/api/v2/registrations/${数据.其他渠道报备.id}`)
        .set("Authorization", 签发测试V2令牌(数据.超级管理员.username))
        .send({
          assignedPartnerId: 数据.渠道一.partner_code,
          assignedStaffId: 数据.员工一.username,
          contact: "改派联系人",
        })
        .expect(200);
      expect(改派报备.body.data.partnerName).toBe(数据.渠道一.partner_name);
      expect(改派报备.body.data.assignedStaffName).toBe(数据.员工一.display_name);

      const 改派商机 = await request(app)
        .put(`/api/v2/opportunities/${数据.其他渠道商机.id}`)
        .set("Authorization", 签发测试V2令牌(数据.超级管理员.username))
        .send({
          assignedPartnerId: 数据.渠道一.partner_code,
          assignedStaffId: 数据.员工一.username,
          stage: "design",
          followup: "管理员改派后跟进",
        })
        .expect(200);
      expect(改派商机.body.data.partnerName).toBe(数据.渠道一.partner_name);
      expect(改派商机.body.data.assignedStaffName).toBe(数据.员工一.display_name);
    } finally {
      await pool.end();
    }
  });

  it("既往客户导入后可通过企业搜索模糊匹配并回填", async () => {
    const app = 创建应用({ env: 测试环境变量 });
    const pool = new Pool({ connectionString: 测试环境变量.DATABASE_URL });
    const 批次 = `KB003-KNOWN-${Date.now()}`;
    const 客户名称 = `${批次}-平安既往客户`;
    try {
      await 插入既往客户搜索样本(pool, 客户名称);
      const 搜索 = await request(app)
        .get(`/api/v2/company-search?keyword=${encodeURIComponent("平安既往")}`)
        .expect(200);
      expect(搜索.body.success).toBe(true);
      const 命中 = 搜索.body.data.find((item: { name: string }) => item.name === 客户名称);
      expect(命中).toMatchObject({
        name: 客户名称,
        creditCode: "91310000KB003KNOWN",
        legalPerson: "既往客户法人",
        address: "深圳市南山区既往客户园区",
        companyStatus: "在营",
        industry: "金融",
      });
    } finally {
      await pool.end();
    }
  });

  it("可以使用PostgreSQL正式表维护OpenAPI客户端并完成授权调用", async () => {
    const app = 创建应用({ env: 测试环境变量 });
    const 用户列表 = await request(app).get("/api/users?pageSize=1").expect(200);
    const 绑定用户 = 用户列表.body.data.数据[0] as { id: string };
    expect(绑定用户.id).toBeTruthy();

    const 创建 = await request(app)
      .post("/api/open-api/clients")
      .send({
        name: `阶段9.13自动化Client-${Date.now()}`,
        boundUserId: 绑定用户.id,
        status: "active",
        ipWhitelist: [],
        allowedResources: ["registrations"],
        remark: "PostgreSQL正式表验收",
      })
      .expect(200);
    expect(创建.body.data.appKey).toMatch(/^oak_/);
    expect(创建.body.data.appSecret).toMatch(/^osk_/);

    const 重置 = await request(app)
      .post(`/api/open-api/clients/${创建.body.data.id}/reset-secret`)
      .send({})
      .expect(200);
    expect(重置.body.data.appSecret).toMatch(/^osk_/);

    const 令牌 = await request(app)
      .post("/api/open/v1/auth/token")
      .send({ appKey: 重置.body.data.appKey, appSecret: 重置.body.data.appSecret })
      .expect(200);
    expect(令牌.body.data.accessToken).toBeTruthy();
    expect(令牌.body.data.allowedResources).toContain("registrations");

    const 开放报备 = await request(app)
      .get("/api/open/v1/registrations?pageSize=1")
      .set("Authorization", `Bearer ${令牌.body.data.accessToken}`)
      .expect(200);
    expect(开放报备.body.success).toBe(true);
    expect(开放报备.body.data.分页.总数).toBeGreaterThan(0);

    const 日志 = await request(app).get("/api/open-api/logs?limit=20").expect(200);
    expect(
      日志.body.data.some((项: { path: string; resultMessage: string }) =>
        `${项.path} ${项.resultMessage}`.includes("/api/open/v1/registrations"),
      ),
    ).toBe(true);
  });

  it("可以维护工作量映射和交付规则，并影响报价工作量试算", async () => {
    const app = 创建应用({ env: 测试环境变量 });
    const 映射列表 = await request(app).get("/api/workload/mappings?pageSize=100").expect(200);
    const 产品映射 = 映射列表.body.data.find(
      (项: { itemType: string }) => 项.itemType === "feature",
    );
    expect(产品映射?.featureId).toBeTruthy();

    const 保存映射 = await request(app)
      .put(`/api/workload/mappings/${产品映射.featureId}`)
      .send({ deliveryTags: ["EPP_BASE"], active: true })
      .expect(200);
    expect(保存映射.body.data.deliveryTags).toEqual(["EPP_BASE"]);

    const 规则列表 = await request(app).get("/api/workload/delivery-rules").expect(200);
    const 命中规则 = 规则列表.body.data.find(
      (项: {
        deliveryTag: string;
        ruleType: string;
        minPoints: number | null;
        maxPoints: number | null;
      }) =>
        项.deliveryTag === "EPP_BASE" &&
        项.ruleType !== "fixed" &&
        (项.minPoints || 1) <= 120 &&
        (项.maxPoints || 5000) >= 120,
    );
    expect(命中规则?.id).toBeTruthy();
    const 新人天 = Number((Number(命中规则.personDays) + 0.5).toFixed(1));

    const 保存规则 = await request(app)
      .put(`/api/workload/delivery-rules/${命中规则.id}`)
      .send({
        minPoints: 命中规则.minPoints,
        maxPoints: 命中规则.maxPoints,
        personDays: 新人天,
        comboPersonDays: 命中规则.comboPersonDays,
        remark: "阶段9.13自动化规则维护",
        active: true,
      })
      .expect(200);
    expect(保存规则.body.data.personDays).toBe(新人天);

    const 试算 = await request(app)
      .post("/api/quotes/workload-preview")
      .send({ endpoints: 120, productIds: [产品映射.featureId] })
      .expect(200);
    expect(试算.body.data.workloadDays).toBe(新人天);
    expect(试算.body.data.workloadSummary).toContain("EPP");
  });
});

type 渠道范围测试用户 = {
  id: string;
  username: string;
  display_name: string;
};

type 渠道范围测试渠道 = {
  id: string;
  partner_code: string;
  partner_name: string;
};

type 渠道范围测试业务记录 = {
  id: string;
  编号?: string;
};

async function 读取可登录测试用户(): Promise<{ username: string }> {
  const pool = new Pool({ connectionString: 测试环境变量.DATABASE_URL });
  try {
    const result = await pool.query<{ username: string }>(
      `
      SELECT u.username::text AS username
      FROM iam.users u
      JOIN iam.password_credentials pc ON pc.user_id = u.id
      WHERE u.status_code = 'active'
        AND pc.algorithm = 'scrypt'
      ORDER BY
        CASE WHEN u.username::text LIKE 'kb003-%' THEN 1 ELSE 0 END,
        u.created_at DESC
      LIMIT 1
      `,
    );
    const username = result.rows[0]?.username;
    if (!username) throw new Error("测试库缺少可登录账号。");
    return { username };
  } finally {
    await pool.end();
  }
}

async function 准备渠道范围测试数据(pool: Pool, 批次: string) {
  const 区域编号 = await 准备渠道范围测试区域(pool, 批次);
  const 其他区域编号 = await 准备渠道范围测试区域(pool, `${批次}-外区`);
  await 准备渠道范围测试角色(pool);

  const 渠道一 = await 创建渠道范围测试渠道(pool, 批次, "一", 区域编号);
  const 渠道二 = await 创建渠道范围测试渠道(pool, 批次, "二", 区域编号);
  const 其他区域渠道 = await 创建渠道范围测试渠道(pool, 批次, "外区", 其他区域编号);
  const 超级管理员 = await 创建渠道范围测试用户(
    pool,
    批次,
    "super",
    "超级管理员",
    "superadmin",
    "all",
    区域编号,
  );
  const 区域管理员 = await 创建渠道范围测试用户(
    pool,
    批次,
    "region_admin",
    "区域管理员",
    "region_manager",
    "region",
    区域编号,
  );
  const 企业管理员 = await 创建渠道范围测试用户(
    pool,
    批次,
    "partner_admin",
    "企业管理员",
    "partner_admin",
    "partner",
    区域编号,
  );
  const 企业管理员仅扩展 = await 创建渠道范围测试用户(
    pool,
    批次,
    "partner_admin_extra",
    "扩展绑定企业管理员",
    "partner_admin",
    "partner",
    区域编号,
  );
  const 员工一 = await 创建渠道范围测试用户(
    pool,
    批次,
    "staff1",
    "员工一",
    "staff",
    "self",
    区域编号,
  );
  const 员工二 = await 创建渠道范围测试用户(
    pool,
    批次,
    "staff2",
    "员工二",
    "staff",
    "self",
    区域编号,
  );
  const 其他渠道员工 = await 创建渠道范围测试用户(
    pool,
    批次,
    "other_staff",
    "其他渠道员工",
    "staff",
    "self",
    区域编号,
  );
  const 其他区域员工 = await 创建渠道范围测试用户(
    pool,
    批次,
    "outside_region_staff",
    "外区员工",
    "staff",
    "self",
    其他区域编号,
  );

  await 绑定渠道范围测试成员(pool, 渠道一.id, 企业管理员.id, "partner_admin");
  await 绑定渠道范围测试成员(pool, 渠道一.id, 员工一.id, "staff");
  await 绑定渠道范围测试成员(pool, 渠道一.id, 员工二.id, "staff");
  await 绑定渠道范围测试成员(pool, 渠道二.id, 其他渠道员工.id, "staff");
  await 绑定渠道范围测试成员(pool, 其他区域渠道.id, 其他区域员工.id, "staff");
  await 写入渠道范围测试用户扩展绑定(pool, 企业管理员仅扩展.id, 渠道一);

  const 员工本人报备 = await 创建渠道范围测试报备(
    pool,
    批次,
    `${批次}-员工本人客户`,
    渠道一,
    员工一,
    区域编号,
  );
  await 创建渠道范围测试报备(pool, 批次, `${批次}-同企业其他员工客户`, 渠道一, 员工二, 区域编号);
  const 其他渠道报备 = await 创建渠道范围测试报备(
    pool,
    批次,
    `${批次}-其他渠道客户`,
    渠道二,
    其他渠道员工,
    区域编号,
  );
  const 其他渠道商机 = await 创建渠道范围测试商机(
    pool,
    批次,
    `${批次}-其他渠道商机客户`,
    `${批次}-其他渠道商机`,
    渠道二,
    其他渠道员工,
    区域编号,
  );
  const 员工本人商机 = await 创建渠道范围测试商机(
    pool,
    批次,
    `${批次}-员工本人商机客户`,
    `${批次}-员工本人商机`,
    渠道一,
    员工一,
    区域编号,
  );
  const 报价订单 = await 创建渠道范围测试报价和订单(
    pool,
    批次,
    `${批次}-员工本人报价订单客户`,
    渠道一,
    员工一,
  );
  const 其他区域报价订单 = await 创建渠道范围测试报价和订单(
    pool,
    批次,
    `${批次}-其他区域报价订单客户`,
    其他区域渠道,
    其他区域员工,
    "其他区域",
  );

  return {
    渠道一,
    渠道二,
    其他区域渠道,
    超级管理员,
    区域管理员,
    企业管理员,
    企业管理员仅扩展,
    员工一,
    其他渠道员工,
    其他区域员工,
    员工本人报备,
    其他渠道报备,
    其他渠道商机,
    员工本人商机: { ...员工本人商机, 编号: `${批次}-员工本人商机` },
    报价: 报价订单.报价,
    订单: 报价订单.订单,
    其他区域报价: 其他区域报价订单.报价,
    其他区域订单: 其他区域报价订单.订单,
  };
}

async function 写入渠道范围测试用户扩展绑定(
  pool: Pool,
  用户编号: string,
  渠道: 渠道范围测试渠道,
): Promise<void> {
  await pool.query(
    `
    UPDATE iam.users
    SET extra_json = extra_json || $2::jsonb,
        updated_at = now()
    WHERE id = $1::uuid
    `,
    [
      用户编号,
      JSON.stringify({
        partnerId: 渠道.partner_code,
        partnerName: 渠道.partner_name,
      }),
    ],
  );
}

async function 准备渠道范围测试区域(pool: Pool, 批次: string): Promise<string> {
  const result = await pool.query<{ id: string }>(
    `
    INSERT INTO org.regions (region_code, region_name, region_level, status_code)
    VALUES ($1, $2, 'region', 'active')
    ON CONFLICT (region_code) DO UPDATE
    SET region_name = EXCLUDED.region_name,
        status_code = EXCLUDED.status_code
    RETURNING id::text AS id
    `,
    [`RG-${批次}`, `${批次}-测试区域`],
  );
  const row = result.rows[0];
  if (!row) throw new Error("准备渠道范围测试区域失败。");
  return row.id;
}

async function 准备渠道范围测试角色(pool: Pool): Promise<void> {
  await pool.query(
    `
    INSERT INTO iam.roles (role_code, role_name, status_code)
    VALUES
      ('superadmin', '超级管理员', 'active'),
      ('region_manager', '区域管理员', 'active'),
      ('partner_admin', '渠道管理员', 'active'),
      ('staff', '销售代表', 'active')
    ON CONFLICT (role_code) DO UPDATE
    SET role_name = EXCLUDED.role_name,
        status_code = EXCLUDED.status_code
    `,
  );
}

async function 创建渠道范围测试渠道(
  pool: Pool,
  批次: string,
  序号: string,
  区域编号: string,
): Promise<渠道范围测试渠道> {
  const 渠道编码 = `${批次}-PARTNER-${序号}`;
  const 渠道名称 = `${批次}-渠道商${序号}`;
  const result = await pool.query<渠道范围测试渠道>(
    `
    INSERT INTO channel.partners (
      v2_source_id, partner_code, partner_name, normalized_name, partner_level_code,
      region_id, status_code, extra_json
    )
    VALUES ($1, $1, $2, $3, 'primary', $4::uuid, 'active', $5::jsonb)
    ON CONFLICT (partner_code) DO UPDATE
    SET partner_name = EXCLUDED.partner_name,
        normalized_name = EXCLUDED.normalized_name,
        region_id = EXCLUDED.region_id,
        status_code = EXCLUDED.status_code,
        extra_json = channel.partners.extra_json || EXCLUDED.extra_json,
        updated_at = now()
    RETURNING id::text AS id, partner_code, partner_name
    `,
    [
      渠道编码,
      渠道名称,
      归一化渠道范围测试名称(渠道名称),
      区域编号,
      JSON.stringify({ id: 渠道编码, partnerId: 渠道编码, name: 渠道名称, partnerName: 渠道名称 }),
    ],
  );
  const row = result.rows[0];
  if (!row) throw new Error("创建渠道范围测试渠道失败。");
  return row;
}

async function 创建渠道范围测试用户(
  pool: Pool,
  批次: string,
  后缀: string,
  显示名后缀: string,
  角色编码: string,
  数据范围编码: string,
  区域编号: string,
): Promise<渠道范围测试用户> {
  const username = `${批次.toLowerCase()}_${后缀}`;
  const displayName = `${批次}-${显示名后缀}`;
  const result = await pool.query<渠道范围测试用户>(
    `
    INSERT INTO iam.users (v2_source_id, username, display_name, status_code, region_id, extra_json)
    VALUES ($1, $2::citext, $3, 'active', $4::uuid, $5::jsonb)
    ON CONFLICT (username) DO UPDATE
    SET display_name = EXCLUDED.display_name,
        status_code = EXCLUDED.status_code,
        region_id = EXCLUDED.region_id,
        extra_json = iam.users.extra_json || EXCLUDED.extra_json,
        updated_at = now()
    RETURNING id::text AS id, username::text AS username, display_name
    `,
    [
      username,
      username,
      displayName,
      区域编号,
      JSON.stringify({ id: username, userId: username, role: 角色编码, name: displayName }),
    ],
  );
  const 用户 = result.rows[0];
  if (!用户) throw new Error("创建渠道范围测试用户失败。");
  await pool.query(
    `
    INSERT INTO iam.password_credentials (
      user_id, password_hash, algorithm, must_change_password, changed_at
    )
    VALUES ($1::uuid, $2, 'scrypt', false, now())
    ON CONFLICT (user_id) DO UPDATE
    SET password_hash = EXCLUDED.password_hash,
        algorithm = EXCLUDED.algorithm,
        must_change_password = EXCLUDED.must_change_password,
        changed_at = EXCLUDED.changed_at
    `,
    [用户.id, 创建密码散列("LrCRM@2026!")],
  );
  await pool.query(
    `
    INSERT INTO iam.user_roles (user_id, role_id)
    SELECT $1::uuid, id
    FROM iam.roles
    WHERE role_code = $2
    ON CONFLICT DO NOTHING
    `,
    [用户.id, 角色编码],
  );
  await pool.query(
    `
    INSERT INTO org.staff_profiles (user_id, employee_no, title, data_scope_code, extra_json)
    VALUES ($1::uuid, $2, $3, $4, $5::jsonb)
    ON CONFLICT (user_id) DO UPDATE
    SET title = EXCLUDED.title,
        data_scope_code = EXCLUDED.data_scope_code,
        extra_json = org.staff_profiles.extra_json || EXCLUDED.extra_json
    `,
    [
      用户.id,
      username,
      显示名后缀,
      数据范围编码,
      JSON.stringify({ role: 角色编码, dataScopeCode: 数据范围编码 }),
    ],
  );
  return 用户;
}

async function 绑定渠道范围测试成员(
  pool: Pool,
  渠道编号: string,
  用户编号: string,
  成员角色编码: "partner_admin" | "staff",
): Promise<void> {
  await pool.query(
    `
    INSERT INTO channel.partner_members (partner_id, user_id, member_role_code, status_code)
    VALUES ($1::uuid, $2::uuid, $3, 'active')
    ON CONFLICT (partner_id, user_id) DO UPDATE
    SET member_role_code = EXCLUDED.member_role_code,
        status_code = EXCLUDED.status_code,
        ended_at = NULL
    `,
    [渠道编号, 用户编号, 成员角色编码],
  );
}

async function 创建渠道范围测试报备(
  pool: Pool,
  批次: string,
  客户名称: string,
  渠道: 渠道范围测试渠道,
  员工: 渠道范围测试用户,
  区域编号: string,
): Promise<渠道范围测试业务记录> {
  const 客户编号 = await 创建渠道范围测试客户(pool, 客户名称, 员工.id, 渠道.id);
  const 报备编号 = `${批次}-REG-${客户名称.replace(批次, "").replace(/[^0-9A-Za-z\u4e00-\u9fa5]/g, "")}`;
  const result = await pool.query<渠道范围测试业务记录>(
    `
    INSERT INTO crm.registrations (
      registration_no, customer_id, partner_id, owner_user_id, region_id, status_code,
      submitted_at, approved_at, extra_json
    )
    VALUES ($1, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'approved', now(), now(), $6::jsonb)
    ON CONFLICT (registration_no) DO UPDATE
    SET customer_id = EXCLUDED.customer_id,
        partner_id = EXCLUDED.partner_id,
        owner_user_id = EXCLUDED.owner_user_id,
        region_id = EXCLUDED.region_id,
        status_code = EXCLUDED.status_code,
        extra_json = crm.registrations.extra_json || EXCLUDED.extra_json,
        updated_at = now()
    RETURNING id::text AS id
    `,
    [
      报备编号,
      客户编号,
      渠道.id,
      员工.id,
      区域编号,
      JSON.stringify({
        id: 报备编号,
        customer: 客户名称,
        customerName: 客户名称,
        partnerId: 渠道.partner_code,
        assignedPartnerId: 渠道.partner_code,
        partnerName: 渠道.partner_name,
        assignedStaffId: 员工.username,
        assignedStaffName: 员工.display_name,
        region: `${批次}-测试区域`,
      }),
    ],
  );
  const row = result.rows[0];
  if (!row) throw new Error("创建渠道范围测试报备失败。");
  return row;
}

async function 创建渠道范围测试商机(
  pool: Pool,
  批次: string,
  客户名称: string,
  商机名称: string,
  渠道: 渠道范围测试渠道,
  员工: 渠道范围测试用户,
  区域编号: string,
): Promise<渠道范围测试业务记录> {
  const 报备 = await 创建渠道范围测试报备(pool, 批次, 客户名称, 渠道, 员工, 区域编号);
  const 客户编号 = await 创建渠道范围测试客户(pool, 客户名称, 员工.id, 渠道.id);
  const 商机编号 = await 生成测试业务编号(pool, "opportunity");
  const result = await pool.query<渠道范围测试业务记录>(
    `
    INSERT INTO crm.opportunities (
      opportunity_no, customer_id, registration_id, partner_id, owner_user_id, region_id,
      stage_code, raw_stage_name, status_code, expected_amount, extra_json
    )
    VALUES ($1, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6::uuid, 'registered', 'registered', 'active', 1000, $7::jsonb)
    ON CONFLICT (opportunity_no) DO UPDATE
    SET customer_id = EXCLUDED.customer_id,
        registration_id = EXCLUDED.registration_id,
        partner_id = EXCLUDED.partner_id,
        owner_user_id = EXCLUDED.owner_user_id,
        region_id = EXCLUDED.region_id,
        stage_code = EXCLUDED.stage_code,
        raw_stage_name = EXCLUDED.raw_stage_name,
        status_code = EXCLUDED.status_code,
        expected_amount = EXCLUDED.expected_amount,
        extra_json = crm.opportunities.extra_json || EXCLUDED.extra_json,
        updated_at = now()
    RETURNING id::text AS id
    `,
    [
      商机编号,
      客户编号,
      报备.id,
      渠道.id,
      员工.id,
      区域编号,
      JSON.stringify({
        id: 商机编号,
        name: 商机名称,
        customer: 客户名称,
        customerName: 客户名称,
        partnerId: 渠道.partner_code,
        assignedPartnerId: 渠道.partner_code,
        partnerName: 渠道.partner_name,
        assignedStaffId: 员工.username,
        assignedStaffName: 员工.display_name,
        stage: "registered",
        region: `${批次}-测试区域`,
        amount: 1000,
      }),
    ],
  );
  const row = result.rows[0];
  if (!row) throw new Error("创建渠道范围测试商机失败。");
  return row;
}

async function 创建渠道范围测试报价和订单(
  pool: Pool,
  批次: string,
  客户名称: string,
  渠道: 渠道范围测试渠道,
  员工: 渠道范围测试用户,
  _区域名称 = "",
): Promise<{ 报价: 渠道范围测试业务记录; 订单: 渠道范围测试业务记录 }> {
  const 客户编号 = await 创建渠道范围测试客户(pool, 客户名称, 员工.id, 渠道.id);
  const 报价编号 = await 生成测试业务编号(pool, "quote", 员工.username);
  const 报价结果 = await pool.query<渠道范围测试业务记录>(
    `
    INSERT INTO crm.quotes (
      quote_no, customer_id, partner_id, owner_user_id, status_code,
      total_amount, discount_amount, extra_json
    )
    VALUES ($1, $2::uuid, $3::uuid, $4::uuid, 'approved', 12000, 0, $5::jsonb)
    ON CONFLICT (quote_no) DO UPDATE
    SET customer_id = EXCLUDED.customer_id,
        partner_id = EXCLUDED.partner_id,
        owner_user_id = EXCLUDED.owner_user_id,
        status_code = EXCLUDED.status_code,
        total_amount = EXCLUDED.total_amount,
        extra_json = crm.quotes.extra_json || EXCLUDED.extra_json,
        updated_at = now()
    RETURNING id::text AS id
    `,
    [
      报价编号,
      客户编号,
      渠道.id,
      员工.id,
      JSON.stringify({
        id: 报价编号,
        customer: 客户名称,
        customerName: 客户名称,
        partnerId: 渠道.partner_code,
        assignedPartnerId: 渠道.partner_code,
        partnerName: 渠道.partner_name,
        assignedStaffId: 员工.username,
        assignedStaffName: 员工.display_name,
        total: 12000,
      }),
    ],
  );
  const 报价行 = 报价结果.rows[0];
  const 报价 = 报价行 ? { ...报价行, 编号: 报价编号 } : undefined;
  if (!报价) throw new Error("创建渠道范围测试报价失败。");

  const 订单编号 = await 生成测试业务编号(pool, "order", 员工.username);
  const 订单结果 = await pool.query<渠道范围测试业务记录>(
    `
    INSERT INTO crm.orders (
      order_no, quote_id, customer_id, partner_id, owner_user_id,
      status_code, total_amount, extra_json
    )
    VALUES ($1, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'confirmed', 12000, $6::jsonb)
    ON CONFLICT (order_no) DO UPDATE
    SET quote_id = EXCLUDED.quote_id,
        customer_id = EXCLUDED.customer_id,
        partner_id = EXCLUDED.partner_id,
        owner_user_id = EXCLUDED.owner_user_id,
        status_code = EXCLUDED.status_code,
        total_amount = EXCLUDED.total_amount,
        extra_json = crm.orders.extra_json || EXCLUDED.extra_json,
        updated_at = now()
    RETURNING id::text AS id
    `,
    [
      订单编号,
      报价.id,
      客户编号,
      渠道.id,
      员工.id,
      JSON.stringify({
        id: 订单编号,
        customer: 客户名称,
        customerName: 客户名称,
        quoteId: 报价.id,
        partnerId: 渠道.partner_code,
        assignedPartnerId: 渠道.partner_code,
        partnerName: 渠道.partner_name,
        assignedStaffId: 员工.username,
        assignedStaffName: 员工.display_name,
        total: 12000,
      }),
    ],
  );
  const 订单行 = 订单结果.rows[0];
  const 订单 = 订单行 ? { ...订单行, 编号: 订单编号 } : undefined;
  if (!订单) throw new Error("创建渠道范围测试订单失败。");
  return { 报价, 订单 };
}

async function 创建渠道范围测试订单审批待办(
  pool: Pool,
  批次: string,
  订单: 渠道范围测试业务记录,
  渠道: 渠道范围测试渠道,
  员工: 渠道范围测试用户,
): Promise<void> {
  await pool.query(
    `
    INSERT INTO ops.approvals (
      v2_source_id, approval_type_code, target_type, target_id,
      applicant_user_id, applicant_partner_id, status_code, extra_json
    )
    VALUES ($1, 'order', 'order', $2::uuid, $3::uuid, $4::uuid, 'pending', $5::jsonb)
    ON CONFLICT (v2_source_id) DO UPDATE
    SET target_id = EXCLUDED.target_id,
        applicant_user_id = EXCLUDED.applicant_user_id,
        applicant_partner_id = EXCLUDED.applicant_partner_id,
        status_code = EXCLUDED.status_code,
        extra_json = ops.approvals.extra_json || EXCLUDED.extra_json,
        updated_at = now()
    `,
    [
      `${批次}-APPROVAL-${订单.编号}`,
      订单.id,
      员工.id,
      渠道.id,
      JSON.stringify({
        step: "region_confirm",
        stepName: "区管确认",
        targetName: 订单.编号,
        customerName: 订单.编号,
        targetPartnerName: 渠道.partner_name,
        status: "pending",
      }),
    ],
  );
}

async function 创建渠道范围测试客户(
  pool: Pool,
  客户名称: string,
  用户编号: string,
  渠道编号: string,
): Promise<string> {
  const result = await pool.query<{ id: string }>(
    `
    INSERT INTO crm.customers (
      customer_name, normalized_name, owner_user_id, owner_partner_id, status_code, extra_json
    )
    VALUES ($1, $2, $3::uuid, $4::uuid, 'active', $5::jsonb)
    ON CONFLICT (normalized_name) WHERE status_code <> 'merged'
    DO UPDATE SET
      customer_name = EXCLUDED.customer_name,
      owner_user_id = EXCLUDED.owner_user_id,
      owner_partner_id = EXCLUDED.owner_partner_id,
      extra_json = crm.customers.extra_json || EXCLUDED.extra_json,
      updated_at = now()
    RETURNING id::text AS id
    `,
    [
      客户名称,
      归一化渠道范围测试名称(客户名称),
      用户编号,
      渠道编号,
      JSON.stringify({ customer: 客户名称, customerName: 客户名称 }),
    ],
  );
  const row = result.rows[0];
  if (!row) throw new Error("创建渠道范围测试客户失败。");
  return row.id;
}

function 归一化渠道范围测试名称(value: string): string {
  return value.toLowerCase().replace(/\s+/g, "");
}

function 签发测试V2令牌(username: string): string {
  return `Bearer v2.${Buffer.from(username, "utf8").toString("base64url")}.test`;
}

async function 插入既往客户搜索样本(pool: Pool, 客户名称: string): Promise<void> {
  await pool.query(
    `
    INSERT INTO crm.customers (customer_name, normalized_name, credit_code, status_code, extra_json)
    VALUES ($1, $2, $3, 'active', $4::jsonb)
    ON CONFLICT (normalized_name) WHERE status_code <> 'merged'
    DO UPDATE SET
      customer_name = EXCLUDED.customer_name,
      credit_code = EXCLUDED.credit_code,
      extra_json = crm.customers.extra_json || EXCLUDED.extra_json,
      updated_at = now()
    `,
    [
      客户名称,
      归一化渠道范围测试名称(客户名称),
      "91310000KB003KNOWN",
      JSON.stringify({
        knownCustomer: true,
        customer: 客户名称,
        customerName: 客户名称,
        creditCode: "91310000KB003KNOWN",
        legalPerson: "既往客户法人",
        address: "深圳市南山区既往客户园区",
        companyStatus: "在营",
        industry: "金融",
        city: "深圳市",
      }),
    ],
  );
}
