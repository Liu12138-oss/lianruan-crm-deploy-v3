import { describe, expect, it } from "vitest";

import {
  Iam平台单点登录路径,
  单点登录路径,
  UniSdp平台单点登录路径,
  构建UniSdp单点登录跳转,
  构建单点登录跳转,
  是平台专属单点登录路径,
  识别单点登录提供方,
  需要转入UniSdp单点登录,
  需要转入单点登录,
} from "../src/router/sso-entry.js";

function 测试路由(path: string, query: Record<string, string> = {}, hash = "") {
  return { path, query, hash } as never;
}

describe("统一链接单点登录入口识别", () => {
  it("UniSDP门户根路径带sso_token时转入UniSDP前端单点入口", () => {
    const 路由 = 测试路由("/", { sso_token: "test-token" });

    expect(需要转入UniSdp单点登录(路由)).toBe(true);
    expect(需要转入单点登录(路由)).toBe(false);
    expect(构建UniSdp单点登录跳转(路由)).toEqual({
      path: UniSdp平台单点登录路径,
      query: { sso_token: "test-token", provider: "unisdp", fallback: "login" },
      hash: "",
    });
  });

  it("登录页带旧PC code凭证时不再自动转入旧兼容单点登录页", () => {
    const 路由 = 测试路由("/login", { code: "test-token" });

    expect(需要转入单点登录(路由)).toBe(false);
  });

  it("旧PC占位符code参数不再触发IAM单点登录", () => {
    expect(需要转入单点登录(测试路由("/", { code: "test-token" }))).toBe(false);
  });

  it("兼容PC平台单点凭证参数的大小写和下划线差异", () => {
    expect(需要转入UniSdp单点登录(测试路由("/", { ssoToken: "test-token" }))).toBe(true);
    expect(需要转入UniSdp单点登录(测试路由("/", { SSOTOKEN: "test-token" }))).toBe(true);
    expect(需要转入UniSdp单点登录(测试路由("/", { SSO_TOKEN: "test-token" }))).toBe(true);
    expect(需要转入UniSdp单点登录(测试路由("/", {}, "#/login?Sso_Token=test-token"))).toBe(
      true,
    );
  });

  it("根路径 hash 带UniSDP凭证时自动转入后端门户单点入口", () => {
    const 路由 = 测试路由("/", {}, "#/login?ssotoken=test-token");

    expect(需要转入UniSdp单点登录(路由)).toBe(true);
  });

  it("EMM 统一链接无凭证时也自动转入单点登录页", () => {
    const 路由 = 测试路由("/login", { source: "emm" });

    expect(需要转入单点登录(路由)).toBe(true);
  });

  it("普通账号密码登录页不触发单点登录", () => {
    expect(需要转入单点登录(测试路由("/login"))).toBe(false);
    expect(需要转入单点登录(测试路由(单点登录路径, { sso_token: "test-token" }))).toBe(false);
  });

  it("平台专属入口由路径固定识别，避免两个PC平台互相抢入口", () => {
    const iam路由 = 测试路由(Iam平台单点登录路径, {
      provider: "unisdp",
      sso_token: "test-token",
    });
    const uniSdp路由 = 测试路由(UniSdp平台单点登录路径, {
      provider: "iam",
      sso_token: "test-token",
    });

    expect(识别单点登录提供方(iam路由)).toBe("iam");
    expect(识别单点登录提供方(uniSdp路由)).toBe("unisdp");
    expect(需要转入UniSdp单点登录(iam路由)).toBe(false);
    expect(需要转入单点登录(uniSdp路由)).toBe(false);
    expect(是平台专属单点登录路径(Iam平台单点登录路径)).toBe(true);
    expect(是平台专属单点登录路径(UniSdp平台单点登录路径)).toBe(true);
  });

  it("UniSDP单点处理页带凭证时不重复重定向自己", () => {
    const 路由 = 测试路由(单点登录路径, { sso_token: "test-token", provider: "unisdp" });

    expect(需要转入UniSdp单点登录(路由)).toBe(false);
    expect(需要转入单点登录(路由)).toBe(false);
  });

  it("裸根路径可生成自动单点登录跳转", () => {
    expect(构建单点登录跳转(测试路由("/"), { 自动尝试: true, 失败回登录: true })).toEqual({
      path: Iam平台单点登录路径,
      query: { autoSso: "1", fallback: "login" },
      hash: "",
    });
  });
});
