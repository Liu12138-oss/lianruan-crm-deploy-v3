import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const 正式管理员脚本地址 = resolve(process.cwd(), "public/admin-app.js");
const 正式管理员页面地址 = resolve(process.cwd(), "public/admin.html");

describe("正式管理员页组织架构入口", () => {
  it("仅向超级管理员展示入口，并使用内部路由进入内嵌组织架构工作区", async () => {
    const 脚本文本 = await readFile(正式管理员脚本地址, "utf8");

    expect(脚本文本).toMatch(/v-if="isSuperAdmin"[^>]*[\s\S]{0,500}组织架构/);
    expect(脚本文本).toContain("'nav-item-disabled': !组织功能已启用");
    expect(脚本文本).toContain("未启用");
    expect(脚本文本).toContain("只读观察");
    expect(脚本文本).toContain('@click="打开组织架构"');
    expect(脚本文本).toContain("router.push('/organization/units')");
    expect(脚本文本).not.toContain(
      "window.location.assign('/workspace/admin/platform-admin/organization/units')",
    );
    expect(脚本文本).toContain("fetch('/api/org/status', { credentials: 'include' })");
    expect(脚本文本).toContain("accountEntryMerged: false");
    expect(脚本文本).toContain(
      "const 账号入口已合并 = computed(() => 组织功能已启用.value && 组织功能状态.value.accountEntryMerged === true);",
    );
    expect(脚本文本).toContain('v-if="isSuperAdmin && !账号入口已合并"');
    expect(脚本文本).toContain("{{ 组织入口名称 }}");
    expect(脚本文本).toContain("fetch('/api/auth/me', { credentials: 'include' })");
    expect(脚本文本).toContain("当前是升级前建立的页面会话");
    expect(脚本文本).toContain("fetch('/api/v2/auth/login'");
    expect(脚本文本).toContain("window.location.href = '/login?reason=session_mismatch'");
  });

  it("正式页面入口不经由兼容接口写入组织数据或修改功能开关", async () => {
    const 脚本文本 = await readFile(正式管理员脚本地址, "utf8");

    expect(脚本文本).not.toContain("/api/v2/org");
    expect(脚本文本).not.toContain("V3_ORGANIZATION_ENABLED");
    expect(脚本文本).not.toContain("V3_ORGANIZATION_WRITE_ENABLED");
    expect(脚本文本).not.toContain("V3_DIRECTORY_SYNC_ENABLED");
  });

  it("账号入口合并只收口超级管理员菜单，不影响普通区域管理员的企业管理员入口", async () => {
    const 脚本文本 = await readFile(正式管理员脚本地址, "utf8");

    expect(脚本文本).toContain(
      'v-if="!isSuperAdmin || !账号入口已合并" :class="{active:$route.path===\'/partner-admin\'}"',
    );
    expect(脚本文本).toContain(
      'v-if="isSuperAdmin && !账号入口已合并" :class="{active:$route.path===\'/account-manage\'}"',
    );
    expect(脚本文本).toContain(
      'v-if="isSuperAdmin" :class="{active:$route.path.startsWith(\'/organization\')',
    );
    expect(脚本文本).toContain(
      "const 组织入口名称 = computed(() => 账号入口已合并.value ? '组织与账号' : '组织架构');",
    );
  });

  it("正式页面使用本次组织状态入口对应的稳定资源版本", async () => {
    const 页面文本 = await readFile(正式管理员页面地址, "utf8");

    expect(页面文本).toContain('<script src="admin-app.js?v=159"></script>');
  });
});
