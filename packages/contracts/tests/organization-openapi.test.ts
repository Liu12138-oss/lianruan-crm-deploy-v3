import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const 契约路径 = resolve(import.meta.dirname, "../openapi/organization.yaml");

describe("组织架构 OpenAPI 契约", () => {
  it("登记已实现的组织管理路径和会话、开关约束", async () => {
    const 契约内容 = await readFile(契约路径, "utf8");

    expect(契约内容).toContain("openapi: 3.1.0");
    expect(契约内容).toContain("/api/org/units/tree:");
    expect(契约内容).toContain("/api/org/manager-relations:");
    expect(契约内容).toContain("/api/org/assignments/{id}:");
    expect(契约内容).toContain("更新任职请求:");
    expect(契约内容).toContain("/api/org/member-business-roles:");
    expect(契约内容).toContain("/api/rbac/accounts:");
    expect(契约内容).toContain("/api/rbac/roles/{id}/users:");
    expect(契约内容).toContain("/api/org/data-scopes/{subjectType}/{subjectId}:");
    expect(契约内容).toContain("V3_ORGANIZATION_ENABLED");
    expect(契约内容).toContain("V3_ORGANIZATION_ACCOUNT_ENTRY_MERGED");
    expect(契约内容).toContain("accountEntryMerged");
    expect(契约内容).toContain("offboardingEnabled");
    expect(契约内容).toContain("accountStatusCheckEnabled");
    expect(契约内容).toContain("V3_AUTH_ACCOUNT_STATUS_CHECK_ENABLED");
    expect(契约内容).toContain("V3_ORGANIZATION_OFFBOARDING_ENABLED");
    expect(契约内容).toContain("V3签名会话");
    expect(契约内容).toContain("Idempotency-Key");
    expect(契约内容).toContain("rowVersion");
  });

  it("固定禁止物理删除并完整声明停用归档交接边界", async () => {
    const 契约内容 = await readFile(契约路径, "utf8");

    expect(契约内容).toContain("/api/org/users/{userId}:");
    expect(契约内容).toContain("deprecated: true");
    expect(契约内容).toContain("ORG_PHYSICAL_DELETE_DISABLED");
    expect(契约内容).toContain("ORG_OFFBOARDING_DISABLED");
    expect(契约内容).toContain("required: [userId, effectiveAt, reason, confirmationUsername]");
    expect(契约内容).toContain("recommendedReplacementUserId");
    expect(契约内容).toContain("candidates:");
    expect(契约内容).toContain("V3_AUTH_ACCOUNT_DISABLED");
    expect(契约内容).toContain("V3_AUTH_ACCOUNT_CHECK_UNAVAILABLE");
  });

  it("明确企微同步只读并禁止应用和暂停", async () => {
    const 契约内容 = await readFile(契约路径, "utf8");

    expect(契约内容).toContain("/api/integrations/directory-sync/preview:");
    expect(契约内容).toContain("/api/integrations/directory-sync/runs/{id}/apply:");
    expect(契约内容).toContain("/api/integrations/directory-sync/runs/{id}/pause:");
    expect(契约内容).toContain("DIRECTORY_SYNC_APPLY_DISABLED");
    expect(契约内容).toContain("applyEnabled: { const: false");
  });

  it("声明泛微 OA 身份候选、人工确认和正式映射的边界", async () => {
    const 契约内容 = await readFile(契约路径, "utf8");

    expect(契约内容).toContain("/api/org/users/{userId}/eteams-identity:");
    expect(契约内容).toContain("/api/org/users/{userId}/eteams-identity-candidates:");
    expect(契约内容).toContain("/api/org/users/{userId}/eteams-identity-candidates/{candidateId}/confirm:");
    expect(契约内容).toContain("/api/org/users/{userId}/eteams-identity-candidates/{candidateId}/reject:");
    expect(契约内容).toContain("/api/org/users/{userId}/eteams-identity/disable:");
    expect(契约内容).toContain("候选不具备流程发起资格");
    expect(契约内容).toContain("不得按姓名自动创建候选或正式映射");
    expect(契约内容).toContain("确认成功后，该身份才可作为后续 OA 发起人");
    expect(契约内容).toContain("泛微OA身份候选更新请求:");
    expect(契约内容).toContain("泛微OA正式身份停用请求:");
    expect(契约内容).toContain("required: [identityId, rowVersion, reason]");
    expect(契约内容).toContain("enum: [manual, eteams_directory]");
  });
});
