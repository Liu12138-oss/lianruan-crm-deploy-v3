import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { chromium } from "playwright";

const 基础地址 = "http://10.9.86.66";
const 输出目录 = resolve(
  process.cwd(),
  "outputs/01a11954-3564-7ba0-bf8f-5db6972bbbe4/复测修复-20261022/验证证据",
);
await mkdir(输出目录, { recursive: true });

const 浏览器 = await chromium.launch({ headless: true });
const 结果 = {
  执行时间: new Date().toISOString(),
  测试环境: 基础地址,
  ORG12: {},
  ERR07: {},
  VIS02: {},
};

async function 登录(用户名, 密码) {
  const 上下文 = await 浏览器.newContext({
    baseURL: 基础地址,
    viewport: { width: 1600, height: 950 },
  });
  const 页面 = await 上下文.newPage();
  await 页面.goto("/login", { waitUntil: "domcontentloaded", timeout: 20_000 });
  await 页面.locator('input[autocomplete="username"]').fill(用户名);
  await 页面.locator('input[autocomplete="current-password"]').fill(密码);
  await Promise.all([
    页面.waitForURL((地址) => !地址.pathname.startsWith("/login"), { timeout: 20_000 }),
    页面.getByRole("button", { name: /登\s*录/ }).click(),
  ]);
  await 页面.waitForTimeout(800);
  return { 上下文, 页面 };
}

async function 请求(页面, 路径, 方法 = "GET", 正文) {
  return 页面.evaluate(
    async ({ 路径, 方法, 正文 }) => {
      const 响应 = await fetch(路径, {
        method: 方法,
        credentials: "include",
        headers: {
          ...(正文 === undefined ? {} : { "content-type": "application/json" }),
          ...(方法 === "GET" ? {} : { "Idempotency-Key": `verify-${Date.now()}-${Math.random()}` }),
        },
        body: 正文 === undefined ? undefined : JSON.stringify(正文),
      });
      const 文本 = await 响应.text();
      let 内容;
      try {
        内容 = JSON.parse(文本);
      } catch {
        内容 = 文本.slice(0, 1000);
      }
      return { 状态: 响应.status, 内容 };
    },
    { 路径, 方法, 正文 },
  );
}

async function 选中有效证书(页面, 人员名称) {
  await 页面.getByRole("button", { name: "持证记录", exact: true }).click();
  await 页面.waitForTimeout(500);
  const 搜索 = 页面.locator('input[placeholder="搜索证书名称、人员或风险状态"]');
  await 搜索.fill(人员名称);
  await 页面.waitForTimeout(600);
  const 人员 = 页面.getByText(人员名称, { exact: true }).first();
  if (!(await 人员.count())) throw new Error(`未找到 ${人员名称} 的证书记录。`);
  await 人员.click();
  await 页面.waitForTimeout(400);
}

async function 正文字号(页面) {
  return 页面.evaluate(() => {
    const 结果 = [];
    for (const 元素 of document.querySelectorAll("body *")) {
      if (["SCRIPT", "STYLE", "NOSCRIPT", "SVG", "PATH", "OPTION"].includes(元素.tagName)) continue;
      const 样式 = getComputedStyle(元素);
      if (样式.display === "none" || 样式.visibility === "hidden" || Number(样式.opacity) === 0) continue;
      const 文本 = (元素.textContent || "").replace(/\s+/g, " ").trim();
      if (!文本) continue;
      const 框 = 元素.getBoundingClientRect();
      if (框.width <= 0 || 框.height <= 0) continue;
      结果.push({
        字号: Math.round(Number.parseFloat(样式.fontSize) * 100) / 100,
        字重: 样式.fontWeight,
        文本: 文本.slice(0, 80),
        标签: 元素.tagName,
        类名: String(元素.className || "").slice(0, 100),
        叶子: 元素.children.length === 0,
      });
    }
    return 结果;
  });
}

