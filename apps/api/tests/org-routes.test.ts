import { 创建测试环境变量 } from "@lianruan/testing";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { 创建密码散列 } from "../src/auth-routes.js";
import { 创建应用 } from "../src/index.js";
import type { 组织数据服务 } from "../src/org-store.js";

const 密码散列 = 创建密码散列("LrCRM@2026!", Buffer.from("0123456789abcdef"));
const 基础环境 = 创建测试环境变量({
  V3_DELIVERY_AUTH_ENABLED: "true",
  V3_DELIVERY_AUTH_COOKIE_SECURE: "false",
  V3_DELIVERY_AUTH_USERS_JSON: JSON.stringify([
    {
      username: "org_admin",
      displayName: "组织管理员",
      roleName: "超级管理员",
      passwordHash: 密码散列,
      defaultPath: "/unified",
      allowedPaths: ["/unified", "/admin"],
    },
    {
      username: "normal_admin",
      displayName: "普通管理员",
      roleName: "管理员",
      passwordHash: 密码散列,
      defaultPath: "/unified",
      allowedPaths: ["/unified", "/admin"],
    },
    {
      username: "partner_admin",
      displayName: "渠道管理员",
      roleName: "渠道管理员",
      passwordHash: 密码散列,
      defaultPath: "/unified",
      allowedPaths: ["/unified", "/partner"],
    },
    {
      username: "partner_staff",
      displayName: "渠道员工",
      roleName: "渠道员工",
      passwordHash: 密码散列,
      defaultPath: "/unified",
      allowedPaths: ["/unified", "/partner"],
    },
  ]),
});

async function 登录Cookie(app: ReturnType<typeof 创建应用>, username: string): Promise<string> {
  const 登录 = await request(app)
    .post("/api/auth/login")
    .send({ username, password: "LrCRM@2026!" })
    .expect(200);
  const cookie = 登录.headers["set-cookie"]?.[0];
  if (!cookie) throw new Error("登录未返回会话 Cookie");
  return cookie;
}

type 组织写入请求 = { method: "post" | "put" | "delete"; path: string };

function 发送组织写入请求(app: ReturnType<typeof 创建应用>, cookie: string, 请求: 组织写入请求) {
  const 客户端 = request(app);
  const 调用 =
    请求.method === "post"
      ? 客户端.post(请求.path)
      : 请求.method === "put"
        ? 客户端.put(请求.path)
        : 客户端.delete(请求.path);
  return 调用.set("Cookie", cookie).set("Idempotency-Key", "readonly-guard").send({});
}

