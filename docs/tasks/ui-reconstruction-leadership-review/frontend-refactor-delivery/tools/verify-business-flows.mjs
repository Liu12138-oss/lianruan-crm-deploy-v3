/**
 * 全流程业务回归：覆盖客户、商机、报价、订单、渠道成员、证书、消息与权限边界。
 * 用法：
 *   V3_TEST_BASE_URL=http://10.9.86.66 \
 *   V3_TEST_SUPERADMIN_USERNAME=... V3_TEST_SUPERADMIN_PASSWORD=... \
 *   V3_TEST_REGION_USERNAME=... V3_TEST_REGION_PASSWORD=... \
 *   V3_TEST_CHANNEL_USERNAME=... V3_TEST_CHANNEL_PASSWORD=... \
 *   node tools/verify-business-flows.mjs
 * 说明：只在测试环境创建业务数据，不修改配置与结构。
 */
import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const baseUrl = process.env.V3_TEST_BASE_URL || "http://10.9.86.66";
const 账号 = {
  超管: {
    username: process.env.V3_TEST_SUPERADMIN_USERNAME || "",
    password: process.env.V3_TEST_SUPERADMIN_PASSWORD || "",
  },
  区管: {
    username: process.env.V3_TEST_REGION_USERNAME || "",
    password: process.env.V3_TEST_REGION_PASSWORD || "",
  },
  渠道: {
    username: process.env.V3_TEST_CHANNEL_USERNAME || "",
    password: process.env.V3_TEST_CHANNEL_PASSWORD || "",
  },
};
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const 输出目录 =
  process.env.V3_TEST_EVIDENCE_DIR ||
  path.join(scriptDir, "../test-evidence/20260924-business-flow-verification");
await fs.mkdir(输出目录, { recursive: true });

const 批次 = `FLOW${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${Date.now().toString().slice(-5)}`;
const 报告 = { 批次, baseUrl, 开始时间: new Date().toISOString(), 步骤: [], 失败: [] };

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

async function 登录(角色) {
  const 状态 = await page.evaluate(async (account) => {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(account),
    });
    return response.status;
  }, 账号[角色]);
  if (!状态.toString().startsWith("2")) throw new Error(`${角色}登录失败：${状态}`);
}

