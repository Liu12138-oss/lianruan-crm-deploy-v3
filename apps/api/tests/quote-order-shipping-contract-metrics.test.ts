import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

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

if (!测试环境变量.DATABASE_URL) {
  throw new Error("双报价与订单履约测试必须配置 PostgreSQL DATABASE_URL，禁止回退内存模式。");
}

const 连接池 = new Pool({ connectionString: 测试环境变量.DATABASE_URL });
const 测试批次 = `QOS-${Date.now()}-${randomUUID().slice(0, 8)}`;
const 测试用户名前缀 = 测试批次.toLowerCase().replace(/[^a-z0-9-]/g, "-");
const 已创建订单编号: string[] = [];
const 已创建用户编号: string[] = [];
const 已创建渠道编号: string[] = [];
const 已创建客户编号: string[] = [];
const 已创建商机编号: string[] = [];
const 已创建报价编号: string[] = [];
const 已创建产品编号: string[] = [];
let 上传目录 = "";
let 原上传目录: string | undefined;

type 测试账户 = { id: string; username: string };
type 测试渠道 = { id: string; name: string; level: "primary" | "secondary" | "none" };

describe("双报价体系与转单履约接口", () => {
  let 应用: ReturnType<typeof 创建应用>;
  let 超级管理员: request.Agent;
  let 区域管理员: request.Agent;
  let 渠道管理员: request.Agent;
  let 区域编号 = "";
  let 一级渠道: 测试渠道;
  let 二级渠道: 测试渠道;
  let 功能编号 = "";
  let 标准商机编号 = "";
  let 渠道商机编号 = "";
  let 二级商机编号 = "";
  let 标准报价编号 = "";
  let 标准订单编号 = "";
  let 待取消报价编号 = "";
  let 待取消订单编号 = "";
  const 目标年度 = new Date().getFullYear();

  beforeAll(async () => {
    await 清理测试数据();
    上传目录 = await mkdtemp(path.join(os.tmpdir(), "lianruan-qos-"));
    原上传目录 = process.env.V3_UPLOAD_DIR;
    process.env.V3_UPLOAD_DIR = 上传目录;
    测试环境变量.V3_UPLOAD_DIR = 上传目录;
    应用 = 创建应用({ env: 测试环境变量 });
    超级管理员 = request.agent(应用);
    区域管理员 = request.agent(应用);
    渠道管理员 = request.agent(应用);

    await 登录(超级管理员, "liulonghai");

    const 区域结果 = await 连接池.query<{ id: string }>(
      `INSERT INTO org.regions(region_code,region_name,region_level,status_code)
       VALUES($1,$2,'region','active') RETURNING id::text AS id`,
      [`${测试批次}-REGION`, `${测试批次}-区域`],
    );
    区域编号 = 区域结果.rows[0]?.id || "";
    一级渠道 = await 创建渠道("一级分销", "primary");
    二级渠道 = await 创建渠道("二级分销", "secondary");
    await 连接池.query(
      `INSERT INTO channel.partner_relations(parent_partner_id,child_partner_id,relation_code)
       VALUES($1::uuid,$2::uuid,'primary_secondary')`,
      [一级渠道.id, 二级渠道.id],
    );

    const 超级管理员账号 = await 查询用户编号("liulonghai");
    const 区管账号 = await 创建账户("region_manager", "区域管理员", "region_manager", "region");
    const 渠道账号 = await 创建账户("partner_admin", "渠道管理员", "partner_admin", "partner");
    await 绑定渠道成员(一级渠道.id, 渠道账号.id, "partner_admin");
    区域管理员 = await 登录代理(区管账号.username);
    渠道管理员 = await 登录代理(渠道账号.username);

    功能编号 = await 创建测试功能();
    标准商机编号 = await 创建商机(
      一级渠道,
      渠道账号.id,
      `${测试批次}-标准商机`,
      `${测试批次}-标准客户`,
    );
    渠道商机编号 = await 创建商机(
      一级渠道,
      渠道账号.id,
      `${测试批次}-渠道商机`,
      `${测试批次}-渠道客户`,
    );
    二级商机编号 = await 创建商机(
      二级渠道,
      超级管理员账号,
      `${测试批次}-二级商机`,
      `${测试批次}-二级客户`,
    );
  });

  afterAll(async () => {
    await 清理测试数据();
    if (原上传目录 === undefined) delete process.env.V3_UPLOAD_DIR;
    else process.env.V3_UPLOAD_DIR = 原上传目录;
    if (上传目录) await rm(上传目录, { recursive: true, force: true });
    await 连接池.end();
  });

  it("标准产品报价在创建、列表、详情、试算和收益接口均不返回价格", async () => {
    const 创建 = await 渠道管理员
      .post("/api/quotes")
      .send({
        oppId: 标准商机编号,
        endpoints: 10,
        products: [功能编号],
        quoteTypeCode: "standard",
        testTag: 测试批次,
      })
      .expect(200);
    标准报价编号 = String(创建.body.data.id);
    已创建报价编号.push(标准报价编号);
    expect(创建.body.data.金额).toBe(0);
    expect(创建.body.data.原始数据.priceVisible).toBe(false);
    expect(价格字段(创建.body.data)).toEqual([]);

    const 详情 = await 渠道管理员.get(`/api/quotes/${标准报价编号}`).expect(200);
    expect(详情.body.data.金额).toBe(0);
    expect(详情.body.data.原始数据.quoteTypeCode).toBe("standard");
    expect(价格字段(详情.body.data)).toEqual([]);

    const 列表 = await 渠道管理员
      .get(`/api/quotes?keyword=${encodeURIComponent(`${测试批次}-标准客户`)}&pageSize=20`)
      .expect(200);
    const 列表记录 = 列表.body.data.数据 as Array<{ id: string }>;
    expect(列表记录.some((记录) => 记录.id === 标准报价编号)).toBe(true);
    for (const 记录 of 列表记录) {
      if (记录.id === 标准报价编号) expect(价格字段(记录)).toEqual([]);
    }

    const 试算 = await 渠道管理员
      .post("/api/quotes/workload-preview")
      .send({ endpoints: 10, products: [功能编号], quoteTypeCode: "standard" })
      .expect(200);
    expect(试算.body.data.total).toBe(0);
    expect(试算.body.data.priceVisible).toBe(false);
    expect(价格字段(试算.body.data)).toEqual([]);

    const IPG试算 = await 渠道管理员
      .post("/api/v2/ipg/quote-preview")
      .send({
        endpoints: 10,
        featureIds: [功能编号],
        quoteTypeCode: "standard",
        lianruanTotal: 1000,
      })
      .expect(200);
    expect(IPG试算.body.data.priceVisible).toBe(false);
    expect(IPG试算.body.data).not.toHaveProperty("ipgReferenceTotal");
    expect(IPG试算.body.data).not.toHaveProperty("lianruanTotal");
    expect(IPG试算.body.data).not.toHaveProperty("difference");
    expect(价格字段(IPG试算.body.data)).toEqual([]);

    const 渠道收益 = await 渠道管理员
      .get(`/api/quotes/${标准报价编号}/profit-calculation`)
      .expect(403);
    expect(渠道收益.body.error.code).toBe("V3_QUOTE_PROFIT_ROLE_DENIED");

    const 内部收益 = await 超级管理员
      .get(`/api/quotes/${标准报价编号}/profit-calculation`)
      .expect(409);
    expect(内部收益.body.error.code).toBe("V3_STANDARD_QUOTE_PROFIT_HIDDEN");
  });

  it("标准报价创建后类型不可切换，且渠道分销报价仍展示服务端取价", async () => {
    const 报价 = await 渠道管理员.get(`/api/quotes/${标准报价编号}`).expect(200);
    const 版本 = Number(报价.body.data.原始数据.rowVersion);
    const 切换类型 = await 渠道管理员
      .put(`/api/quotes/${标准报价编号}`)
      .send({
        rowVersion: 版本,
        quoteTypeCode: "channel_distribution",
        endpoints: 10,
        products: [功能编号],
      })
      .expect(409);
    expect(切换类型.body.error.code).toBe("V3_QUOTE_TYPE_IMMUTABLE");

    const 创建渠道报价 = await 渠道管理员
      .post("/api/quotes")
      .send({
        oppId: 渠道商机编号,
        endpoints: 10,
        products: [功能编号],
        quoteTypeCode: "channel_distribution",
        testTag: 测试批次,
      })
      .expect(200);
    已创建报价编号.push(String(创建渠道报价.body.data.id));
    expect(创建渠道报价.body.data.原始数据.quoteTypeCode).toBe("channel_distribution");
    expect(创建渠道报价.body.data.原始数据.priceVisible).toBe(true);
    expect(Number(创建渠道报价.body.data.金额)).toBeGreaterThan(0);
    expect(创建渠道报价.body.data.原始数据.pricingVersion).toMatch(/^PRICE-[A-F0-9]{12}$/);
    expect(创建渠道报价.body.data.原始数据.pricingCapturedAt).toBeTruthy();
    expect(创建渠道报价.body.data.原始数据.pricingSnapshot.items[0].ruleVersion).toMatch(
      /^PRICE-[A-F0-9]{12}$/,
    );
    expect(创建渠道报价.body.data.原始数据.pricingSnapshot.hitRules.length).toBeGreaterThan(0);
  });

  it("报价免审批，草稿及历史提交/通过/驳回状态可直接转单，关闭状态禁止转单", async () => {
    const 创建报价 = async (): Promise<string> => {
      const 结果 = await 渠道管理员
        .post("/api/quotes")
        .send({
          oppId: 渠道商机编号,
          endpoints: 10,
          products: [功能编号],
          quoteTypeCode: "channel_distribution",
          testTag: 测试批次,
        })
        .expect(200);
      const 编号 = String(结果.body.data.id);
      已创建报价编号.push(编号);
      return 编号;
    };
    const 转订单 = async (报价编号: string, 收货人: string) => {
      const 结果 = await 渠道管理员
        .post("/api/orders/from-quote")
        .field("quoteId", 报价编号)
        .field("recipientName", 收货人)
        .field("recipientPhone", "13800138000")
        .field("deliveryAddress", "上海市浦东新区测试路1号")
        .field("shipmentAmount", "800")
        .attach("contractFiles", 生成最小PDF(), `${收货人}-合同.pdf`);
      if (结果.status === 200) 已创建订单编号.push(String(结果.body.data.id));
      return 结果;
    };

    const 草稿报价 = await 创建报价();
    const 草稿详情 = await 渠道管理员.get(`/api/quotes/${草稿报价}`).expect(200);
    const 草稿订单 = await 转订单(草稿报价, "草稿收货人");
    expect(草稿订单.status).toBe(200);
    expect(草稿订单.body.data.原始数据.pricingVersion).toBe(
      草稿详情.body.data.原始数据.pricingVersion,
    );
    expect(草稿订单.body.data.原始数据.pricingCapturedAt).toBe(
      草稿详情.body.data.原始数据.pricingCapturedAt,
    );

    for (const [状态, 收货人] of [
      ["submitted", "历史提交收货人"],
      ["approved", "历史通过收货人"],
      ["rejected", "历史驳回收货人"],
    ] as const) {
      const 历史报价 = await 创建报价();
      await 连接池.query(`UPDATE crm.quotes SET status_code = $2 WHERE id = $1::uuid`, [
        历史报价,
        状态,
      ]);
      const 历史订单 = await 转订单(历史报价, 收货人);
      expect(历史订单.status, `${状态} 报价应可直接转单`).toBe(200);
    }

    const 关闭报价 = await 创建报价();
    await 连接池.query(`UPDATE crm.quotes SET status_code = 'cancelled' WHERE id = $1::uuid`, [
      关闭报价,
    ]);
    const 关闭订单 = await 转订单(关闭报价, "已取消收货人");
    expect(关闭订单.status, "已取消报价不能转单").toBe(409);
    expect(关闭订单.body.error.code).toBe("V3_QUOTE_STATUS_INVALID");
  });

  it("一级渠道转标准报价订单必须带收货、出货金额和合同附件", async () => {
    const 缺少出货金额 = await 渠道管理员
      .post("/api/orders/from-quote")
      .field("quoteId", 标准报价编号)
      .field("recipientName", "张三")
      .field("recipientPhone", "13800138000")
      .field("deliveryAddress", "上海市浦东新区测试路1号")
      .expect(400);
    expect(缺少出货金额.body.error.code).toBe("V3_ORDER_SHIPMENT_AMOUNT_REQUIRED");

    const 缺少附件 = await 渠道管理员
      .post("/api/orders/from-quote")
      .field("quoteId", 标准报价编号)
      .field("recipientName", "张三")
      .field("recipientPhone", "13800138000")
      .field("deliveryAddress", "上海市浦东新区测试路1号")
      .field("shipmentAmount", "800")
      .expect(400);
    expect(缺少附件.body.error.code).toBe("V3_ORDER_CONTRACT_ATTACHMENT_REQUIRED");

    const 成功 = await 渠道管理员
      .post("/api/orders/from-quote")
      .field("quoteId", 标准报价编号)
      .field("recipientName", "张三")
      .field("recipientPhone", "13800138000")
      .field("deliveryAddress", "上海市浦东新区测试路1号")
      .field("shipmentAmount", "800")
      .attach("contractFiles", 生成最小PDF(), "合同.pdf")
      .expect(200);
    标准订单编号 = String(成功.body.data.id);
    已创建订单编号.push(标准订单编号);
    expect(成功.body.data.状态).toBe("primary_confirmed");
    expect(成功.body.data.原始数据.quoteTypeCode).toBe("standard");
    expect(成功.body.data.原始数据.pricingStatus).toBe("pending_region_price");
    expect(成功.body.data.原始数据.priceVisible).toBe(false);
    expect(成功.body.data.金额).toBe(0);
    expect(成功.body.data.原始数据.contractAttachments).toHaveLength(1);
    expect(价格字段(成功.body.data.原始数据)).toEqual([]);

    const 待定价详情 = await 超级管理员.get(`/api/orders/${标准订单编号}`).expect(200);
    expect(待定价详情.body.data.原始数据.pricingStatusName).toBe("待区管定价");
    expect(价格字段(待定价详情.body.data.原始数据)).toEqual([]);
  });

  it("区管必须先补大于零的订单价格，补价后价格对比与渠道利润按角色返回", async () => {
    const 未补价确认 = await 区域管理员
      .put(`/api/orders/${标准订单编号}/status`)
      .send({ action: "region_confirm", status: "pending_superadmin_confirm", reason: "未补价" })
      .expect(409);
    expect(未补价确认.body.error.code).toBe("V3_ORDER_REGION_PRICE_REQUIRED");

    const 零价格 = await 区域管理员
      .put(`/api/orders/${标准订单编号}/status`)
      .send({ action: "price_adjust", status: "pending_superadmin_confirm", newAmount: 0 })
      .expect(400);
    expect(零价格.body.error.code).toBe("V3_ORDER_REGION_PRICE_REQUIRED");

    const 补价 = await 区域管理员
      .put(`/api/orders/${标准订单编号}/status`)
      .send({
        action: "price_adjust",
        status: "pending_superadmin_confirm",
        newAmount: 1000,
        reason: "区管补价",
      })
      .expect(200);
    expect(补价.body.data.状态).toBe("pending_superadmin_confirm");
    expect(补价.body.data.原始数据.pricingStatus).toBe("priced");
    expect(Number(补价.body.data.原始数据.originalAmount)).toBeGreaterThan(0);
    expect(Number(补价.body.data.原始数据.channelOrderAmount)).toBe(1000);
    expect(Number(补价.body.data.原始数据.shipmentAmount)).toBe(800);

    const 渠道查看 = await 渠道管理员.get(`/api/orders/${标准订单编号}`).expect(200);
    expect(渠道查看.body.data.原始数据.originalAmount).toBeGreaterThan(0);
    expect(渠道查看.body.data.原始数据.channelOrderAmount).toBe(1000);
    expect(渠道查看.body.data.原始数据.shipmentAmount).toBe(800);
    expect(渠道查看.body.data.原始数据).not.toHaveProperty("channelProfit");
    expect(渠道查看.body.data.原始数据).not.toHaveProperty("channelProfitMargin");

    const 内部查看 = await 超级管理员.get(`/api/orders/${标准订单编号}`).expect(200);
    expect(内部查看.body.data.原始数据.channelProfit).toBe(-200);
    expect(内部查看.body.data.原始数据.shipmentToOrderRatio).toBe(80);
  });

  it("二级渠道转单不强制出货金额与合同附件", async () => {
    const 报价 = await 超级管理员
      .post("/api/quotes")
      .send({
        oppId: 二级商机编号,
        endpoints: 10,
        products: [功能编号],
        quoteTypeCode: "channel_distribution",
        testTag: 测试批次,
      })
      .expect(200);
    const 报价编号 = String(报价.body.data.id);
    已创建报价编号.push(报价编号);
    const 订单 = await 超级管理员
      .post("/api/orders/from-quote")
      .field("quoteId", 报价编号)
      .field("recipientName", "李四")
      .field("recipientPhone", "13900139000")
      .field("deliveryAddress", "北京市朝阳区测试路2号")
      .expect(200);
    已创建订单编号.push(String(订单.body.data.id));
    expect(订单.body.data.状态).toBe("pending_primary_confirm");
    expect(订单.body.data.原始数据.shipmentAmount ?? null).toBeNull();
    expect(订单.body.data.原始数据.contractAttachments).toEqual([]);
  });

  it("合同附件拒绝伪造格式、非法内容和越权下载", async () => {
    const 报价 = await 超级管理员
      .post("/api/quotes")
      .send({
        oppId: 渠道商机编号,
        endpoints: 10,
        products: [功能编号],
        quoteTypeCode: "channel_distribution",
        testTag: 测试批次,
      })
      .expect(200);
    const 报价编号 = String(报价.body.data.id);
    已创建报价编号.push(报价编号);

    const 非法扩展名 = await 超级管理员
      .post("/api/orders/from-quote")
      .field("quoteId", 报价编号)
      .field("recipientName", "王五")
      .field("recipientPhone", "13700137000")
      .field("deliveryAddress", "深圳市南山区测试路3号")
      .field("shipmentAmount", "500")
      .attach("contractFiles", Buffer.from("executable"), "合同.exe")
      .expect(400);
    expect(非法扩展名.body.error.code).toBe("V3_ORDER_ATTACHMENT_TYPE_INVALID");

    const 伪造内容 = await 超级管理员
      .post("/api/orders/from-quote")
      .field("quoteId", 报价编号)
      .field("recipientName", "王五")
      .field("recipientPhone", "13700137000")
      .field("deliveryAddress", "深圳市南山区测试路3号")
      .field("shipmentAmount", "500")
      .attach("contractFiles", Buffer.from("not a pdf"), "合同.pdf")
      .expect(400);
    expect(伪造内容.body.error.code).toBe("V3_ORDER_ATTACHMENT_CONTENT_INVALID");

    const 正常转单 = await 超级管理员
      .post("/api/orders/from-quote")
      .field("quoteId", 报价编号)
      .field("recipientName", "王五")
      .field("recipientPhone", "13700137000")
      .field("deliveryAddress", "深圳市南山区测试路3号")
      .field("shipmentAmount", "500")
      .attach("contractFiles", 生成最小PDF(), "合同.pdf")
      .expect(200);
    const 订单编号 = String(正常转单.body.data.id);
    已创建订单编号.push(订单编号);
    const 附件 = await 渠道管理员.get(`/api/orders/${订单编号}/contract-attachments`).expect(200);
    expect(附件.body.data).toHaveLength(1);

    const 其他渠道用户 = await 创建账户("other_channel", "其他渠道用户", "staff", "self");
    const 其他渠道 = await 创建渠道("其他渠道", "none");
    await 绑定渠道成员(其他渠道.id, 其他渠道用户.id, "staff");
    const 其他渠道代理 = await 登录代理(其他渠道用户.username);
    const 越权下载 = await 其他渠道代理
      .get(`/api/orders/${订单编号}/contract-attachments`)
      .expect(404);
    expect(越权下载.body.success).toBe(false);
  });

  it("渠道创建人可以取消未确认订单，取消后关闭待办、通知并保留报价已转订单", async () => {
    const 报价 = await 渠道管理员
      .post("/api/quotes")
      .send({
        oppId: 渠道商机编号,
        endpoints: 10,
        products: [功能编号],
        quoteTypeCode: "channel_distribution",
        testTag: 测试批次,
      })
      .expect(200);
    待取消报价编号 = String(报价.body.data.id);
    已创建报价编号.push(待取消报价编号);
    const 订单 = await 渠道管理员
      .post("/api/orders/from-quote")
      .field("quoteId", 待取消报价编号)
      .field("recipientName", "赵六")
      .field("recipientPhone", "13600136000")
      .field("deliveryAddress", "广州市天河区测试路4号")
      .field("shipmentAmount", "700")
      .attach("contractFiles", 生成最小PDF(), "取消测试合同.pdf")
      .expect(200);
    待取消订单编号 = String(订单.body.data.id);
    已创建订单编号.push(待取消订单编号);

    const 缺原因 = await 渠道管理员
      .put(`/api/orders/${待取消订单编号}/status`)
      .send({ status: "cancelled" })
      .expect(400);
    expect(缺原因.body.error.code).toBe("V3_ORDER_CANCEL_REASON_REQUIRED");

    const 取消 = await 渠道管理员
      .put(`/api/orders/${待取消订单编号}/status`)
      .send({ status: "cancelled", reason: "客户项目取消" })
      .expect(200);
    expect(取消.body.data.状态).toBe("cancelled");

    const 待办 = await 连接池.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM ops.approvals
       WHERE target_type='order' AND target_id=$1::uuid AND status_code='pending'`,
      [待取消订单编号],
    );
    expect(Number(待办.rows[0]?.total)).toBe(0);
    const 通知 = await 连接池.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM ops.notifications
       WHERE extra_json->>'orderId'=$1 AND title LIKE '订单已取消%'`,
      [待取消订单编号],
    );
    expect(Number(通知.rows[0]?.total)).toBe(1);
    const 审计 = await 连接池.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM audit.audit_logs
       WHERE target_type='order' AND target_id=$1 AND action_code='cancel'`,
      [待取消订单编号],
    );
    expect(Number(审计.rows[0]?.total)).toBeGreaterThan(0);
    const 报价状态 = await 连接池.query<{ status_code: string }>(
      `SELECT status_code FROM crm.quotes WHERE id=$1::uuid`,
      [待取消报价编号],
    );
    expect(报价状态.rows[0]?.status_code).toBe("converted");

    const 重复转单 = await 渠道管理员
      .post("/api/orders/from-quote")
      .field("quoteId", 待取消报价编号)
      .field("recipientName", "赵六")
      .field("recipientPhone", "13600136000")
      .field("deliveryAddress", "广州市天河区测试路4号")
      .field("shipmentAmount", "700")
      .attach("contractFiles", 生成最小PDF(), "重复合同.pdf")
      .expect(409);
    expect(重复转单.body.error.code).toBe("V3_QUOTE_ALREADY_CONVERTED");
  });

  it("渠道年度订单目标区分人工目标与系统实际完成金额，并按角色控制维护权限", async () => {
    const 渠道读取 = await 渠道管理员
      .get(`/api/v2/partners/${一级渠道.id}/order-target?year=${目标年度}`)
      .expect(200);
    expect(渠道读取.body.data.year).toBe(目标年度);
    expect(渠道读取.body.data.canEdit).toBe(false);

    const 渠道写入 = await 渠道管理员
      .put(`/api/v2/partners/${一级渠道.id}/order-target`)
      .send({ year: 目标年度, targetAmount: 1000000 })
      .expect(403);
    expect(渠道写入.body.error.code).toBeTruthy();

    const 区管写入 = await 区域管理员
      .put(`/api/v2/partners/${一级渠道.id}/order-target`)
      .send({ year: 目标年度, targetAmount: 1200000, remark: "年度目标" })
      .expect(200);
    expect(区管写入.body.data.targetAmount).toBe(1200000);
    expect(区管写入.body.data.actualOrderAmount).toBeGreaterThanOrEqual(0);

    const 读取 = await 区域管理员
      .get(`/api/v2/partners/${一级渠道.id}/order-target?year=${目标年度}`)
      .expect(200);
    expect(读取.body.data.targetAmount).toBe(1200000);
    expect(读取.body.data.canEdit).toBe(true);
    const 审计 = await 连接池.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM audit.audit_logs
       WHERE module_code='channel' AND action_code='partner.order_target.update' AND target_name LIKE $1`,
      [`%${一级渠道.name}%`],
    );
    expect(Number(审计.rows[0]?.total)).toBeGreaterThan(0);
  });

  async function 登录代理(username: string): Promise<request.Agent> {
    const 代理 = request.agent(应用);
    await 登录(代理, username);
    return 代理;
  }

  async function 登录(代理: request.Agent, username: string): Promise<void> {
    await 代理.post("/api/auth/login").send({ username, password: "LrCRM@2026!" }).expect(200);
  }

  async function 查询用户编号(username: string): Promise<string> {
    const 结果 = await 连接池.query<{ id: string }>(
      `SELECT id::text AS id FROM iam.users WHERE username=$1::citext LIMIT 1`,
      [username],
    );
    if (!结果.rows[0]?.id) throw new Error(`测试库缺少账号 ${username}`);
    return 结果.rows[0].id;
  }

  async function 创建账户(
    后缀: string,
    显示名: string,
    角色编码: string,
    数据范围: string,
  ): Promise<测试账户> {
    const username = `${测试用户名前缀}-${后缀}`;
    const 结果 = await 连接池.query<{ id: string }>(
      `INSERT INTO iam.users(username,display_name,status_code,region_id,extra_json)
       VALUES($1::citext,$2,'active',$3::uuid,$4::jsonb)
       RETURNING id::text AS id`,
      [
        username,
        显示名,
        区域编号,
        JSON.stringify({ id: username, userId: username, role: 角色编码, name: 显示名 }),
      ],
    );
    const id = 结果.rows[0]?.id;
    if (!id) throw new Error(`创建测试账号 ${username} 失败。`);
    已创建用户编号.push(id);
    await 连接池.query(
      `INSERT INTO iam.password_credentials(user_id,password_hash,algorithm,must_change_password)
       VALUES($1::uuid,$2,'scrypt',false)`,
      [id, 创建密码散列("LrCRM@2026!")],
    );
    await 连接池.query(
      `INSERT INTO iam.user_roles(user_id,role_id)
       SELECT $1::uuid,id FROM iam.roles WHERE role_code=$2`,
      [id, 角色编码],
    );
    await 连接池.query(
      `INSERT INTO org.staff_profiles(user_id,employee_no,title,data_scope_code,extra_json)
       VALUES($1::uuid,$2,$3,$4,$5::jsonb)`,
      [id, username, 显示名, 数据范围, JSON.stringify({ role: 角色编码, dataScopeCode: 数据范围 })],
    );
    return { id, username };
  }

  async function 创建渠道(
    名称: string,
    level: "primary" | "secondary" | "none",
  ): Promise<测试渠道> {
    const 名称全称 = `${测试批次}-${名称}-${randomUUID().slice(0, 4)}`;
    const 结果 = await 连接池.query<{ id: string }>(
      `INSERT INTO channel.partners(
         partner_code,partner_name,normalized_name,partner_level_code,region_id,status_code,
         contact_name,contact_phone,city_name,agreement_no,country_calling_code,extra_json
       ) VALUES($1,$2,$2,$3,$4::uuid,'active','测试联系人','13800138000','上海市',$6,$7,$5::jsonb)
       RETURNING id::text AS id`,
      [
        `${测试批次}-${名称}`,
        名称全称,
        level,
        区域编号,
        JSON.stringify({ testTag: 测试批次, partnerLevel: level }),
        `${测试批次}-AG-${level}`,
        "021",
      ],
    );
    const id = 结果.rows[0]?.id;
    if (!id) throw new Error(`创建测试渠道 ${名称} 失败。`);
    已创建渠道编号.push(id);
    return { id, name: 名称全称, level };
  }

  async function 绑定渠道成员(
    渠道编号: string,
    用户编号: string,
    role: "partner_admin" | "staff",
  ): Promise<void> {
    await 连接池.query(
      `INSERT INTO channel.partner_members(partner_id,user_id,member_role_code,status_code)
       VALUES($1::uuid,$2::uuid,$3,'active')`,
      [渠道编号, 用户编号, role],
    );
  }

  async function 创建测试功能(): Promise<string> {
    const 分类 = await 连接池.query<{ id: string }>(
      `INSERT INTO catalog.product_categories(category_code,category_name,product_type_code,status_code)
       VALUES($1,$2,'software','active') RETURNING id::text AS id`,
      [`${测试批次}-CAT`, `${测试批次}-分类`],
    );
    const 分类编号 = 分类.rows[0]?.id;
    if (!分类编号) throw new Error("创建测试产品分类失败。");
    const 模块 = await 连接池.query<{ id: string }>(
      `INSERT INTO catalog.product_modules(category_id,module_code,module_name,status_code)
       VALUES($1::uuid,$2,$3,'active') RETURNING id::text AS id`,
      [分类编号, `${测试批次}-MOD`, `${测试批次}-模块`],
    );
    const 模块编号 = 模块.rows[0]?.id;
    if (!模块编号) throw new Error("创建测试产品模块失败。");
    const 功能 = await 连接池.query<{ id: string }>(
      `INSERT INTO catalog.product_features(
         module_id,feature_code,feature_name,unit_name,list_price,published,status_code,extra_json
       ) VALUES($1::uuid,$2,$3,'点',5000,true,'active',$4::jsonb)
       RETURNING id::text AS id`,
      [模块编号, `${测试批次}-FEATURE`, `${测试批次}-功能`, JSON.stringify({ testTag: 测试批次 })],
    );
    const 功能编号值 = 功能.rows[0]?.id;
    if (!功能编号值) throw new Error("创建测试产品功能失败。");
    已创建产品编号.push(功能编号值);
    return 功能编号值;
  }

  async function 创建商机(
    渠道: 测试渠道,
    所有者编号: string,
    商机名称: string,
    客户名称: string,
  ): Promise<string> {
    const 客户 = await 连接池.query<{ id: string }>(
      `INSERT INTO crm.customers(customer_name,normalized_name,region_id,owner_user_id,owner_partner_id,status_code,extra_json)
       VALUES($1,$1,$2::uuid,$3::uuid,$4::uuid,'active',$5::jsonb)
       RETURNING id::text AS id`,
      [客户名称, 区域编号, 所有者编号, 渠道.id, JSON.stringify({ testTag: 测试批次 })],
    );
    const 客户编号 = 客户.rows[0]?.id;
    if (!客户编号) throw new Error("创建测试客户失败。");
    已创建客户编号.push(客户编号);
    const 商机 = await 连接池.query<{ id: string }>(
      `INSERT INTO crm.opportunities(
         opportunity_no,customer_id,partner_id,owner_user_id,region_id,stage_code,status_code,business_type_code,extra_json
       ) VALUES($1,$2::uuid,$3::uuid,$4::uuid,$5::uuid,'proposal','active','product',$6::jsonb)
       RETURNING id::text AS id`,
      [商机名称, 客户编号, 渠道.id, 所有者编号, 区域编号, JSON.stringify({ testTag: 测试批次 })],
    );
    const 商机编号值 = 商机.rows[0]?.id;
    if (!商机编号值) throw new Error("创建测试商机失败。");
    已创建商机编号.push(商机编号值);
    return 商机编号值;
  }

  async function 清理测试数据(): Promise<void> {
    const 已知订单 = 已创建订单编号.length
      ? 已创建订单编号
      : ["00000000-0000-0000-0000-000000000000"];
    const 用户 = 已创建用户编号.length ? 已创建用户编号 : ["00000000-0000-0000-0000-000000000000"];
    const 渠道 = 已创建渠道编号.length ? 已创建渠道编号 : ["00000000-0000-0000-0000-000000000000"];
    const 客户 = 已创建客户编号.length ? 已创建客户编号 : ["00000000-0000-0000-0000-000000000000"];
    const 商机 = 已创建商机编号.length ? 已创建商机编号 : ["00000000-0000-0000-0000-000000000000"];
    const 已知报价 = 已创建报价编号.length
      ? 已创建报价编号
      : ["00000000-0000-0000-0000-000000000000"];
    const 产品 = 已创建产品编号.length ? 已创建产品编号 : ["00000000-0000-0000-0000-000000000000"];
    const 报价结果 = await 连接池.query<{ id: string }>(
      `SELECT id::text AS id FROM crm.quotes
       WHERE id=ANY($1::uuid[]) OR extra_json->>'testTag'=$2`,
      [已知报价, 测试批次],
    );
    const 报价 = 报价结果.rows.map((项) => 项.id);
    const 订单结果 = await 连接池.query<{ id: string }>(
      `SELECT id::text AS id FROM crm.orders
       WHERE id=ANY($1::uuid[]) OR quote_id=ANY($2::uuid[])`,
      [已知订单, 报价],
    );
    const 订单 = 订单结果.rows.map((项) => 项.id);

    await 连接池.query(
      `DELETE FROM ops.approval_events WHERE approval_id IN (
         SELECT id FROM ops.approvals WHERE target_type='order' AND target_id=ANY($1::uuid[])
       )`,
      [订单],
    );
    await 连接池.query(
      `DELETE FROM ops.approvals WHERE target_type='order' AND target_id=ANY($1::uuid[])`,
      [订单],
    );
    await 连接池
      .query(
        `DELETE FROM integration.order_preapproval_invocations WHERE request_id IN (
         SELECT id FROM integration.order_preapproval_requests WHERE order_id=ANY($1::uuid[])
       )`,
        [订单],
      )
      .catch(() => undefined);
    await 连接池
      .query(`DELETE FROM integration.order_preapproval_requests WHERE order_id=ANY($1::uuid[])`, [
        订单,
      ])
      .catch(() => undefined);
    await 连接池
      .query(`DELETE FROM integration.order_preapproval_groups WHERE group_key LIKE $1`, [
        `%${测试批次}%`,
      ])
      .catch(() => undefined);
    await 连接池
      .query(
        `DELETE FROM ops.outbox_events WHERE aggregate_id=ANY($1::uuid[]) OR payload_json->>'orderId'=ANY($2::text[])`,
        [订单, 订单],
      )
      .catch(() => undefined);
    await 连接池.query(
      `DELETE FROM crm.order_contract_attachments WHERE order_id=ANY($1::uuid[])`,
      [订单],
    );
    await 连接池.query(`DELETE FROM crm.order_items WHERE order_id=ANY($1::uuid[])`, [订单]);
    await 连接池.query(`DELETE FROM crm.order_status_history WHERE order_id=ANY($1::uuid[])`, [
      订单,
    ]);
    await 连接池.query(`DELETE FROM crm.orders WHERE id=ANY($1::uuid[])`, [订单]);
    await 连接池.query(`DELETE FROM crm.quote_items WHERE quote_id=ANY($1::uuid[])`, [报价]);
    await 连接池.query(`DELETE FROM crm.quotes WHERE id=ANY($1::uuid[])`, [报价]);
    await 连接池.query(`DELETE FROM crm.opportunities WHERE id=ANY($1::uuid[])`, [商机]);
    await 连接池.query(`DELETE FROM crm.customers WHERE id=ANY($1::uuid[])`, [客户]);
    await 连接池.query(
      `DELETE FROM channel.partner_order_targets WHERE partner_id=ANY($1::uuid[])`,
      [渠道],
    );
    await 连接池.query(
      `DELETE FROM channel.partner_relations WHERE parent_partner_id=ANY($1::uuid[]) OR child_partner_id=ANY($1::uuid[])`,
      [渠道],
    );
    await 连接池.query(
      `DELETE FROM channel.partner_members WHERE partner_id=ANY($1::uuid[]) OR user_id=ANY($2::uuid[])`,
      [渠道, 用户],
    );
    await 连接池.query(`DELETE FROM channel.partners WHERE id=ANY($1::uuid[])`, [渠道]);
    await 连接池
      .query(
        `DELETE FROM audit.audit_logs WHERE target_id=ANY($1::text[]) OR actor_user_id=ANY($2::uuid[]) OR actor_username LIKE $3`,
        [订单, 用户, `${测试用户名前缀}%`],
      )
      .catch(() => undefined);
    await 连接池.query(
      `DELETE FROM ops.notifications WHERE recipient_user_id=ANY($1::uuid[]) OR extra_json->>'orderId'=ANY($2::text[])`,
      [用户, 订单],
    );
    await 连接池.query(`DELETE FROM org.staff_profiles WHERE user_id=ANY($1::uuid[])`, [用户]);
    await 连接池.query(
      `DELETE FROM crm.region_manager_contract_counters WHERE region_manager_user_id=ANY($1::uuid[])`,
      [用户],
    );
    await 连接池.query(`DELETE FROM iam.user_roles WHERE user_id=ANY($1::uuid[])`, [用户]);
    await 连接池.query(`DELETE FROM iam.password_credentials WHERE user_id=ANY($1::uuid[])`, [
      用户,
    ]);
    await 连接池.query(`DELETE FROM iam.users WHERE id=ANY($1::uuid[])`, [用户]);
    await 连接池.query(`DELETE FROM catalog.product_features WHERE id=ANY($1::uuid[])`, [产品]);
    await 连接池.query(`DELETE FROM catalog.product_modules WHERE module_code LIKE $1`, [
      `${测试批次}-MOD`,
    ]);
    await 连接池.query(`DELETE FROM catalog.product_categories WHERE category_code LIKE $1`, [
      `${测试批次}-CAT`,
    ]);
    await 连接池.query(`DELETE FROM org.regions WHERE region_code LIKE $1`, [`${测试批次}-REGION`]);
  }
});

