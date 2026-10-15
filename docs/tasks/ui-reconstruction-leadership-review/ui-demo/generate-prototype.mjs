import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const base = path.dirname(fileURLToPath(import.meta.url));
const screenshotDir = path.join(base, "screenshots");
const windowDir = path.join(screenshotDir, "windows-v3");

await fs.mkdir(screenshotDir, { recursive: true });
await fs.mkdir(windowDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 2,
});

await page.goto(pathToFileURL(path.join(base, "index.html")).href, {
  waitUntil: "networkidle",
});

const screens = await page.evaluate(() => window.demoScreens);
const pages = [];

for (let index = 0; index < screens.length; index += 1) {
  const screen = screens[index];
  await page.evaluate((id) => window.demoGo(id), screen);
  await page.waitForTimeout(35);
  const file = `${String(index + 1).padStart(2, "0")}-${screen}.png`;
  await page.locator(".demo-artboard").screenshot({ path: path.join(screenshotDir, file) });
  pages.push(file);
}

const discoveredModals = [];
for (const screen of screens) {
  await page.evaluate((id) => window.demoGo(id), screen);
  const values = await page
    .locator("[data-modal]")
    .evaluateAll((nodes) => [...new Set(nodes.map((node) => node.dataset.modal))]);
  discoveredModals.push(...values);
}

const modalities = [...new Set(discoveredModals)]
  .filter((value) => value && !value.includes("${"))
  .sort();
const windows = [];

for (let index = 0; index < modalities.length; index += 1) {
  const modal = modalities[index];
  await page.evaluate((id) => window.demoModal(id), modal);
  await page.waitForTimeout(25);
  const count = await page.locator(".overlay, .drawer").count();
  if (!count) throw new Error(`Modal did not render: ${modal}`);
  const file = `${String(index + 1).padStart(2, "0")}-${modal}.png`;
  await page.screenshot({ path: path.join(windowDir, file), fullPage: false });
  windows.push(file);
}

const evidence = {
  generatedAt: new Date().toISOString(),
  pageCount: pages.length,
  windowCount: windows.length,
  pages,
  windows,
};

await fs.writeFile(
  path.join(base, "PROTOTYPE-EVIDENCE.json"),
  `${JSON.stringify(evidence, null, 2)}\n`,
);

console.log(`Generated ${pages.length} pages and ${windows.length} windows.`);
await browser.close();
