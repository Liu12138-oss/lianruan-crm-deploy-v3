# AI-agent 全量业务 OpenAPI 取数说明

> 日期：2026-06-24  
> Base URL：`{CRM_BASE_URL}/api/open/v1`  
> 定位：给 AI agent 做业务分析、流程优化、报价/产品/渠道运营诊断使用。OpenAPI 仍保持只读为主，报价工作量和 IPG 参考价仅提供预览计算，不写入报价单或订单。

## 1. 鉴权

1. 调用 `POST /auth/token`，传入 `appKey`、`appSecret` 获取 `accessToken`。
2. 后续请求使用：

```http
Authorization: Bearer {accessToken}
```

3. Client 的 `allowedResources` 会限制可访问资源；绑定 CRM 用户决定数据权限范围。

## 2. 权限口径

| CRM 角色 | OpenAPI 可见范围 |
|---|---|
| 超级管理员 | 全量业务数据、产品/工作量配置、审计日志 |
| 区域管理员 | 本区域客户报备、商机、报价、订单、渠道运营数据 |
| 渠道管理员 | 本渠道及关联渠道范围内的数据 |
| 员工 | 本人创建、负责或所属渠道相关数据 |

说明：即使 Client 勾选了资源，返回数据也不会突破绑定 CRM 用户的权限范围。

## 3. 新增开放资源

### 核心业务

| 资源 | 接口 |
|---|---|
| 用户 | `GET /users`、`GET /users/{id}` |
| 渠道商 | `GET /partners`、`GET /partners/{id}` |
| 客户报备 | `GET /registrations`、`GET /registrations/{id}` |
| 商机 | `GET /opportunities`、`GET /opportunities/{id}` |
| 报价 | `GET /quotes`、`GET /quotes/{id}` |
| 订单 | `GET /orders`、`GET /orders/{id}` |

### 产品与报价配置

| 资源 | 接口 |
|---|---|
| 产品大类 | `GET /categories`、`GET /categories/{id}` |
| 产品模块 | `GET /modules`、`GET /modules/{id}` |
| 功能模块 | `GET /features`、`GET /features/{id}` |
| 硬件产品 | `GET /hardware`、`GET /hardware/{id}` |
| 产品套餐 | `GET /packages`、`GET /packages/{id}` |
| 兼容产品 | `GET /products`、`GET /products/{id}` |
| 产品目录树 | `GET /product-tree` |
| 产品统计 | `GET /product-stats` |

### 运营与提醒

| 资源 | 接口 |
|---|---|
| 通知中心 | `GET /notifications`、`GET /notifications/{id}` |
| 待审批 | `GET /pending-approvals`、`GET /pending-approvals/{id}` |
| 渠道目标 | `GET /channel-targets`、`GET /channel-targets/{id}` |
| 渠道拜访 | `GET /channel-visits`、`GET /channel-visits/{id}` |
| 渠道运营总览 | `GET /channel-operations-overview` |
| 首页统计 | `GET /dashboard-stats` |
| 企业搜索 | `GET /company-search?keyword=客户名称` |

### 计算与实施配置

| 资源 | 接口 |
|---|---|
| 实施工作量分类 | `GET /workload-classifications`、`GET /workload-classifications/{id}` |
| 交付工作量规则 | `GET /workload-delivery-rules`、`GET /workload-delivery-rules/{id}` |
| 产品工作量映射 | `GET /workload-mappings`、`GET /workload-mappings/{id}` |
| 旧版工作量规则 | `GET /workload-rules`、`GET /workload-rules/{id}` |
| 报价工作量预览 | `POST /quotes/workload-preview` |
| IPG 参考价预览 | `POST /ipg/quote-preview` |

### 系统分析

| 资源 | 接口 |
|---|---|
| 字典 | `GET /meta/dictionaries` |
| 权限范围 | `GET /meta/permission-scope` |
| 身份上下文 | `GET /identity/users/{userId}` |
| 诊断自检 | `GET /diagnostics/self-check` |
| 操作审计日志 | `GET /audit-logs`、`GET /audit-logs/{id}`，仅超级管理员有数据 |
| 统计分析 | `GET /analytics/...` 系列接口 |

## 4. 通用查询参数

列表接口统一支持：

