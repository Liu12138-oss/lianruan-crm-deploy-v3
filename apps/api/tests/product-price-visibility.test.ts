import { 创建构建信息 } from "@lianruan/shared";
import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { 创建业务路由 } from "../src/business-routes.js";
import type { 业务数据服务 } from "../src/business-store.js";
import { 产品价格字段, 移除产品价格字段 } from "../src/product-price-visibility.js";

describe("渠道产品价格字段清洗", () => {
  it("递归移除价格、折扣、价格类型和价格维护时间", () => {
    const 原始 = {
      id: "feature-1",
      name: "网络准入控制",
      description: "渠道可查看的产品描述",
      priceType: "tiered",
      discount: 0.2,
      priceRatioUpdatedAt: "2026-05-20T08:50:38.200Z",
      regionPriceUpdatedAt: "2026-05-20T08:50:38.200Z",
      extra: {
        priceFixed: 500,
        priceForPrimary: [{ min: 1, price: 100 }],
        nested: [{ unitPrice: 88, name: "模块明细" }],
      },
    };

    const 清理后 = 移除产品价格字段(原始);

    expect(清理后).toEqual({
      id: "feature-1",
      name: "网络准入控制",
      description: "渠道可查看的产品描述",
      extra: { nested: [{ name: "模块明细" }] },
    });
    expect([...产品价格字段]).toEqual(
      expect.arrayContaining([
        "priceType",
        "discount",
        "priceRatioUpdatedAt",
        "regionPriceUpdatedAt",
      ]),
    );
  });

  it("渠道账号访问通用产品列表与详情时都不返回价格字段", async () => {
    const app = 创建产品路由测试应用();

    const 列表 = await request(app)
      .get("/api/stage9/products?pageSize=10")
      .set("Authorization", 创建测试令牌("partner_test"))
      .expect(200);
    const 详情 = await request(app)
      .get("/api/stage9/products/product-1")
      .set("Authorization", 创建测试令牌("partner_test"))
      .expect(200);

    expect(列表.body.data.数据[0].原始数据).toEqual({
      id: "product-1",
      name: "网络准入控制",
      description: "渠道可查看的产品描述",
      extra: { name: "模块明细" },
    });
    expect(详情.body.data.原始数据).toEqual({
      id: "product-1",
      name: "网络准入控制",
      description: "渠道可查看的产品描述",
      extra: { name: "模块明细" },
    });
  });

  it("内部管理员访问通用产品列表与详情时保留价格字段", async () => {
    const app = 创建产品路由测试应用();

    const 列表 = await request(app)
      .get("/api/stage9/products?pageSize=10")
      .set("Authorization", 创建测试令牌("admin_test"))
      .expect(200);
    const 详情 = await request(app)
      .get("/api/stage9/products/product-1")
      .set("Authorization", 创建测试令牌("admin_test"))
      .expect(200);

    expect(列表.body.data.数据[0].原始数据).toMatchObject({
      price: 500,
      priceForPrimary: [{ min: 1, price: 100 }],
      extra: { unitPrice: 88 },
    });
    expect(详情.body.data.原始数据).toMatchObject({
      price: 500,
      priceForPrimary: [{ min: 1, price: 100 }],
      extra: { unitPrice: 88 },
    });
  });
});

function 创建产品路由测试应用() {
  const 产品记录 = {
    id: "product-1",
    编号: "P-001",
    类型: "功能模块",
    标题: "网络准入控制",
    客户名称: "",
    渠道名称: "",
    负责人: "",
    区域: "",
    状态: "published",
    状态名称: "已发布",
    金额: 500,
    创建时间: "2026-10-22T00:00:00.000Z",
    更新时间: "2026-10-22T00:00:00.000Z",
    原始数据: {
      id: "product-1",
      name: "网络准入控制",
      description: "渠道可查看的产品描述",
      price: 500,
      priceForPrimary: [{ min: 1, price: 100 }],
      priceType: "tiered",
      discount: 0.2,
      extra: { name: "模块明细", unitPrice: 88 },
    },
  };
  const service = {
    查询列表: async () => ({ 数据: [产品记录], 分页: { 页码: 1, 每页: 10, 总数: 1 } }),
    查询详情: async () => 产品记录,
    读取当前用户上下文: async (用户: { username?: string } | null) => ({
      username: 用户?.username || "",
      roleCode: 用户?.username === "partner_test" ? "partner_admin" : "superadmin",
    }),
  } as unknown as 业务数据服务;
  const app = express();
  app.use(express.json());
  app.use(
    "/api",
    创建业务路由({
      build: 创建构建信息({ V3_BUILD_VERSION: "test", V3_BUILD_COMMIT: "test" }),
      service,
      env: { V3_BUSINESS_LEGACY_IDENTITY_ENABLED: "true", NODE_ENV: "test" },
    }),
  );
  return app;
}

function 创建测试令牌(username: string): string {
  return `Bearer v2.${Buffer.from(username, "utf8").toString("base64url")}.test`;
}
