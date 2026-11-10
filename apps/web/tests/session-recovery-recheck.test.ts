import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("浏览器缓存恢复会话复核", () => {
  it("后退与页面缓存恢复时重新校验服务端会话", async () => {
    const 入口 = await readFile(resolve(process.cwd(), "src/main.ts"), "utf8");

    expect(入口).toContain("校验页面会话有效");
    expect(入口).toContain('window.addEventListener("pageshow"');
    expect(入口).toContain('window.addEventListener("pageshow", () => 复核页面会话())');
    expect(入口).toContain('window.addEventListener("popstate", () => 复核页面会话(true))');
    expect(入口).toContain("router.afterEach(() => 复核页面会话())");
    expect(入口).not.toContain("if (!存在业务页面会话())");
    expect(入口).toContain("新标签页初次打开时只有 HttpOnly Cookie");
    expect(入口).toContain('window.location.replace("/login")');
  });
});
