import { describe, expect, it } from "vitest";

import { type 微盾收益计算输入, 计算微盾报价收益 } from "../src/quote-profit.js";

function 创建完整输入(覆盖: Partial<微盾收益计算输入> = {}): 微盾收益计算输入 {
  return {
    scopeCode: "weidun",
    softwareItems: [
      {
        id: "微盾软件",
        quantity: 1,
        discountedUnitPrice: "80000.00",
        publicUnitPrice: "100000.00",
        scopeCode: "weidun",
      },
    ],
    hardwareItems: [
      {
        productId: "LV-7050",
        quantity: 2,
        quoteUnitPrice: "20000.00",
        internalSaleCost: "13000.00",
        annualWarrantyMaintenanceCost: "500.00",
        scopeCode: "weidun",
      },
    ],
    serviceContractAmount: "12000.00",
    warrantyYears: 3,
    procurementMaintenanceYears: 1,
    ...覆盖,
  };
}

describe("微盾报价收益定点计算", () => {
  it("与手工验算基准逐项一致", () => {
    const 结果 = 计算微盾报价收益(创建完整输入());

    expect(结果.statusCode).toBe("complete");
    expect(结果.details).toEqual({
      softwareDiscountedAmount: "80000.000000",
      softwarePublicAmount: "100000.000000",
      hardwareQuoteAmount: "40000.000000",
      productContractAmount: "120000.000000",
      serviceContractAmount: "12000.000000",
      hardwareInternalCost: "26000.000000",
      hardwareAnnualWarrantyCost: "1000.000000",
      hardwareAnnualMaintenanceCost: "1000.000000",
      productTaxAmount: "4700.000000",
      serviceTaxAmount: "840.000000",
      warrantyCost: "3000.000000",
      procurementMaintenanceCost: "1500.000000",
      effectiveContractIncome: "100460.000000",
      projectProfit: "97460.000000",
    });
    expect(结果.details.projectProfit).not.toBe(
      结果.details.effectiveContractIncome && "98960.000000",
    );
  });

  it("区管调价后使用产品合同额计算收益，不再依赖模块折后金额", () => {
    const 结果 = 计算微盾报价收益(
      创建完整输入({
        productContractAmount: "150000.00",
        softwareItems: [
          {
            id: "微盾软件",
            quantity: 1,
            discountedUnitPrice: "1.00",
            publicUnitPrice: "100000.00",
            scopeCode: "weidun",
          },
        ],
      }),
    );

    expect(结果.formulaVersion).toBe("weidun-v2-total-input");
    expect(结果.complete).toBe(true);
    expect(结果.details.productContractAmount).toBe("150000.000000");
    expect(结果.details.productTaxAmount).toBe("6200.000000");
    expect(结果.details.effectiveContractIncome).toBe("128960.000000");
    expect(结果.details.projectProfit).toBe("125960.000000");
  });

  it("质保一年和采购维保零年均计算为真正的零值", () => {
    const 结果 = 计算微盾报价收益(
      创建完整输入({ warrantyYears: 1, procurementMaintenanceYears: 0 }),
    );

    expect(结果.complete).toBe(true);
    expect(结果.details.warrantyCost).toBe("0.000000");
    expect(结果.details.procurementMaintenanceCost).toBe("0.000000");
  });

  it("只选择软件或只选择硬件时仍能完成对应收益核算", () => {
    const 只软件 = 计算微盾报价收益(
      创建完整输入({
        hardwareItems: [],
        serviceContractAmount: "0.00",
        warrantyYears: 1,
        procurementMaintenanceYears: 0,
      }),
    );
    expect(只软件.complete).toBe(true);
    expect(只软件.details.hardwareQuoteAmount).toBe("0.000000");
    expect(只软件.details.hardwareInternalCost).toBe("0.000000");
    expect(只软件.details.projectProfit).toBe("76000.000000");

    const 只硬件 = 计算微盾报价收益(
      创建完整输入({
        softwareItems: [],
        hardwareItems: [
          {
            productId: "LV-7050",
            quantity: 1,
            quoteUnitPrice: "20000.00",
            internalSaleCost: "13000.00",
            annualWarrantyMaintenanceCost: "500.00",
            scopeCode: "weidun",
          },
        ],
        serviceContractAmount: "0.00",
        warrantyYears: 1,
        procurementMaintenanceYears: 0,
      }),
    );
    expect(只硬件.complete).toBe(true);
    expect(只硬件.details.softwarePublicAmount).toBe("0.000000");
    expect(只硬件.details.hardwareInternalCost).toBe("13000.000000");
    expect(只硬件.details.projectProfit).toBe("6650.000000");
  });

  it("成本缺失返回 null，不把未知成本伪装成零元", () => {
    const 结果 = 计算微盾报价收益(
      创建完整输入({
        hardwareItems: [
          {
            productId: "LV-7050A",
            quantity: 1,
            quoteUnitPrice: "20000.00",
            internalSaleCost: "8500.00",
            annualWarrantyMaintenanceCost: null,
            scopeCode: "weidun",
          },
        ],
      }),
    );

    expect(结果.statusCode).toBe("incomplete");
    expect(结果.details.hardwareAnnualWarrantyCost).toBeNull();
    expect(结果.details.warrantyCost).toBeNull();
    expect(结果.details.projectProfit).toBeNull();
    expect(结果.missingRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "年度质保/维保成本", targetId: "LV-7050A" }),
      ]),
    );
  });

  it("允许产品合同额低于内部成本并输出负收益", () => {
    const 结果 = 计算微盾报价收益(
      创建完整输入({
        softwareItems: [],
        hardwareItems: [
          {
            productId: "亏损硬件",
            quantity: 1,
            quoteUnitPrice: "100.00",
            internalSaleCost: "13000.00",
            annualWarrantyMaintenanceCost: "500.00",
            scopeCode: "weidun",
          },
        ],
        serviceContractAmount: "0.00",
        warrantyYears: 1,
        procurementMaintenanceYears: 0,
      }),
    );

    expect(结果.complete).toBe(true);
    expect(结果.details.effectiveContractIncome).toBe("-12255.000000");
    expect(结果.details.projectProfit).toBe("-12255.000000");
  });

  it("一分钱参与百分比计算时不产生二进制浮点误差", () => {
    const 结果 = 计算微盾报价收益(
      创建完整输入({
        softwareItems: [
          {
            id: "一分钱软件",
            quantity: 1,
            discountedUnitPrice: "0.01",
            publicUnitPrice: "0.01",
            scopeCode: "weidun",
          },
        ],
        hardwareItems: [],
        serviceContractAmount: "0.01",
        warrantyYears: 1,
        procurementMaintenanceYears: 1,
      }),
    );

    expect(结果.details.productTaxAmount).toBe("0.000500");
    expect(结果.details.serviceTaxAmount).toBe("0.000700");
    expect(结果.details.effectiveContractIncome).toBe("0.018800");
  });

  it("软件数量保留四位小数并以定点方式计算金额", () => {
    const 结果 = 计算微盾报价收益(
      创建完整输入({
        softwareItems: [
          {
            id: "按月软件",
            quantity: "1.25",
            discountedUnitPrice: "80.00",
            publicUnitPrice: "100.00",
            scopeCode: "weidun",
          },
        ],
        hardwareItems: [],
        serviceContractAmount: "0.00",
        warrantyYears: 1,
        procurementMaintenanceYears: 0,
      }),
    );
    expect(结果.complete).toBe(true);
    expect(结果.softwareLines[0]?.quantity).toBe(1.25);
    expect(结果.details.softwareDiscountedAmount).toBe("100.000000");
    expect(结果.details.softwarePublicAmount).toBe("125.000000");
  });

  it("XCAD 或未分类产品不返回任何收益金额", () => {
    for (const scopeCode of ["xcad", "unclassified"] as const) {
      const 结果 = 计算微盾报价收益(
        创建完整输入({
          scopeCode,
          softwareItems: [
            {
              id: "范围外模块",
              quantity: 1,
              discountedUnitPrice: "80000.00",
              publicUnitPrice: "100000.00",
              scopeCode,
            },
          ],
        }),
      );
      expect(结果.statusCode).toBe("not_applicable");
      expect(结果.details.projectProfit).toBeNull();
      expect(结果.details.hardwareInternalCost).toBeNull();
    }
  });

  it("相同输入产生完全一致的结果和指纹", () => {
    const 输入 = 创建完整输入();
    const 第一次 = 计算微盾报价收益(输入);
    const 第二次 = 计算微盾报价收益(JSON.parse(JSON.stringify(输入)) as 微盾收益计算输入);
    expect(第二次).toEqual(第一次);
    expect(第一次.inputFingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it("交换明细顺序不会改变输入指纹", () => {
    const 输入 = 创建完整输入({
      hardwareItems: [
        {
          productId: "B",
          quantity: 1,
          quoteUnitPrice: "2.00",
          internalSaleCost: "1.00",
          annualWarrantyMaintenanceCost: "0.50",
          scopeCode: "weidun",
        },
        {
          productId: "A",
          quantity: 1,
          quoteUnitPrice: "3.00",
          internalSaleCost: "1.00",
          annualWarrantyMaintenanceCost: "0.50",
          scopeCode: "weidun",
        },
      ],
    });
    const 反向 = { ...输入, hardwareItems: [...(输入.hardwareItems || [])].reverse() };
    expect(计算微盾报价收益(输入).inputFingerprint).toBe(计算微盾报价收益(反向).inputFingerprint);
  });

  it("拒绝浮点金额、负成本、非整数数量和越界年限", () => {
    expect(() => 计算微盾报价收益(创建完整输入({ serviceContractAmount: 0.1 as never }))).toThrow(
      "服务合同额必须使用十进制定点字符串",
    );
    expect(() => 计算微盾报价收益(创建完整输入({ warrantyYears: 21 }))).toThrow(
      "质保年限必须在1至20年之间",
    );
    expect(() =>
      计算微盾报价收益(
        创建完整输入({
          hardwareItems: [
            {
              productId: "重复数量",
              quantity: 1.5,
              quoteUnitPrice: "1.00",
              internalSaleCost: "1.00",
              annualWarrantyMaintenanceCost: "1.00",
              scopeCode: "weidun",
            },
          ],
        }),
      ),
    ).toThrow("必须是正整数");
    expect(() =>
      计算微盾报价收益(
        创建完整输入({
          hardwareItems: [
            {
              productId: "负成本",
              quantity: 1,
              quoteUnitPrice: "1.00",
              internalSaleCost: "-1.00",
              annualWarrantyMaintenanceCost: "1.00",
              scopeCode: "weidun",
            },
          ],
        }),
      ),
    ).toThrow("硬件内部销售成本不能为负数");
  });
});
