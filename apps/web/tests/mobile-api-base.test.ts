import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("移动端接口前缀", () => {
  it("使用V3移动端接口前缀，避免请求落到不存在的/api/v2/mobile", () => {
    const 页面 = readFileSync(resolve(process.cwd(), "public/mobile.html"), "utf8");

    expect(页面).toContain("window.API_BASE = '/api';");
    expect(页面).not.toContain("window.API_BASE = '/api/v2';");
  });
});
