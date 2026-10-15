import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const 正式管理员脚本地址 = resolve(process.cwd(), "public/admin-app.js");
const 正式管理员页面地址 = resolve(process.cwd(), "public/admin.html");

describe("正式管理员核心管理入口可见性", () => {
  it("超级管理员可以从侧栏直接进入人天与工作量配置", async () => {
    const 脚本文本 = await readFile(正式管理员脚本地址, "utf8");

    expect(脚本文本).toContain("人天与工作量配置");
    expect(脚本文本).toContain(
      `v-if="isSuperAdmin" :class="{active:$route.path==='/workload-config'}" @click="go('/workload-config')"`,
    );
    expect(脚本文本).toContain("'/workload-config': '人天与工作量配置'");
  });

  it("管理账号可以从侧栏直接进入消息中心", async () => {
    const 脚本文本 = await readFile(正式管理员脚本地址, "utf8");

    expect(脚本文本).toContain(
      `:class="{active:$route.path==='/notifications'}" @click="go('/notifications')"`,
    );
    expect(脚本文本).toContain("查看全部消息");
    expect(脚本文本).toContain("'/notifications': '消息中心'");
  });

  it("管理员页面使用包含本次导航调整的稳定脚本版本", async () => {
    const 页面文本 = await readFile(正式管理员页面地址, "utf8");

    expect(页面文本).toContain('<script src="admin-app.js?v=168"></script>');
  });
});
