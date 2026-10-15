import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const baseUrl = process.env.V3_TEST_BASE_URL || "http://10.9.86.66";
const accounts = {
  superadmin: {
    username: process.env.V3_TEST_SUPERADMIN_USERNAME || "",
    password: process.env.V3_TEST_SUPERADMIN_PASSWORD || "",
  },
  region: {
    username: process.env.V3_TEST_REGION_USERNAME || "",
    password: process.env.V3_TEST_REGION_PASSWORD || "",
  },
  channel: {
    username: process.env.V3_TEST_CHANNEL_USERNAME || "",
    password: process.env.V3_TEST_CHANNEL_PASSWORD || "",
  },
};

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const outputDir =
  process.env.V3_TEST_EVIDENCE_DIR ||
  path.join(scriptDir, "../test-evidence/20260923-refactor-verification-r11");
await fs.mkdir(outputDir, { recursive: true });

async function login(page, account) {
  const status = await page.evaluate(async (input) => {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return response.status;
  }, account);
  if (!status.toString().startsWith("2")) throw new Error(`${account.username} 登录失败：${status}`);
}

async function 取首个ID(page, pathName) {
  return page.evaluate(async (target) => {
    const response = await fetch(`${target}?page=1&pageSize=5`, { credentials: "include" });
    const result = await response.json();
    return result?.data?.数据?.[0]?.id || "";
  }, pathName);
}

async function 等待页面(page) {
  await page
    .locator("h1")
    .first()
    .waitFor({ timeout: 8000 })
    .catch(() => undefined);
  await page.waitForTimeout(900);
}

const 探针 = [];
const browser = await chromium.launch({ headless: true });

