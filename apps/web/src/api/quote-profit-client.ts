/**
 * 报价收益核算接口客户端（R32）。
 *
 * 与后端 `apps/api/src/quote-profit-routes.ts` 一一对应：
 * - GET  /api/quotes/:quoteId/profit-calculation           读取核算结果
 * - PUT  /api/quotes/:quoteId/profit-calculation/draft      保存草稿
 * - POST /api/quotes/:quoteId/profit-calculation/recalculate 重新计算
 * - POST /api/quotes/:quoteId/profit-calculation/freeze      冻结正式收益
 *
 * 服务端只允许区管和超级管理员读取，前端仅负责展示与触发。
 */

import { 请求 } from "./business-client.js";

export type 收益状态码 =
  | "estimated"
  | "draft"
  | "incomplete"
  | "frozen"
  | "void"
  | "not_applicable";

export interface 收益缺项规则 {
  message?: string;
  [key: string]: unknown;
}

/** 收益构成明细：与服务端 `微盾收益计算结果.details` 一一对应，全部为服务端计算的定点金额字符串。 */
export interface 收益构成明细 {
  softwareDiscountedAmount: string | null;
  softwarePublicAmount: string | null;
  hardwareQuoteAmount: string | null;
  productContractAmount: string | null;
  serviceContractAmount: string | null;
  hardwareInternalCost: string | null;
  hardwareAnnualWarrantyCost: string | null;
  hardwareAnnualMaintenanceCost: string | null;
  productTaxAmount: string | null;
  serviceTaxAmount: string | null;
  warrantyCost: string | null;
  procurementMaintenanceCost: string | null;
  effectiveContractIncome: string | null;
  projectProfit: string | null;
}

export interface 收益计算响应 {
  quoteId: string;
  orderId: string | null;
  regionId: string | null;
  scopeCode: string | null;
  statusCode: 收益状态码;
  statusName: string;
  formulaVersion: string;
  warrantyYears: number;
  procurementMaintenanceYears: number;
  quoteRowVersion: number;
  calculationVersion: number | null;
  calculatedAt: string;
  frozenAt: string | null;
  inputHash: string | null;
  summary: {
    productContractAmount: string | null;
    serviceContractAmount: string | null;
    effectiveContractIncome: string | null;
    projectProfit: string | null;
  };
  details: 收益构成明细;
  softwareLines: Array<Record<string, unknown>>;
  hardwareLines: Array<Record<string, unknown>>;
  missingRules: 收益缺项规则[];
}

export async function 读取报价收益(quoteId: string): Promise<收益计算响应> {
  return 请求<收益计算响应>(
    `/api/quotes/${encodeURIComponent(quoteId)}/profit-calculation`,
  );
}
