/**
 * 测试环境全链路造数与真实数据校验。
 * 链路：客户报备 → 审核通过 → 商机 → 报价 → 转订单 → 区管确认 → 超管确认。
 * 用法：
 *   V3_TEST_BASE_URL=http://10.9.86.66 \
 *   V3_TEST_SUPERADMIN_USERNAME=<账号> V3_TEST_SUPERADMIN_PASSWORD=<密码> \
 *   node tools/seed-and-verify-business-chain.mjs
 * 说明：只写入测试环境业务数据，不修改任何配置与结构。
 */
import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const baseUrl = process.env.V3_TEST_BASE_URL || "http://10.9.86.66";
const superadmin = {
  username: process.env.V3_TEST_SUPERADMIN_USERNAME || "",
  password: process.env.V3_TEST_SUPERADMIN_PASSWORD || "",
};
const regionManager = {
  username: process.env.V3_TEST_REGION_USERNAME || "",
  password: process.env.V3_TEST_REGION_PASSWORD || "",
};
const channelUser = {
  username: process.env.V3_TEST_CHANNEL_USERNAME || "",
  password: process.env.V3_TEST_CHANNEL_PASSWORD || "",
};
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const outputDir =
  process.env.V3_TEST_EVIDENCE_DIR ||
  path.join(scriptDir, "../test-evidence/20260924-business-chain-verification");
const screenshotDir = path.join(outputDir, "screenshots");
await fs.mkdir(screenshotDir, { recursive: true });

const 批次 = `UI验收${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${Date.now().toString().slice(-5)}`;
const 客户名称 = `${批次}客户`;
const 商机名称 = `${批次}商机`;
const 报告 = { 批次, 客户名称, 商机名称, baseUrl, 步骤: [], 页面校验: [], 失败: [] };

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

async function 接口(方法, 路径, 数据) {
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
        parsed = { raw: text.slice(0, 200) };
      }
      return { status: response.status, body: parsed };
    },
    { method: 方法, target: `${baseUrl}${路径}`, body: 数据 },
  );
}

async function 步骤(名称, 执行) {
  try {
    const 结果 = await 执行();
    报告.步骤.push({ 名称, 状态: "通过", 结果 });
    return 结果;
  } catch (异常) {
    const 信息 = 异常 instanceof Error ? 异常.message : String(异常);
    报告.步骤.push({ 名称, 状态: "失败", 原因: 信息 });
    报告.失败.push({ 名称, 原因: 信息 });
    return null;
  }
}

async function 切换账号(账号, 名称) {
  if (!账号.username || !账号.password) throw new Error(`${名称}账号未配置`);
  const 状态 = await page.evaluate(async (account) => {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(account),
    });
    return response.status;
  }, 账号);
  if (!状态.toString().startsWith("2")) throw new Error(`${名称}登录失败：${状态}`);
}

