import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

type 移动端窗口 = Window &
  typeof globalThis & {
    API_BASE?: string;
    APP_PREFIX?: string;
    Vue?: unknown;
    mobileRequest?: (path: string) => Promise<unknown>;
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
    computed: (getter: () => unknown) => ({ get value() { return getter(); } }),
    onMounted: () => undefined,
    watch: () => undefined,
  };
  localStorage.setItem("auth_token", "v2.test.token");
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
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            success: false,
            error: { code: "V3_AUTH_FORBIDDEN", message: "当前账号无权访问该资源。" },
          }),
          { status: 403, headers: { "content-type": "application/json" } },
        ),
      ),
    );

    await expect(运行窗口.mobileRequest?.("/registrations")).rejects.toThrow("当前账号无权访问该资源。");
  });

  it("错误对象缺少可读消息时使用状态兜底", async () => {
    const 运行窗口 = 准备移动端环境();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ success: false, error: { code: "UNKNOWN" } }), {
          status: 500,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    await expect(运行窗口.mobileRequest?.("/registrations")).rejects.toThrow("请求失败（500）");
  });
});
