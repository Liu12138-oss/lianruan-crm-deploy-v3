// @vitest-environment jsdom

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { router } from "../src/router/index.js";

const 工程化组织页面地址 = resolve(
  process.cwd(),
  "src/pages/admin/platform-admin/OrganizationWorkspacePage.vue",
);

describe("组织架构工程化工作区路由", () => {
  it("仅注册独立的桌面端工作区路径", () => {
    const 路径列表 = router.getRoutes().map((路由) => 路由.path);

    expect(路径列表).toEqual(
      expect.arrayContaining([
        "/workspace/admin/platform-admin/organization",
        "/workspace/admin/platform-admin/organization/units",
        "/workspace/admin/platform-admin/organization/staff",
        "/workspace/admin/platform-admin/organization/business-roles",
        "/workspace/admin/platform-admin/organization/certifications",
        "/workspace/admin/platform-admin/organization/offboarding",
        "/workspace/admin/platform-admin/organization/directory-sync",
        "/workspace/admin/platform-admin/organization/external-identities",
      ]),
    );
    expect(路径列表).not.toEqual(
      expect.arrayContaining([
        "/admin.html",
        "/admin-mobile.html",
        "/partner.html",
        "/partner-mobile.html",
      ]),
    );
  });

  it("所有组织工作区页面均要求现有 Cookie 会话", () => {
    const 组织页面 = router
      .getRoutes()
      .filter((路由) => 路由.path.startsWith("/workspace/admin/platform-admin/organization/"));

    expect(组织页面.length).toBeGreaterThan(0);
    expect(组织页面.every((路由) => 路由.meta.需要登录 === true)).toBe(true);
  });

  it("编辑现有账号不提供直接停用或启用入口", async () => {
    const 页面文本 = await readFile(工程化组织页面地址, "utf8");

    expect(页面文本).toContain(
      '<input :value="状态中文(编辑用户.status)" class="form-control" disabled />',
    );
    expect(页面文本).toContain("停用账号必须通过“停用并交接”流程处理。");
    expect(页面文本).not.toContain('@click="切换账号状态"');
    expect(页面文本).not.toContain("async function 切换账号状态");
  });

  it("成员编辑部门下拉来自完整组织树，且证书文案不表示自动联动", async () => {
    const 页面文本 = await readFile(工程化组织页面地址, "utf8");

    expect(页面文本).toContain("const 平铺组织列表 = computed(() => 展开组织树(组织树.value));");
    expect(页面文本).toContain('v-model="新任职表单.orgUnitId"');
    expect(页面文本).toContain('v-for="组织 in 平铺组织列表"');
    expect(页面文本).toContain(':value="组织.id"');
    expect(页面文本).toContain("证书到期仅告警，不自动撤销业务角色");
    expect(页面文本).not.toContain("颁发证书后自动授予业务角色");
    expect(页面文本).not.toContain("撤销证书后自动回收业务角色");
  });
});
