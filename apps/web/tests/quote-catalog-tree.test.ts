import { describe, expect, it } from "vitest";

import type { 阶段9记录 } from "../src/api/business-client.js";
import type { 产品树大类 } from "../src/features/product/product-catalog-client.js";
import {
  分组已选报价明细,
  是维保报价产品,
  构建报价目录,
  筛选套餐功能目录,
  过滤报价目录,
} from "../src/features/quote/quote-catalog-tree.js";

function 产品(编号: string, 标题: string, 原始数据: Record<string, unknown>): 阶段9记录 {
  return {
    id: 编号,
    编号: String(原始数据.productCode || 编号),
    类型: "功能模块",
    标题,
    客户名称: "",
    渠道名称: "",
    负责人: "",
    区域: "",
    状态: "active",
    状态名称: "已发布",
    金额: 0,
    创建时间: "",
    更新时间: "",
    原始数据,
  };
}

function 产品树(): 产品树大类[] {
  return [
    {
      id: "CAT-LEP",
      name: "联软ESPP企业安全监测保护平台软件V5.0",
      code: "CAT-LEP",
      type: "software",
      icon: "🛡️",
      sort: 1,
      modules: [
        {
          id: "MOD-LEP-01",
          categoryId: "CAT-LEP",
          name: "桌面安全管理",
          code: "MOD-LEP-01",
          icon: "🖥️",
          sort: 1,
          features: [
            {
              id: "F-A",
              uuid: "uuid-a",
              name: "功能甲",
              productCode: "CODE-A",
            },
            {
              id: "uuid-b",
              uuid: "uuid-b",
              name: "功能乙",
              productCode: "CODE-B",
            },
          ],
        },
        {
          id: "MOD-LEP-02",
          categoryId: "CAT-LEP",
          name: "防泄密",
          code: "MOD-LEP-02",
          icon: "🔒",
          sort: 2,
          features: [
            {
              id: "F-C",
              uuid: "uuid-c",
              name: "功能丙",
              productCode: "CODE-C",
            },
          ],
        },
      ],
    },
    {
      id: "CAT-MAINTENANCE",
      name: "维保产品模块",
      code: "CAT-MAINTENANCE",
      type: "service",
      icon: "🔧",
      sort: 2,
      modules: [
        {
          id: "MOD-MAINTENANCE-01",
          categoryId: "CAT-MAINTENANCE",
          name: "维保服务",
          code: "MOD-MAINTENANCE-01",
          icon: "🔧",
          sort: 1,
          features: [
            {
              id: "F-MAINT",
              uuid: "uuid-maint",
              name: "标准维保服务",
              productCode: "MAINT-STD-1",
            },
          ],
        },
      ],
    },
  ];
}

describe("报价目录三级分组", () => {
  it("按产品树排列大类、模块和功能，并兼容 UUID 与业务编号", () => {
    const 目录 = 构建报价目录(
      [
        产品("uuid-b", "功能乙", {
          id: "uuid-b",
          categoryName: "旧分类",
          moduleName: "旧模块",
        }),
        产品("uuid-c", "功能丙", { id: "F-C" }),
        产品("uuid-a", "功能甲", { id: "F-A" }),
      ],
      产品树(),
    );

    expect(目录.map((大类) => 大类.名称)).toEqual(["联软ESPP企业安全监测保护平台软件V5.0"]);
    expect(目录[0]?.模块.map((模块) => 模块.名称)).toEqual(["桌面安全管理", "防泄密"]);
    expect(目录[0]?.模块[0]?.功能.map((功能) => 功能.名称)).toEqual(["功能甲", "功能乙"]);
  });

  it("产品树不可用时回退阶段九分类和模块字段", () => {
    const 目录 = 构建报价目录([
      产品("uuid-a", "功能甲", {
        categoryName: "终端安全",
        moduleName: "桌面管理",
        productCode: "CODE-A",
      }),
      产品("uuid-b", "功能乙", {
        categoryName: "终端安全",
        moduleName: "准入控制",
        productCode: "CODE-B",
      }),
    ]);

    expect(目录).toHaveLength(1);
    expect(目录[0]?.名称).toBe("终端安全");
    expect(目录[0]?.模块.map((模块) => 模块.名称)).toEqual(["准入控制", "桌面管理"]);
  });

  it("套餐筛选同时识别 V2 功能编号和 V3 产品 UUID", () => {
    const 目录 = 构建报价目录(
      [
        产品("uuid-a", "功能甲", { id: "F-A", productCode: "CODE-A" }),
        产品("uuid-b", "功能乙", { id: "F-B", productCode: "CODE-B" }),
      ],
      产品树(),
    );
    const 命中 = 筛选套餐功能目录(目录, ["F-A", "uuid-b"]);

    expect(命中).toHaveLength(1);
    expect(命中[0]?.模块[0]?.功能.map((功能) => 功能.名称)).toEqual(["功能甲", "功能乙"]);
  });

  it("关键词只缩小可选目录，模块与编码也可命中", () => {
    const 目录 = 构建报价目录(
      [
        产品("uuid-a", "功能甲", { id: "F-A", productCode: "CODE-A" }),
        产品("uuid-c", "功能丙", { id: "F-C", productCode: "CODE-C" }),
      ],
      产品树(),
    );

    expect(过滤报价目录(目录, "防泄密")[0]?.模块[0]?.功能[0]?.名称).toBe("功能丙");
    expect(过滤报价目录(目录, "CODE-A")[0]?.模块[0]?.功能[0]?.名称).toBe("功能甲");
  });

  it("历史明细无法匹配目录时进入其他功能，不丢失原明细", () => {
    const 目录 = 构建报价目录([
      产品("uuid-a", "功能甲", { id: "F-A", categoryName: "终端安全", moduleName: "桌面管理" }),
    ]);
    const 分组 = 分组已选报价明细(
      [
        { id: "uuid-a", 名称: "功能甲", 数量: 100 },
        { id: "历史编号", 名称: "历史模块", 数量: 20 },
      ],
      目录,
    );

    expect(分组).toHaveLength(2);
    expect(分组.find((项) => 项.模块名称 === "桌面管理")?.明细[0]?.名称).toBe("功能甲");
    expect(分组.find((项) => 项.大类名称 === "其他功能")?.明细[0]?.数量).toBe(20);
  });

  it("维保产品只按 CAT-MAINTENANCE 分类识别", () => {
    expect(
      是维保报价产品(
        产品("uuid-maint", "标准维保服务", {
          categoryCode: "CAT-MAINTENANCE",
        }),
      ),
    ).toBe(true);
    expect(
      是维保报价产品(
        产品("uuid-normal", "普通模块", {
          categoryCode: "CAT-LEP",
        }),
      ),
    ).toBe(false);
  });
});
