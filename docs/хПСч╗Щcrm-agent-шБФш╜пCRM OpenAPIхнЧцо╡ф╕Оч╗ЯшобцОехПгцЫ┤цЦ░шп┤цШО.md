# 发给对方：联软 CRM OpenAPI + Markdown 分析交接补充说明

> 日期：2026-06-16  
> 适用对象：crm-agent / AI-agent 对接团队  
> 对接模式：AI-agent 调用联软 CRM 标准 OpenAPI 取数，生成 Markdown 数据快照，再基于 Markdown 做经营分析、业务进展分析和系统问题分析。  
> 安全边界：本次只开放只读查询与只读统计接口，不开放 CRM 管理员/用户密码，不开放业务写入接口。

---

## 1. 当前对接模式

1. AI-agent 不直接连接业务库，不直接读取 SQLite / data.json。
2. AI-agent 不使用 CRM 管理员或普通用户账号登录页面。
3. AI-agent 仅使用 OpenAPI 的 `appKey/appSecret` 调用 `POST /auth/token` 换取 `accessToken`。
4. 所有 OpenAPI 查询结果按绑定 CRM 用户的角色和权限自动裁剪。
5. AI-agent 将接口数据整理成 Markdown 文件，后续分析只基于 Markdown 快照和接口返回的统计数据。

---

## 2. 我方还需提供或确认给对方的信息

| 类别 | 需要提供/确认 | 当前建议 |
|---|---|---|
| 环境地址 | SIT / 生产 Base URL | SIT 当前为 `http://10.18.16.114:3000/api/open/v1`，生产地址上线前另行确认 |
| 出口 IP | AI-agent 服务器出口 IP | 已知 `8.129.9.164`，如对方有多出口或容灾 IP，需要补齐 |
| OpenAPI 凭证 | `appKey/appSecret` | 通过单独安全渠道发送，不写入本文档和 Markdown |
| 启用 client | 使用哪一组 OpenAPI client | 建议 SIT 先启用超管全量 client，再用区管/渠道/员工 client 验证权限差异 |
| 绑定用户 | client 绑定的 CRM 用户 | 见第 5 节权限矩阵 |
| 资源白名单 | `allowedResources` | 全量分析建议 `["*"]`；生产可按资源精确授权 |
| Token TTL | token 有效期 | 当前默认 7200 秒；服务重启后旧 token 失效 |
| Markdown 范围 | 全量快照或按问题临时快照 | 经营总览建议全量快照；单问题分析可按时间/区域/渠道过滤 |
| Markdown 脱敏级别 | 手机、邮箱、联系人、统一社会信用代码是否脱敏 | 默认对外大模型分析时脱敏，内部可信环境可按双方书面确认放开 |
| Markdown 保存周期 | 快照文件保留多久 | 建议 SIT 7 天，生产按客户安全要求确认 |
| 调用频率 | 快照刷新周期和并发 | 建议先 15 分钟或按问题触发；并发控制在单 client 串行分页 |
| 产品目录 | 是否分析产品/套餐/报价构成 | 若问产品线、套餐、报价构成，必须授权产品目录资源 |
| 故障联系人 | 403/401/数据差异时联系谁 | 双方指定联调负责人和日志排查窗口 |

---

## 3. 账号、密码和密钥处理要求

### 3.1 CRM 管理员/用户密码

1. 不向 AI-agent 提供 CRM 超级管理员密码、区域管理员密码、渠道用户密码或员工密码。
2. 不允许把 CRM 用户密码写入接口文档、Markdown 快照、提示词、日志或前端配置。
3. OpenAPI 响应会自动剔除 `password/token/secret/session/captcha/salt` 等敏感字段。
4. AI-agent 如需验证权限，只使用不同 OpenAPI client，不使用不同 CRM 登录密码。
5. 如确需页面 UI 联调，由联软侧单独创建临时测试账号；测试完成后禁用或重置密码，且该密码不进入 OpenAPI 交付材料。

