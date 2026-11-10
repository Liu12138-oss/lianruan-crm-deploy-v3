import { describe, expect, it } from "vitest";

import {
  判断导航激活,
  取当前一级导航,
  管理端顶部导航,
} from "../src/shared/navigation/admin-navigation.js";

describe("第二轮测试管理配置入口", () => {
  const 配置菜单 = 管理端顶部导航.find((项目) => 项目.简称 === "配置");

  it("角色、数据范围、工作量和数据导入导出均可从配置菜单直接进入", () => {
    const 路径 = new Set(配置菜单?.子项?.map((子项) => 子项.路径));

    expect(路径).toContain("/admin/organization/business-roles");
    expect(路径).toContain("/admin/organization/data-scopes");
    expect(路径).toContain("/admin/workload-config");
    expect(路径).toContain("/admin/data-import-export");
  });

  it("工作量配置只归属管理配置，避免产品目录与配置菜单重复高亮", () => {
    const 产品目录 = 管理端顶部导航.find((项目) => 项目.简称 === "产品");

    expect(产品目录 && 判断导航激活("/admin/workload-config", 产品目录)).toBe(false);
    expect(取当前一级导航("/admin/workload-config", 管理端顶部导航)?.简称).toBe("配置");
  });
});
