import { describe, expect, it } from "vitest";

import { 依赖业务说明, 依赖中文名 } from "../src/shared/format/dependency-status.js";

describe("服务依赖业务文案", () => {
  it("数据库、缓存和数据服务只输出业务中文", () => {
    expect(依赖中文名("postgres")).toBe("数据库");
    expect(依赖中文名("redis")).toBe("缓存服务");
    expect(依赖业务说明("postgres", "ok")).toBe("数据库服务正常");
    expect(依赖业务说明("redis", "ok")).toBe("缓存服务正常");
    expect(依赖业务说明("migration", "ok")).toBe("数据库结构已是最新");
  });

  it("异常与未启用状态不暴露技术组件名", () => {
    const 文案 = [
      依赖业务说明("postgres", "failed"),
      依赖业务说明("redis", "degraded"),
      依赖业务说明("migration", "skipped"),
    ];

    for (const 内容 of 文案) {
      expect(内容).not.toMatch(/PostgreSQL|Redis|数据库迁移/i);
    }
    expect(文案[0]).toContain("数据库服务异常");
    expect(文案[1]).toContain("响应偏慢");
    expect(文案[2]).toContain("未启用");
  });
});
