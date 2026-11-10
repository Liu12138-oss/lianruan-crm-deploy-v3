import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

async function 读取源码(路径: string): Promise<string> {
  return readFile(resolve(process.cwd(), 路径), "utf8");
}

describe("渠道商维护能力补齐", () => {
  it("渠道列表提供新建入口和完整维护字段", async () => {
    const 源码 = await 读取源码("src/features/channel/ChannelListPage.vue");

    expect(源码).toContain("新建渠道商");
    expect(源码).toContain('@click="打开新建渠道商"');
    expect(源码).toContain("新建表单.cooperationLevel");
    expect(源码).toContain("新建表单.distributionLevel");
    expect(源码).toContain("新建表单.parentPartnerIds");
    expect(源码).toContain("新建表单.address");
    expect(源码).toContain("新建表单.cooperationBackground");
    expect(源码).toContain("新建表单.agencyBrandsText");
    expect(源码).toContain("新建表单.typicalCustomersText");
    expect(源码).toContain("新建表单.customerIndustriesText");
    expect(源码).toContain("保存渠道核心档案");
  });

  it("核心档案提供经营地址、合作背景、经营能力和合作层级维护入口，列表不重复展示入口", async () => {
    const [列表源码, 档案源码, 客户端源码] = await Promise.all([
      读取源码("src/features/channel/ChannelListPage.vue"),
      读取源码("src/features/channel/ChannelProfilePage.vue"),
      读取源码("src/features/channel/channel-profile-client.ts"),
    ]);

    expect(列表源码).not.toContain("档案维护入口");
    expect(列表源码).toContain("渠道核心档案");
    expect(列表源码).toContain("所属一级渠道商");
    expect(列表源码).toContain("直属二级渠道商");
    expect(档案源码).toContain("合作级别用于渠道评级；分销层级用于区分一级、二级渠道和价格取价。");
    expect(档案源码).toContain("表单.cooperationLevel");
    expect(档案源码).toContain("表单.distributionLevel");
    expect(档案源码).toContain("表单.parentPartnerIds");
    expect(档案源码).toContain("multiple");
    expect(档案源码).toContain("合作级别");
    expect(客户端源码).toContain('fetch("/api/v2/partners"');
    expect(客户端源码).toContain("/level");
  });

  it("渠道列表展示直属上下级关系并收敛上级档案为只读", async () => {
    const [列表源码, 档案源码, 接口源码, 客户端源码] = await Promise.all([
      读取源码("src/features/channel/ChannelListPage.vue"),
      读取源码("src/features/channel/ChannelProfilePage.vue"),
      读取源码("../api/src/business-store.ts"),
      读取源码("src/features/channel/channel-profile-client.ts"),
    ]);

    expect(列表源码).toContain("parentPartnerNames");
    expect(列表源码).toContain("childPartnerNames");
    expect(列表源码).toContain("所属一级：");
    expect(列表源码).toContain("直属二级：");
    expect(档案源码).toContain("上下级只读");
    expect(档案源码).toContain('v-if="!关联只读" class="档案分组 经营摘要组"');
    expect(接口源码).toContain("scope_relation.relation_code = 'primary_secondary'");
    expect(客户端源码).toContain('relationship?: "self" | "parent" | "child" | "internal"');
  });

  it("技术服务商类型只保留签约和提名，保存有反馈且列表不重复展示档案动作", async () => {
    const [列表源码, 档案源码] = await Promise.all([
      读取源码("src/features/channel/ChannelListPage.vue"),
      读取源码("src/features/channel/ChannelProfilePage.vue"),
    ]);

    expect(档案源码).toContain('<option value="full">签约技术服务商</option>');
    expect(档案源码).toContain('<option value="developing">提名技术服务商</option>');
    expect(档案源码).not.toContain("全能力技术服务商");
    expect(档案源码).not.toContain("交付服务商");
    expect(档案源码).not.toContain("集成服务商");
    expect(档案源码).not.toContain("发展中技术服务商");
    expect(档案源码).toContain('ElMessage.success("渠道核心档案已保存。")');
    expect(列表源码).not.toContain(":actions=\"[{ text: '查看档案' }, { text: '成员维护' }]\"");
  });
});