function 生成最小PDF(): Buffer {
  return Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n");
}

function 价格字段(值: unknown, 路径 = "根"): string[] {
  if (Array.isArray(值)) return 值.flatMap((项, 索引) => 价格字段(项, `${路径}[${索引}]`));
  if (!值 || typeof 值 !== "object" || 值 instanceof Date) return [];
  const 禁止键 = new Set([
    "金额",
    "单价",
    "小计",
    "总价",
    "原价",
    "成交价",
    "报价金额",
    "金额合计",
    "amount",
    "total",
    "unitPrice",
    "lineAmount",
    "originalAmount",
    "channelOrderAmount",
    "shipmentAmount",
    "channelProfit",
    "channelProfitMargin",
    "discount",
    "discountAmount",
    "价格",
    "定价明细",
    "pricingBreakdown",
    "price",
    "listPrice",
    "channelPrice",
    "standardUnitPrice",
    "finalUnitPrice",
  ]);
  return Object.entries(值 as Record<string, unknown>).flatMap(([键, 子值]) => {
    const 当前路径 = `${路径}.${键}`;
    const 数值 = typeof 子值 === "number" ? 子值 : Number(子值);
    const 是零值价格字段 =
      [
        "金额",
        "total",
        "amount",
        "unitPrice",
        "lineAmount",
        "originalAmount",
        "channelOrderAmount",
        "shipmentAmount",
      ].includes(键) &&
      Number.isFinite(数值) &&
      数值 === 0;
    return [...(禁止键.has(键) && !是零值价格字段 ? [当前路径] : []), ...价格字段(子值, 当前路径)];
  });
}
