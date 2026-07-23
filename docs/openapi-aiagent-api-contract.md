# 联软 CRM 对接 AI-agent 标准 API 契约

> 版本：V1.2  
> 日期：2026-06-16  
> 适用范围：AI-agent 标准查询、只读统计与 Markdown 分析取数接口  
> 说明：本文是“正式对接契约”，用于开发、联调、验收

---

## 1. 总体约定

### 1.1 Base URL

```text
{CRM_BASE_URL}/api/open/v1
```

示例：

```text
https://crm.example.com/api/open/v1
```

### 1.2 数据格式

1. 请求与响应统一使用 `application/json`
2. 字符集统一 `UTF-8`
3. 时间字段统一使用 ISO 8601 字符串

### 1.3 认证流程

1. AI-agent 持有 `appKey`、`appSecret`
2. 调用 `POST /auth/token` 获取 `accessToken`
3. 后续请求在 Header 中传：

```http
Authorization: Bearer {accessToken}
```

---

## 2. 标准响应结构

### 2.1 成功响应

```json
{
  "code": 0,
  "message": "ok",
  "data": {},
  "requestId": "req_20260603_xxx"
}
```

列表接口会额外返回分页字段：

```json
{
  "code": 0,
  "message": "ok",
  "data": [],
  "requestId": "req_20260603_xxx",
  "pageNo": 1,
  "pageSize": 20,
  "total": 138
}
```

### 2.2 错误响应

```json
{
  "code": 40101,
  "message": "missing access token",
  "requestId": "req_20260603_xxx"
}
```

---

## 3. 通用查询参数

除个别接口特殊说明外，列表接口统一支持以下参数：

| 参数 | 类型 | 必选 | 说明 |
|---|---|---:|---|
| `pageNo` | int | 否 | 页码，默认 1 |
| `pageSize` | int | 否 | 每页条数，默认系统值 |
| `keyword` | string | 否 | 关键字模糊搜索 |
| `status` | string | 否 | 状态过滤 |
| `region` | string | 否 | 区域过滤 |
| `partnerId` | string | 否 | 渠道过滤 |
| `partnerName` | string | 否 | 渠道商名称模糊过滤 |
| `customer` | string | 否 | 客户名称模糊过滤 |
| `customerId` | string | 否 | 客户标识过滤，当前兼容 `customerId/creditCode/customerName` |
| `registrationId` | string | 否 | 报备 ID 过滤，兼容旧字段 `regId` |
| `opportunityId` | string | 否 | 商机 ID 过滤，兼容旧字段 `oppId/oppIds` |
| `quoteId` | string | 否 | 报价 ID 过滤 |
| `orderId` | string | 否 | 订单 ID 过滤 |
| `orderNo` | string | 否 | 订单编号过滤 |
| `assignedStaffId` | string | 否 | 指派/负责人 ID 过滤 |
| `ownerId` | string | 否 | 负责人 ID 过滤 |
| `ownerName` | string | 否 | 负责人名称模糊过滤 |
| `createdAfter` | string | 否 | 创建时间起 |
| `createdBefore` | string | 否 | 创建时间止 |
| `updatedAfter` | string | 否 | 更新时间起 |
| `updatedBefore` | string | 否 | 更新时间止 |
| `sortBy` | string | 否 | 排序字段 |
| `sortOrder` | string | 否 | `asc` 或 `desc` |

附加规则：

1. 所有过滤都在当前绑定 CRM 用户权限范围内生效。
2. 即使传了 `region/partnerId`，也不能突破权限边界。

---

## 4. 错误码约定

