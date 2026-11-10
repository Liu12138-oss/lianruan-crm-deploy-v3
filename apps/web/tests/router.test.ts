import { describe, expect, it } from "vitest";

import { routes } from "../src/router.js";

describe("前端测试路由", () => {
  it("包含登录、管理端、渠道端和移动端布局，不再暴露 unified 测试页", () => {
    const paths = routes.map((route) => route.path);
    expect(paths).toContain("/");
    expect(paths).toContain("/login");
    expect(paths).toContain("/sso/iam");
    expect(paths).toContain("/sso/unisdp");
    expect(paths).toContain("/admin");
    expect(paths).toContain("/partner");
    expect(paths).toContain("/mobile");
    expect(paths).not.toContain("/unified");
  });

  it("包含中文错误页入口", () => {
    expect(routes.map((route) => route.path)).toEqual(
      expect.arrayContaining(["/403", "/session-expired", "/maintenance"]),
    );
  });
});