try {
  await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded", timeout: 20000 });
  // 真实链路：渠道发起报备 → 区管审核 → 渠道建商机/报价/转订单 → 区管确认 → 超管终审
  await 切换账号(channelUser, "渠道");

  const 报备 = await 步骤("创建客户报备", async () => {
    const 响应 = await 接口("POST", "/api/registrations", {
      customer: 客户名称,
      creditCode: `91370000${Date.now().toString().slice(-10)}`,
      contact: "验收联系人",
      phone: "13800000000",
    });
    if (响应.status !== 200 || !响应.body?.data?.id) throw new Error(`创建失败：${响应.status}`);
    return { id: 响应.body.data.id, 编号: 响应.body.data.编号, 状态: 响应.body.data.状态 };
  });

  await 步骤("审核通过客户报备", async () => {
    await 切换账号(regionManager, "区管");
    const 响应 = await 接口("PUT", `/api/registrations/${报备.id}/status`, {
      status: "approved",
      reason: "UI 验收自动审核",
    });
    if (响应.status !== 200) throw new Error(`审核失败：${响应.status}`);
    return { 状态: 响应.body.data.状态, 保护期至: 响应.body.data.原始数据?.expireAt };
  });

  const 商机 = await 步骤("创建商机", async () => {
    await 切换账号(channelUser, "渠道");
    const 响应 = await 接口("POST", "/api/opportunities", {
      registrationId: 报备.id,
      name: 商机名称,
      amount: 128000,
    });
    if (响应.status !== 200 || !响应.body?.data?.id) throw new Error(`创建失败：${响应.status}`);
    return { id: 响应.body.data.id, 编号: 响应.body.data.编号, 状态: 响应.body.data.状态 };
  });

  const 产品编号 = await 步骤("读取产品目录", async () => {
    const 响应 = await 接口("GET", "/api/products?pageSize=5");
    const 列表 = 响应.body?.data?.数据 || [];
    if (!列表.length) throw new Error("产品目录为空，无法创建报价");
    return 列表[0].id;
  });

  const 报价 = await 步骤("创建报价单", async () => {
    const 响应 = await 接口("POST", "/api/quotes", {
      opportunityId: 商机.id,
      endpoints: 120,
      productIds: [产品编号],
    });
    if (响应.status !== 200 || !响应.body?.data?.id) throw new Error(`创建失败：${响应.status}`);
    return { id: 响应.body.data.id, 编号: 响应.body.data.id, 状态: 响应.body.data.状态 };
  });

  await 步骤("提交并确认报价", async () => {
    const 提交 = await 接口("PUT", `/api/quotes/${encodeURIComponent(报价.id)}/status`, {
      status: "submitted",
    });
    if (提交.status !== 200) throw new Error(`提交失败：${提交.status}`);
    await 切换账号(regionManager, "区管");
    const 确认 = await 接口("PUT", `/api/quotes/${encodeURIComponent(报价.id)}/status`, {
      status: "approved",
    });
    if (确认.status !== 200) throw new Error(`确认失败：${确认.status}`);
    await 切换账号(channelUser, "渠道");
    return { 状态: 确认.body.data.状态 };
  });

  const 订单 = await 步骤("报价转订单", async () => {
    const 响应 = await 接口("POST", "/api/orders", { quoteId: 报价.id });
    if (响应.status !== 200 || !响应.body?.data?.id)
      throw new Error(`转单失败：${响应.status} ${JSON.stringify(响应.body).slice(0, 160)}`);
    return { id: 响应.body.data.id, 编号: 响应.body.data.编号, 状态: 响应.body.data.状态 };
  });

  await 步骤("区管确认订单", async () => {
    await 切换账号(regionManager, "区管");
    const 响应 = await 接口("PUT", `/api/orders/${订单.id}/status`, {
      status: "pending_superadmin_confirm",
      action: "region_confirm",
    });
    if (响应.status !== 200) throw new Error(`区管确认失败：${响应.status}`);
    return { 状态: 响应.body.data.状态 };
  });

  await 步骤("超管确认订单", async () => {
    await 切换账号(superadmin, "超管");
    const 响应 = await 接口("PUT", `/api/orders/${订单.id}/status`, {
      status: "confirmed",
      action: "superadmin_confirm",
    });
    if (响应.status !== 200) throw new Error(`超管确认失败：${响应.status}`);
    return { 状态: 响应.body.data.状态 };
  });

  await 步骤("区管调价复核链路", async () => {
    await 切换账号(superadmin, "超管");
    // 重复转单已被拒绝，调价/驳回链路使用同一商机下的第二份报价
    const 第二报价 = await 接口("POST", "/api/quotes", {
      opportunityId: 商机.id,
      endpoints: 80,
      productIds: [产品编号],
    });
    if (第二报价.status !== 200) throw new Error(`创建第二报价失败：${第二报价.status}`);
    const 新订单 = await 接口("POST", "/api/orders", { quoteId: 第二报价.body.data.id });
    if (新订单.status !== 200) throw new Error(`创建第二订单失败：${新订单.status}`);
    const 重复转单 = await 接口("POST", "/api/orders", { quoteId: 第二报价.body.data.id });
    if (重复转单.status !== 409)
      throw new Error(`重复转单未被拒绝，实际状态：${重复转单.status}`);
    await 切换账号(regionManager, "区管");
    const 调价 = await 接口("PUT", `/api/orders/${新订单.body.data.id}/price-adjust`, {
      amount: 118000,
      reason: "UI 验收调价",
    });
    if (调价.status !== 200) throw new Error(`调价失败：${调价.status}`);
    await 切换账号(superadmin, "超管");
    const 驳回 = await 接口("PUT", `/api/orders/${新订单.body.data.id}/primary-reject`, {
      reason: "UI 验收一级驳回",
    });
    if (驳回.status !== 200) throw new Error(`驳回失败：${驳回.status}`);
    return { 调价后状态: 调价.body.data.状态, 驳回后状态: 驳回.body.data.状态 };
  });

  const 页面校验项 = [
    {
      名称: "客户管理列表包含新客户",
      路径: "/admin/registration",
      期望: [客户名称],
      搜索: 客户名称,
    },
    { 名称: "商机列表包含新商机", 路径: "/admin/opportunity", 期望: [商机名称] },
    {
      名称: "订单列表包含新订单",
      路径: "/admin/order",
      期望: [客户名称],
      搜索: 客户名称,
    },
    { 名称: "订单处理页可打开", 路径: `/admin/order/${订单.id}/actions`, 期望: ["订单处理"] },
  ];

  for (const 项 of 页面校验项) {
    await page.goto(`${baseUrl}${项.路径}`, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page
      .locator("h1, .war-center-head, .订单处理页, .线索页")
      .first()
      .waitFor({ timeout: 8000 })
      .catch(() => undefined);
    await page.waitForTimeout(2000);
    if (项.搜索) {
      const 候选输入框 = [
        page.locator(".war-search input").first(),
        page.locator('input[placeholder*="搜索"]').first(),
        page.locator('input[type="search"]').first(),
      ];
      for (const 输入框 of 候选输入框) {
        if (await 输入框.count()) {
          await 输入框.fill(项.搜索);
          await page.waitForTimeout(900);
          break;
        }
      }
    }
    const 文本 = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, " ");
    const 缺失 = 项.期望.filter((关键字) => !文本.includes(关键字));
    const 文件 = `${项.名称}.png`.replaceAll("/", "-");
    await page.screenshot({ path: path.join(screenshotDir, 文件) });
    报告.页面校验.push({ ...项, 缺失, 通过: 缺失.length === 0, 截图: 文件 });
    if (缺失.length) 报告.失败.push({ 名称: 项.名称, 原因: `页面缺少：${缺失.join("、")}` });
  }
} catch (异常) {
  报告.失败.push({ 名称: "执行异常", 原因: 异常 instanceof Error ? 异常.message : String(异常) });
} finally {
  await fs.writeFile(
    path.join(outputDir, "business-chain-verification.json"),
    `${JSON.stringify(报告, null, 2)}\n`,
  );
  console.log(
    JSON.stringify(
      {
        批次: 报告.批次,
        步骤通过: 报告.步骤.filter((项) => 项.状态 === "通过").length,
        步骤总数: 报告.步骤.length,
        页面校验通过: 报告.页面校验.filter((项) => 项.通过).length,
        页面校验总数: 报告.页面校验.length,
        失败: 报告.失败,
      },
      null,
      2,
    ),
  );
  await browser.close();
}