### 3.2 OpenAPI appKey/appSecret

1. `appKey/appSecret` 是 AI-agent 唯一使用的接口凭证。
2. `appSecret` 只通过安全渠道单独发送，不能写入本交接文档、Markdown 快照、代码仓库、前端页面或普通日志。
3. AI-agent 本地配置建议使用环境变量或密钥管理配置，例如：

```bash
CRM_OPENAPI_BASE_URL=http://10.18.16.114:3000/api/open/v1
CRM_OPENAPI_APP_KEY=oak_xxx
CRM_OPENAPI_APP_SECRET=oas_xxx
CRM_OPENAPI_PAGE_SIZE=200
```

4. `accessToken` 只在运行内存中使用，不落 Markdown 文件。
5. 如 `appSecret` 疑似泄露，联软侧立即重置对应 client 密钥，对方同步更新配置。

### 3.3 对外联调参数回传表模板

| 环境 | Base URL | clientName | appKey | appSecret | 绑定用户 | 角色 | allowedResources | ipWhitelist | 过期时间 |
|---|---|---|---|---|---|---|---|---|---|
| SIT | `http://10.18.16.114:3000/api/open/v1` | `AI-agent-superadmin-sit` | 单独发送 | 单独发送 | `A030 / liulonghai` | `superadmin` | `["*"]` | `8.129.9.164,10.18.16.114` | 待确认 |

---

## 4. OpenAPI 总体约定

Base URL：

```text
{CRM_BASE_URL}/api/open/v1
```

SIT 当前示例：

```text
http://10.18.16.114:3000/api/open/v1
```

认证流程：

1. `POST /auth/token`，请求体包含 `appKey/appSecret`。
2. 响应中获取 `accessToken`。
3. 后续请求 Header 传：

```http
Authorization: Bearer {accessToken}
```

标准成功响应：

```json
{
  "code": 0,
  "message": "ok",
  "data": [],
  "requestId": "req_xxx",
  "pageNo": 1,
  "pageSize": 200,
  "total": 1000
}
```

分页规则：

1. 推荐 `pageSize=200`，当前最大 200。
2. 按 `total` 判断是否继续翻页。
3. 建议排序 `sortBy=updatedAt&sortOrder=desc`；产品目录可按 `sort` 排序。
4. 同一份 Markdown 快照内，所有资源使用同一组时间/区域/渠道过滤条件。

---

## 5. OpenAPI client 与权限矩阵

| 视角 | clientName | 绑定用户 | 角色 | 权限范围 | 用途 |
|---|---|---|---|---|---|
| 全量 | `AI-agent-superadmin-sit` | `A030 / liulonghai` | `superadmin` | 全量数据 | 经营总览、全局数据质量、全域问题分析 |
| 区域 | `AI-agent-admin-sit` | `A013 / admin_sd` | `admin` | 本区域数据 | 验证区域管理员视角 |
| 渠道 | `AI-agent-partner-admin-sit` | `PA001 / liangcui` | `partner_admin` | 本渠道及关联渠道数据 | 验证渠道视角 |
| 员工 | `AI-agent-staff-sit` | `S022 / shangxichao` | `staff` | 本人相关数据 | 验证个人视角 |

权限裁剪由 CRM 后端完成。AI-agent 在每份 Markdown 和每次分析结论中必须写明：

1. `clientName`
2. 绑定用户 ID / 用户名
3. 角色
4. `scopeType`
5. `regions / bigRegions / partnerIds / userIds`

避免把局部权限数据误判为全局经营数据。

---

