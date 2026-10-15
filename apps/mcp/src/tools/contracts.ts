import * as z from "zod/v4";

import { MOCK_TOOL_VERSION } from "./common.js";

const 日期模式 = /^\d{4}-\d{2}-\d{2}$/;

export const 列表输入结构 = z
  .object({
    keyword: z.string().trim().max(100).optional(),
    status: z.string().trim().max(50).optional(),
    from: z.string().regex(日期模式, "from 必须使用 YYYY-MM-DD 格式。").optional(),
    to: z.string().regex(日期模式, "to 必须使用 YYYY-MM-DD 格式。").optional(),
    cursor: z.string().max(256).optional(),
    limit: z.number().int().min(1).max(50).default(20),
  })
  .strict();

export const 空对象输入结构 = z.object({}).strict();

export const 详情输入结构 = z
  .object({
    id: z.string().trim().min(1).max(100),
  })
  .strict();

export const 页码结构 = z
  .object({
    nextCursor: z.string().nullable(),
    hasNext: z.boolean(),
    truncated: z.boolean(),
  })
  .strict();

const 通用列表输出字段 = {
  requestId: z.string(),
  toolCode: z.string(),
  toolVersion: z.literal(MOCK_TOOL_VERSION),
  dataAsOf: z.string(),
  scopeSummary: z.string(),
  pageInfo: 页码结构,
  maskedFields: z.array(z.string()),
  source: z.string(),
  v3Link: z.string(),
};

export const 当前身份输出结构 = z
  .object({
    requestId: z.string(),
    toolCode: z.literal("v3_current_context"),
    toolVersion: z.literal(MOCK_TOOL_VERSION),
    dataAsOf: z.string(),
    user: z
      .object({
        userId: z.string(),
        username: z.string(),
        displayName: z.string(),
        personType: z.enum(["internal", "channel"]),
        primaryOrganization: z.string(),
        primaryPartner: z.string().nullable(),
      })
      .strict(),
    permissionSummary: z.array(z.string()),
    source: z.literal("V3身份上下文"),
  })
  .strict();

export const 产品条目结构 = z
  .object({
    id: z.string(),
    name: z.string(),
    productType: z.enum(["feature", "hardware", "package"]),
    status: z.enum(["published", "disabled"]),
    category: z.string(),
    updatedAt: z.string(),
  })
  .strict();

export const 产品搜索输出结构 = z
  .object({
    ...通用列表输出字段,
    toolCode: z.literal("v3_product_search"),
    items: z.array(产品条目结构),
  })
  .strict();

export const 报备条目结构 = z
  .object({
    id: z.string(),
    customerName: z.string(),
    registrationNo: z.string(),
    status: z.string(),
    ownerName: z.string(),
    partnerName: z.string().nullable(),
    regionName: z.string().nullable(),
    updatedAt: z.string(),
  })
  .strict();

export const 报备列表输出结构 = z
  .object({
    ...通用列表输出字段,
    toolCode: z.literal("v3_registration_list"),
    items: z.array(报备条目结构),
  })
  .strict();

export type 列表输入 = z.infer<typeof 列表输入结构>;
