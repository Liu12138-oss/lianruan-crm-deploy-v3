import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

type 旧界面窗口 = Window &
  typeof globalThis & {
    API_BASE?: string;
    APP_PREFIX?: string;
    apiClient?: {
      login: (username: string, password: string) => Promise<unknown>;
      updateOrderStatus: (orderId: string, status: string, remark?: string) => Promise<unknown>;
    };
    readApiErrorMessage?: (value: unknown, fallback?: string) => string;
  };

const 公共客户端路径 = resolve(process.cwd(), "public/api-client.js");

function 准备旧界面环境() {
  const 运行窗口 = window as 旧界面窗口;
  运行窗口.API_BASE = "/api";
  运行窗口.APP_PREFIX = "";
  localStorage.setItem(
    "api_user",
    JSON.stringify({ user: { id: "u-001", role: "admin" }, token: "v3t.test.token" }),
  );
  运行窗口.eval(readFileSync(公共客户端路径, "utf8"));
  if (!运行窗口.apiClient || !运行窗口.readApiErrorMessage) {
    throw new Error("旧界面公共请求层未完成初始化。");
  }
  return 运行窗口;
}

function 结构化错误响应() {
  return new Response(
    JSON.stringify({
      success: false,
      error: { code: "V3_AUTH_AUTHORIZATION_CHANGED", message: "账号授权已发生变化，请重新登录。" },
    }),
    { status: 401, headers: { "content-type": "application/json" } },
  );
}

describe("旧界面公共取消息函数", () => {
  afterEach(() => {
    localStorage.clear();
    delete (window as 旧界面窗口).readApiErrorMessage;
    vi.unstubAllGlobals();
  });

  it("结构化错误对象返回后端中文消息", () => {
    const 运行窗口 = 准备旧界面环境();
    expect(
      运行窗口.readApiErrorMessage?.({
        code: "V3_AUTH_AUTHORIZATION_CHANGED",
        message: "账号授权已发生变化，请重新登录。",
      }),
    ).toBe("账号授权已发生变化，请重新登录。");
  });

  it("标准响应体 {success:false,error:{...}} 可提取消息", () => {
    const 运行窗口 = 准备旧界面环境();
    expect(
      运行窗口.readApiErrorMessage?.({
        success: false,
        error: { code: "V3_ORDER_STATUS_INVALID", message: "当前订单状态不允许取消。" },
      }),
    ).toBe("当前订单状态不允许取消。");
  });

  it("字符串与 Error 直接可用，空值与占位串使用兜底文案", () => {
    const 运行窗口 = 准备旧界面环境();
    expect(运行窗口.readApiErrorMessage?.("客户取消")).toBe("客户取消");
    expect(运行窗口.readApiErrorMessage?.(new Error("网络连接失败"))).toBe("网络连接失败");
    expect(运行窗口.readApiErrorMessage?.({}, "未知错误")).toBe("未知错误");
    expect(运行窗口.readApiErrorMessage?.("[object Object]", "未知错误")).toBe("未知错误");
  });

  it("业务接口 401 返回结构化消息并派发会话失效事件", async () => {
    const 运行窗口 = 准备旧界面环境();
    const 会话失效监听 = vi.fn();
    运行窗口.addEventListener("api-auth-expired", 会话失效监听);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => 结构化错误响应()),
    );

    const 结果 = await 运行窗口.apiClient?.updateOrderStatus("LS-1", "cancelled", "客户取消");

    expect(会话失效监听).toHaveBeenCalledTimes(1);
    expect(运行窗口.readApiErrorMessage?.(结果, "未知错误")).toBe(
      "账号授权已发生变化，请重新登录。",
    );
  });

  it("登录接口自身 401 不派发会话失效事件", async () => {
    const 运行窗口 = 准备旧界面环境();
    const 会话失效监听 = vi.fn();
    运行窗口.addEventListener("api-auth-expired", 会话失效监听);
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              success: false,
              error: { code: "V3_AUTH_INVALID", message: "用户名或密码不正确。" },
            }),
            { status: 401, headers: { "content-type": "application/json" } },
          ),
      ),
    );

    await expect(运行窗口.apiClient?.login("tester", "bad-password")).rejects.toThrow(
      "用户名或密码不正确。",
    );
    expect(会话失效监听).not.toHaveBeenCalled();
  });
});