function 汇总字号(项列表) {
  const 分布 = {};
  const 异常样本 = [];
  const 已见 = new Set();
  for (const 项 of 项列表) {
    分布[项.字号] = (分布[项.字号] || 0) + 1;
    if ([11, 16, 22, 23].includes(项.字号)) continue;
    const 键 = `${项.字号}|${项.类名}|${项.文本}`;
    if (已见.has(键)) continue;
    已见.add(键);
    异常样本.push(项);
  }
  return {
    分布,
    异常样本: 异常样本.slice(0, 80),
    叶子异常: 异常样本.filter((项) => 项.叶子 && 项.文本.length > 1).slice(0, 80),
  };
}

try {
  const 超管 = await 登录("liulonghai", "LrCRM@2026!");
  const 证书列表 = await 请求(超管.页面, "/api/org/member-certifications");
  const 有效证书 = (证书列表.内容?.data?.items || []).find((项) => 项.statusCode === "active");
  if (!有效证书) throw new Error("测试环境没有可用于复测的有效证书。");

  结果.ORG12 = {
    证书编号: 有效证书.id,
    持有人: 有效证书.displayName,
    证书模板: 有效证书.templateName,
    初始版本: Number(有效证书.rowVersion),
  };

  await 超管.页面.goto("/admin/certifications", { waitUntil: "domcontentloaded" });
  await 超管.页面.waitForTimeout(1200);
  await 选中有效证书(超管.页面, 有效证书.displayName);

  const 延期请求 = [];
  const 延期响应 = [];
  超管.页面.on("request", (请求项) => {
    if (请求项.method() === "PUT" && 请求项.url().includes("/extend")) {
      延期请求.push(请求项.postDataJSON());
    }
  });
  超管.页面.on("response", async (响应) => {
    if (响应.request().method() === "PUT" && 响应.url().includes("/extend")) {
      延期响应.push({ 状态: 响应.status(), 正文: await 响应.text().catch(() => "") });
    }
  });
  超管.页面.once("dialog", (对话框) => 对话框.accept("2028-12-31"));
  const 延期等待 = 超管.页面.waitForResponse(
    (响应) => 响应.request().method() === "PUT" && 响应.url().includes("/extend"),
    { timeout: 12_000 },
  );
  await 超管.页面.getByRole("button", { name: "延期", exact: true }).first().click();
  const 延期HTTP = await 延期等待;
  await 超管.页面.waitForTimeout(1000);
  const 延期载荷 = JSON.parse(延期响应.at(-1)?.正文 || "{}");
  const 延期后版本 = Number(延期载荷?.data?.rowVersion || 0);
  结果.ORG12.延期 = {
    HTTP状态: 延期HTTP.status(),
    请求: 延期请求.at(-1),
    响应: 延期响应.at(-1),
    新版本: 延期后版本,
  };
  await 超管.页面.screenshot({ path: resolve(输出目录, "ORG-12-延期成功.png") });

  const 旧版本延期 = await 请求(
    超管.页面,
    `/api/org/member-certifications/${encodeURIComponent(有效证书.id)}/extend`,
    "PUT",
    { expiresOn: "2029-12-31", rowVersion: Number(有效证书.rowVersion) },
  );
  结果.ERR07.旧版本延期 = 旧版本延期;

  await 选中有效证书(超管.页面, 有效证书.displayName);
  const 撤销请求 = [];
  const 撤销响应 = [];
  超管.页面.on("request", (请求项) => {
    if (请求项.method() === "PUT" && 请求项.url().includes("/revoke")) {
      撤销请求.push(请求项.postDataJSON());
    }
  });
  超管.页面.on("response", async (响应) => {
    if (响应.request().method() === "PUT" && 响应.url().includes("/revoke")) {
      撤销响应.push({ 状态: 响应.status(), 正文: await 响应.text().catch(() => "") });
    }
  });
  超管.页面.once("dialog", (对话框) => 对话框.accept());
  const 撤销等待 = 超管.页面.waitForResponse(
    (响应) => 响应.request().method() === "PUT" && 响应.url().includes("/revoke"),
    { timeout: 12_000 },
  );
  await 超管.页面.getByRole("button", { name: "撤销", exact: true }).first().click();
  const 撤销HTTP = await 撤销等待;
  await 超管.页面.waitForTimeout(1000);
  结果.ORG12.撤销 = {
    HTTP状态: 撤销HTTP.status(),
    请求: 撤销请求.at(-1),
    响应: 撤销响应.at(-1),
  };
  await 超管.页面.screenshot({ path: resolve(输出目录, "ORG-12-撤销成功.png") });

  const 旧版本撤销 = await 请求(
    超管.页面,
    `/api/org/member-certifications/${encodeURIComponent(有效证书.id)}/revoke`,
    "PUT",
    { reason: "旧版本重复提交验证", rowVersion: 延期后版本 },
  );
  结果.ERR07.旧版本撤销 = 旧版本撤销;

  const 页面清单 = [
    ["工作台", "/admin/dashboard"],
    ["客户管理", "/admin/registration"],
    ["商机作战", "/admin/opportunity"],
    ["订单中心", "/admin/order"],
    ["报价中心", "/admin/quote"],
    ["产品目录", "/admin/products"],
    ["证书与风险", "/admin/certifications"],
    ["操作审计", "/admin/audit-logs"],
    ["403状态页", "/403"],
  ];
  for (const [名称, 路径] of 页面清单) {
    await 超管.页面.goto(路径, { waitUntil: "domcontentloaded" });
    await 超管.页面.waitForTimeout(1300);
    结果.VIS02[名称] = 汇总字号(await 正文字号(超管.页面));
    if (名称 === "报价中心") {
      await 超管.页面.screenshot({ path: resolve(输出目录, "VIS-02-报价中心字号.png") });
    }
    if (名称 === "403状态页") {
      await 超管.页面.screenshot({ path: resolve(输出目录, "VIS-02-403字号.png") });
    }
  }

  await 超管.上下文.close();
} finally {
  await 浏览器.close();
}