| HTTP | code | 含义 |
|---|---:|---|
| 400 | `40111` | 缺少 `appKey` 或 `appSecret` |
| 401 | `40112` | client 无效 |
| 401 | `40113` | `appSecret` 无效 |
| 401 | `40101` | 缺少 `accessToken` |
| 401 | `40102` | `accessToken` 无效或过期 |
| 403 | `40312` | IP 不在白名单 |
| 403 | `40313` | 绑定 CRM 用户不可用 |
| 403 | `40301` | client 被禁用或已过期 |
| 403 | `40302` | 当前请求 IP 不允许 |
| 403 | `40303` | 资源未授权 |
| 403 | `40304` | 绑定 CRM 用户不可访问 |
| 404 | `40401` | 用户不存在 |
| 404 | `40402` | 渠道不存在 |
| 404 | `40403` | 报备不存在 |
| 404 | `40404` | 商机不存在 |
| 404 | `40405` | 报价不存在 |
| 404 | `40406` | 订单不存在 |
| 404 | `40407` | 套餐不存在 |
| 404 | `40408` | 产品不存在 |
| 404 | `40409` | 统计资源不存在 |

---

## 5. 资源授权值

创建 OpenAPI client 时，`allowedResources` 建议使用以下资源名。

核心业务资源：

```json
[
  "users",
  "partners",
  "registrations",
  "opportunities",
  "quotes",
  "orders"
]
```

产品目录资源：

```json
[
  "categories",
  "modules",
  "features",
  "hardware",
  "packages",
  "products",
  "product-tree",
  "product-stats"
]
```

运营与提醒资源：

```json
[
  "notifications",
  "pending-approvals",
  "channel-targets",
  "channel-visits",
  "channel-operations-overview",
  "dashboard-stats",
  "company-search"
]
```

计算与实施配置资源：

```json
[
  "workload-classifications",
  "workload-delivery-rules",
  "workload-mappings",
  "workload-rules",
  "quote-workload-preview",
  "ipg-quote-preview"
]
```

辅助分析资源：

```json
[
  "audit-logs",
  "analytics",
  "diagnostics",
  "identity"
]
```

如需全部放开，可使用：

```json
["*"]
```

建议：

1. SIT 全量验证可使用 `["*"]`，便于 AI-agent 建立完整 Markdown 快照。
2. 生产环境建议按实际用途精确授权，经营分析至少需要核心业务资源和 `analytics/diagnostics/identity`。
3. 若分析问题涉及产品、报价构成、套餐和模块维度，需同时授权产品目录资源。
4. `audit-logs`、工作量配置类资源建议仅绑定超级管理员账号的 OpenAPI Client 使用。

---

## 6. 鉴权接口

### 6.1 获取访问令牌

`POST /auth/token`

请求体：

```json
{
  "appKey": "oak_xxxxxxxxx",
  "appSecret": "oas_xxxxxxxxx"
}
```

响应示例：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "accessToken": "openapi_xxxxxxxxx",
    "expiresIn": 7200,
    "tokenType": "Bearer",
    "clientId": "OAC-1717310000000",
    "clientName": "AI-agent-prod",
    "boundUser": {
      "id": "A002",
      "username": "admin_sh",
      "name": "上海区管理员",
      "role": "admin",
      "region": "上海区（非金）",
      "bigRegion": "大东区",
      "partnerId": "",
      "partnerName": "",
      "status": "active"
    }
  },
  "requestId": "req_20260603_xxx"
}
```

### 6.2 获取当前身份上下文

`GET /auth/me`

响应示例：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "client": {
      "id": "OAC-1717310000000",
      "name": "AI-agent-prod",
      "boundUserId": "A002",
      "status": "active",
      "allowedResources": [
        "users",
        "partners",
        "registrations",
        "opportunities",
        "quotes",
        "orders"
      ],
      "ipWhitelist": [
        "10.0.0.10"
      ],
      "expiresAt": "",
      "remark": "",
      "createdAt": "2026-06-03T09:00:00.000Z",
      "updatedAt": "2026-06-03T09:00:00.000Z"
    },
    "user": {
      "id": "A002",
      "username": "admin_sh",
      "name": "上海区管理员",
      "role": "admin",
      "region": "上海区（非金）",
      "bigRegion": "大东区",
      "partnerId": "",
      "partnerName": "",
      "status": "active"
    }
  },
  "requestId": "req_20260603_xxx"
}
```

