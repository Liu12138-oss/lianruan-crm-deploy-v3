import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

async function 读取源码(路径: string): Promise<string> {
  return readFile(resolve(process.cwd(), 路径), "utf8");
}

describe("渠道端只读渠道关系", () => {
  it("渠道一级菜单固定六项，渠道关系和成员维护收口到企业管理", async () => {
    const [菜单源码, 路由源码] = await Promise.all([
      读取源码("src/layouts/PartnerLayout.vue"),
      读取源码("src/router/index.ts"),
    ]);

    expect(菜单源码).not.toContain('{ 名称: "渠道关系", 路径: "/partner/partners"');
    for (const 菜单名称 of ["工作台", "客户管理", "商机作战", "报价管理", "订单中心", "产品目录"]) {
      expect(菜单源码).toContain(`名称: "${菜单名称}"`);
    }
    expect(菜单源码).toContain('<details v-if="是渠道企业管理员()" class="v2-企业管理">');
    expect(菜单源码).toContain('<RouterLink to="/partner/partners">渠道关系</RouterLink>');
    expect(菜单源码).toContain('<RouterLink to="/partner/members">成员维护</RouterLink>');
    expect(路由源码).toContain(
      'const 渠道关系页面 = () => import("../features/channel/ChannelRelationshipPage.vue");',
    );
    expect(路由源码).toContain('path: "partners",');
    expect(路由源码).toContain('允许角色: ["partner"]');
  });

  it("渠道关系页只展示自身、直属一级与直属二级，不提供管理动作", async () => {
    const 源码 = await 读取源码("src/features/channel/ChannelRelationshipPage.vue");

    expect(源码).toContain('查询阶段9全部("partners")');
    expect(源码).toContain("所属一级渠道商");
    expect(源码).toContain("直属二级渠道商");
    expect(源码).toContain("原始(row).isSelf === true");
    expect(源码).toContain("经营摘要、成员和档案维护不对上下级开放");
    expect(源码).not.toContain("新建渠道商");
    expect(源码).not.toContain("渠道资质审核");
    expect(源码).not.toContain("成员维护");
    expect(源码).not.toContain("保存渠道核心档案");
  });
});
