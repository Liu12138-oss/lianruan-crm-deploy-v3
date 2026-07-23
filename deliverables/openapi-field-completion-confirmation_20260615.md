# 联软 CRM OpenAPI 字段补齐与确认说明

日期：2026-06-15  
适用对象：crm-agent / AI-agent 数据分析对接  
Base URL：`{CRM_BASE_URL}/api/open/v1`

## 1. 总体结论

针对 crm-agent 提出的 OpenAPI 需求，联软 CRM 侧已按“分析可用、链路可串、字段可读、可本地聚合”的原则补齐/确认如下能力：

1. 列表和详情接口返回真实展示名字段，不只返回 ID。
2. 报备、商机、报价、订单链路字段已补标准别名，兼容旧字段。
3. `/meta/dictionaries` 返回中文枚举/字典。
4. 列表和统计接口支持按时间、渠道商、客户、阶段、状态、负责人、区域等过滤。
5. 列表接口返回稳定分页字段：`pageNo`、`pageSize`、`total`。
6. 统计接口已有渠道贡献、经营总览、漏斗、单对象摘要；暂未独立封装的统计可先基于列表真实数据本地聚合。

## 2. 字段补齐状态

### 2.1 真实展示名字段

| 需求 | 当前字段 | 状态 | 说明 |
| --- | --- | --- | --- |
| 渠道商名 | `partnerName`、`displayName` | 已补齐 | 渠道商对象同时返回 `id/partnerId/name/partnerName` |
| 客户名 | `customerName`、`customer` | 已补齐 | 报备、商机、报价、订单均返回 |
| 商机名 | `opportunityName`、`name` | 已补齐 | 商机对象返回自身名称；报价/订单会尽量回填关联商机名 |
| 订单名/编号 | `orderName`、`orderNo`、`orderId` | 已补齐 | 若无独立订单编号，`orderNo` 默认等于订单 `id` |
| 负责人名 | `ownerName`、`assignedStaffName`、`createdByName` | 已补齐 | 同时保留 `ownerId/assignedStaffId/createdBy` |

## 3. 业务链路字段

为便于第三方统一建模，OpenAPI 现同时保留旧字段和补充标准字段。

| 对象 | 主键/标准字段 | 兼容字段 | 说明 |
| --- | --- | --- | --- |
| 渠道商 | `partnerId` | `id` | `partnerId = partners.id` |
| 客户 | `customerId`、`customerName` | `customer`、`creditCode` | 当前无独立客户主数据表，`customerId` 优先取已有 `customerId`，否则兼容 `creditCode/customerName` |
| 报备 | `registrationId` | `id`、`regId` | 报备对象中 `registrationId = registrations.id` |
| 商机 | `opportunityId` | `id`、`oppId` | 商机对象中 `opportunityId = opportunities.id` |
| 报价 | `quoteId` | `id` | 报价对象中 `quoteId = quotes.id` |
| 订单 | `orderId`、`orderNo` | `id` | 订单对象中 `orderId = orders.id` |

推荐链路：

```text
registrations.registrationId
  -> opportunities.registrationId
  -> quotes.opportunityId / quotes.opportunityIds
  -> orders.quoteId / orders.opportunityId
```

兼容旧链路：

```text
opportunities.regId = registrations.id
quotes.oppId / quotes.oppIds = opportunities.id
orders.quoteId = quotes.id
orders.oppId = opportunities.id
```

## 4. 重点接口字段清单

### 4.1 `GET /partners`

```text
id, partnerId, name, partnerName, displayName,
partnerLevel, partnerLevelName, partnerType, partnerTypeName,
parentPartnerId, parentPartnerIds,
region, bigRegion, status, contact, phone, email,
createdAt, updatedAt
```

### 4.2 `GET /registrations`

```text
id, registrationId,
customerId, customer, customerName,
status, creditCode, industry, contact, phone,
partnerId, partnerName, assignedPartnerId, assignedPartnerName,
assignedStaffId, assignedStaffName,
createdBy, createdByName,
opportunityId, opportunityName,
region, bigRegion, createdAt, updatedAt, approvedAt, expireAt
```

### 4.3 `GET /opportunities`

```text
id, opportunityId, name, opportunityName,
customerId, customer, customerName,
registrationId, regId, quoteId,
stage, stageName, status,
amount, expectedClose,
partnerId, partnerName, assignedPartnerId, assignedPartnerName,
ownerId, ownerName, assignedStaffId, assignedStaffName,
createdBy, createdByName,
region, bigRegion, createdAt, updatedAt
```

### 4.4 `GET /quotes`

```text
id, quoteId, quoteName,
customerId, customer, customerName,
registrationId, regId,
opportunityId, opportunityIds, opportunityName,
oppId, oppIds,
amount, total, totalAmount, originalTotal, discountAmount,
status, endpoints, products, quoteMode,
partnerId, partnerName, assignedPartnerId, assignedPartnerName,
ownerId, ownerName, assignedStaffId, assignedStaffName,
createdBy, createdByName,
region, bigRegion, createdAt, updatedAt
```

### 4.5 `GET /orders`

```text
id, orderId, orderNo, orderName,
customerId, customer, customerName,
registrationId, regId,
opportunityId, opportunityName,
quoteId,
amount, total, totalAmount, status,
partnerId, partnerName, assignedPartnerId, assignedPartnerName, parentPartnerId,
ownerId, ownerName, assignedStaffId, assignedStaffName,
createdBy, createdByName,
region, bigRegion, deliveryAddr, contacts,
createdAt, updatedAt, dealAt
```

## 5. 中文枚举/字典

通过：

```http
GET /meta/dictionaries
```

当前返回：