| 参数 | 说明 |
|---|---|
| `pageNo`、`pageSize` | 分页，最大页大小由服务端限制 |
| `keyword` | 关键字模糊搜索 |
| `status`、`type`、`year` | 状态、类型、年份过滤 |
| `region`、`bigRegion` | 区域过滤，不突破权限 |
| `partnerId`、`partnerName` | 渠道过滤 |
| `customer`、`customerId` | 客户过滤 |
| `registrationId`、`opportunityId`、`quoteId`、`orderId` | 业务链路过滤 |
| `createdAfter`、`createdBefore`、`updatedAfter`、`updatedBefore` | 时间范围 |
| `partnerLevel` | 渠道分销层级过滤：`primary` / `secondary` / `none` |
| `cooperationLevel` | 合作级别过滤：`lep` / `gold` / `silver` / `diamond` |
| `techServiceType`、`technicalServiceProviderType` | 技术服务商类型过滤：`none` / `full` / `developing` / `nominated` |
| `sortBy`、`sortOrder` | 排序 |

## 5. 字典增强

`GET /meta/dictionaries` 增加以下内容：

- `openApiResources`：OpenAPI 资源清单。
- `openApiResourceGroups`：按核心业务、产品与报价配置、运营与提醒、计算与实施配置、系统分析分组。
- `productStatuses`、`priceTypes`、`publishStatuses`：产品/报价配置相关字典。
- `approvalTypes`、`approvalStatuses`：审批类型和状态。
- `notificationTypes`：通知类型。
- `channelVisitTypes`、`channelVisitStatuses`：渠道拜访类型和状态。
- `workloadProductTypes`、`workloadDeliveryTags`：工作量计算口径。
- `auditModules`、`auditActions`、`auditResults`：审计分析口径。
- `techServiceTypes`：技术服务商类型，包含 `none`、`full`、`developing`、`nominated`。
- `businessFieldDictionary`：AI agent 可直接使用的核心字段说明。

## 6. 统计端点维度增强

以下统计端点已统一补充合作级别、技术服务商类型、状态分布和时间序列能力：

| 接口 | 增强内容 |
|---|---|
| `GET /analytics/{resource}/summary` | 返回 `byCooperationLevel`、`byTechServiceType`、`statusDistribution`、`dimensions`、`timeSeries` |
| `GET /analytics/business-overview` | 返回各资源 `dimensions` 与 `timeSeries` |
| `GET /analytics/partners/profile` | 返回渠道画像的技术服务商类型、状态分布和时间序列 |
| `GET /analytics/partners/contribution` | 贡献排行行数据补充渠道分销层级、合作级别、技术服务商类型和状态 |
| `GET /analytics/technical-service-providers/summary` | 技术服务商统计别名，底层来源为渠道商，默认排除 `techServiceType=none` |
| `GET /analytics/technical-service-providers/profile` | 技术服务商画像，返回签约/提名类型、状态分布和时间序列 |
| `GET /analytics/technical-service-providers/contribution` | 技术服务商维度的报备、商机、报价、订单贡献排行 |
| `GET /analytics/regions/contribution` | 返回区域贡献的 `dimensions` 与 `timeSeries` |
| `GET /analytics/owners/contribution` | 返回负责人贡献的 `dimensions` 与 `timeSeries` |
| `GET /analytics/funnel`、`GET /analytics/funnel/registration-opportunity-order` | 返回漏斗口径下的 `dimensions` 与 `timeSeries` |

`technical-service-providers` 同时提供短别名 `tech-service-providers`。

统计接口额外支持 `dateField` 与 `granularity`：

- `dateField`：默认 `createdAt`，可传对象已有时间字段，如 `updatedAt`。
- `granularity`：`day` / `month` / `year`，默认 `month`。

说明：客户报备、商机、报价、订单统计会按可见渠道关系补齐 `cooperationLevel` 与 `techServiceType`，用于跨对象渠道维度分析；所有补齐和过滤仍在当前绑定 CRM 用户权限范围内执行。

## 7. AI agent 推荐取数顺序

1. `GET /auth/me`：确认绑定用户。
2. `GET /meta/permission-scope`：确认数据边界。
3. `GET /meta/dictionaries`：加载枚举和字段口径。
4. `GET /diagnostics/self-check`：检查各资源可见数量。
5. 按分析主题取数：
   - 报价/产品分析：`/features`、`/packages`、`/product-tree`、`/quotes`、`/orders`、`/workload-mappings`。
- 渠道运营分析：`/partners`、`/channel-targets`、`/channel-visits`、`/channel-operations-overview`。
- 业务漏斗分析：`/registrations`、`/opportunities`、`/quotes`、`/orders`、`/analytics/funnel`。
- 到期提醒分析：`/notifications`、`/opportunities`、`/registrations`。

渠道商字段口径补充：

- `partnerLevel`：渠道分销层级，取值 `primary` / `secondary` / `none`。
- `cooperationLevel`：合作级别，取值 `lep` / `gold` / `silver` / `diamond`，兼容旧字段 `level`。
- `techServiceType` / `technicalServiceProviderType`：技术服务商类型字段。
