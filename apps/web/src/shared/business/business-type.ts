import { 文本 } from "../format/business-format.js";

export type 业务类型代码 = "product" | "maintenance";

export const 业务类型选项: Array<{ 代码: 业务类型代码; 名称: string; 说明: string }> = [
  { 代码: "product", 名称: "产品商机/订单", 说明: "新产品、硬件或产品实施服务" },
  { 代码: "maintenance", 名称: "维保商机/订单", 说明: "基于既有产品订单的续保或维保服务" },
];

export function 规范业务类型(值: unknown): 业务类型代码 {
  const 原始 = 文本(值).toLowerCase();
  if (["maintenance", "maintain", "维保", "维保商机", "维保报价", "维保订单"].includes(原始)) {
    return "maintenance";
  }
  return "product";
}

export function 业务类型名称(值: unknown, 对象: "商机" | "报价" | "订单" = "商机"): string {
  return `${规范业务类型(值) === "maintenance" ? "维保" : "产品"}${对象}`;
}

export function 记录业务类型(
  记录: { 原始数据?: Record<string, unknown> } | null | undefined,
): 业务类型代码 {
  const 原始 = 记录?.原始数据 || {};
  return 规范业务类型(
    原始.businessTypeCode ?? 原始.business_type_code ?? 原始.businessType ?? 原始.业务类型,
  );
}
