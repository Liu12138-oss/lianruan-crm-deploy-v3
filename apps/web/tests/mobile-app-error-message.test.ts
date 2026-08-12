import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

type 移动端窗口 = Window &
  typeof globalThis & {
    API_BASE?: string;
    APP_PREFIX?: string;
    Vue?: unknown;
    mobileRequest?: (path: string, options?: Record<string, unknown>) => Promise<unknown>;
  };

const 移动端脚本路径 = resolve(process.cwd(), "public/mobile-app.js");

function 准备移动端环境() {
  const 运行窗口 = window as 移动端窗口;
  运行窗口.API_BASE = "/api";
  运行窗口.APP_PREFIX = "";
  运行窗口.Vue = {
    createApp: () => ({ mount: () => undefined }),
    ref: (value: unknown) => ({ value }),
    reactive: (value: unknown) => value,
    computed: (getter: () => unknown) => ({
      get value() {
        return getter();
      },
    }),
    onMounted: () => undefined,
    watch: () => undefined,
  };
  localStorage.setItem(
    "mobile_api_user",
    JSON.stringify({ user: { role: "admin" }, token: "v3m.test.token" }),
  );
  运行窗口.eval(readFileSync(移动端脚本路径, "utf8"));
  if (!运行窗口.mobileRequest) throw new Error("移动端请求方法未完成初始化。");
  return 运行窗口;
}

describe("移动端错误提示", () => {
  afterEach(() => {
    const 运行窗口 = window as 移动端窗口;
    localStorage.clear();
    delete 运行窗口.mobileRequest;
    delete 运行窗口.API_BASE;
    delete 运行窗口.APP_PREFIX;
    delete 运行窗口.Vue;
    vi.unstubAllGlobals();
  });

  it("后端返回标准错误对象时展示中文消息", async () => {
    const 运行窗口 = 准备移动端环境();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              success: false,
              error: { code: "V3_AUTH_FORBIDDEN", message: "当前账号无权访问该资源。" },
            }),
            { status: 403, headers: { "content-type": "application/json" } },
          ),
      ),
    );

    await expect(运行窗口.mobileRequest?.("/registrations")).rejects.toThrow(
      "当前账号无权访问该资源。",
    );
  });

  it("错误对象缺少可读消息时使用状态兜底", async () => {
    const 运行窗口 = 准备移动端环境();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ success: false, error: { code: "UNKNOWN" } }), {
            status: 500,
            headers: { "content-type": "application/json" },
          }),
      ),
    );

    await expect(运行窗口.mobileRequest?.("/registrations")).rejects.toThrow("请求失败（500）");
  });

  it("将V3移动端列表响应转换为页面所需的字段和分页信息", async () => {
    const 运行窗口 = 准备移动端环境();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              success: true,
              data: {
                数据: [
                  {
                    id: "内部编号",
                    编号: "BB-20260812-0001",
                    标题: "测试客户",
                    客户名称: "测试客户",
                    渠道名称: "测试渠道",
                    负责人: "测试人员",
                    区域: "华东",
                    状态: "pending",
                    状态名称: "待审核",
                    金额: 0,
                    创建时间: "2026-08-12T00:00:00.000Z",
                    更新时间: "2026-08-12T00:00:00.000Z",
                    原始数据: { contact: "张三" },
                  },
                ],
                分页: { 页码: 1, 每页: 20, 总数: 21 },
              },
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
      ),
    );

    await expect(运行窗口.mobileRequest?.("/registrations")).resolves.toMatchObject({
      page: 1,
      pageSize: 20,
      total: 21,
      hasMore: true,
      data: [
        {
          id: "BB-20260812-0001",
          customer: "测试客户",
          partnerName: "测试渠道",
          contact: "张三",
          status: "pending",
        },
      ],
    });
  });

  it("移动端请求只访问V3移动接口，不会回落到/api/v2/mobile", async () => {
    const 运行窗口 = 准备移动端环境();
    const 请求 = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            success: true,
            data: { 数据: [], 分页: { 页码: 1, 每页: 20, 总数: 0 } },
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
    );
    vi.stubGlobal("fetch", 请求);

    await 运行窗口.mobileRequest?.("/pending-approvals");

    expect(请求).toHaveBeenCalledWith(
      "/api/mobile/pending-approvals",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("移动端写请求携带幂等键", async () => {
    const 运行窗口 = 准备移动端环境();
    const 请求 = vi.fn(
      async () =>
        new Response(JSON.stringify({ success: true, data: {} }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", 请求);

    await 运行窗口.mobileRequest?.("/registrations", {
      method: "POST",
      body: { customer: "测试客户" },
    });

    expect(请求).toHaveBeenCalledWith(
      "/api/mobile/registrations",
      expect.objectContaining({
        headers: expect.objectContaining({ "Idempotency-Key": expect.any(String) }),
      }),
    );
  });
});