---

## 7. 权限与字典接口

### 7.1 获取当前权限范围

`GET /meta/permission-scope`

用途：

1. 让 AI-agent 确认当前绑定身份是谁。
2. 明确当前可见范围是全量、区域、渠道还是本人。
3. 便于前置提示和兜底文案生成。

响应示例：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "user": {
      "id": "A002",
      "name": "上海区管理员",
      "role": "admin"
    },
    "scopeType": "region",
    "regions": [
      "上海区（非金）"
    ],
    "partnerIds": [],
    "userIds": []
  },
  "requestId": "req_20260603_xxx"
}
```

### 7.2 获取字典

`GET /meta/dictionaries`

用途：

1. 获取角色字典
2. 获取对象状态字典
3. 获取渠道层级字典
4. 减少对方硬编码

响应示例：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "roles": [
      { "value": "superadmin", "label": "超级管理员" },
      { "value": "admin", "label": "区域管理员" },
      { "value": "partner_admin", "label": "渠道管理员" },
      { "value": "staff", "label": "员工" }
    ],
    "partnerLevels": [
      { "value": "none", "label": "未设置" },
      { "value": "primary", "label": "一级渠道" },
      { "value": "secondary", "label": "二级渠道" }
    ],
    "partnerTypes": [
      { "value": "channel_partner", "label": "渠道商" },
      { "value": "technical_service_provider", "label": "技术服务商" }
    ],
    "customerCategories": [],
    "customerTypes": [],
    "registrationStatuses": [
      { "value": "pending", "label": "待审批" },
      { "value": "approved", "label": "已通过" },
      { "value": "rejected", "label": "已驳回" }
    ]
  },
  "requestId": "req_20260603_xxx"
}
```

---

## 8. 用户接口

### 8.1 用户列表

`GET /users`

额外参数：

| 参数 | 类型 | 说明 |
|---|---|---|
| `role` | string | 角色过滤 |

响应字段重点：

`id` `username` `name` `role` `region` `bigRegion` `partnerId` `partnerName` `status`

### 8.2 用户详情

`GET /users/{id}`

---

## 9. 渠道接口

### 9.1 渠道列表

`GET /partners`

搜索字段建议：

1. `id`
2. `name`
3. `level`
4. `region`
5. `contact`
6. `phone`
7. `email`

响应字段重点：

`id` `partnerId` `name` `partnerName` `displayName` `partnerLevel` `partnerLevelName` `cooperationLevel` `cooperationLevelName` `level` `partnerType` `partnerTypeName` `parentPartnerId` `parentPartnerIds` `region` `bigRegion` `status` `techServiceType` `technicalServiceProviderType`

字段口径：

- `partnerLevel`：渠道分销层级，取值 `primary` / `secondary` / `none`，用于一级/二级渠道关系分析。
- `cooperationLevel`：合作级别，来源于原渠道商 `level` 字段，取值 `lep` / `gold` / `silver` / `diamond`，用于 LEP/金牌/银牌/钻石统计。
- `level`：保留旧字段，含义与 `cooperationLevel` 一致；新对接建议优先读取 `cooperationLevel`。
- `techServiceType` / `technicalServiceProviderType`：技术服务商类型字段，用于签约技术服务商、提名技术服务商等分析。

### 9.2 渠道详情

`GET /partners/{id}`

---

## 10. 客户报备接口

### 10.1 报备列表

`GET /registrations`

搜索字段建议：

1. `id`
2. `customer`
3. `industry`
4. `contact`
5. `phone`
6. `partnerName`
7. `createdByName`

响应字段重点：

`id` `registrationId` `customerId` `customer` `customerName` `contact` `phone` `creditCode` `status` `createdBy` `createdByName` `assignedStaffId` `assignedStaffName` `partnerId` `partnerName` `opportunityId` `opportunityName` `region` `createdAt`

