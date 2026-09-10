import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const 正式管理员脚本地址 = resolve(process.cwd(), "public/admin-app.js");

describe("超管提醒规则保存入口", () => {
  it("所有启用的系统业务事件规则均显示保存入口", async () => {
    const 脚本文本 = await readFile(正式管理员脚本地址, "utf8");

    expect(脚本文本).toContain(
      `v-else-if="selectedRule.statusCode==='active'" class="btn btn-primary" :disabled="saving===selectedRule.subscriptionCode" @click="saveEventRule(selectedRule)"`,
    );
    expect(脚本文本).not.toContain(
      "selectedRule.protectionLevel==='mandatory' && selectedRule.statusCode==='active'",
    );
  });

  it("保存业务事件时保留站内提醒，并传递报备待审批的可配置范围", async () => {
    const 脚本文本 = await readFile(正式管理员脚本地址, "utf8");

    expect(脚本文本).toContain("request('GET', '/recipient-candidates')");
    expect(脚本文本).toContain('v-for="u in recipientUsers"');
    const 提醒模块 = 脚本文本.slice(
      脚本文本.indexOf("const MessageRules ="),
      脚本文本.indexOf("const WorkloadConfig ="),
    );
    expect(提醒模块).not.toContain("/api/org/staff");
    expect(脚本文本).toContain("业务事件规则必须保留站内提醒。");
    expect(脚本文本).toContain("rule.recipientRule?.type === 'registration_pending_approver'");
    expect(脚本文本).toContain("body.recipientScope = scope;");
    expect(脚本文本).toContain(
      "ruleDraft.roleCodes = Array.isArray(scope.codes) && scope.codes.length ? [...scope.codes] : ['region_manager', 'superadmin'];",
    );
    expect(脚本文本).toContain(
      "ruleDraft.userIds = Array.isArray(scope.userIds) ? [...scope.userIds] : [];",
    );
  });
});