| 字典 | 说明 |
| --- | --- |
| `roles` | 用户角色 |
| `registrationStatuses` | 报备状态 |
| `opportunityStages` | 商机阶段，包含系统内真实中文阶段 |
| `quoteStatuses` | 报价状态，含 `draft/converted` 等 |
| `orderStatuses` | 订单状态，含 `pending/primary_confirmed/cancelled` 等 |
| `partnerLevels` | 渠道商等级：`none/primary/secondary` |
| `partnerTypes` | 渠道商类型：渠道商、技术服务商 |
| `partnerCooperationLevels` | 合作等级，如 LEP、金牌、银牌、钻石 |
| `customerCategories` | 客户分类；当前从 `customerType/customerCategory/industry` 聚合 |
| `customerTypes` | 客户类型；当前同客户分类口径 |
| `regions` | 区域 |
| `bigRegions` | 大区 |

说明：如果联软后续提供独立客户主数据表和正式客户分类字段，`customerId/customerCategories/customerTypes` 可切换到官方主数据口径。

## 6. 筛选能力

列表接口和统计接口均支持以下通用参数：

| 参数 | 说明 |
| --- | --- |
| `pageNo` | 页码，默认 1 |
| `pageSize` | 每页条数，当前最大 200 |
| `keyword` | 关键词模糊搜索 |
| `createdAfter` / `createdBefore` | 创建时间范围 |
| `updatedAfter` / `updatedBefore` | 更新时间范围 |
| `region` | 区域 |
| `bigRegion` | 大区 |
| `partnerId` | 渠道商 ID，兼容 `partnerId/assignedPartnerId/parentPartnerId/parentPartnerIds` |
| `partnerName` | 渠道商名称模糊过滤 |
| `customer` | 客户名称模糊过滤 |
| `customerId` | 客户标识过滤，兼容 `customerId/creditCode/customerName` |
| `registrationId` | 报备 ID 过滤，兼容 `regId` |
| `opportunityId` | 商机 ID 过滤，兼容 `oppId/oppIds` |
| `quoteId` | 报价 ID 过滤 |
| `orderId` / `orderNo` | 订单 ID/编号过滤 |
| `assignedStaffId` | 指派员工/负责人 ID |
| `ownerId` | 负责人 ID |
| `ownerName` | 负责人名称模糊过滤 |
| `createdBy` | 创建人 ID |
| `status` | 状态过滤；商机接口中按 `stage` 兼容处理 |
| `stage` | 商机阶段过滤 |
| `partnerLevel` | 渠道等级过滤 |
| `sortBy` / `sortOrder` | 排序字段和顺序，`sortOrder=asc/desc` |

注意：所有筛选都在当前 token 绑定用户权限范围内生效，不能突破 CRM 权限边界。

## 7. 分页与总数

所有列表接口统一响应：

```json
{
  "code": 0,
  "message": "ok",
  "data": [],
  "requestId": "req_xxx",
  "pageNo": 1,
  "pageSize": 20,
  "total": 138,
  "returnedCount": 20
}
```

说明：

1. `total` 是当前权限范围 + 当前筛选条件下的总记录数。
2. `data.length` 是当前页返回数量。
3. 排序在分页前执行。
4. 建议第三方不要用当前页数量代替 `total`。

## 8. 统计接口与本地聚合建议

### 8.1 当前已有统计接口

| 接口 | 能力 |
| --- | --- |
| `GET /analytics/business-overview` | 经营总览 |
| `GET /analytics/{resource}/summary` | 单对象摘要，支持 `partners/registrations/opportunities/quotes/orders` |
| `GET /analytics/funnel/registration-opportunity-order` | 报备 -> 商机 -> 报价 -> 订单漏斗 |
| `GET /analytics/partners/contribution` | 渠道商贡献，含报备、商机、报价、订单数量和金额 |
| `GET /analytics/regions/contribution` | 区域贡献 |
| `GET /analytics/owners/contribution` | 负责人贡献 |

### 8.2 可本地聚合的统计

如果第三方暂不等待新统计接口，可以用列表真实数据本地聚合：

| 需求 | 聚合方式 |
| --- | --- |
| 客户生命周期 | 按 `customerId/customerName` 串 `registrations -> opportunities -> quotes -> orders` |
| 客户报备关联商机 | `registrations.registrationId = opportunities.registrationId/regId` |
| 订单渠道贡献 | 按 `orders.partnerId/partnerName` 聚合 `orderCount/totalAmount` |
| 商机阶段分布 | 按 `opportunities.stage/stageName` 聚合 |
| 负责人贡献 | 按 `ownerId/ownerName/assignedStaffId/assignedStaffName` 聚合 |

### 8.3 可选后续增强

若对方希望减少本地聚合工作，可后续追加：

```http
GET /analytics/customers/lifecycle
GET /analytics/orders/channel-contribution
GET /analytics/registrations/opportunity-linkage
```

当前阶段这些不是硬依赖，因为列表接口已返回真实明细和链路字段。

## 9. 仍需业务侧确认的口径

以下不是技术阻塞，但建议联软业务侧确认后固化：

1. 是否存在正式客户主数据 ID。如果有，后续应将 `customerId` 固定为该字段；当前为兼容口径。
2. 客户分类的官方字段。目前从 `customerType/customerCategory/industry` 聚合。
3. 订单正式编号字段。如果业务上有独立订单编号，应优先返回为 `orderNo`；当前无独立编号时用订单 `id` 兜底。
4. 商机阶段中文枚举是否完全以系统现有阶段为准。目前 `/meta/dictionaries.opportunityStages` 会包含真实阶段值。
5. 订单状态中文标签是否需要业务侧调整，例如 `primary_confirmed` 当前标记为“一级渠道已确认”。

