import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const baseUrl = process.env.V3_TEST_BASE_URL || "http://10.9.86.66";
const username = process.env.V3_TEST_USERNAME || "";
const password = process.env.V3_TEST_PASSWORD || "";

if (!username || !password) {
  throw new Error("请通过 V3_TEST_USERNAME 和 V3_TEST_PASSWORD 提供测试账号。");
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const outputDir =
  process.env.V3_TEST_EVIDENCE_DIR ||
  path.join(scriptDir, "../test-evidence/20260923-business-baseline");
const screenshotsDir = path.join(outputDir, "screenshots");
await fs.mkdir(screenshotsDir, { recursive: true });

const adminRoutes = [
  "dashboard",
  "registration",
  "opportunity",
  "quote",
  "order",
  "products",
  "partner-report",
  "partners",
  "partner-admin",
  "admin-review",
  "account-manage",
  "audit-logs",
  "openapi-integration",
  "message-platform",
  "message-rules",
  "organization/units",
  "notifications",
];

const partnerRoutes = [
  "dashboard",
  "registration",
  "opportunity",
  "quote",
  "order",
  "products",
  "notifications",
];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const consoleErrors = [];
const failedResponses = [];
const records = [];

async function maskSensitiveText(page) {
  await page.evaluate(() => {
    const mask = (value) =>
      value
        .replace(/1[3-9]\d{9}/g, (phone) => `${phone.slice(0, 3)}****${phone.slice(-4)}`)
        .replace(/([A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g, "$1***@$2")
        .replace(/\d{6,}(?=[^0-9]|$)/g, (value) => `${value.slice(0, 3)}***${value.slice(-2)}`);
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      if (node.nodeValue) node.nodeValue = mask(node.nodeValue);
      node = walker.nextNode();
    }
  });
}

page.on("pageerror", (error) => consoleErrors.push(`pageerror:${error.message}`));
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(`console:${message.text()}`);
});
page.on("response", (response) => {
  if (response.status() >= 400) {
    failedResponses.push({
      status: response.status(),
      method: response.request().method(),
      url: response.url(),
      page: page.url(),
    });
  }
});

await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle", timeout: 30000 });
await page.locator("input").nth(0).fill(username);
await page.locator("input").nth(1).fill(password);
await page.getByRole("button", { name: /登\s*录|登录/ }).click();
await page.waitForURL(/(admin|partner|mobile)\.html/, { timeout: 30000 });
await page.waitForLoadState("networkidle");

const portalPath = new URL(page.url()).pathname;
const portal = portalPath.includes("partner")
  ? "partner"
  : portalPath.includes("mobile")
    ? "mobile"
    : "admin";
const routes = portal === "partner" ? partnerRoutes : adminRoutes;
const pageBase = portal === "partner" ? "partner" : "admin";

for (const [index, route] of routes.entries()) {
  const file = `${String(index + 1).padStart(2, "0")}-${route.replaceAll("/", "-")}.png`;
  const url = `${baseUrl}/${pageBase}.html#/${route}`;
  const response = await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(1200);

  const pageData = await page.evaluate(() => {
    const visibleButtons = [...document.querySelectorAll("button")]
      .filter((button) => {
        const style = getComputedStyle(button);
        const rect = button.getBoundingClientRect();
        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          rect.width > 0 &&
          rect.height > 0
        );
      })
      .map((button) => (button.innerText || "").trim())
      .filter(Boolean);
    return {
      title: document.title,
      text: (document.body.innerText || "").replace(/\s+/g, " ").slice(0, 1200),
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      bodyScrollWidth: document.body.scrollWidth,
      tableRows: document.querySelectorAll("tbody tr").length,
      cards: document.querySelectorAll(".card, [class*='card']").length,
      buttons: [...new Set(visibleButtons)].slice(0, 30),
    };
  });

  await maskSensitiveText(page);
  await page.screenshot({ path: path.join(screenshotsDir, file), fullPage: true });

  let overlay = null;
  const viewButton = page.getByRole("button", { name: /^查看$|^详情$|查看详情/ }).first();
  if (await viewButton.count()) {
    try {
      await viewButton.click({ timeout: 3000 });
      await page.waitForTimeout(300);
      const overlayLocator = page.locator(
        ".modal-overlay:visible, .el-dialog:visible, .drawer:visible, [class*='drawer']:visible",
      );
      if (await overlayLocator.count()) {
        const overlayFile = `${String(index + 1).padStart(2, "0")}-${route.replaceAll("/", "-")}-detail.png`;
        await maskSensitiveText(page);
        await page.screenshot({
          path: path.join(screenshotsDir, overlayFile),
          fullPage: false,
        });
        overlay = {
          file: overlayFile,
          text: (await overlayLocator.first().innerText()).replace(/\s+/g, " ").slice(0, 1200),
        };
      }
    } catch {
      overlay = null;
    }
  }

  records.push({ route, url, status: response?.status() || 0, file, ...pageData, overlay });
}

const summary = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  version: "see-health-endpoint",
  routes: records,
  consoleErrors: [...new Set(consoleErrors)],
  failedResponses,
};

await fs.writeFile(
  path.join(outputDir, "baseline-results.json"),
  `${JSON.stringify(summary, null, 2)}\n`,
);
console.log(
  JSON.stringify(
    { outputDir, pages: records.length, consoleErrors: summary.consoleErrors },
    null,
    2,
  ),
);
await browser.close();