const 场景列表 = [
  {
    role: "superadmin",
    route: () => "/admin/opportunity",
    name: "商机七阶段文案",
    run: async (page) => {
      const stages = await page.evaluate(() => {
        const text = document.body.innerText || "";
        const 新阶段 = ["客户建联", "需求挖掘", "客户方案", "POC试用", "立项推进", "招投标", "成单"];
        const 旧阶段 = ["初步接洽", "需求确认", "方案报价", "商务谈判", "合同签订"];
        return {
          命中七阶段: 新阶段.filter((item) => text.includes(item)),
          残留旧阶段: 旧阶段.filter((item) => text.includes(item)),
        };
      });
      return { ...stages, 通过: stages.命中七阶段.length >= 5 && stages.残留旧阶段.length === 0 };
    },
  },
  {
    role: "superadmin",
    route: () => "/admin/products/pricing",
    name: "价格规则展示与筛选",
    run: async (page) => {
      const 文本 = await page.evaluate(() => (document.body.innerText || "").replace(/\s+/g, " "));
      const 结果 = {
        阶梯价展示: 文本.includes("基础阶梯价"),
        渠道比例展示: 文本.includes("渠道价格比例"),
        区域覆盖展示: 文本.includes("区域价格覆盖"),
        命中顺序: 文本.includes("价格命中顺序"),
      };
      for (const 标签 of ["区域覆盖", "阶梯计价"]) {
        const button = page.getByRole("button", { name: 标签 }).first();
        if (!(await button.count())) {
          结果[`筛选-${标签}`] = false;
          continue;
        }
        await button.click();
        await page.waitForTimeout(500);
        结果[`筛选-${标签}`] = (await page.locator(`button:has-text("${标签}")`).count()) > 0;
      }
      return {
        ...结果,
        通过:
          结果.阶梯价展示 && 结果.渠道比例展示 && 结果.区域覆盖展示 && 结果.命中顺序,
      };
    },
  },
  {
    role: "superadmin",
    route: () => "/admin/certifications",
    name: "证书模板弹窗",
    run: async (page) => {
      const button = page.getByRole("button", { name: /新建模板/ }).first();
      if (!(await button.count())) return { 通过: false, 原因: "未找到新建模板按钮" };
      await button.click();
      await page.waitForTimeout(600);
      const 打开 = (await page.locator(".证书弹窗").count()) > 0;
      if (打开) {
        const 关闭 = page.locator(".证书弹窗").first().getByRole("button", { name: /关闭|取消/ });
        if (await 关闭.count()) await 关闭.first().click();
      }
      return { 弹窗打开: 打开, 通过: 打开 };
    },
  },
  {
    role: "superadmin",
    route: () => "/admin/notifications/rules",
    name: "提醒规则真实数据",
    run: async (page) => {
      const 结果 = await page.evaluate(async () => {
        const response = await fetch("/api/messages/platform/rules", { credentials: "include" });
        const body = await response.json();
        return { status: response.status, 条数: body?.data?.items?.length || 0 };
      });
      const 表格行 = await page.locator("tbody tr").count();
      return { ...结果, 表格行, 通过: 结果.status === 200 && 表格行 > 0 };
    },
  },
  {
    role: "region",
    route: async (page) => {
      const id = await 取首个ID(page, "/api/stage9/registrations");
      return `/admin/registration/${id}/followup`;
    },
    name: "客户档案编辑与跟进",
    run: async (page) => {
      const 编辑 = page.getByRole("button", { name: /编辑客户档案/ }).first();
      const 编辑可见 = await 编辑.count();
      let 弹窗打开 = false;
      if (编辑可见) {
        await 编辑.click();
        await page.waitForTimeout(700);
        弹窗打开 = (await page.getByRole("button", { name: /取消编辑|取消/ }).count()) > 0;
        const 取消 = page.getByRole("button", { name: /取消编辑|取消/ }).first();
        if (await 取消.count()) await 取消.click();
      }
      const 跟进 = await page.getByRole("button", { name: /记录客户跟进|保存跟进|提交跟进/ }).count();
      return { 编辑按钮: 编辑可见, 编辑态打开: 弹窗打开, 跟进入口: 跟进, 通过: 编辑可见 > 0 && 弹窗打开 && 跟进 > 0 };
    },
  },
  {
    role: "region",
    route: async (page) => {
      const id = await 取首个ID(page, "/api/stage9/partners");
      return `/admin/partners/${id}/members`;
    },
    name: "渠道成员新增弹窗",
    run: async (page) => {
      const 新增 = page.getByRole("button", { name: /新增成员/ }).first();
      const 可见 = await 新增.count();
      let 弹窗 = false;
      if (可见) {
        await 新增.click();
        await page.waitForTimeout(700);
        弹窗 = (await page.locator(".成员弹窗").count()) > 0;
        const 关闭 = page.locator(".成员弹窗").first().getByRole("button", { name: /关闭|取消/ });
        if (await 关闭.count()) await 关闭.first().click();
      }
      return { 新增按钮: 可见, 弹窗打开: 弹窗, 通过: 可见 > 0 && 弹窗 };
    },
  },
  {
    role: "region",
    route: () => "/admin/order",
    name: "订单动作中心按状态与角色显示动作",
    run: async (page) => {
      const 订单列表 = await page.evaluate(async () => {
        const response = await fetch("/api/stage9/orders?page=1&pageSize=10", {
          credentials: "include",
        });
        const result = await response.json();
        return (result?.data?.数据 || []).map((row) => ({ id: row.id, 状态: row.状态 }));
      });
      const 明细 = [];
      for (const 订单 of 订单列表) {
        await page.goto(`${baseUrl}/admin/order/${订单.id}/actions`, {
          waitUntil: "domcontentloaded",
        });
        await 等待页面(page);
        const 文本 = await page.evaluate(() => (document.body.innerText || "").replace(/\s+/g, " "));
        const 动作按钮 = await page
          .getByRole("button", { name: /执行|审批|确认|驳回|调价/ })
          .count();
        明细.push({ 订单: 订单.id, 状态: 订单.状态, 动作按钮, 无动作提示: 文本.includes("没有可执行动作") });
        if (动作按钮 > 0) break;
      }
      return {
        明细,
        可执行动作订单数: 明细.filter((item) => item.动作按钮 > 0).length,
        状态边界提示: 明细.some((item) => item.无动作提示),
        通过: 明细.some((item) => item.动作按钮 > 0) && 明细.some((item) => item.无动作提示),
      };
    },
  },
  {
    role: "superadmin",
    route: () => "/admin/order",
    name: "超管确认与退回动作",
    run: async (page) => {
      const 订单列表 = await page.evaluate(async () => {
        const response = await fetch("/api/stage9/orders?page=1&pageSize=10", {
          credentials: "include",
        });
        const result = await response.json();
        return (result?.data?.数据 || []).map((row) => ({ id: row.id, 状态: row.状态 }));
      });
      const 待超管 = 订单列表.find((订单) => 订单.状态 === "pending_superadmin_confirm");
      const 目标 = 待超管 || 订单列表[0];
      if (!目标) return { 通过: false, 原因: "没有可用订单" };
      await page.goto(`${baseUrl}/admin/order/${目标.id}/actions`, {
        waitUntil: "domcontentloaded",
      });
      await 等待页面(page);
      const 文本 = await page.evaluate(() => (document.body.innerText || "").replace(/\s+/g, " "));
      const 动作卡 = await page.locator(".动作列表 article").allInnerTexts();
      const 确认 = 动作卡.filter((item) => item.includes("超管确认")).length;
      const 退回 = 动作卡.filter((item) => item.includes("超管退回")).length;
      return {
        订单: 目标.id,
        状态: 目标.状态,
        动作卡,
        超管确认动作: 确认,
        超管退回动作: 退回,
        审批说明存在: 文本.includes("审批边界") || 文本.includes("超管确认"),
        通过: 确认 > 0 && 退回 > 0,
      };
    },
  },
  {
    role: "region",
    route: async (page) => {
      const id = await 取首个ID(page, "/api/stage9/partners");
      return `/admin/partners/${id}/profile`;
    },
    name: "渠道核心档案可编辑",
    run: async (page) => {
      const 文本 = await page.evaluate(() => (document.body.innerText || "").replace(/\s+/g, " "));
      const 可编辑 = await page.locator("input, select, textarea").count();
      return {
        关键文案: ["渠道核心档案", "工商主体"].filter((item) => 文本.includes(item)),
        表单控件: 可编辑,
        通过: 文本.includes("渠道核心档案") && 可编辑 > 0,
      };
    },
  },
  {
    role: "channel",
    route: () => "/partner/order",
    name: "渠道端报价与订单入口",
    run: async (page) => {
      const 文本 = await page.evaluate(() => (document.body.innerText || "").replace(/\s+/g, " "));
      return { 通过: 文本.includes("订单") };
    },
  },
];

