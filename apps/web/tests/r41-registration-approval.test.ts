import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const 根目录 = process.cwd();

async function 读取(路径: string): Promise<string> {
  return readFile(resolve(根目录, 路径), "utf8");
}

describe("R41 客户报备审核动作补齐", () => {
  it("审核组件对待审核报备提供通过 / 驳回，驳回必填原因", async () => {
    const 组件 = await 读取("src/features/customer/RegistrationReviewActions.vue");

    expect(组件).toContain("✓ 通过报备");
    expect(组件).toContain("✕ 驳回报备");
    expect(组件).toContain('审核动作.value === "驳回" && !审核意见.value.trim()');
    expect(组件).toContain('status: 目标状态');
    expect(组件).toContain('决定 === "通过" ? "approved" : 决定 === "驳回" ? "rejected" : "pending"');
  });

  it("审核按钮仅内部管理员可见，渠道端只能看到报备商机入口", async () => {
    const 组件 = await 读取("src/features/customer/RegistrationReviewActions.vue");

    expect(组件).toContain('import { 是内部管理员 } from "../../shared/permission/role.js";');
    expect(组件).toContain('v-if="内部管理员 && 待审核"');
    expect(组件).toContain('v-if="内部管理员 && 已驳回"');
    expect(组件).toContain('v-if="已通过"');
    expect(组件).toContain("/opportunity/new?registrationId=");
  });

  it("已驳回报备支持重新提交，回到待审核", async () => {
    const 组件 = await 读取("src/features/customer/RegistrationReviewActions.vue");

    expect(组件).toContain("↻ 重新提交");
    expect(组件).toContain("打开审核('重提')");
    expect(组件).toContain("客户报备已重新提交，等待审核。");
  });

  it("审核中心处理落地的客户跟进页与客户列表都接入审核组件", async () => {
    const 跟进页 = await 读取("src/features/customer/CustomerFollowupPage.vue");
    const 列表页 = await 读取("src/features/customer/CustomerManagementPage.vue");

    expect(跟进页).toContain('import RegistrationReviewActions from "./RegistrationReviewActions.vue";');
    expect(跟进页).toContain('<RegistrationReviewActions :客户="客户" 尺寸="大" @更新="应用审核结果" />');
    expect(跟进页).toContain("function 应用审核结果(记录: 阶段9记录)");

    expect(列表页).toContain('import RegistrationReviewActions from "./RegistrationReviewActions.vue";');
    expect(列表页).toContain('<RegistrationReviewActions :客户="当前客户" @更新="应用审核结果" />');
    expect(列表页).toContain("function 应用审核结果(记录: 阶段9记录)");
  });

  it("报备商机入口携带 registrationId，新建商机页自动预选该报备客户", async () => {
    const 新建商机页 = await 读取("src/features/opportunity/OpportunityCreatePage.vue");

    expect(新建商机页).toContain("useRoute");
    expect(新建商机页).toContain('String(路由.query.registrationId || "")');
    expect(新建商机页).toContain("表单.报备编号 = 指定报备");
  });
});
