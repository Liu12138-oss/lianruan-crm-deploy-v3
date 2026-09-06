import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("正式报价单下载入口", () => {
  it("公共 API 客户端通过服务端 PDF 接口下载报价单", async () => {
    const 脚本文本 = await readFile(resolve(process.cwd(), "public/api-client.js"), "utf8");
    expect(脚本文本).toContain("async downloadQuotePdf(quoteId)");
    expect(脚本文本).toContain("/quotes/${encodeURIComponent(quoteId)}/pdf");
    expect(脚本文本).toContain("res.blob()");
  });

  it("管理员和渠道页面不再自行打开浏览器打印窗口", async () => {
    const [管理员脚本, 渠道脚本] = await Promise.all([
      readFile(resolve(process.cwd(), "public/admin-app.js"), "utf8"),
      readFile(resolve(process.cwd(), "public/partner-app.js"), "utf8"),
    ]);
    for (const 脚本文本 of [管理员脚本, 渠道脚本]) {
      expect(脚本文本).toContain("apiClient.downloadQuotePdf(q.id)");
      expect(脚本文本).toContain("URL.createObjectURL(file.content)");
      expect(脚本文本).not.toContain("window.print()");
      expect(脚本文本).not.toContain("window.open('', '_blank'");
    }
  });
});