## 6. 资源授权值

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
  "products"
]
```

辅助分析资源：

```json
[
  "analytics",
  "diagnostics",
  "identity"
]
```

全量授权：

```json
["*"]
```

建议：

1. SIT 全量联调先用 `["*"]`。
2. 生产如只做经营分析，至少授权核心业务资源和 `analytics/diagnostics/identity`。
3. 生产如做产品线、套餐、报价构成分析，额外授权产品目录资源。

---

## 7. 接口清单

### 7.1 鉴权与身份

| 接口 | 方法 | 用途 | 是否写入 Markdown |
|---|---|---|---|
| `/auth/token` | POST | 获取 `accessToken` | 只写 token 有效期，不写 token |
| `/auth/me` | GET | 当前 client 和绑定用户 | 写入 `01-auth-scope.md` |
| `/meta/permission-scope` | GET | 当前数据权限范围 | 写入 `01-auth-scope.md` |
| `/meta/dictionaries` | GET | 角色、状态、阶段、区域、大区等字典 | 写入 `02-dictionaries.md` |
| `/identity/users/{userId}` | GET | 查询用户身份上下文 | 按需写入 |
| `/diagnostics/self-check` | GET | 联调自检、资源授权、可见数量 | 写入 `11-data-quality.md` |

### 7.2 核心业务列表与详情

| 资源 | 列表接口 | 详情接口 | 重点用途 |
|---|---|---|---|
| 用户 | `GET /users` | `GET /users/{id}` | 角色、区域、负责人、渠道归属 |
| 渠道商 | `GET /partners` | `GET /partners/{id}` | 渠道层级、区域、贡献分析 |
| 客户报备 | `GET /registrations` | `GET /registrations/{id}` | 客户入口、报备状态、转化起点 |
| 商机 | `GET /opportunities` | `GET /opportunities/{id}` | 阶段、金额、负责人、预计成交 |
| 报价 | `GET /quotes` | `GET /quotes/{id}` | 报价金额、折扣、关联商机 |
| 订单 | `GET /orders` | `GET /orders/{id}` | 成交金额、状态、关联报价/商机 |

### 7.3 产品目录

| 资源 | 列表接口 | 详情接口 | 重点用途 |
|---|---|---|---|
| 产品大类 | `GET /categories` | - | 产品线 |
| 产品模块 | `GET /modules` | - | 模块维度 |
| 功能产品 | `GET /features` | - | 软件/功能产品 |
| 硬件产品 | `GET /hardware` | - | 硬件产品 |
| 套餐 | `GET /packages` | `GET /packages/{id}` | 套餐包含关系 |
| 产品 | `GET /products` | `GET /products/{id}` | 产品目录补充 |

### 7.4 统计分析

| 接口 | 用途 |
|---|---|
| `GET /analytics/{resource}/summary` | 单对象摘要，`resource` 支持 `partners/registrations/opportunities/quotes/orders` |
| `GET /analytics/business-overview` | 经营总览：五类对象摘要 + 漏斗 + 当前 scope |
| `GET /analytics/funnel` | 报备 -> 商机 -> 报价 -> 订单漏斗 |
| `GET /analytics/funnel/registration-opportunity-order` | 第一阶段漏斗兼容接口 |
| `GET /analytics/partners/profile` | 渠道画像 |
| `GET /analytics/partners/contribution` | 渠道贡献排行 |
| `GET /analytics/regions/contribution` | 区域/大区贡献 |
| `GET /analytics/owners/contribution` | 负责人贡献 |

---

## 8. 通用筛选参数

列表接口和统计接口常用参数：

| 参数 | 说明 |
|---|---|
| `pageNo` | 页码，默认 1 |
| `pageSize` | 每页数量，最大 200 |
| `keyword` | 关键词模糊搜索 |
| `status` | 状态过滤；商机中等价于阶段过滤 |
| `stage` | 商机阶段 |
| `region` | 区域 |
| `bigRegion` | 大区 |
| `partnerId` | 渠道过滤，兼容 `partnerId/assignedPartnerId/parentPartnerId/parentPartnerIds` |
| `partnerName` | 渠道商名称模糊过滤 |
| `customer` | 客户名称模糊过滤 |
| `customerId` | 客户标识过滤，兼容 `customerId/creditCode/customerName` |
| `registrationId` | 报备 ID，兼容 `regId` |
| `opportunityId` | 商机 ID，兼容 `oppId/oppIds` |
| `quoteId` | 报价 ID |
| `orderId` | 订单 ID |
| `orderNo` | 订单编号 |
| `assignedStaffId` | 指派员工 |
| `ownerId` | 负责人 ID |
| `ownerName` | 负责人名称 |
| `createdBy` | 创建人 |
| `createdAfter/createdBefore` | 创建时间范围 |
| `updatedAfter/updatedBefore` | 更新时间范围 |
| `sortBy/sortOrder` | 排序字段和方向 |

注意：所有筛选只能在当前绑定用户权限范围内生效，不能突破 CRM 权限边界。

---

## 9. 业务关联字段

AI-agent 生成 Markdown 时必须保留 ID 和展示名，不能只保留 ID。

| 业务链路 | 关联字段 |
|---|---|
| 用户 -> 渠道 | `users.partnerId = partners.id` |
| 报备 -> 商机 | `opportunities.registrationId/regId = registrations.id` |
| 商机 -> 报价 | `quotes.opportunityId/oppId/oppIds = opportunities.id`，或 `opportunities.quoteId = quotes.id` |
| 报价 -> 订单 | `orders.quoteId = quotes.id` |
| 商机 -> 订单 | `orders.opportunityId/oppId = opportunities.id` |
| 渠道 -> 报备/商机/报价/订单 | `partnerId/assignedPartnerId/parentPartnerId/parentPartnerIds` |
| 员工/负责人 -> 业务对象 | `createdBy/ownerId/assignedStaffId` |

必须保留的展示名字段：

```text
partnerName, customerName/customer, opportunityName/name,
quoteName, orderName/orderNo, ownerName, assignedStaffName, createdByName
```

---

## 10. Markdown 快照生成流程

推荐目录：

```text
crm-md-snapshot/
  00-snapshot-meta.md
  01-auth-scope.md
  02-dictionaries.md
  03-users.md
  04-partners.md
  05-registrations.md
  06-opportunities.md
  07-quotes.md
  08-orders.md
  09-products.md
  10-analytics-overview.md
  11-data-quality.md
  12-index.md
