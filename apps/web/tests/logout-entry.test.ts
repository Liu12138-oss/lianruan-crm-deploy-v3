import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const 根目录 = resolve(import.meta.dirname, "..");

describe("兼容业务入口退出登录", () => {
  it("管理员端等待服务端退出后再跳转", async () => {
    const 内容 = await readFile(resolve(根目录, "public/admin-app.js"), "utf8");

    expect(内容).toContain("async function logout()");
    expect(内容).toContain("await adminFetch('/api/auth/logout'");
    expect(内容).toContain("window.location.replace('/login')");
    expect(内容).not.toContain(
      "adminFetch('/api/auth/logout', { method: 'POST' }).catch(() => {});",
    );
  });

  it("渠道商端等待服务端退出后再跳转", async () => {
    const 内容 = await readFile(resolve(根目录, "public/partner-app.js"), "utf8");

    expect(内容).toContain("async function logout()");
    expect(内容).toContain("await partnerFetch('/api/auth/logout'");
    expect(内容).toContain("window.location.replace('/login')");
    expect(内容).not.toContain(
      "partnerFetch('/api/auth/logout', { method: 'POST' }).catch(() => {});",
    );
  });
});
