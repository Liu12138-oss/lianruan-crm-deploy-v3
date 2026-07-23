# 联软 CRM OpenAPI 统计端点对接说明

> 日期：2026-06-24  
> Base URL：`{CRM_BASE_URL}/api/open/v1`  
> 用途：给 AI agent 做客户报备、商机、订单、渠道/技术服务商的统计分析、状态分布、合作级别分布、技术服务商类型分布和时间趋势分析。  
> 说明：本文涉及接口均为只读统计接口，不写入 CRM 业务数据，不影响报价、订单、客户报备、商机等业务主线。

## 1. 鉴权

先调用：

```http
POST /auth/token
Content-Type: application/json
```

请求体：

```json
{
  "appKey": "oak_xxx",
  "appSecret": "oas_xxx"
}
```

后续请求 Header：

```http
Authorization: Bearer {accessToken}
```

所有统计结果都会按 token 绑定的 CRM 用户权限裁剪，不会突破超级管理员、区域管理员、渠道管理员、员工各自的数据边界。

## 2. 已增强统计端点

| 业务对象 | 接口 | 说明 |
|---|---|---|
| 客户报备 | `GET /analytics/registrations/summary` | 客户报备总量、状态分布、区域分布、合作级别分布、技术服务商类型分布、时间序列 |
| 商机 | `GET /analytics/opportunities/summary` | 商机总量、金额、阶段分布、区域分布、合作级别分布、技术服务商类型分布、时间序列 |
| 订单 | `GET /analytics/orders/summary` | 订单总量、金额、状态分布、区域分布、合作级别分布、技术服务商类型分布、时间序列 |
| 渠道商 | `GET /analytics/partners/summary` | 渠道总量、状态分布、渠道分销层级、合作级别、技术服务商类型分布 |
| 技术服务商 | `GET /analytics/technical-service-providers/summary` | 技术服务商统计别名，底层来源为渠道商，默认排除 `techServiceType=none` |
| 技术服务商短别名 | `GET /analytics/tech-service-providers/summary` | 与上一接口等价 |
| 技术服务商画像 | `GET /analytics/technical-service-providers/profile` | 技术服务商数量、签约/提名分布、状态分布、区域分布、时间序列 |
| 技术服务商贡献 | `GET /analytics/technical-service-providers/contribution` | 技术服务商维度的报备、商机、报价、订单贡献排行 |
| 技术服务商短别名 | `GET /analytics/tech-service-providers/profile`、`GET /analytics/tech-service-providers/contribution` | 与 technical-service-providers 等价 |

补充总览端点：

| 接口 | 说明 |
|---|---|
| `GET /analytics/business-overview` | 一次返回渠道、客户报备、商机、报价、订单摘要，并包含各资源 `dimensions` 和 `timeSeries` |
| `GET /analytics/funnel` | 客户报备 -> 商机 -> 报价 -> 订单漏斗，包含维度和时间序列 |
| `GET /analytics/funnel/registration-opportunity-order` | 与 `/analytics/funnel` 等价兼容 |
| `GET /analytics/partners/profile` | 渠道画像，可传 `techServiceType=full/developing/nominated/none` 看技术服务商类型 |
| `GET /analytics/partners/contribution` | 渠道贡献排行，行数据包含合作级别、技术服务商类型 |
| `GET /analytics/regions/contribution` | 区域贡献排行，包含维度和时间序列 |
| `GET /analytics/owners/contribution` | 负责人贡献排行，包含维度和时间序列 |

## 3. 通用筛选参数

| 参数 | 说明 |
|---|---|
| `createdAfter` / `createdBefore` | 创建时间范围 |
| `updatedAfter` / `updatedBefore` | 更新时间范围 |
| `region` / `bigRegion` | 区域 / 大区过滤 |
| `partnerId` / `partnerName` | 渠道过滤 |
| `customer` / `customerId` | 客户过滤 |
| `registrationId` | 客户报备 ID，兼容旧字段 `regId` |
| `opportunityId` | 商机 ID，兼容旧字段 `oppId/oppIds` |
| `quoteId` | 报价 ID |
| `orderId` / `orderNo` | 订单 ID / 订单编号 |
| `assignedStaffId` | 指派员工过滤 |
| `ownerId` / `ownerName` | 负责人过滤 |
| `createdBy` | 创建人过滤 |
| `status` | 状态过滤 |
| `stage` | 商机阶段过滤 |
| `partnerLevel` | 渠道分销层级：`primary` / `secondary` / `none` |
| `cooperationLevel` | 合作级别：`lep` / `gold` / `silver` / `diamond` |
| `techServiceType` | 技术服务商类型：`none` / `full` / `developing` / `nominated` |
| `technicalServiceProviderType` | 技术服务商类型兼容字段，含义同 `techServiceType` |
| `dateField` | 时间序列分桶字段，默认 `createdAt`，可传 `updatedAt` 等对象已有时间字段 |
| `granularity` | 时间粒度：`day` / `month` / `year`，默认 `month` |

