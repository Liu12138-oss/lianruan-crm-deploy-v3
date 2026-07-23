import { 读取应用配置 } from "@lianruan/config";
import { 创建测试环境变量 } from "@lianruan/testing";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { 创建依赖状态 } from "../src/dependencies.js";
import { 创建应用 } from "../src/index.js";

const config = 读取应用配置(创建测试环境变量());

describe("健康检查接口", () => {
  it("存活检查返回200", async () => {
    const app = 创建应用({ config });
    const res = await request(app).get("/health/live").expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe("ok");
  });

  it("就绪检查在依赖失败时返回503和中文状态", async () => {
    const app = 创建应用({
      config,
      dependencyChecker: {
        async check() {
          return [创建依赖状态("redis", "failed", "Redis连接失败：测试故障")];
        },
      },
    });
    const res = await request(app).get("/health/ready").expect(503);
    expect(res.body.data.status).toBe("failed");
    expect(res.body.data.dependencies[0].message).toContain("测试故障");
  });

  it("不存在的接口返回统一中文错误结构", async () => {
    const app = 创建应用({ config });
    const res = await request(app).get("/api/not-found").expect(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain("接口不存在");
  });
});
