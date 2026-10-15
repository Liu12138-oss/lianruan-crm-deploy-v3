import type { McpPrincipal } from "../auth/principal.js";

export interface MockProduct {
  id: string;
  name: string;
  productType: "feature" | "hardware" | "package";
  status: "published" | "disabled";
  category: string;
  updatedAt: string;
}

export interface MockRegistration {
  id: string;
  customerName: string;
  registrationNo: string;
  status: string;
  ownerName: string;
  partnerName: string | null;
  regionName: string | null;
  updatedAt: string;
  visibleToChannel: boolean;
}

export const MOCK_PRODUCTS: readonly MockProduct[] = [
  {
    id: "product-001",
    name: "微盾终端安全基础包",
    productType: "package",
    status: "published",
    category: "微盾",
    updatedAt: "2026-09-12T08:30:00.000Z",
  },
  {
    id: "product-002",
    name: "终端准入功能",
    productType: "feature",
    status: "published",
    category: "微盾",
    updatedAt: "2026-09-10T03:20:00.000Z",
  },
  {
    id: "product-003",
    name: "安全接入网关硬件",
    productType: "hardware",
    status: "published",
    category: "硬件",
    updatedAt: "2026-09-08T01:10:00.000Z",
  },
  {
    id: "product-004",
    name: "历史停用产品",
    productType: "feature",
    status: "disabled",
    category: "历史产品",
    updatedAt: "2025-12-01T00:00:00.000Z",
  },
];

export const MOCK_REGISTRATIONS: readonly MockRegistration[] = [
  {
    id: "registration-001",
    customerName: "测试客户甲",
    registrationNo: "REG-2026-001",
    status: "pending",
    ownerName: "内部测试用户",
    partnerName: "渠道甲",
    regionName: "华南",
    updatedAt: "2026-09-18T01:00:00.000Z",
    visibleToChannel: true,
  },
  {
    id: "registration-002",
    customerName: "测试客户乙",
    registrationNo: "REG-2026-002",
    status: "approved",
    ownerName: "内部测试用户",
    partnerName: "渠道甲",
    regionName: "华东",
    updatedAt: "2026-09-17T02:30:00.000Z",
    visibleToChannel: true,
  },
  {
    id: "registration-003",
    customerName: "渠道乙客户",
    registrationNo: "REG-2026-003",
    status: "pending",
    ownerName: "渠道测试用户",
    partnerName: "渠道乙",
    regionName: "华北",
    updatedAt: "2026-09-16T05:45:00.000Z",
    visibleToChannel: false,
  },
];

export function 过滤模拟产品(
  keyword: string | undefined,
  status: string | undefined,
  from: string | undefined,
  to: string | undefined,
): MockProduct[] {
  const normalizedKeyword = keyword?.toLowerCase();
  return MOCK_PRODUCTS.filter((item) => item.status === "published")
    .filter(
      (item) =>
        !normalizedKeyword || `${item.name} ${item.id}`.toLowerCase().includes(normalizedKeyword),
    )
    .filter((item) => !status || item.status === status)
    .filter((item) => !from || item.updatedAt.slice(0, 10) >= from)
    .filter((item) => !to || item.updatedAt.slice(0, 10) <= to);
}

export function 过滤模拟报备(
  principal: McpPrincipal,
  keyword: string | undefined,
  status: string | undefined,
  from: string | undefined,
  to: string | undefined,
): MockRegistration[] {
  const normalizedKeyword = keyword?.toLowerCase();
  return MOCK_REGISTRATIONS.filter((item) =>
    principal.personType === "channel" ? item.visibleToChannel : true,
  )
    .filter(
      (item) =>
        !normalizedKeyword ||
        `${item.customerName} ${item.registrationNo} ${item.ownerName}`
          .toLowerCase()
          .includes(normalizedKeyword),
    )
    .filter((item) => !status || item.status === status)
    .filter((item) => !from || item.updatedAt.slice(0, 10) >= from)
    .filter((item) => !to || item.updatedAt.slice(0, 10) <= to);
}