for (const 场景 of 场景列表) {
  const account = accounts[场景.role];
  if (!account.username || !account.password) {
    探针.push({ ...{ role: 场景.role, name: 场景.name }, 通过: null, 原因: "缺少账号密码" });
    continue;
  }
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  try {
    await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded", timeout: 20000 });
    await login(page, account);
    const route = typeof 场景.route === "function" ? await 场景.route(page) : 场景.route;
    if (!route || route.includes("undefined")) throw new Error("未取到可用于探针的业务单据 ID");
    await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded", timeout: 20000 });
    await 等待页面(page);
    const 结果 = await 场景.run(page);
    探针.push({ role: 场景.role, name: 场景.name, route, ...结果 });
  } catch (error) {
    探针.push({
      role: 场景.role,
      name: 场景.name,
      通过: false,
      原因: error instanceof Error ? error.message : String(error),
    });
  } finally {
    await context.close();
  }
}

await browser.close();
const 汇总 = {
  generatedAt: new Date().toISOString(),
  通过: 探针.filter((item) => item.通过 === true).length,
  总数: 探针.length,
  失败项: 探针.filter((item) => item.通过 !== true),
  明细: 探针,
};
await fs.writeFile(
  path.join(outputDir, "interaction-probes.json"),
  `${JSON.stringify(汇总, null, 2)}\n`,
);
console.log(JSON.stringify(汇总, null, 2));
