import { 创建测试环境变量 } from "@lianruan/testing";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { 创建应用 } from "../src/index.js";

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
    const 用户列表 = await request(app).get("/api/users?pageSize=1").expect(200);
    const 迁移用户 = 用户列表.body.data.数据[0] as { 负责人: string; 标题: string };
    expect(迁移用户?.负责人).toBeTruthy();

    const agent = request.agent(app);
    const 登录 = await agent
      .post("/api/auth/login")
      .send({ username: 迁移用户.负责人, password: "LrCRM@2026!" })
      .expect(200);
    expect(登录.body.data.user.username).toBe(迁移用户.负责人);
    expect(登录.body.data.user.displayName).toBeTruthy();

    const 当前用户 = await agent.get("/api/auth/me").expect(200);
    expect(当前用户.body.data.user.username).toBe(迁移用户.负责人);
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

    const 已审核列表 = await request(app)
      .get("/api/stage9/approvals?status=approved&pageSize=20")
      .expect(200);
    expect(
      已审核列表.body.data.数据.some(
        (项: { 客户名称: string; 状态: string }) =>
          项.客户名称 === "阶段9自动化验收客户" && 项.状态 === "approved",
      ),
    ).toBe(true);

    const 商机 = await request(app)
      .post("/api/opportunities")
      .send({
        registrationId: 报备.body.data.id,
        name: "阶段9自动化验收商机",
        amount: 88000,
      })
      .expect(200);
    expect(商机.body.data.客户名称).toBe("阶段9自动化验收客户");

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
    expect(订单.body.data.状态).toBe("pending_primary_confirm");

    const 一级确认 = await request(app)
      .put(`/api/orders/${订单.body.data.id}/primary-confirm`)
      .send({ reason: "阶段9自动化一级确认" })
      .expect(200);
    expect(一级确认.body.data.状态).toBe("confirmed");
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
