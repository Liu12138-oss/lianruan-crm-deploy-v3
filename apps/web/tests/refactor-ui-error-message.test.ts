import { afterEach, describe, expect, it, vi } from "vitest";

import { 发送契约请求, 读取接口错误消息 } from "../src/api/client.js";

function 构造响应(负载: unknown, 状态码: number) {
  return new Response(typeof 负载 === "string" ? 负载 : JSON.stringify(负载), {
    status: 状态码,
    headers: { "content-type": "application/json" },
  });
}

describe("重构 UI 接口错误消息", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("优先展示后端结构化错误消息", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        构造响应(
          {
            success: false,
            error: { code: "V3_AUTH_FORBIDDEN", message: "当前账号无权访问该资源。" },
          },
          403,
        ),
      ),
    );

    await expect(
      发送契约请求({ 路径: "/api/notifications/read" as never, method: "POST" }),
    ).rejects.toThrow("当前账号无权访问该资源。");
  });

  it("错误体为字符串时直接展示", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => 构造响应({ error: "订单状态已变更，请刷新后重试。" }, 409)),
    );

    await expect(
      发送契约请求({ 路径: "/api/notifications/read" as never, method: "POST" }),
    ).rejects.toThrow("订单状态已变更，请刷新后重试。");
  });

  it("无可读消息时回退状态码文案", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<html>502 Bad Gateway</html>", { status: 502 })),
    );

    await expect(
      发送契约请求({ 路径: "/api/notifications/read" as never, method: "POST" }),
    ).rejects.toThrow("接口请求失败：502");
  });

  it("成功响应仍返回业务数据", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => 构造响应({ success: true, data: { updated: true } }, 200)),
    );

    await expect(
      发送契约请求({ 路径: "/api/notifications/read" as never, method: "POST" }),
    ).resolves.toEqual({ success: true, data: { updated: true } });
  });

  it("读取接口错误消息兼容标准响应体", async () => {
    const 消息 = await 读取接口错误消息(
      构造响应(
        {
          success: false,
          error: {
            code: "V3_AUTH_AUTHORIZATION_CHANGED",
            message: "账号授权已发生变化，请重新登录。",
          },
        },
        401,
      ),
    );
    expect(消息).toBe("账号授权已发生变化，请重新登录。");
  });
});