function 创建服务(): 组织数据服务 {
  return {
    查询组织树: async () => ({ items: [{ id: "a", children: [] }] }),
    查询渠道组织树: async () => ({ items: [{ id: "p", partnerName: "渠道商A", children: [] }] }),
    查询渠道成员档案: async () => ({ id: "member", businessRoleCode: "channel_sales" }),
    保存渠道成员档案: async () => ({ id: "member", businessRoleCode: "channel_sales" }),
    导入部门: async () => ({ imported: 1 }),
    导出部门: async () => ({ items: [{ name: "部门A", parentName: null }] }),
    导入成员: async () => ({ imported: 1 }),
    导出成员: async () => ({ items: [{ username: "u1", departmentName: "部门A" }] }),
    查询组织详情: async () => ({}),
    新建组织: async () => ({}),
    更新组织: async () => ({}),
    更新组织状态: async () => ({}),
    查询岗位: async () => ({ items: [] }),
    新建岗位: async () => ({}),
    更新岗位: async () => ({}),
    更新岗位状态: async () => ({}),
    查询任职: async () => ({ items: [] }),
    新建任职: async () => ({}),
    更新任职: async () => ({}),
    结束任职: async () => ({}),
    查询负责人关系: async () => ({ items: [] }),
    新建负责人关系: async () => ({}),
    更新负责人关系: async () => ({}),
    结束负责人关系: async () => ({}),
    查询业务角色: async () => ({ items: [] }),
    新建业务角色: async () => ({}),
    更新业务角色: async () => ({}),
    更新业务角色状态: async () => ({}),
    查询成员业务角色: async () => ({ items: [] }),
    指派成员业务角色: async () => ({}),
    结束成员业务角色: async () => ({}),
    查询证书模板: async () => ({ items: [] }),
    新建证书模板: async () => ({}),
    查询成员证书: async () => ({ items: [] }),
    颁发证书: async () => ({}),
    延期证书: async () => ({}),
    撤销证书: async () => ({}),
    同步管理账号: async () => ({
      superadmin: 1,
      regionManager: 0,
      skipped: 0,
      departmentsCreated: 0,
    }),
    统计未归集管理账号: async () => ({ unassigned: 0 }),
    删除用户: async () => ({ deleted: true, userId: "u", username: "u1" }),
    查询数据范围: async () => ({ runtimeApplied: false, items: [] }),
    保存数据范围: async () => ({ runtimeApplied: false }),
    停用数据范围: async () => ({ runtimeApplied: false }),
    查询区域列表: async () => ({ items: [] }),
    新建区域: async () => ({}),
    更新区域: async () => ({}),
    查询离职交接: async () => ({ items: [] }),
    预览离职影响: async () => ({ readOnly: true, items: [] }),
    查询离职交接详情: async () => ({ items: [] }),
    发起离职交接: async () => ({}),
    重试离职扫描: async () => ({}),
    关闭离职交接: async () => ({}),
    预览渠道商同步: async () => ({
      orgRegionCount: 3,
      channelPartnerCount: 5,
      missingRegionPartners: [{ partnerCode: "P-NEW", partnerName: "未关联渠道商" }],
      summary: "组织架构已存在 3 个渠道区域，5 个渠道商中有 1 个未关联区域。",
    }),
    执行渠道商同步: async (_input) => ({
      dryRun: true,
      partnerScanned: 5,
      regionCreated: 0,
      partnerLinked: 0,
      details: [{ partnerCode: "P-NEW", regionCode: "P-NEW", action: "create" }],
    }),
    查询泛微OA身份: async () => ({ formalIdentity: null, candidates: [] }),
    新建泛微OA身份候选: async () => ({ id: "candidate", statusCode: "pending" }),
    更新泛微OA身份候选: async () => ({ id: "candidate", statusCode: "pending" }),
    确认泛微OA身份候选: async () => ({
      formalIdentity: { id: "identity", statusCode: "active" },
      candidate: { id: "candidate", statusCode: "confirmed" },
    }),
    驳回泛微OA身份候选: async () => ({ id: "candidate", statusCode: "rejected" }),
    停用泛微OA身份: async () => ({ id: "identity", statusCode: "disabled" }),
    执行幂等: async (_参数, 操作) => 操作(),
  };
}