```

推荐调用顺序：

1. `POST /auth/token`
2. `GET /auth/me`
3. `GET /meta/permission-scope`
4. `GET /meta/dictionaries`
5. `GET /diagnostics/self-check`
6. `GET /analytics/business-overview`
7. 分页拉取核心业务列表。
8. 如问题涉及产品、套餐、报价构成，再分页拉取产品目录。
9. 按需读取重点对象详情。
10. 生成 Markdown 索引和数据质量报告。

每个 Markdown 文件头建议固定：

```md
# {资源名称}

- snapshotAt: 2026-06-16T10:00:00+08:00
- baseUrl: http://10.18.16.114:3000/api/open/v1
- clientName: AI-agent-superadmin-sit
- boundUser: A030 / liulonghai / superadmin
- scopeType: all
- filters: createdAfter=..., region=...
- total: 100
- returnedCount: 100
- requestIds: req_xxx, req_yyy
- piiMasking: phone/email/contact masked
```

表格字段建议：

1. 第一列放稳定 ID。
2. 第二列放展示名。
3. 状态字段同时保留原值和中文标签。
4. 金额字段保留原始数值，不要只写中文摘要。
5. 关联字段同时保留 ID 和展示名。
6. 缺失字段写空值，不要编造。

---

## 11. Markdown 脱敏规则

禁止写入：

```text
password, passwd, pwd, token, accessToken, refreshToken,
secret, appSecret, privateKey, session, cookie, captcha, salt
```

建议脱敏：

| 字段 | 建议 |
|---|---|
| 手机号 | 保留前 3 后 4，中间 `****` |
| 邮箱 | 保留首字母和域名，中间 `***` |
| 联系人 | 对外大模型场景可只保留姓或角色 |
| 统一社会信用代码 | 保留前 6 后 4，中间 `******` |
| 详细地址 | 默认不写入，确需分析区域时只保留省市区 |

内部可信联调环境若需要完整字段，需双方确认脱敏级别，并限制 Markdown 文件保存周期和访问人员。

---

## 12. AI-agent 分析规则建议

1. 回答任何经营问题前，先读取 `00-snapshot-meta.md` 和 `01-auth-scope.md`，确认快照时间和权限范围。
2. 当前 scope 不是 `all` 时，结论必须写明“仅代表当前权限范围”。
3. 商机阶段使用 `stage/stageName`，不要把商机当普通 `status` 处理。
4. 渠道贡献需合并 `partnerId/assignedPartnerId/parentPartnerId/parentPartnerIds`。
5. 客户链路按 `registrationId -> opportunityId -> quoteId -> orderId` 串联。
6. 订单编号优先使用 `orderNo`，展示可使用 `orderName`。
7. 如果接口 `total` 与 Markdown 记录数不一致，需要重新分页生成，不得继续分析。
8. 没有权限看到的数据不能推断为不存在。
9. 对金额、转化率、Top 排行必须说明口径、过滤条件和时间范围。
10. 发现字段缺失、关系断链、状态异常时，先归类为“数据质量问题”，不要直接给经营结论。

---

## 13. 错误码和排查

| HTTP | code | 含义 | 对方处理 |
|---|---:|---|---|
| 400 | `40111` | 缺少 `appKey/appSecret` | 检查配置 |
| 401 | `40112` | client 无效 | 联系联软确认 client 状态 |
| 401 | `40113` | `appSecret` 无效 | 检查密钥，必要时重置 |
| 401 | `40101` | 缺少 access token | 重新鉴权 |
| 401 | `40102` | token 无效或过期 | 重新获取 token 后重跑当前资源 |
| 403 | `40312` / `40302` | IP 不在白名单 | 提供出口 IP 给联软加入白名单 |
| 403 | `40313` / `40304` | 绑定 CRM 用户不可用 | 联软检查绑定用户是否启用 |
| 403 | `40303` | 资源未授权 | 检查 `allowedResources` |
| 404 | `40401` - `40408` | 资源详情不存在 | 检查 ID 和权限范围 |
| 404 | `40409` | 统计资源不存在 | 检查 analytics resource 名称 |

---

## 14. 联调验收清单

1. 对方能用 `POST /auth/token` 获取 token。
2. `GET /auth/me` 返回正确 client 和绑定用户。
3. `GET /meta/permission-scope` 返回预期权限范围。
4. `GET /meta/dictionaries` 返回中文枚举。
5. `GET /diagnostics/self-check` 显示核心资源已授权。
6. 六类核心业务列表均可分页返回 `total`。
7. 产品目录接口按授权可读取。
8. 统计接口 `business-overview`、`funnel`、`partners/contribution` 可读取。
9. Markdown 中没有密码、appSecret、accessToken。
10. Markdown 记录数和 OpenAPI `total` 可校验。
11. 使用四组 client 分别验证超管、区管、渠道、员工权限差异。
12. 对方基于 Markdown 输出经营分析时，能正确说明快照时间、权限范围、过滤条件和指标口径。

---

## 15. 相关接口文档

已补充/更新的文档：

1. `docs/openapi-aiagent-latest-guide.md`：最新联调说明，含账号密码处理、Markdown 分析模式和测试顺序。
2. `docs/openapi-aiagent-api-contract.md`：标准 API 契约，含完整资源授权值、产品目录接口和 Markdown 取数约束。
3. `docs/openapi-aiagent-self-test-record.md`：联调自测记录。
4. `deliverables/openapi-field-completion-confirmation_20260615.md`：字段补齐确认。
5. `deliverables/openapi-md-agent-handoff-guide_20260616.md`：本文档，可直接发给对方。
