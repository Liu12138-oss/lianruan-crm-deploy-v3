import { describe, expect, it } from "vitest";

import type { 登录用户 } from "../src/api/auth-client.js";
import {
  判断导航激活,
  取当前一级导航,
  可见管理端顶部导航,
  管理端顶部导航,
} from "../src/shared/navigation/admin-navigation.js";
import {
  判断平台角色,
  可访问管理配置,
  可访问内部管理员维护,
  取最具体角色约束,
} from "../src/shared/permission/role.js";

function 用户(roleName: string): 登录用户 {
  return {
    username: roleName,
    displayName: roleName,
    roleName,
    defaultPath: "/admin/dashboard",
    allowedPaths: ["/admin"],
  };
}

describe("管理端角色权限", () => {
  it("识别超管和区域管理员", () => {
    expect(判断平台角色(用户("超级管理员"))).toBe("superadmin");
    expect(判断平台角色(用户("区域管理员"))).toBe("region_manager");
  });

  it("区域管理员看不到管理配置，超管可见", () => {
    expect(可访问管理配置(用户("区域管理员"))).toBe(false);
    expect(可见管理端顶部导航(用户("区域管理员")).map((item) => item.简称)).not.toContain("配置");
    expect(可访问管理配置(用户("超级管理员"))).toBe(true);
    expect(可见管理端顶部导航(用户("超级管理员")).map((item) => item.简称)).toContain("配置");
  });

  it("审核中心是独立一级入口：区域管理员可见，且只命中审核一个一级菜单", () => {
    const 区域导航 = 可见管理端顶部导航(用户("区域管理员")).map((item) => item.简称);
    expect(区域导航).toContain("审核");

    const 命中菜单 = 管理端顶部导航
      .filter((项目) => 判断导航激活("/admin/admin-review", 项目))
      .map((项目) => 项目.简称);
    expect(命中菜单).toEqual(["审核"]);
    // 审核页没有二级菜单条，配置二级导航不得在此路径出现。
    expect(取当前一级导航("/admin/admin-review", 管理端顶部导航)).toBeUndefined();
  });

  it("内部管理员维护仅超管开放", () => {
    expect(可访问内部管理员维护(用户("区域管理员"))).toBe(false);
    expect(可访问内部管理员维护(用户("超级管理员"))).toBe(true);
  });

  it("子路由角色约束覆盖父级允许范围", () => {
    expect(取最具体角色约束([["superadmin", "region_manager"], ["superadmin"]])).toEqual([
      "superadmin",
    ]);
    expect(取最具体角色约束([["superadmin", "region_manager"], undefined])).toEqual([
      "superadmin",
      "region_manager",
    ]);
  });
});