### 10.2 报备详情

`GET /registrations/{id}`

详情响应示例：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "id": "REG-1717310000000",
    "customer": "上海XX公司",
    "project": "终端安全项目",
    "industry": "制造业",
    "contact": "张三",
    "phone": "13800138000",
    "creditCode": "9131XXXXXXXXXXXX",
    "status": "approved",
    "createdBy": "S002",
    "createdByName": "王小红",
    "assignedStaffId": "S002",
    "assignedStaffName": "王小红",
    "partnerId": "P002",
    "partnerName": "上海锐行信息",
    "assignedPartnerId": "P002",
    "assignedPartnerName": "上海锐行信息",
    "region": "上海区（非金）",
    "estimatedAmt": 800000,
    "signDate": "2026-07-01",
    "createdAt": "2026-06-03T10:00:00.000Z",
    "updatedAt": "2026-06-03T10:30:00.000Z"
  },
  "requestId": "req_20260603_xxx"
}
```

---

## 11. 商机接口

### 11.1 商机列表

`GET /opportunities`

搜索字段建议：

1. `id`
2. `name`
3. `customer`
4. `contact`
5. `phone`
6. `partnerName`
7. `createdByName`

说明：

1. `status` 参数在商机列表中实际过滤 `stage` 字段。
2. AI-agent 对接时建议按“阶段”理解该筛选条件。

### 11.2 商机详情

`GET /opportunities/{id}`

响应字段重点：

`id` `opportunityId` `name` `opportunityName` `customerId` `customer` `customerName` `stage` `stageName` `amount` `expectedClose` `ownerId` `ownerName` `assignedStaffId` `assignedStaffName` `partnerId` `partnerName` `registrationId` `regId` `quoteId` `createdAt`

---

## 12. 报价接口

### 12.1 报价列表

`GET /quotes`

搜索字段建议：

1. `id`
2. `customer`
3. `partnerName`
4. `createdByName`

响应字段重点：

`id` `quoteId` `quoteName` `customerId` `customer` `customerName` `registrationId` `regId` `opportunityId` `opportunityIds` `opportunityName` `oppId` `oppIds` `partnerId` `partnerName` `ownerId` `ownerName` `assignedStaffId` `assignedStaffName` `status` `createdAt`

### 12.2 报价详情

`GET /quotes/{id}`

---

## 13. 订单接口

### 13.1 订单列表

`GET /orders`

搜索字段建议：

1. `id`
2. `customer`
3. `partnerName`
4. `createdByName`
5. `deliveryAddr`

响应字段重点：

`id` `orderId` `orderNo` `orderName` `customerId` `customer` `customerName` `registrationId` `regId` `opportunityId` `opportunityName` `quoteId` `partnerId` `partnerName` `parentPartnerId` `assignedPartnerId` `assignedStaffId` `assignedStaffName` `ownerId` `ownerName` `status` `createdAt`

### 13.2 订单详情

`GET /orders/{id}`

---

## 14. 调用示例

### 14.1 获取 token

```bash
curl -X POST "https://crm.example.com/api/open/v1/auth/token" \
  -H "Content-Type: application/json" \
  -d '{
    "appKey": "oak_xxx",
    "appSecret": "oas_xxx"
  }'
```

### 14.2 查询最近 30 天本权限内的商机

```bash
curl "https://crm.example.com/api/open/v1/opportunities?pageNo=1&pageSize=20&createdAfter=2026-05-01T00:00:00.000Z" \
  -H "Authorization: Bearer openapi_xxx"
```

### 14.3 查询某渠道下的订单

```bash
curl "https://crm.example.com/api/open/v1/orders?pageNo=1&pageSize=20&partnerId=P002" \
  -H "Authorization: Bearer openapi_xxx"