async function 请求(方法, 路径, 数据) {
  return page.evaluate(
    async ({ method, target, body }) => {
      const response = await fetch(target, {
        method,
        credentials: "include",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const text = await response.text();
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = { raw: text.slice(0, 160) };
      }
      return { status: response.status, body: parsed };
    },
    { method: 方法, target: `${baseUrl}${路径}`, body: 数据 },
  );
}

async function 步骤(流程, 名称, 角色, 执行, 预期 = {}) {
  try {
    if (角色) await 登录(角色);
    const 结果 = await 执行();
    const 状态通过 = 预期.status === undefined || 结果.status === 预期.status;
    const 字段通过 =
      !预期.字段 ||
      Object.entries(预期.字段).every(([键, 值]) => {
        const 实际 = (结果.body?.data || {})[键];
        return Array.isArray(值) ? 值.includes(实际) : 实际 === 值;
      });
    const 通过 = 状态通过 && 字段通过;
    报告.步骤.push({
      流程,
      名称,
      角色: 角色 || "沿用当前会话",
      请求状态: 结果.status,
      通过,
      ...(通过 ? {} : { 响应: JSON.stringify(结果.body).slice(0, 300) }),
    });
    if (!通过) 报告.失败.push({ 流程, 名称, 请求状态: 结果.status });
    return 结果.body?.data;
  } catch (异常) {
    const 原因 = 异常 instanceof Error ? 异常.message : String(异常);
    报告.步骤.push({ 流程, 名称, 角色, 通过: false, 异常: 原因 });
    报告.失败.push({ 流程, 名称, 异常: 原因 });
    return null;
  }
}

try {
  await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded", timeout: 30000 });

  // ===== 客户报备 =====
  const 报备 = await 步骤(
    "客户报备",
    "渠道创建报备",
    "渠道",
    () =>
      请求("POST", "/api/registrations", {
        customer: `${批次}客户`,
        creditCode: `91370000${Date.now().toString().slice(-10)}`,
        contact: "流程测试联系人",
        phone: "13800000001",
      }),
    { status: 200, 字段: { 状态: "pending" } },
  );

  await 步骤(
    "客户报备",
    "区管审核通过",
    "区管",
    () =>
      请求("PUT", `/api/registrations/${报备?.id}/status`, {
        status: "approved",
        reason: "流程回归-通过",
      }),
    { status: 200, 字段: { 状态: "approved" } },
  );

  const 待驳回报备 = await 步骤(
    "客户报备",
    "渠道创建待驳回报备",
    "渠道",
    () =>
      请求("POST", "/api/registrations", {
        customer: `${批次}驳回客户`,
        creditCode: `91370001${Date.now().toString().slice(-10)}`,
        contact: "驳回测试联系人",
        phone: "13800000002",
      }),
    { status: 200, 字段: { 状态: "pending" } },
  );

  await 步骤(
    "客户报备",
    "区管审核驳回",
    "区管",
    () =>
      请求("PUT", `/api/registrations/${待驳回报备?.id}/status`, {
        status: "rejected",
        reason: "流程回归-驳回",
      }),
    { status: 200, 字段: { 状态: "rejected" } },
  );

  // ===== 商机 =====
  const 商机 = await 步骤(
    "商机",
    "从报备创建商机",
    "渠道",
    () =>
      请求("POST", "/api/opportunities", {
        registrationId: 报备?.id,
        name: `${批次}商机`,
        amount: 88_000,
      }),
    { status: 200 },
  );

  await 步骤(
    "商机",
    "推进到客户方案阶段",
    "渠道",
    () => 请求("PUT", `/api/opportunities/${商机?.id}`, { stage: "design", reason: "流程回归-推进阶段" }),
    { status: 200 },
  );

  // ===== 报价 =====
  const 产品列表 = await 步骤(
    "报价",
    "读取产品目录",
    "渠道",
    () => 请求("GET", "/api/products?pageSize=5"),
    { status: 200 },
  );
  const 产品编号 = (产品列表?.数据 || [])[0]?.id;

  const 报价 = await 步骤(
    "报价",
    "创建报价单",
    "渠道",
    () =>
      请求("POST", "/api/quotes", {
        opportunityId: 商机?.id,
        endpoints: 60,
        productIds: [产品编号],
      }),
    { status: 200, 字段: { 状态: "draft" } },
  );

  await 步骤(
    "报价",
    "提交报价",
    "渠道",
    () => 请求("PUT", `/api/quotes/${报价?.id}/status`, { status: "submitted" }),
    { status: 200 },
  );

  await 步骤(
    "报价",
    "区管确认报价",
    "区管",
    () => 请求("PUT", `/api/quotes/${报价?.id}/status`, { status: "approved" }),
    { status: 200, 字段: { 状态: "approved" } },
  );

  const 订单 = await 步骤(
    "报价",
    "报价转订单",
    "渠道",
    () => 请求("POST", "/api/orders", { quoteId: 报价?.id }),
    { status: 200 },
  );

  await 步骤(
    "报价",
    "重复转单被拒绝",
    "渠道",
    () => 请求("POST", "/api/orders", { quoteId: 报价?.id }),
    { status: 409 },
  );

  const 第二报价 = await 步骤(
    "报价",
    "创建第二份报价",
    "渠道",
    () =>
      请求("POST", "/api/quotes", {
        opportunityId: 商机?.id,
        endpoints: 40,
        productIds: [产品编号],
      }),
    { status: 200 },
  );

  await 步骤(
    "报价",
    "报价驳回",
    "区管",
    () => 请求("PUT", `/api/quotes/${第二报价?.id}/status`, { status: "rejected" }),
    { status: 200 },
  );

  // ===== 订单审批与履约 =====
  await 步骤(
    "订单",
    "区管确认订单",
    "区管",
    () =>
      请求("PUT", `/api/orders/${订单?.id}/status`, {
        status: "pending_superadmin_confirm",
        action: "region_confirm",
      }),
    { status: 200, 字段: { 状态: "pending_superadmin_confirm" } },
  );

  await 步骤(
    "订单",
    "超管确认订单",
    "超管",
    () =>
      请求("PUT", `/api/orders/${订单?.id}/status`, {
        status: "confirmed",
        action: "superadmin_confirm",
      }),
    { status: 200, 字段: { 状态: "confirmed" } },
  );

  for (const [名称, 目标状态] of [
    ["履约-处理中", "processing"],
    ["履约-已发货", "shipped"],
    ["履约-已完成", "completed"],
  ]) {
    await 步骤(
      "订单",
      名称,
      "区管",
      () => 请求("PUT", `/api/orders/${订单?.id}/status`, { status: 目标状态, action: "fulfillment" }),
      { status: 200, 字段: { 状态: 目标状态 } },
    );
  }

  const 待驳回订单 = await 步骤(
    "订单",
    "创建待一级驳回订单",
    "渠道",
    () => 请求("POST", "/api/orders", { quoteId: 第二报价?.id }),
    { status: 200 },
  );

  await 步骤(
    "订单",
    "一级驳回（属地管）",
    "区管",
    () => 请求("PUT", `/api/orders/${待驳回订单?.id}/primary-reject`, { reason: "流程回归-一级驳回" }),
    { status: 200, 字段: { 状态: "returned_to_secondary" } },
  );

  const 待调价报价 = await 步骤(
    "订单",
    "创建待调价报价",
    "渠道",
    () =>
      请求("POST", "/api/quotes", {
        opportunityId: 商机?.id,
        endpoints: 30,
        productIds: [产品编号],
      }),
    { status: 200 },
  );

  const 待调价订单 = await 步骤(
    "订单",
    "创建待调价订单",
    "渠道",
    () => 请求("POST", "/api/orders", { quoteId: 待调价报价?.id }),
    { status: 200 },
  );

  await 步骤(
    "订单",
    "区管调价",
    "区管",
    () =>
      请求("PUT", `/api/orders/${待调价订单?.id}/price-adjust`, {
        amount: 66_000,
        reason: "流程回归-调价",
      }),
    { status: 200, 字段: { 状态: "pending_superadmin_confirm" } },
  );

  await 步骤(
    "订单",
    "超管退回",
    "超管",
    () =>
      请求("PUT", `/api/orders/${待调价订单?.id}/status`, {
        status: "returned_to_region",
        action: "superadmin_return",
        returnTarget: "region",
        reason: "流程回归-超管退回",
      }),
    { status: 200 },
  );

  await 登录("渠道");
  const 订单详情 = await 请求("GET", `/api/orders/${待调价订单?.id}`);
  const 订单明细 = 订单详情?.body?.data?.原始数据?.items || [];
  await 步骤(
    "订单",
    "退回后重新提交",
    "渠道",
    () =>
      请求("PUT", `/api/orders/${待调价订单?.id}/resubmit`, {
        reason: "流程回归-修订重提",
        items: 订单明细,
      }),
    { status: 200 },
  );

  // ===== 渠道成员 =====
  const 渠道商 = await 步骤(
    "渠道成员",
    "读取渠道商列表",
    "超管",
    () => 请求("GET", "/api/stage9/partners?page=1&pageSize=1"),
    { status: 200 },
  );
  const 渠道商编号 = (渠道商?.数据 || [])[0]?.编号;

  const 成员 = await 步骤(
    "渠道成员",
    "新增渠道成员",
    "超管",
    () =>
      请求("POST", `/api/v2/partners/${渠道商编号}/staff`, {
        name: `${批次}成员`,
        username: `${批次.toLowerCase()}user`,
        phone: `138${Date.now().toString().slice(-8)}`,
        role: "销售",
        status: "active",
      }),
    { status: 200 },
  );


  // ===== 证书 =====
  const 模板 = await 步骤(
    "证书",
    "创建证书模板",
    "超管",
    () =>
      请求("POST", "/api/org/certification-templates", {
        templateCode: `${批次}-CERT`,
        templateName: `${批次}证书模板`,
        category: "技术类",
      }),
    { status: 200 },
  );

  const 任职列表 = await 步骤(
    "证书",
    "读取有效任职成员",
    "超管",
    () => 请求("GET", "/api/org/staff"),
    { status: 200 },
  );
  const 任职项目 = 任职列表?.items || [];
  const 账号列表 = await 请求("GET", "/api/stage9/users?page=1&pageSize=100");
  const 启用账号集合 = new Set(
    (账号列表?.数据 || [])
      .filter((账号项) => 账号项.状态 === "active")
      .map((账号项) => 账号项.原始数据?.userId || 账号项.id),
  );
  // 优先使用本轮新建的渠道成员：先按登录名查回 UUID 账号编号
  const 成员登录名 = 成员?.username || 成员?.userId;
  const 成员账号查询 = 成员登录名
    ? await 请求("GET", `/api/stage9/users?page=1&pageSize=20&keyword=${encodeURIComponent(成员登录名)}`)
    : null;
  const 成员账号编号 =
    (成员账号查询?.数据 || []).find(
      (账号项) => (账号项.原始数据?.username || 账号项.编号) === 成员登录名,
    )?.id || (成员账号查询?.数据 || [])[0]?.id;
  const 成员编号 =
    成员账号编号 ||
    任职项目.map((项) => 项.userId || 项.id).find((编号) => 启用账号集合.has(编号)) ||
    任职项目[0]?.userId ||
    任职项目[0]?.id;

  // 证书颁发：按候选成员依次尝试（需要账号启用且有有效任职/渠道成员关系）
  const 候选成员 = [
    ...(成员?.id ? [成员.id] : []),
    ...(任职项目.map((项) => 项.userId || 项.id) || []),
    ...((账号列表?.数据 || []).filter((账号项) => 账号项.状态 === "active").map((账号项) => 账号项.id)),
  ].filter((编号, 序号, 数组) => 编号 && 数组.indexOf(编号) === 序号);

  let 证书 = null;
  for (const 候选 of 候选成员.slice(0, 8)) {
    await 登录("超管");
    const 响应 = await 请求("POST", `/api/org/users/${候选}/certifications`, {
      certificationTemplateId: 模板?.id,
      issuedOn: new Date().toISOString().slice(0, 10),
      expiresOn: new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10),
      certificateNo: `${批次}-NO-01`,
    });
    if (响应.status === 200) {
      报告.步骤.push({ 流程: "证书", 名称: "颁发证书", 角色: "超管", 请求状态: 200, 通过: true, 成员: 候选 });
      证书 = 响应.body?.data;
      break;
    }
    if (候选 === 候选成员.slice(0, 8).at(-1)) {
      报告.步骤.push({
        流程: "证书",
        名称: "颁发证书",
        角色: "超管",
        请求状态: 响应.status,
        通过: false,
        响应: JSON.stringify(响应.body).slice(0, 300),
      });
      报告.失败.push({ 流程: "证书", 名称: "颁发证书", 请求状态: 响应.status });
    }
  }

  if (证书?.id) {
    const 延期到期 = new Date(Date.now() + 400 * 86400000).toISOString().slice(0, 10);
    const 延期结果 = await 步骤(
      "证书",
      "延期证书",
      "超管",
      () =>
        请求("PUT", `/api/org/member-certifications/${证书.id}/extend`, {
          expiresOn: 延期到期,
          rowVersion: Number(证书.rowVersion) || 1,
        }),
      { status: 200 },
    );
    const 撤销用版本 = Number(延期结果?.rowVersion || 证书.rowVersion) || 1;
    await 步骤(
      "证书",
      "撤销证书",
      "超管",
      () =>
        请求("PUT", `/api/org/member-certifications/${证书.id}/revoke`, {
          reason: "流程回归-撤销",
          rowVersion: 撤销用版本,
        }),
      { status: 200 },
    );
  }

  // ===== 渠道成员停用（放在证书颁发之后，避免影响证书校验）=====
  if (成员?.id || 成员?.username) {
    await 步骤(
      "渠道成员",
      "停用渠道成员",
      "超管",
      () =>
        请求(
          "PUT",
          `/api/v2/partners/${渠道商编号}/staff/${成员.id || 成员.username}`,
          { status: "disabled" },
        ),
      { status: 200 },
    );
  }

  // ===== 消息 =====
  await 步骤(
    "消息",
    "读取消息列表",
    "超管",
    () => 请求("GET", "/api/stage9/notifications?page=1&pageSize=5"),
    { status: 200 },
  );

  await 步骤("消息", "全部标记已读", "超管", () => 请求("PUT", "/api/notifications/read", {}), {
    status: 200,
  });

  // ===== 权限边界 =====
  await 步骤(
    "权限",
    "渠道访问管理端订单接口",
    "渠道",
    () => 请求("GET", "/api/stage9/orders?page=1&pageSize=1"),
    { status: 200 },
  );

  const 区管账号管理 = await 步骤(
    "权限",
    "区管访问账号管理接口",
    "区管",
    () => 请求("GET", "/api/stage9/users?page=1&pageSize=1"),
    { status: 200 },
  );
  报告.权限观察 = {
    区管账号管理返回条数: (区管账号管理?.数据 || []).length,
  };
} catch (异常) {
  报告.失败.push({ 流程: "执行", 名称: "未捕获异常", 异常: String(异常) });
} finally {
  报告.结束时间 = new Date().toISOString();
  报告.统计 = {
    步骤总数: 报告.步骤.length,
    通过: 报告.步骤.filter((步骤项) => 步骤项.通过).length,
    失败: 报告.失败.length,
  };
  await fs.writeFile(
    path.join(输出目录, "business-flow-results.json"),
    `${JSON.stringify(报告, null, 2)}\n`,
  );
  console.log(JSON.stringify({ 批次: 报告.批次, ...报告.统计, 失败明细: 报告.失败 }, null, 2));
  await browser.close();
}
