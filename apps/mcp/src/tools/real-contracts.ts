import * as z from "zod/v4";

export const 真实条目结构 = z
  .object({
    id: z.string(),
    number: z.string(),
    type: z.string(),
    title: z.string(),
    customerName: z.string(),
    partnerName: z.string().nullable(),
    region: z.string().nullable(),
    status: z.string(),
    statusName: z.string(),
    amount: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .strict();

export const 真实页码结构 = z
  .object({
    nextCursor: z.string().nullable(),
    hasNext: z.boolean(),
    truncated: z.boolean(),
  })
  .strict();

export const 真实列表输出结构 = z
  .object({
    requestId: z.string(),
    toolCode: z.string(),
    toolVersion: z.literal("1.0.0"),
    dataAsOf: z.string(),
    scopeSummary: z.string(),
    items: z.array(真实条目结构),
    pageInfo: 真实页码结构,
    maskedFields: z.array(z.string()),
    source: z.string(),
    v3Link: z.string(),
  })
  .strict();

export const 真实详情输出结构 = z
  .object({
    requestId: z.string(),
    toolCode: z.string(),
    toolVersion: z.literal("1.0.0"),
    dataAsOf: z.string(),
    scopeSummary: z.string(),
    item: 真实条目结构,
    maskedFields: z.array(z.string()),
    source: z.string(),
    v3Link: z.string(),
  })
  .strict();
