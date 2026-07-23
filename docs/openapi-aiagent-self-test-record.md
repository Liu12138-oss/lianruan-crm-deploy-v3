# 联软 CRM OpenAPI 增强实施与自测记录

> 日期：2026-06-05  
> 范围：AI-agent 对接所需的标准 OpenAPI 只读能力增强  
> 原则：不影响现有 CRM 业务登录、页面、报备、商机、报价、订单等原有业务功能

---

## 1. 本次实施内容

### 1.1 通用筛选能力增强

六类对象列表和统计接口补充支持以下筛选：

| 参数 | 说明 |
|---|---|
| `bigRegion` | 大区过滤 |
| `partnerId` | 渠道过滤，兼容 `partnerId / assignedPartnerId / parentPartnerId / parentPartnerIds` |
| `assignedStaffId` | 指派员工过滤 |
| `ownerId` | 负责人过滤 |
| `createdBy` | 创建人过滤 |
| `stage` | 商机阶段过滤 |
| `partnerLevel` | 渠道等级过滤 |

### 1.2 字典增强

`GET /api/open/v1/meta/dictionaries` 补充：

1. `regions`
2. `bigRegions`
3. 字典项统一补充 `sort` 和 `enabled`

### 1.3 身份查询接口

新增：

```http
GET /api/open/v1/identity/users/{userId}
```

安全规则：

1. 超管可查可见用户身份。
2. 非超管只能查当前绑定用户身份。
3. 返回角色、区域、大区、渠道、个人权限范围。

### 1.4 联调诊断接口

新增：

```http
GET /api/open/v1/diagnostics/self-check
```

返回内容：

1. 当前 client。
2. 当前绑定 CRM 用户。
3. 权限范围。
4. 字典数量。
5. 六类对象授权情况、可见数量、样例 ID。

说明：该接口不返回密码、密钥、token、业务明细等敏感内容。

### 1.5 统计分析只读接口

新增：

```http
GET /api/open/v1/analytics/{resource}/summary
GET /api/open/v1/analytics/business-overview
GET /api/open/v1/analytics/funnel/registration-opportunity-order
GET /api/open/v1/analytics/partners/contribution
```

当前支持的 `resource`：

1. `partners`
2. `registrations`
3. `opportunities`
4. `quotes`
5. `orders`

统计口径：

1. 所有统计先按当前 token 绑定用户做权限裁剪。
2. 再按请求参数做时间、区域、渠道、负责人等筛选。
3. 最终返回数量、金额、状态分布、区域分布、趋势、渠道贡献等只读结果。

---

## 2. 未改动范围

本次未改动以下业务主链路：

1. `POST /api/auth/login` 默认登录逻辑。
2. CRM 页面使用的原有业务接口。
3. 报备创建、审批、分配逻辑。
4. 商机创建、修改、分配逻辑。
5. 报价创建、修改、状态流转逻辑。
6. 订单创建、确认、驳回、调价逻辑。
7. 真实登录开关默认值。
8. 数据库表结构。

---

## 3. 自测环境

| 项目 | 值 |
|---|---|
| 临时测试端口 | `3012`、`3013` |
| 测试 Base URL | `http://127.0.0.1:3012`、`http://127.0.0.1:3013` |
| 最新联调 Base URL | `http://10.18.16.114:3000/api/open/v1` |
| 模拟来源 IP | `10.18.16.114` |
| 真实登录开关 | `CRM_REAL_LOGIN_ENABLED=false` |
| 测试方式 | 先临时端口自测，再重启 `3000` 联调服务并复测 |

---

## 4. 自测结果

### 4.1 业务登录回归

| 测试项 | 结果 |
|---|---|
| `liulonghai / 123456` 本地登录 | 通过 |
| 返回用户 | `liulonghai` |
| 返回角色 | `superadmin` |
| 返回 token | 有 |

### 4.2 四类 client 自测

| client | 绑定用户 | scope | 商机可见数 | 身份查询 | 诊断接口 | 统计接口 |
|---|---|---|---:|---|---|---|
| `AI-agent-superadmin-sit` | `liulonghai` | `all` | 44 | 通过 | 通过 | 通过 |
| `AI-agent-admin-sit` | `admin_sd` | `region` | 44 | 通过 | 通过 | 通过 |
| `AI-agent-partner-admin-sit` | `liangcui` | `partner` | 15 | 通过 | 通过 | 通过 |
| `AI-agent-staff-sit` | `shangxichao` | `user` | 3 | 通过 | 通过 | 通过 |

### 4.3 身份越权验证

| 场景 | 预期 | 结果 |
|---|---|---|
| 区管 client 查询超管 `A030` 身份 | 阻断 | 通过，返回 `403 / 40304` |

### 4.4 接口覆盖验证

已验证：

1. `POST /api/open/v1/auth/token`
2. `GET /api/open/v1/auth/me`
3. `GET /api/open/v1/meta/permission-scope`
4. `GET /api/open/v1/meta/dictionaries`
5. `GET /api/open/v1/users`
6. `GET /api/open/v1/partners`
7. `GET /api/open/v1/registrations`
8. `GET /api/open/v1/opportunities`
9. `GET /api/open/v1/quotes`
10. `GET /api/open/v1/orders`
11. `GET /api/open/v1/identity/users/{userId}`
12. `GET /api/open/v1/diagnostics/self-check`
13. `GET /api/open/v1/analytics/opportunities/summary`
14. `GET /api/open/v1/analytics/partners/summary`
15. `GET /api/open/v1/analytics/business-overview`
16. `GET /api/open/v1/analytics/funnel/registration-opportunity-order`
17. `GET /api/open/v1/analytics/partners/contribution`

### 4.5 `3000` 联调服务复测结果

复测时间：2026-06-05  
复测地址：`http://10.18.16.114:3000/api/open/v1`

| 测试项 | 结果 |
|---|---|
| 业务登录 `liulonghai / 123456` | 通过 |
| OpenAPI token | 通过 |
| `meta/dictionaries` 返回 `regions` | 通过，当前 15 个 |
| `meta/dictionaries` 返回 `bigRegions` | 通过，当前 5 个 |
| `GET /partners` | 通过，超管可见 174 |
| `GET /registrations` | 通过，超管可见 150 |
| `GET /opportunities` | 通过，超管可见 44 |
| `GET /quotes` | 通过，超管可见 17 |
| `GET /orders` | 通过，超管可见 2 |
| `GET /analytics/partners/summary` | 通过 |
| `GET /analytics/business-overview` | 通过 |
| `GET /analytics/funnel/registration-opportunity-order` | 通过 |
| `GET /analytics/partners/contribution` | 通过 |

---

## 5. 结论

本次增强满足“标准 API 先稳定、权限不绕过、业务不受影响、后续可扩展统计”的要求。

下一步建议：

1. 当前 `3000` 联调环境已经加载最新接口。
2. 对方如开始接统计接口，优先使用只读统计接口，不建议分页拉全量。
3. 如后端后续重启，旧 `accessToken` 会失效，需要重新调用 `/auth/token`。
