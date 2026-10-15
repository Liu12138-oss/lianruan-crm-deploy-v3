import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const 公共目录 = resolve(import.meta.dirname, "..", "public");

function 读取旧界面脚本(文件名: string) {
  return readFile(resolve(公共目录, 文件名), "utf8");
}

describe("旧界面错误提示统一收口", () => {
  it("管理员页、渠道页与分销层级模块不再直接拼接结构化错误对象", async () => {
    for (const 文件名 of ["admin-app.js", "partner-app.js", "partner-level-module.js"]) {
      const 内容 = await 读取旧界面脚本(文件名);
      expect(内容).not.toMatch(/\+ \((?:result|res|data|userRes)\.error \|\|/);
      expect(内容).toContain("readApiErrorMessage");
    }
  });

  it("管理员页与渠道页监听会话失效事件", async () => {
    expect(await 读取旧界面脚本("admin-app.js")).toContain("'api-auth-expired'");
    expect(await 读取旧界面脚本("partner-app.js")).toContain("'api-auth-expired'");
  });

  it("公共请求层暴露统一取消息函数并在业务接口 401 时派发事件", async () => {
    const 内容 = await 读取旧界面脚本("api-client.js");
    expect(内容).toContain("function readApiErrorMessage(");
    expect(内容).toContain("window.readApiErrorMessage = readApiErrorMessage;");
    expect(内容).toContain("const API_AUTH_EXPIRED_EVENT = 'api-auth-expired';");
    expect(内容).toContain("isAuthEntryRequest(url)");
  });

  it("消息中心与移动端二期复用统一取消息函数并带本地兜底", async () => {
    expect(await 读取旧界面脚本("message-client.js")).toContain("window.readApiErrorMessage");
    expect(await 读取旧界面脚本("mobile-v2-api.js")).toContain("readApiErrorMessage(result");
  });
});
