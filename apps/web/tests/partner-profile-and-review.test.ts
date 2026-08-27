import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const 正式管理员脚本地址 = resolve(process.cwd(), "public/admin-app.js");

describe("渠道商信息简介与客户报备审批展示", () => {
  it("企业基本信息包含合作背景字段：展示、编辑、保存链路完整", async () => {
    const 脚本文本 = await readFile(正式管理员脚本地址, "utf8");

    // 展示区：企业基本信息 fact 网格中展示合作背景
    expect(脚本文本).toContain("<span>合作背景</span>");
    expect(脚本文本).toContain("profileTextValue('cooperationBackground', '—')");
    // 编辑表单：合作背景 textarea，受简介编辑权限控制
    expect(脚本文本).toContain('v-model="profileForm.cooperationBackground"');
    // 表单模型与回填同步
    expect(脚本文本).toContain("cooperationBackground: '',");
    expect(脚本文本).toContain(
      "profileForm.cooperationBackground = profile.cooperationBackground || profile.extended?.cooperationBackground || '';",
    );
    // 保存时随简介一并提交（后端 extra_json 开放存储，无需结构变更）
    expect(脚本文本).toContain("cooperationBackground: profileForm.cooperationBackground,");
  });

  it("简介编辑权限收紧为超级管理员与区域管理员", async () => {
    const 脚本文本 = await readFile(正式管理员脚本地址, "utf8");

    expect(脚本文本).toContain(
      "const isProfileManager = role === 'superadmin' || role === 'admin';",
    );
    expect(脚本文本).toContain(
      "return isProfileManager && !!partnerProfile.value?.permissions?.canEditProfile;",
    );
  });

  it("客户报备审核列表展示合作伙伴与提报人", async () => {
    const 脚本文本 = await readFile(正式管理员脚本地址, "utf8");

    // 表头包含两列
    expect(脚本文本).toContain("<th>合作伙伴</th><th>提报人</th>");
    // 行数据取后端已返回的 partnerName 与 assignedStaffName/ownerName
    expect(脚本文本).toContain("{{ r.partnerName || '—' }}");
    expect(脚本文本).toContain("{{ r.assignedStaffName || r.ownerName || '—' }}");
    // 空状态占位列数与表头列数一致（10 列）
    expect(脚本文本).toContain('<td colspan="10">');
  });

  it("渠道商普通员工与企业管理员共用待办审批状态机", async () => {
    const 管理端脚本文本 = await readFile(正式管理员脚本地址, "utf8");
    const 移动端脚本地址 = resolve(process.cwd(), "public/mobile-app.js");
    const 移动端脚本文本 = await readFile(移动端脚本地址, "utf8");

    expect(管理端脚本文本).toContain("aprId: a.approvalId || a.id,");
    expect(管理端脚本文本).toContain("`/pending-approvals/${encodeApiPathValue(s.aprId)}`");
    expect(管理端脚本文本).toContain("action: 'resubmit',");
    expect(移动端脚本文本).toContain(
      "const approvalId = reviewDialog.item.approvalId || reviewDialog.item.id;",
    );
    expect(移动端脚本文本).toContain("`/pending-approvals/${encodeURIComponent(approvalId)}`");
  });
});