const 输出文件 = resolve(输出目录, `验证结果-${Date.now()}.json`);
await writeFile(输出文件, JSON.stringify(结果, null, 2));

const 所有字号异常 = Object.entries(结果.VIS02).flatMap(([页面, 项]) =>
  项.叶子异常.map((异常) => ({ 页面, ...异常 })),
);
const 延期请求版本类型 = typeof 结果.ORG12.延期?.请求?.rowVersion;
const 撤销请求版本类型 = typeof 结果.ORG12.撤销?.请求?.rowVersion;
const 证书通过 =
  结果.ORG12.延期?.HTTP状态 === 200 &&
  延期请求版本类型 === "number" &&
  结果.ORG12.撤销?.HTTP状态 === 200 &&
  撤销请求版本类型 === "number";
const 乐观锁通过 =
  结果.ERR07.旧版本延期?.状态 === 409 && 结果.ERR07.旧版本撤销?.状态 === 409;
const 字号通过 = 所有字号异常.length === 0;

console.log(
  JSON.stringify(
    {
      证据文件: 输出文件,
      ORG12: {
        结论: 证书通过 ? "通过" : "失败",
        延期状态: 结果.ORG12.延期?.HTTP状态,
        延期请求版本类型,
        撤销状态: 结果.ORG12.撤销?.HTTP状态,
        撤销请求版本类型,
      },
      ERR07: {
        结论: 乐观锁通过 ? "通过" : "失败",
        旧版本延期状态: 结果.ERR07.旧版本延期?.状态,
        旧版本撤销状态: 结果.ERR07.旧版本撤销?.状态,
      },
      VIS02: {
        结论: 字号通过 ? "通过" : "部分通过",
        异常数量: 所有字号异常.length,
        异常: 所有字号异常.slice(0, 20),
        页面分布: Object.fromEntries(
          Object.entries(结果.VIS02).map(([页面, 项]) => [页面, 项.分布]),
        ),
      },
    },
    null,
    2,
  ),
);
