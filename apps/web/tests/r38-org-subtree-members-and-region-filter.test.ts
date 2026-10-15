import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const 根目录 = process.cwd();

async function 读取(路径: string): Promise<string> {
  return readFile(resolve(根目录, 路径), "utf8");
}

describe("R38 组织部门含子部门成员与渠道商/商机区域检索", () => {
  it("组织架构点击部门后展示本部门与全部子部门成员", async () => {
    const 组织页 = await 读取("src/pages/admin/platform-admin/OrganizationWorkspacePage.vue");

    expect(组织页).toContain("当前部门节点");
    expect(组织页).toContain("收集成员");
    expect(组织页).toContain("flatMap(收集成员)");
    expect(组织页).toContain("当前部门含下级");
    expect(组织页).toContain("（含子部门）");
    expect(组织页).toContain("该部门及子部门暂无成员");
  });

  it("组织成员卡片标注所属部门，便于区分直属与子部门成员", async () => {
    const 组织页 = await 读取("src/pages/admin/platform-admin/OrganizationWorkspacePage.vue");

    expect(组织页).toContain("组装成员概要(成员, 当前节点.label)");
    expect(组织页).toContain("所属部门: string");
    expect(组织页).toContain("组织成员部门");
    expect(组织页).toContain("<dt>所属部门</dt>");
  });

  it("渠道商列表支持按区域检索并与客户列表口径一致", async () => {
    const 渠道页 = await 读取("src/features/channel/ChannelListPage.vue");

    expect(渠道页).toContain("function 区域文本");
    expect(渠道页).toContain('字段(row, "region")');
    expect(渠道页).toContain('字段(row, "regionName")');
    expect(渠道页).toContain('列表 = 列表.filter((row) => 区域文本(row) === 选中区域.value)');
    expect(渠道页).toContain(':区域列表="区域选项"');
    expect(渠道页).toContain(':选中区域="选中区域"');
    expect(渠道页).toContain('@update:选中区域="选中区域 = $event"');
  });

  it("商机列表区域检索兼容中文键与英文历史键", async () => {
    const 商机页 = await 读取("src/features/opportunity/OpportunityCenterPage.vue");

    expect(商机页).toContain("function 区域文本");
    expect(商机页).toContain('字段(row, "region")');
    expect(商机页).toContain('字段(row, "regionName")');
    expect(商机页).toContain('列表 = 列表.filter((row) => 区域文本(row) === 选中区域.value)');
    expect(商机页).toContain(':区域列表="区域选项"');
    expect(商机页).toContain(':选中区域="选中区域"');
  });

  it("渠道商与商机卡片展示区域，与区域筛选口径一致", async () => {
    const [渠道页, 商机页] = await Promise.all([
      读取("src/features/channel/ChannelListPage.vue"),
      读取("src/features/opportunity/OpportunityCenterPage.vue"),
    ]);

    expect(渠道页).toContain("区域文本(row) || '未填写区域'");
    expect(商机页).toContain("区域文本(row) || '未填写区域'");
    expect(商机页).toContain('区域文本(当前商机) || "未填写"');
  });
});
