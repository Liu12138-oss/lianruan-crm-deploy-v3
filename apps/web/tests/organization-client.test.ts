import { afterEach, describe, expect, it, vi } from "vitest";

import {
  应用已审批企微同步差异,
  创建泛微OA身份候选,
  停用泛微OA身份,
  更新任职,
  更新组织,
  更新泛微OA身份候选,
  确认泛微OA身份候选,
  查询岗位,
  查询成员业务角色,
  查询负责人关系,
  生成企微同步预览,
  读取组织状态,
  读取泛微OA身份,
  驳回泛微OA身份候选,
} from "../src/api/organization-client.js";

function 成功响应<T>(data: T): Response {
  return new Response(
    JSON.stringify({
      success: true,
      data,
      meta: { requestId: "req-organization-test" },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

describe("组织架构接口客户端", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("使用 Cookie 会话读取组织功能状态", async () => {
    const fetchMock = vi.fn(async () =>
      成功响应({ enabled: true, writeEnabled: false, directorySyncEnabled: false }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(读取组织状态()).resolves.toEqual({
      enabled: true,
      writeEnabled: false,
      directorySyncEnabled: false,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/org/status",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("组织更新同时传递行版本与幂等键", async () => {
    const fetchMock = vi.fn(async () => 成功响应({ id: "unit-1", rowVersion: 3 }));
    vi.stubGlobal("fetch", fetchMock);

    await 更新组织(
      "unit/1",
      { unitName: "华东销售部", sortOrder: 20 },
      { rowVersion: 2, 幂等键: "org-update-unit-1" },
    );

    const 调用 = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const [, 初始化] = 调用;
    expect(调用[0]).toBe("/api/org/units/unit%2F1");
    expect(初始化.credentials).toBe("include");
    expect(new Headers(初始化.headers).get("Idempotency-Key")).toBe("org-update-unit-1");
    expect(JSON.parse(String(初始化.body))).toEqual({
      unitName: "华东销售部",
      sortOrder: 20,
      rowVersion: 2,
    });
  });

  it("任职调整使用编码路径并传递行版本与幂等键", async () => {
    const fetchMock = vi.fn(async () => 成功响应({ id: "assignment-1", rowVersion: 5 }));
    vi.stubGlobal("fetch", fetchMock);

    await 更新任职(
      "assignment/1",
      { orgUnitId: "unit-2", isPrimary: true },
      { rowVersion: 4, 幂等键: "assignment-update-1" },
    );

    const 调用 = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const [, 初始化] = 调用;
    expect(调用[0]).toBe("/api/org/assignments/assignment%2F1");
    expect(初始化.method).toBe("PUT");
    expect(初始化.credentials).toBe("include");
    expect(new Headers(初始化.headers).get("Idempotency-Key")).toBe("assignment-update-1");
    expect(JSON.parse(String(初始化.body))).toEqual({
      orgUnitId: "unit-2",
      isPrimary: true,
      rowVersion: 4,
    });
  });

  it("岗位查询会编码查询参数且忽略空参数", async () => {
    const fetchMock = vi.fn(async () => 成功响应({ items: [] }));
    vi.stubGlobal("fetch", fetchMock);

    await 查询岗位("org unit/01");
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toBe(
      "/api/org/positions?orgUnitId=org+unit%2F01",
    );
  });

  it("负责人关系和成员业务角色查询仅使用签名会话", async () => {
    const fetchMock = vi.fn(async () => 成功响应({ items: [] }));
    vi.stubGlobal("fetch", fetchMock);

    await 查询负责人关系({ subordinateAssignmentId: "assignment/1" });
    await 查询成员业务角色({ businessRoleId: "role 1" });

    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toBe(
      "/api/org/manager-relations?subordinateAssignmentId=assignment%2F1",
    );
    expect((fetchMock.mock.calls[1] as unknown as [string])[0]).toBe(
      "/api/org/member-business-roles?businessRoleId=role+1",
    );
    expect((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].credentials).toBe(
      "include",
    );
    expect((fetchMock.mock.calls[1] as unknown as [string, RequestInit])[1].credentials).toBe(
      "include",
    );
  });

  it("企微预览只创建预览批次并使用 Cookie 会话", async () => {
    const fetchMock = vi.fn(async () => 成功响应({ id: "run-preview", status: "queued" }));
    vi.stubGlobal("fetch", fetchMock);

    await 生成企微同步预览({ connectorId: "connector-1" }, { 幂等键: "preview-1" });

    const 调用 = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const [, 初始化] = 调用;
    expect(调用[0]).toBe("/api/integrations/directory-sync/preview");
    expect(初始化.method).toBe("POST");
    expect(初始化.credentials).toBe("include");
    expect(new Headers(初始化.headers).get("Idempotency-Key")).toBe("preview-1");
    expect(JSON.parse(String(初始化.body))).toEqual({ connectorId: "connector-1" });
  });

  it("企微应用只提交明确列出的差异及其版本", async () => {
    const fetchMock = vi.fn(async () => 成功响应({ id: "run-1", status: "queued" }));
    vi.stubGlobal("fetch", fetchMock);

    await 应用已审批企微同步差异(
      "run/1",
      [
        { id: "change-1", changeVersion: 4, rowVersion: 9 },
        { id: "change-2", changeVersion: "v2", rowVersion: 10 },
      ],
      { rowVersion: 3, 幂等键: "apply-1" },
    );

    const 调用 = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const [, 初始化] = 调用;
    expect(调用[0]).toBe("/api/integrations/directory-sync/runs/run%2F1/apply");
    expect(JSON.parse(String(初始化.body))).toEqual({
      changes: [
        { id: "change-1", changeVersion: 4, rowVersion: 9 },
        { id: "change-2", changeVersion: "v2", rowVersion: 10 },
      ],
      rowVersion: 3,
    });
  });

  it("泛微 OA 身份候选与正式映射接口使用 Cookie、行版本和幂等键", async () => {
    const fetchMock = vi.fn(async () => 成功响应({}));
    vi.stubGlobal("fetch", fetchMock);

    await 读取泛微OA身份("user/1");
    await 创建泛微OA身份候选(
      "user/1",
      { externalSubject: "eteams-001", externalUsername: "泛微人员", sourceCode: "manual" },
      { 幂等键: "eteams-create-1" },
    );
    await 更新泛微OA身份候选(
      "user/1",
      "candidate/1",
      {
        externalSubject: "eteams-002",
        externalUsername: "泛微人员",
        sourceCode: "eteams_directory",
      },
      { rowVersion: 2, 幂等键: "eteams-update-1" },
    );
    await 确认泛微OA身份候选(
      "user/1",
      "candidate/1",
      { verificationNote: "已完成双人核验" },
      { rowVersion: 3, 幂等键: "eteams-confirm-1" },
    );
    await 驳回泛微OA身份候选(
      "user/1",
      "candidate/1",
      { rejectedReason: "人员不匹配" },
      { rowVersion: 4, 幂等键: "eteams-reject-1" },
    );
    await 停用泛微OA身份(
      "user/1",
      { identityId: "identity/1", reason: "人员调整" },
      { rowVersion: 5, 幂等键: "eteams-disable-1" },
    );

    const 请求 = fetchMock.mock.calls as unknown as [string, RequestInit][];
    expect(请求.map(([路径]) => 路径)).toEqual([
      "/api/org/users/user%2F1/eteams-identity",
      "/api/org/users/user%2F1/eteams-identity-candidates",
      "/api/org/users/user%2F1/eteams-identity-candidates/candidate%2F1",
      "/api/org/users/user%2F1/eteams-identity-candidates/candidate%2F1/confirm",
      "/api/org/users/user%2F1/eteams-identity-candidates/candidate%2F1/reject",
      "/api/org/users/user%2F1/eteams-identity/disable",
    ]);
    expect(请求.every(([, 初始化]) => 初始化.credentials === "include")).toBe(true);
    const 创建请求 = 请求.at(1);
    const 更新请求 = 请求.at(2);
    const 确认请求 = 请求.at(3);
    const 驳回请求 = 请求.at(4);
    const 停用请求 = 请求.at(5);
    if (!创建请求 || !更新请求 || !确认请求 || !驳回请求 || !停用请求) {
      throw new Error("泛微 OA 身份接口调用数量不完整。");
    }
    expect(new Headers(创建请求[1].headers).get("Idempotency-Key")).toBe("eteams-create-1");
    expect(JSON.parse(String(更新请求[1].body))).toEqual({
      externalSubject: "eteams-002",
      externalUsername: "泛微人员",
      sourceCode: "eteams_directory",
      rowVersion: 2,
    });
    expect(JSON.parse(String(确认请求[1].body))).toEqual({
      verificationNote: "已完成双人核验",
      rowVersion: 3,
    });
    expect(JSON.parse(String(驳回请求[1].body))).toEqual({
      rejectedReason: "人员不匹配",
      rowVersion: 4,
    });
    expect(JSON.parse(String(停用请求[1].body))).toEqual({
      identityId: "identity/1",
      reason: "人员调整",
      rowVersion: 5,
    });
  });

  it("将服务端中文错误、错误码和请求编号转换为可识别错误", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              success: false,
              error: {
                code: "ORG_VERSION_CONFLICT",
                message: "数据已被其他管理员更新，请刷新后重试。",
              },
              meta: { requestId: "req-conflict" },
            }),
            { status: 409, headers: { "content-type": "application/json" } },
          ),
      ),
    );

    await expect(读取组织状态()).rejects.toMatchObject({
      name: "组织接口错误",
      状态码: 409,
      错误码: "ORG_VERSION_CONFLICT",
      请求编号: "req-conflict",
      message: "数据已被其他管理员更新，请刷新后重试。",
    });
  });
});