describe("组织架构路由", () => {
  it("默认关闭且不要求会话", async () => {
    const app = 创建应用({ env: 基础环境, orgService: 创建服务() });
    const res = await request(app).get("/api/org/status").expect(200);
    expect(res.body.data).toEqual({
      enabled: false,
      writeEnabled: false,
      channelPhoneEditEnabled: false,
      directorySyncEnabled: false,
      accountEntryMerged: false,
      accountStatusCheckEnabled: false,
      offboardingEnabled: false,
    });
    await request(app).get("/api/org/units/tree").expect(503);
  });

  it("启用后仅接受签名会话中的超级管理员身份", async () => {
    const env = { ...基础环境, V3_ORGANIZATION_ENABLED: "true" };
    const app = 创建应用({ env, orgService: 创建服务() });
    await request(app).get("/api/org/units/tree").expect(401);
    await request(app)
      .get("/api/org/units/tree")
      .set("Cookie", "lianruan_crm_v3_session=forged.superadmin.signature")
      .expect(401);
    const cookie = await 登录Cookie(app, "org_admin");
    const 状态 = await request(app).get("/api/org/status").set("Cookie", cookie).expect(200);
    expect(状态.body.data).toEqual({
      enabled: true,
      writeEnabled: false,
      channelPhoneEditEnabled: false,
      directorySyncEnabled: false,
      accountEntryMerged: false,
      accountStatusCheckEnabled: false,
      offboardingEnabled: false,
    });
    const res = await request(app).get("/api/org/units/tree").set("Cookie", cookie).expect(200);
    expect(res.body.data.items).toHaveLength(1);
  });

  it("账号入口整合开关只追加导航状态，不改变组织写入门禁", async () => {
    const env = {
      ...基础环境,
      V3_ORGANIZATION_ENABLED: "true",
      V3_ORGANIZATION_ACCOUNT_ENTRY_MERGED: "true",
    };
    const app = 创建应用({ env, orgService: 创建服务() });
    const cookie = await 登录Cookie(app, "org_admin");
    const 状态 = await request(app).get("/api/org/status").set("Cookie", cookie).expect(200);

    expect(状态.body.data).toEqual({
      enabled: true,
      writeEnabled: false,
      channelPhoneEditEnabled: false,
      directorySyncEnabled: false,
      accountEntryMerged: true,
      accountStatusCheckEnabled: false,
      offboardingEnabled: false,
    });
    await request(app)
      .post("/api/org/units")
      .set("Cookie", cookie)
      .set("Idempotency-Key", "account-entry-merged-write-guard")
      .send({})
      .expect(403);
  });

  it("启用后拒绝普通管理员读取组织状态和组织数据", async () => {
    const env = {
      ...基础环境,
      V3_ORGANIZATION_ENABLED: "true",
      V3_DELIVERY_AUTH_USERS_JSON: JSON.stringify([
        {
          username: "org_admin",
          displayName: "组织管理员",
          roleName: "超级管理员",
          passwordHash: 密码散列,
          defaultPath: "/unified",
          allowedPaths: ["/unified", "/admin"],
        },
        {
          username: "normal_admin",
          displayName: "普通管理员",
          roleName: "管理员",
          passwordHash: 密码散列,
          defaultPath: "/unified",
          allowedPaths: ["/unified", "/admin"],
        },
      ]),
    };
    const app = 创建应用({ env, orgService: 创建服务() });
    const 登录 = await request(app)
      .post("/api/auth/login")
      .send({ username: "normal_admin", password: "LrCRM@2026!" })
      .expect(200);
    const cookie = 登录.headers["set-cookie"]?.[0];
    if (!cookie) throw new Error("登录未返回会话 Cookie");

    const 状态 = await request(app).get("/api/org/status").set("Cookie", cookie).expect(403);
    expect(状态.body.error.code).toBe("ORG_PERMISSION_DENIED");
    const 组织树 = await request(app).get("/api/org/units/tree").set("Cookie", cookie).expect(403);
    expect(组织树.body.error.code).toBe("ORG_PERMISSION_DENIED");
  });

  it("渠道商同步：预览接口返回差异汇总", async () => {
    const env = {
      ...基础环境,
      V3_ORGANIZATION_ENABLED: "true",
      V3_ORGANIZATION_WRITE_ENABLED: "true",
    };
    const app = 创建应用({ env, orgService: 创建服务() });
    const cookie = await 登录Cookie(app, "org_admin");
    const res = await request(app)
      .get("/api/org/channel-sync/preview")
      .set("Cookie", cookie)
      .expect(200);
    expect(res.body.data.orgRegionCount).toBe(3);
    expect(res.body.data.channelPartnerCount).toBe(5);
    expect(res.body.data.missingRegionPartners).toHaveLength(1);
    expect(res.body.data.summary).toContain("未关联区域");
  });

  it("渠道商同步：执行接口在 dryRun 模式下返回预览结构，不写数据库", async () => {
    const env = {
      ...基础环境,
      V3_ORGANIZATION_ENABLED: "true",
      V3_ORGANIZATION_WRITE_ENABLED: "true",
      V3_ORGANIZATION_CHANNEL_PHONE_EDIT_ENABLED: "true",
    };
    const app = 创建应用({ env, orgService: 创建服务() });
    const cookie = await 登录Cookie(app, "org_admin");
    const res = await request(app)
      .post("/api/org/channel-sync/execute")
      .set("Cookie", cookie)
      .set("Idempotency-Key", "channel-sync-dry-run-001")
      .send({ dryRun: true })
      .expect(200);
    expect(res.body.data.dryRun).toBe(true);
    expect(res.body.data.partnerScanned).toBe(5);
    expect(Array.isArray(res.body.data.details)).toBe(true);
  });

  it("渠道成员手机号编辑默认关闭且在服务端拒绝绕过页面提交", async () => {
    const env = {
      ...基础环境,
      V3_ORGANIZATION_ENABLED: "true",
      V3_ORGANIZATION_WRITE_ENABLED: "true",
    };
    const 服务 = 创建服务();
    const 保存调用 = vi.fn(async () => ({}));
    服务.保存渠道成员档案 = 保存调用;
    const app = 创建应用({ env, orgService: 服务 });
    const cookie = await 登录Cookie(app, "org_admin");

    const 响应 = await request(app)
      .put("/api/org/channel-members/00000000-0000-0000-0000-000000000011/profile")
      .set("Cookie", cookie)
      .set("Idempotency-Key", "channel-phone-edit-disabled")
      .send({ rowVersion: 1, phone: "13800000000", businessRoleCode: "channel_sales" })
      .expect(409);

    expect(响应.body.error.code).toBe("ORG_CHANNEL_PHONE_EDIT_DISABLED");
    expect(保存调用).not.toHaveBeenCalled();
  });

  it("只读观察模式拒绝普通管理员与渠道身份，并保持超级管理员状态可见", async () => {
    const env = { ...基础环境, V3_ORGANIZATION_ENABLED: "true" };
    const app = 创建应用({ env, orgService: 创建服务() });
    const 超管Cookie = await 登录Cookie(app, "org_admin");
    const 状态 = await request(app).get("/api/org/status").set("Cookie", 超管Cookie).expect(200);
    expect(状态.body.data).toEqual({
      enabled: true,
      writeEnabled: false,
      channelPhoneEditEnabled: false,
      directorySyncEnabled: false,
      accountEntryMerged: false,
      accountStatusCheckEnabled: false,
      offboardingEnabled: false,
    });

    for (const username of ["normal_admin", "partner_admin", "partner_staff"]) {
      const cookie = await 登录Cookie(app, username);
      const 组织树 = await request(app)
        .get("/api/org/units/tree")
        .set("Cookie", cookie)
        .expect(403);
      expect(组织树.body.error.code).toBe("ORG_PERMISSION_DENIED");
      const 写入 = await request(app)
        .post("/api/org/units")
        .set("Cookie", cookie)
        .send({})
        .expect(403);
      expect(写入.body.error.code).toBe("ORG_WRITE_DISABLED");
    }
  });

  it("只读观察模式拒绝全部组织写入口且不会调用组织数据服务", async () => {
    const env = { ...基础环境, V3_ORGANIZATION_ENABLED: "true" };
    const 服务 = 创建服务();
    let 幂等服务调用次数 = 0;
    服务.执行幂等 = async (_参数, 操作) => {
      幂等服务调用次数 += 1;
      return 操作();
    };
    const app = 创建应用({ env, orgService: 服务 });
    const cookie = await 登录Cookie(app, "org_admin");
    const 标识 = "00000000-0000-0000-0000-000000000001";
    const 请求列表: 组织写入请求[] = [
      { method: "post", path: "/api/org/units" },
      { method: "put", path: `/api/org/units/${标识}` },
      { method: "put", path: `/api/org/units/${标识}/status` },
      { method: "post", path: "/api/org/positions" },
      { method: "put", path: `/api/org/positions/${标识}` },
      { method: "put", path: `/api/org/positions/${标识}/status` },
      { method: "post", path: `/api/org/staff/${标识}/assignments` },
      { method: "put", path: `/api/org/assignments/${标识}` },
      { method: "put", path: `/api/org/assignments/${标识}/expire` },
      { method: "post", path: "/api/org/manager-relations" },
      { method: "put", path: `/api/org/manager-relations/${标识}` },
      { method: "put", path: `/api/org/manager-relations/${标识}/expire` },
      { method: "post", path: "/api/org/business-roles" },
      { method: "put", path: `/api/org/business-roles/${标识}` },
      { method: "put", path: `/api/org/business-roles/${标识}/status` },
      { method: "post", path: "/api/org/member-business-roles" },
      { method: "put", path: `/api/org/member-business-roles/${标识}/expire` },
      { method: "put", path: `/api/org/channel-members/${标识}/profile` },
      { method: "post", path: "/api/org/certification-templates" },
      { method: "post", path: `/api/org/users/${标识}/certifications` },
      { method: "delete", path: `/api/org/users/${标识}` },
      { method: "put", path: `/api/org/member-certifications/${标识}/extend` },
      { method: "put", path: `/api/org/member-certifications/${标识}/revoke` },
      { method: "put", path: `/api/org/data-scopes/role/${标识}` },
      { method: "delete", path: `/api/org/data-scopes/bindings/${标识}` },
      { method: "post", path: "/api/org/offboarding" },
      { method: "post", path: `/api/org/offboarding/${标识}/retry-items` },
      { method: "post", path: `/api/org/offboarding/${标识}/close` },
      { method: "post", path: `/api/org/users/${标识}/eteams-identity-candidates` },
      { method: "put", path: `/api/org/users/${标识}/eteams-identity-candidates/${标识}` },
      { method: "post", path: `/api/org/users/${标识}/eteams-identity-candidates/${标识}/confirm` },
      { method: "post", path: `/api/org/users/${标识}/eteams-identity-candidates/${标识}/reject` },
      { method: "post", path: `/api/org/users/${标识}/eteams-identity/disable` },
    ];

    for (const 请求 of 请求列表) {
      const 响应 = await 发送组织写入请求(app, cookie, 请求).expect(403);
      expect(响应.body.error.code).toBe("ORG_WRITE_DISABLED");
    }
    expect(幂等服务调用次数).toBe(0);
  });

  it("泛微 OA 身份候选仅由超管读取，确认、驳回和停用均走组织写入门禁", async () => {
    const 标识 = "00000000-0000-0000-0000-000000000051";
    const 服务 = 创建服务();
    const 查询调用 = vi.fn(async () => ({ formalIdentity: null, candidates: [] }));
    const 新建调用 = vi.fn(async () => ({ id: 标识, statusCode: "pending" }));
    const 确认调用 = vi.fn(async () => ({ formalIdentity: { statusCode: "active" } }));
    服务.查询泛微OA身份 = 查询调用;
    服务.新建泛微OA身份候选 = 新建调用;
    服务.确认泛微OA身份候选 = 确认调用;
    const app = 创建应用({
      env: {
        ...基础环境,
        V3_ORGANIZATION_ENABLED: "true",
        V3_ORGANIZATION_WRITE_ENABLED: "true",
      },
      orgService: 服务,
    });
    const cookie = await 登录Cookie(app, "org_admin");

    await request(app).get(`/api/org/users/${标识}/eteams-identity`).set("Cookie", cookie).expect(200);
    expect(查询调用).toHaveBeenCalledWith(标识);

    const 候选内容 = {
      externalSubject: "fanwei-userid-001",
      externalUsername: "泛微人员",
      sourceCode: "eteams_directory",
    };
    await request(app)
      .post(`/api/org/users/${标识}/eteams-identity-candidates`)
      .set("Cookie", cookie)
      .set("Idempotency-Key", "eteams-candidate-create")
      .send(候选内容)
      .expect(200);
    expect(新建调用).toHaveBeenCalledWith(
      标识,
      候选内容,
      expect.objectContaining({ username: "org_admin", role: "superadmin" }),
    );

    await request(app)
      .post(`/api/org/users/${标识}/eteams-identity-candidates/${标识}/confirm`)
      .set("Cookie", cookie)
      .set("Idempotency-Key", "eteams-candidate-confirm")
      .send({ rowVersion: 1, verificationNote: "已与人员确认" })
      .expect(200);
    expect(确认调用).toHaveBeenCalledWith(
      标识,
      标识,
      { rowVersion: 1, verificationNote: "已与人员确认" },
      expect.objectContaining({ username: "org_admin", role: "superadmin" }),
    );
  });

  it("渠道成员统一资料读写透传成员标识、单一业务角色和多证书变更", async () => {
    const env = {
      ...基础环境,
      V3_ORGANIZATION_ENABLED: "true",
      V3_ORGANIZATION_WRITE_ENABLED: "true",
      V3_ORGANIZATION_CHANNEL_PHONE_EDIT_ENABLED: "true",
    };
    const 服务 = 创建服务();
    const 查询调用 = vi.fn(async () => ({ id: 成员标识, memberRoleCode: "partner_admin" }));
    const 保存调用 = vi.fn(async () => ({
      id: 成员标识,
      memberRoleCode: "partner_admin",
      businessRoleCode: "channel_technical",
    }));
    服务.查询渠道成员档案 = 查询调用;
    服务.保存渠道成员档案 = 保存调用;
    const app = 创建应用({ env, orgService: 服务 });
    const cookie = await 登录Cookie(app, "org_admin");
    const 成员标识 = "00000000-0000-0000-0000-000000000011";
    const 证书模板一 = "00000000-0000-0000-0000-000000000021";
    const 证书模板二 = "00000000-0000-0000-0000-000000000022";
    const 待撤销证书 = "00000000-0000-0000-0000-000000000031";

    const 查询响应 = await request(app)
      .get(`/api/org/channel-members/${成员标识}/profile`)
      .set("Cookie", cookie)
      .expect(200);
    expect(查询响应.body.data).toMatchObject({
      id: 成员标识,
      memberRoleCode: "partner_admin",
    });

    const 请求内容 = {
      rowVersion: 3,
      name: "渠道技术人员",
      phone: "13800000000",
      email: "channel@example.com",
      businessRoleCode: "channel_technical",
      grantCertificationTemplateIds: [证书模板一, 证书模板二],
      revokeCertificationIds: [待撤销证书],
    };
    const 保存响应 = await request(app)
      .put(`/api/org/channel-members/${成员标识}/profile`)
      .set("Cookie", cookie)
      .set("Idempotency-Key", "channel-member-profile-test")
      .send(请求内容)
      .expect(200);
    expect(保存响应.body.data).toMatchObject({
      memberRoleCode: "partner_admin",
      businessRoleCode: "channel_technical",
    });
    expect(查询调用).toHaveBeenCalledWith(
      成员标识,
      expect.objectContaining({ username: "org_admin", role: "superadmin" }),
    );
    expect(保存调用).toHaveBeenCalledWith(
      成员标识,
      请求内容,
      expect.objectContaining({ username: "org_admin", role: "superadmin" }),
    );
  });

  it("调整任职透传部门、可选岗位、行版本和幂等键", async () => {
    const env = {
      ...基础环境,
      V3_ORGANIZATION_ENABLED: "true",
      V3_ORGANIZATION_WRITE_ENABLED: "true",
    };
    const 服务 = 创建服务();
    const 更新调用 = vi.fn(async () => ({ id: 任职标识, rowVersion: 8 }));
    let 幂等参数: { 作用域: string; 幂等键: string; 请求哈希: string } | undefined;
    服务.更新任职 = 更新调用;
    服务.执行幂等 = async (参数, 操作) => {
      幂等参数 = 参数;
      return 操作();
    };
    const app = 创建应用({ env, orgService: 服务 });
    const cookie = await 登录Cookie(app, "org_admin");
    const 任职标识 = "00000000-0000-0000-0000-000000000041";
    const 部门标识 = "00000000-0000-0000-0000-000000000042";
    const 请求内容 = {
      orgUnitId: 部门标识,
      isPrimary: true,
      rowVersion: 7,
    };

    const 响应 = await request(app)
      .put(`/api/org/assignments/${任职标识}`)
      .set("Cookie", cookie)
      .set("Idempotency-Key", "assignment-update-001")
      .send(请求内容)
      .expect(200);

    expect(响应.body.data).toEqual({ id: 任职标识, rowVersion: 8 });
    expect(更新调用).toHaveBeenCalledWith(
      任职标识,
      请求内容,
      expect.objectContaining({ username: "org_admin", role: "superadmin" }),
    );
    expect(幂等参数).toMatchObject({
      作用域: `org:org_admin:PUT:/assignments/${任职标识}`,
      幂等键: "assignment-update-001",
    });
    expect(幂等参数?.请求哈希).toMatch(/^[0-9a-f]{64}$/);
  });

  it("数据范围仅在双开关下允许角色级维护，用户级写入固定拒绝", async () => {
    const env = {
      ...基础环境,
      V3_ORGANIZATION_ENABLED: "true",
      V3_ORGANIZATION_WRITE_ENABLED: "true",
    };
    const app = 创建应用({ env, orgService: 创建服务() });
    const 登录 = await request(app)
      .post("/api/auth/login")
      .send({ username: "org_admin", password: "LrCRM@2026!" })
      .expect(200);
    const cookie = 登录.headers["set-cookie"]?.[0];
    if (!cookie) throw new Error("登录未返回会话 Cookie");
    const 用户级 = await request(app)
      .put("/api/org/data-scopes/user/00000000-0000-0000-0000-000000000001")
      .set("Cookie", cookie)
      .send({ resourceCode: "organization", scopeType: "self" })
      .expect(409);
    expect(用户级.body.error.code).toBe("DATA_SCOPE_USER_OVERRIDE_DISABLED");
    const 预览 = await request(app)
      .get("/api/org/staff/00000000-0000-0000-0000-000000000001/offboarding-preview")
      .set("Cookie", cookie)
      .expect(200);
    expect(预览.body.data).toMatchObject({ readOnly: true, items: [] });
  });

  it("组织写开关关闭时拒绝数据范围和离职扫描写入", async () => {
    const env = { ...基础环境, V3_ORGANIZATION_ENABLED: "true" };
    const app = 创建应用({ env, orgService: 创建服务() });
    const 登录 = await request(app)
      .post("/api/auth/login")
      .send({ username: "org_admin", password: "LrCRM@2026!" })
      .expect(200);
    const cookie = 登录.headers["set-cookie"]?.[0];
    if (!cookie) throw new Error("登录未返回会话 Cookie");
    await request(app)
      .put("/api/org/data-scopes/role/00000000-0000-0000-0000-000000000001")
      .set("Cookie", cookie)
      .send({ resourceCode: "organization", scopeType: "self" })
      .expect(403);
    await request(app)
      .post("/api/org/offboarding/00000000-0000-0000-0000-000000000001/retry-items")
      .set("Cookie", cookie)
      .send({ rowVersion: 1 })
      .expect(403);
  });

  it("历史账号不提供自动归集或物理删除，证书查询仍透传筛选参数", async () => {
    const env = {
      ...基础环境,
      V3_ORGANIZATION_ENABLED: "true",
      V3_ORGANIZATION_WRITE_ENABLED: "true",
    };
    const 服务 = 创建服务();
    const 证书调用 = vi.fn(async () => ({ items: [] }));
    服务.查询成员证书 = 证书调用;
    const app = 创建应用({ env, orgService: 服务 });
    const cookie = await 登录Cookie(app, "org_admin");
    const 标识 = "00000000-0000-0000-0000-000000000001";
    await request(app)
      .post("/api/org/admin-accounts/sync")
      .set("Cookie", cookie)
      .send({})
      .expect(404);
    const 删除结果 = await request(app)
      .delete(`/api/org/users/${标识}`)
      .set("Cookie", cookie)
      .send({})
      .expect(409);
    expect(删除结果.body.error.code).toBe("ORG_PHYSICAL_DELETE_DISABLED");
    await request(app)
      .get(`/api/org/member-certifications?orgUnitId=${标识}&partnerId=${标识}&category=产品认证`)
      .set("Cookie", cookie)
      .expect(200);
    expect(证书调用).toHaveBeenCalledWith(undefined, {
      orgUnitId: 标识,
      partnerId: 标识,
      category: "产品认证",
    });
  });

  it("停用归档独立开关关闭时只允许预览，不调用发起、重试或关闭服务", async () => {
    const env = {
      ...基础环境,
      V3_ORGANIZATION_ENABLED: "true",
      V3_ORGANIZATION_WRITE_ENABLED: "true",
      V3_ORGANIZATION_OFFBOARDING_ENABLED: "false",
    };
    const 服务 = 创建服务();
    const 发起 = vi.fn(async () => ({}));
    const 重试 = vi.fn(async () => ({}));
    const 关闭 = vi.fn(async () => ({}));
    服务.发起离职交接 = 发起;
    服务.重试离职扫描 = 重试;
    服务.关闭离职交接 = 关闭;
    const app = 创建应用({ env, orgService: 服务 });
    const cookie = await 登录Cookie(app, "org_admin");
    const 标识 = "00000000-0000-0000-0000-000000000001";

    await request(app)
      .get(`/api/org/staff/${标识}/offboarding-preview`)
      .set("Cookie", cookie)
      .expect(200);
    for (const 路径 of [
      "/api/org/offboarding",
      `/api/org/offboarding/${标识}/retry-items`,
      `/api/org/offboarding/${标识}/close`,
    ]) {
      const 响应 = await request(app).post(路径).set("Cookie", cookie).send({}).expect(403);
      expect(响应.body.error.code).toBe("ORG_OFFBOARDING_DISABLED");
    }
    expect(发起).not.toHaveBeenCalled();
    expect(重试).not.toHaveBeenCalled();
    expect(关闭).not.toHaveBeenCalled();
  });

  it("负责人关系和成员业务角色写入遵循双开关、签名会话与幂等约定", async () => {
    const env = {
      ...基础环境,
      V3_ORGANIZATION_ENABLED: "true",
      V3_ORGANIZATION_WRITE_ENABLED: "true",
    };
    const 服务 = 创建服务();
    const 调用: string[] = [];
    let 幂等作用域 = "";
    服务.新建负责人关系 = async () => {
      调用.push("新建负责人关系");
      return { id: "00000000-0000-0000-0000-000000000099", rowVersion: 1 };
    };
    服务.更新业务角色状态 = async () => {
      调用.push("更新业务角色状态");
      return { id: "00000000-0000-0000-0000-000000000003", rowVersion: 2 };
    };
    服务.指派成员业务角色 = async () => {
      调用.push("指派成员业务角色");
      return { id: "00000000-0000-0000-0000-000000000098", rowVersion: 1 };
    };
    服务.执行幂等 = async (参数, 操作) => {
      幂等作用域 = 参数.作用域;
      return 操作();
    };
    const app = 创建应用({ env, orgService: 服务 });
    const 登录 = await request(app)
      .post("/api/auth/login")
      .send({ username: "org_admin", password: "LrCRM@2026!" })
      .expect(200);
    const cookie = 登录.headers["set-cookie"]?.[0];
    if (!cookie) throw new Error("登录未返回会话 Cookie");
    const 下属任职 = "00000000-0000-0000-0000-000000000011";
    const 负责人任职 = "00000000-0000-0000-0000-000000000012";
    const 角色 = "00000000-0000-0000-0000-000000000003";

    await request(app)
      .post("/api/org/manager-relations")
      .set("Cookie", cookie)
      .set("Idempotency-Key", "manager-relation-001")
      .send({ subordinateAssignmentId: 下属任职, managerAssignmentId: 负责人任职 })
      .expect(200);
    await request(app)
      .put(`/api/org/business-roles/${角色}/status`)
      .set("Cookie", cookie)
      .send({ statusCode: "disabled", rowVersion: 1 })
      .expect(200);
    await request(app)
      .post("/api/org/member-business-roles")
      .set("Cookie", cookie)
      .send({ businessRoleId: 角色, staffAssignmentId: 下属任职, isPrimaryDisplay: true })
      .expect(200);

    expect(调用).toEqual(["新建负责人关系", "更新业务角色状态", "指派成员业务角色"]);
    expect(幂等作用域).toContain("org:org_admin:POST:/manager-relations");
  });

  it("渠道组织树与部门/成员导入导出遵循只读观察与双开关门禁", async () => {
    const 服务 = 创建服务();
    const 调用: string[] = [];
    服务.查询渠道组织树 = async () => {
      调用.push("查询渠道组织树");
      return { items: [{ id: "p", partnerName: "渠道商A" }] };
    };
    服务.导出部门 = async () => {
      调用.push("导出部门");
      return { items: [{ name: "部门A" }] };
    };
    服务.导出成员 = async () => {
      调用.push("导出成员");
      return { items: [{ username: "u1" }] };
    };
    服务.导入部门 = async () => {
      调用.push("导入部门");
      return { imported: 2 };
    };
    服务.导入成员 = async () => {
      调用.push("导入成员");
      return { imported: 2 };
    };

    const app = 创建应用({
      env: { ...基础环境, V3_ORGANIZATION_ENABLED: "true" },
      orgService: 服务,
    });
    const 登录 = await request(app)
      .post("/api/auth/login")
      .send({ username: "org_admin", password: "LrCRM@2026!" })
      .expect(200);
    const cookie = 登录.headers["set-cookie"]?.[0];
    if (!cookie) throw new Error("登录未返回会话 Cookie");

    await request(app).get("/api/org/channel-tree").set("Cookie", cookie).expect(200);
    await request(app).get("/api/org/units/export").set("Cookie", cookie).expect(200);
    await request(app).get("/api/org/staff/export").set("Cookie", cookie).expect(200);
    await request(app)
      .post("/api/org/units/import")
      .set("Cookie", cookie)
      .send({ rows: [{ name: "部门A" }] })
      .expect(403);
    await request(app)
      .post("/api/org/staff/import")
      .set("Cookie", cookie)
      .send({ rows: [{ username: "u1", departmentName: "部门A" }] })
      .expect(403);
    expect(调用).toEqual(["查询渠道组织树", "导出部门", "导出成员"]);

    const 写服务 = 创建服务();
    const 写入调用: string[] = [];
    写服务.导入部门 = async () => {
      写入调用.push("导入部门");
      return { imported: 2 };
    };
    写服务.导入成员 = async () => {
      写入调用.push("导入成员");
      return { imported: 2 };
    };
    const 写app = 创建应用({
      env: {
        ...基础环境,
        V3_ORGANIZATION_ENABLED: "true",
        V3_ORGANIZATION_WRITE_ENABLED: "true",
      },
      orgService: 写服务,
    });
    const 写登录 = await request(写app)
      .post("/api/auth/login")
      .send({ username: "org_admin", password: "LrCRM@2026!" })
      .expect(200);
    const 写cookie = 写登录.headers["set-cookie"]?.[0];
    if (!写cookie) throw new Error("登录未返回会话 Cookie");

    await request(写app)
      .post("/api/org/units/import")
      .set("Cookie", 写cookie)
      .set("Idempotency-Key", "unit-import-001")
      .send({ rows: [{ name: "部门A" }, { name: "部门B", parentName: "部门A" }] })
      .expect(200);
    await request(写app)
      .post("/api/org/staff/import")
      .set("Cookie", 写cookie)
      .set("Idempotency-Key", "staff-import-001")
      .send({ rows: [{ username: "u1", departmentName: "部门A" }] })
      .expect(200);
    expect(写入调用).toEqual(["导入部门", "导入成员"]);
  });

  it("新建组织不传编码与类型时由服务端自动生成", async () => {
    const 服务 = 创建服务();
    let 入参: Record<string, unknown> | null = null;
    服务.新建组织 = async (input) => {
      入参 = input;
      return { id: "00000000-0000-0000-0000-000000000001", unitCode: "AUTO-abc", rowVersion: 1 };
    };
    const app = 创建应用({
      env: {
        ...基础环境,
        V3_ORGANIZATION_ENABLED: "true",
        V3_ORGANIZATION_WRITE_ENABLED: "true",
      },
      orgService: 服务,
    });
    const 登录 = await request(app)
      .post("/api/auth/login")
      .send({ username: "org_admin", password: "LrCRM@2026!" })
      .expect(200);
    const cookie = 登录.headers["set-cookie"]?.[0];
    if (!cookie) throw new Error("登录未返回会话 Cookie");

    await request(app)
      .post("/api/org/units")
      .set("Cookie", cookie)
      .set("Idempotency-Key", "unit-auto-001")
      .send({ unitName: "新部门", parentUnitId: null })
      .expect(200);
    expect(入参).toEqual({ unitName: "新部门", parentUnitId: null });
  });
});
