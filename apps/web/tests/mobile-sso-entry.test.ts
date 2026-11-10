import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const 页面 = readFileSync(resolve(process.cwd(), "public/sso-mobile.html"), "utf8");

describe("手机端轻量单点登录页", () => {
  it("不依赖完整前端应用和模块脚本", () => {
    expect(页面).not.toContain('type="module"');
    expect(页面).not.toContain("/assets/index-");
    expect(页面).toContain("正在准备单点登录");
  });

  it("覆盖 IAM、UniSDP、EMM 与页面会话写入", () => {
    expect(页面).toContain("/api/auth/sso/iam/login");
    expect(页面).toContain("/api/auth/sso/unisdp/login");
    expect(页面).toContain("/api/auth/sso/iam/config");
    expect(页面).toContain("/emm-h5-sso.js");
    expect(页面).toContain('"admin_"');
    expect(页面).toContain('"partner_"');
    expect(页面).toContain('"auth_token"');
    expect(页面).toContain('"mobile_auth_token"');
    expect(页面).toContain('"mobile_user_info"');
    expect(页面).toContain("/admin-mobile.html#/admin/home");
    expect(页面).toContain("/partner-mobile.html#/partner/home");
  });
});
