import { describe, expect, it } from "vitest";

import { openApiDocument } from "../src/index.js";

describe("OpenAPI基础契约", () => {
  it("使用OpenAPI 3.1并包含健康检查路径", () => {
    expect(openApiDocument.openapi).toBe("3.1.0");
    expect(openApiDocument.paths["/health/live"]).toBeTruthy();
    expect(openApiDocument.paths["/health/ready"]).toBeTruthy();
    expect(openApiDocument.paths["/health/dependencies"]).toBeTruthy();
  });

  it("包含交付验收登录路径", () => {
    expect(openApiDocument.paths["/api/auth/login"]).toBeTruthy();
    expect(openApiDocument.paths["/api/auth/me"]).toBeTruthy();
    expect(openApiDocument.paths["/api/auth/logout"]).toBeTruthy();
  });
});
