import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const 排版锁地址 = resolve(process.cwd(), "src/styles/war-typography-lock.css");

describe("新 UI 全站字号锁", () => {
  it("只允许 22/16/23/11px 四档字号", async () => {
    const 样式 = await readFile(排版锁地址, "utf8");
    const 字号集 = new Set(
      [...样式.matchAll(/font-size:\s*(\d+)px\s*!important/g)].map((匹配) => 匹配[1]),
    );

    expect([...字号集].sort()).toEqual(["11", "16", "22", "23"]);
  });

  it("一级导航按正文 11px、加粗和 8px 间距统一", async () => {
    const 样式 = await readFile(排版锁地址, "utf8");

    expect(样式).toMatch(
      /\.v2-桌面布局 \.v2-顶部业务导航 \.v2-一级导航 \{[\s\S]*?gap: 8px !important;/,
    );
    expect(样式).toMatch(
      /\.v2-桌面布局 \.v2-顶部业务导航 \.v2-一级导航项 span[\s\S]*?font-size: 11px !important;[\s\S]*?font-weight: 700 !important;/,
    );
  });

  it("403/404/维护/会话失效页使用 22px 一级标题和 11px 其余文字", async () => {
    const 样式 = await readFile(排版锁地址, "utf8");

    expect(样式).toMatch(/\.状态页,\n\.状态页 \*,[\s\S]*?font-family: var\(--font\) !important;/);
    expect(样式).toMatch(/\.状态页,\n\.状态页 \* \{[\s\S]*?font-size: 11px !important;/);
    expect(样式).toMatch(/\.状态页 h1 \{[\s\S]*?font-size: 22px !important;/);
    expect(样式).toMatch(/\.状态页 \.主按钮 \{[\s\S]*?font-weight: 700 !important;/);
  });

  it("根容器与强调文字归入 11px 和 700 两档", async () => {
    const 样式 = await readFile(排版锁地址, "utf8");

    expect(样式).toContain("#app {\n  font-size: 11px !important;\n}");
    expect(样式).not.toMatch(/font-weight: 800/);
  });
});