说明：客户报备、商机、报价、订单本身没有直接存技术服务商类型时，统计端点会按可见渠道关系补齐 `cooperationLevel`、`techServiceType` 后再统计和过滤。

## 4. Summary 响应结构

适用于：

```http
GET /analytics/{resource}/summary
```

其中 `{resource}` 支持：

```text
partners
registrations
opportunities
quotes
orders
technical-service-providers
tech-service-providers
```

典型响应：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "resource": "opportunities",
    "totalCount": 44,
    "totalAmount": 1280000,
    "statusField": "stage",
    "byStatus": [
      { "key": "proposal", "count": 8, "amount": 360000 }
    ],
    "byRegion": [
      { "key": "山东区", "count": 12, "amount": 420000 }
    ],
    "byBigRegion": [
      { "key": "华北大区", "count": 12, "amount": 420000 }
    ],
    "byMonth": [
      { "key": "2026-06", "count": 6, "amount": 180000 }
    ],
    "byCooperationLevel": [
      { "key": "lep", "count": 3, "amount": 80000 }
    ],
    "byTechServiceType": [
      { "key": "full", "count": 2, "amount": 50000 }
    ],
    "statusDistribution": [
      { "key": "proposal", "count": 8, "amount": 360000 }
    ],
    "dimensions": {},
    "timeSeries": [],
    "dataSource": "CRM_STANDARD_OPEN_API"
  },
  "requestId": "req_xxx"
}
```

## 5. dimensions 字段

`dimensions` 统一包含：

| 字段 | 说明 |
|---|---|
| `byStatus` | 状态或阶段分布；商机使用 `stage`，其他对象使用 `status` |
| `statusDistribution` | 状态分布兼容字段 |
| `byRegion` | 区域分布 |
| `byBigRegion` | 大区分布 |
| `byPartnerLevel` | 渠道分销层级分布 |
| `byCooperationLevel` | 合作级别分布 |
| `byTechServiceType` | 技术服务商类型分布 |
| `byTechnicalServiceProviderType` | 技术服务商类型兼容分布 |
| `byPartner` | 渠道 ID 分布 |
| `byPartnerName` | 渠道名称分布 |

## 6. timeSeries 字段

`timeSeries` 按 `dateField + granularity` 分桶，每个周期包含：

```json
{
  "period": "2026-06",
  "key": "2026-06",
  "count": 12,
  "amount": 420000,
  "byStatus": [],
  "byCooperationLevel": [],
  "byTechServiceType": [],
  "byRegion": [],
  "byBigRegion": []
}
```

示例：

```http
GET /analytics/orders/summary?granularity=month&dateField=createdAt
GET /analytics/opportunities/summary?granularity=day&createdAfter=2026-06-01T00:00:00.000Z
```

## 7. 技术服务商口径

技术服务商数据来源于渠道商 `partners`，字段口径如下：

| 字段 | 说明 |
|---|---|
| `techServiceType=none` | 未参与技术服务商 |
| `techServiceType=full` | 签约技术服务商 |
| `techServiceType=developing` | 提名技术服务商 |
| `techServiceType=nominated` | 提名技术服务商兼容值 |
| `technicalServiceProviderType` | `techServiceType` 的兼容字段 |
| `isTechnicalServiceProvider` | 是否为技术服务商，主要用于布尔判断 |

技术服务商别名端点默认只统计 `techServiceType != none` 的渠道。  
如果显式传入 `techServiceType=full`，只看签约技术服务商；传入 `techServiceType=developing` 或 `nominated`，只看提名技术服务商。

## 8. 推荐调用

客户报备即将分析：

```http
GET /analytics/registrations/summary?granularity=month
```

商机按合作级别分析：

```http
GET /analytics/opportunities/summary?cooperationLevel=lep&granularity=month
```

订单按签约技术服务商分析：

```http
GET /analytics/orders/summary?techServiceType=full&granularity=month
```

技术服务商画像：

```http
GET /analytics/technical-service-providers/profile
```

技术服务商贡献排行：

```http
GET /analytics/technical-service-providers/contribution?pageNo=1&pageSize=50
```

经营总览：

```http
GET /analytics/business-overview?granularity=month
```

## 9. 字典

调用：

```http
GET /meta/dictionaries
```

重点读取：

| 字典 | 说明 |
|---|---|
| `partnerLevels` | 渠道分销层级 |
| `cooperationLevels` | 合作级别 |
| `techServiceTypes` | 技术服务商类型 |
| `opportunityStages` | 商机阶段 |
| `businessFieldDictionary` | AI agent 可用字段清单 |