```

---

## 15. 第一阶段验收口径

满足以下条件即可视为第一阶段 API 可开联调：

1. `auth/token`、`auth/me` 可用。
2. `meta/permission-scope`、`meta/dictionaries` 可用。
3. 六类对象列表和详情接口可用。
4. 权限裁剪结果与 CRM 页面口径一致。
5. 返回结构稳定、带 `requestId`、支持分页。
6. 审计日志可回溯外部调用记录。

---

## 16. 第二阶段预留

以下接口不在本契约实施范围内，但允许后续扩展：

1. 客户/商机/报价草稿写入接口
2. 审批触发接口
3. 企业微信身份映射辅助接口

---

## 17. 已补充的只读辅助接口

> 更新时间：2026-06-05  
> 说明：以下接口均为只读接口，沿用 `Authorization: Bearer {accessToken}`，并继续按当前 token 绑定的 CRM 用户权限裁剪数据。

### 17.1 身份查询

`GET /identity/users/{userId}`

用途：

1. 查询当前 CRM 用户身份上下文。
2. 返回角色、区域、大区、渠道、个人可见范围等权限口径。
3. 非超管只能查询当前绑定用户，避免误取其他用户权限上下文。

响应重点字段：

```json
{
  "id": "A030",
  "user_id": "A030",
  "username": "liulonghai",
  "name": "刘龙海",
  "role": "superadmin",
  "roleIds": ["superadmin"],
  "roleNames": ["超级管理员"],
  "scopeType": "all",
  "scopeDescription": "可查看全量数据",
  "regions": [],
  "bigRegions": [],
  "partnerIds": [],
  "userIds": []
}
```

### 17.2 联调诊断

`GET /diagnostics/self-check`

用途：

1. 检查当前 client、绑定用户、权限范围。
2. 检查字典数量。
3. 检查六类对象是否授权、可见数量和样例 ID。
4. 辅助联调排障，不返回敏感密钥、密码或业务详情。

### 17.3 单对象统计摘要

`GET /analytics/{resource}/summary`

当前支持：

1. `partners`
2. `registrations`
3. `opportunities`
4. `quotes`
5. `orders`
6. `technical-service-providers`
7. `tech-service-providers`

支持常用过滤参数：

1. `createdAfter`
2. `createdBefore`
3. `updatedAfter`
4. `updatedBefore`
5. `region`
6. `bigRegion`
7. `partnerId`
8. `assignedStaffId`
9. `ownerId`
10. `createdBy`
11. `status`
12. `stage`
13. `partnerLevel`
14. `cooperationLevel`
15. `techServiceType`
16. `technicalServiceProviderType`
17. `dateField`
18. `granularity`

返回内容：

1. `totalCount`
2. `totalAmount`
3. `byStatus`
4. `byRegion`
5. `byBigRegion`
6. `byMonth`
7. `byCooperationLevel`
8. `byTechServiceType`
9. `statusDistribution`
10. `dimensions`
11. `timeSeries`
12. `topPartners`
13. `topStaff`
14. `dataSource`

`dimensions` 统一包含：

1. `byStatus`
2. `statusDistribution`
3. `byRegion`
4. `byBigRegion`
5. `byPartnerLevel`
6. `byCooperationLevel`
7. `byTechServiceType`
8. `byTechnicalServiceProviderType`
9. `byPartner`
10. `byPartnerName`

`timeSeries` 按 `dateField` 与 `granularity` 分桶。`granularity` 支持 `day` / `month` / `year`，默认 `month`。

### 17.4 转化漏斗

`GET /analytics/funnel/registration-opportunity-order`

用途：

按当前权限范围返回：

```text
客户报备 -> 商机 -> 报价 -> 订单
```

返回每个阶段数量、订单金额和阶段转化率。

### 17.5 经营总览

`GET /analytics/business-overview`

用途：

一次性返回当前权限范围内的渠道、客户报备、商机、报价、订单汇总，适合 AI-agent 做智能分析首页、经营概览、上下文预加载。

返回内容：

1. `summaries.partners`
2. `summaries.registrations`
3. `summaries.opportunities`
4. `summaries.quotes`
5. `summaries.orders`
6. `funnel`
7. `dimensions`
8. `timeSeries`
9. `scope`

### 17.6 渠道贡献

`GET /analytics/partners/contribution`

用途：

按当前权限范围返回渠道维度贡献排行，包括：

1. 报备数量
2. 商机数量和金额
3. 报价数量和金额
4. 订单数量和金额

返回行补充：

1. `partnerLevelName`
2. `cooperationLevel`
3. `cooperationLevelName`
4. `techServiceType`
5. `techServiceTypeName`
6. `technicalServiceProviderType`
7. `isTechnicalServiceProvider`
8. `status`

统计类端点统一补充 `dimensions` 与 `timeSeries`，用于 AI-agent 直接读取合作级别、技术服务商类型、状态分布和时间序列。

### 17.7 技术服务商统计别名

技术服务商底层来源为渠道商 `partners`，别名端点默认排除 `techServiceType=none`。

```http
GET /analytics/technical-service-providers/summary
GET /analytics/technical-service-providers/profile
GET /analytics/technical-service-providers/contribution
```

短别名：

```http
GET /analytics/tech-service-providers/summary
GET /analytics/tech-service-providers/profile
GET /analytics/tech-service-providers/contribution
```

以上端点支持 `techServiceType=full/developing/nominated/none` 精确过滤；返回结构与渠道统计保持兼容，并补充 `sourceResource: "partners"`。

---

## 18. 通用筛选参数增强

截至 2026-06-05，列表与统计接口已增强支持以下通用筛选：

| 参数 | 说明 |
|---|---|
| `bigRegion` | 大区过滤 |
| `partnerId` | 渠道过滤，兼容 `partnerId / assignedPartnerId / parentPartnerId / parentPartnerIds` |
| `partnerName` | 渠道商名称模糊过滤 |
| `customer` | 客户名称模糊过滤 |
| `customerId` | 客户标识过滤，当前兼容 `customerId/creditCode/customerName` |
| `registrationId` | 报备 ID 过滤，兼容旧字段 `regId` |
| `opportunityId` | 商机 ID 过滤，兼容旧字段 `oppId/oppIds` |
| `quoteId` | 报价 ID 过滤 |
| `orderId` / `orderNo` | 订单 ID/编号过滤 |
| `assignedStaffId` | 指派员工过滤 |
| `ownerId` | 负责人过滤 |
| `ownerName` | 负责人名称模糊过滤 |
| `createdBy` | 创建人过滤 |
| `stage` | 商机阶段过滤 |
| `partnerLevel` | 渠道分销层级过滤：`primary` / `secondary` / `none` |
| `cooperationLevel` | 合作级别过滤：`lep` / `gold` / `silver` / `diamond` |
| `techServiceType` | 技术服务商类型过滤：`none` / `full` / `developing` / `nominated` |
| `technicalServiceProviderType` | 技术服务商类型兼容过滤，含义同 `techServiceType` |
| `dateField` | 统计时间分桶字段，默认 `createdAt` |
| `granularity` | 统计时间粒度：`day` / `month` / `year`，默认 `month` |

注意：所有筛选都只能在当前绑定 CRM 用户可见范围内生效，不能突破权限边界。

---

## 19. 产品目录只读接口

> 更新时间：2026-06-16  
> 说明：产品目录接口用于 AI-agent 理解报价、订单、套餐、模块和产品构成。若对方只分析商机与订单金额，可暂不读取；若需要解释报价结构、套餐贡献、产品线经营情况，必须读取。

### 19.1 产品大类

`GET /categories`

支持参数：

| 参数 | 说明 |
|---|---|
| `pageNo` / `pageSize` | 分页 |
| `status` | 状态 |
| `keyword` | 按 `id/name/type/desc` 搜索 |
| `sortBy` / `sortOrder` | 排序 |

响应字段重点：

`id` `name` `type` `status` `sort` `desc` `createdAt` `updatedAt`

### 19.2 产品模块

`GET /modules`

支持参数：

| 参数 | 说明 |
|---|---|
| `categoryId` | 产品大类 ID |
| `status` | 状态 |
| `keyword` | 按 `id/name/categoryId/desc` 搜索 |

响应字段重点：

`id` `categoryId` `name` `status` `sort` `desc` `createdAt` `updatedAt`

### 19.3 功能产品

`GET /features`

支持参数：

| 参数 | 说明 |
|---|---|
| `moduleId` | 产品模块 ID |
| `status` | 状态 |
| `keyword` | 按 `id/name/moduleId/productCode` 搜索 |

响应字段重点：

`id` `moduleId` `name` `productCode` `status` `published` `price` `sort` `createdAt` `updatedAt`

### 19.4 硬件产品

`GET /hardware`

支持参数：

| 参数 | 说明 |
|---|---|
| `status` | 状态 |
| `keyword` | 按 `id/name/productCode/brand/model` 搜索 |

响应字段重点：

`id` `name` `productCode` `brand` `model` `status` `published` `price` `sort` `createdAt` `updatedAt`

### 19.5 套餐

| 接口 | 说明 |
|---|---|
| `GET /packages` | 套餐列表 |
| `GET /packages/{id}` | 套餐详情 |

响应字段重点：

`id` `name` `featureIds` `hardwareIds` `moduleIds` `status` `sort` `desc` `createdAt` `updatedAt`

### 19.6 产品

| 接口 | 说明 |
|---|---|
| `GET /products` | 产品列表 |
| `GET /products/{id}` | 产品详情 |

响应字段重点：

`id` `name` `categoryId` `moduleId` `featureId` `status` `sort` `createdAt` `updatedAt`

---

## 20. Markdown 分析取数约束

AI-agent 当前约定为：调用 OpenAPI 取数，生成 Markdown 快照文件，再基于 Markdown 做经营分析、进展分析和系统问题分析。

推荐调用顺序：

1. `POST /auth/token`
2. `GET /auth/me`
3. `GET /meta/permission-scope`
4. `GET /meta/dictionaries`
5. `GET /diagnostics/self-check`
6. `GET /analytics/business-overview`
7. 按页拉取核心列表：`users`、`partners`、`registrations`、`opportunities`、`quotes`、`orders`
8. 如需产品维度，按页拉取：`categories`、`modules`、`features`、`hardware`、`packages`、`products`，并按需读取 `product-tree`、`product-stats`
9. 如需运营、提醒和工作量分析，读取 `notifications`、`pending-approvals`、`channel-targets`、`channel-visits`、`workload-mappings`、`workload-delivery-rules`
10. 对重点对象或异常对象调用详情接口
11. 生成 Markdown 文件，并在文件头写入快照时间、绑定用户、权限范围、过滤条件、分页总数、requestId

分页要求：

1. 建议 `pageSize=200`。
2. 按接口返回的 `total` 判断是否继续翻页。
3. 同一份快照内，所有列表使用同一组时间过滤条件。
4. 若遇到 `40102 access token invalid`，重新获取 token 后从当前资源的第一页重新拉取。

敏感信息要求：

1. Markdown 中不得写入 `appSecret`、`accessToken`、CRM 管理员密码、CRM 用户密码。
2. OpenAPI 响应会自动剔除 `password/token/secret/session/captcha/salt` 等敏感字段。
3. 对外发给大模型或第三方的 Markdown，手机号、邮箱、联系人、统一社会信用代码等字段按双方确认的脱敏级别处理。
4. 每份分析结论必须声明当前 `scopeType` 和绑定用户，避免把局部权限数据误判为全局经营数据。
