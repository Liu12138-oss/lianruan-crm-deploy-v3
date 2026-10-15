# V3 动作、接口、幂等与错误契约

更新日期：2026-09-21

## 1. 契约原则

1. `packages/contracts` 和评审通过的 OpenAPI 是接口字段、枚举和错误码的唯一来源。
2. 现有页面兼容接口可以保留，但新增页面不得继续依赖只存在于前端脚本中的隐式字段。
3. 用户、角色、组织、渠道、区域和数据范围只能从服务端会话解析。
4. 金额、折扣、税费、工作量、收益、订单总额、下一状态和可执行动作均由服务端计算。
5. 高风险写动作必须支持幂等、乐观锁、状态前置校验、审计和明确错误码。
6. 外部系统失败不得回滚已经提交的客户、商机、报价、订单、组织和消息事实。

## 2. 通用请求约束

### 2.1 认证

- 正式页面优先使用 HttpOnly Cookie 会话。
- 兼容页面保留现有页面令牌时，服务端必须验证主体与 Cookie 主体一致。
- 开放接口使用独立签名令牌和资源授权，不复用页面用户自报字段。
- MCP 使用服务端签名主体断言或 OAuth 主体，不接受客户端传入用户编号和范围。

### 2.2 通用请求头

| 请求头                             | 适用场景                               | 要求                                         |
| ---------------------------------- | -------------------------------------- | -------------------------------------------- |
| `X-Request-Id`                     | 所有请求                               | 可透传安全格式；服务端始终生成或回传请求编号 |
| `Idempotency-Key`                  | 创建、审批、转单、证书、组织、消息配置 | 同一主体、方法和路径下唯一，长度不超过 200   |
| `If-Match` 或 `expectedRowVersion` | 编辑、审批、配置保存                   | 优先级以 OpenAPI 契约为准，不得两种并存      |
| `MCP-Protocol-Version`             | MCP HTTP                               | 与请求体协议版本一致                         |
| `X-V3-MCP-Principal`               | MCP 到 API 内部调用                    | 仅接受服务端签名断言                         |

## 3. 通用响应

### 3.1 成功

```json
{
  "success": true,
  "data": {},
  "meta": {
    "requestId": "req_...",
    "build": {
      "version": "3.0.0-stage10.20260906-prod1",
      "commit": "abc123",
      "time": "2026-09-21T08:00:00.000Z"
    }
  }
}
```

### 3.2 列表

```json
{
  "success": true,
  "data": [],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 128,
    "hasNext": true
  },
  "meta": {
    "requestId": "req_..."
  }
}
```

### 3.3 错误

```json
{
  "success": false,
  "error": {
    "code": "V3_ORDER_STATUS_CONFLICT",
    "message": "当前订单状态不允许执行该操作。",
    "details": {},
    "retryable": false
  },
  "meta": {
    "requestId": "req_..."
  }
}
```

HTTP 状态约定：

- `400`：字段格式错误、幂等键非法、驳回原因缺失。
- `401`：未登录、会话失效、账号停用、授权版本失效。
- `403`：权限或数据范围不足。
- `404`：对象不存在、已归档或无权限时采用保护性 404。
- `409`：状态冲突、重复转单、并发版本冲突、外部任务未就绪。
- `422`：业务校验失败，例如报价规则缺失。
- `429`：MCP 或高频接口限流。
- `503`：账号状态服务、数据库、审计或关键依赖不可用时的失效关闭。

## 4. 认证与会话

| 动作        | 方法与路径                        | 当前状态 | 关键字段                 | 幂等 / 并发 | 成功结果                                                      | 主要错误                              |
| ----------- | --------------------------------- | -------- | ------------------------ | ----------- | ------------------------------------------------------------- | ------------------------------------- |
| 本地登录    | `POST /api/auth/login`            | 现有     | 账号、密码、入口         | 不需要      | Cookie、用户、允许路径、页面会话                              | `V3_AUTH_INVALID`、`V3_AUTH_DISABLED` |
| 当前用户    | `GET /api/auth/me`                | 现有     | 无                       | 无          | 用户、角色、允许路径和范围摘要                                | `V3_AUTH_REQUIRED`                    |
| 退出        | `POST /api/auth/logout`           | 现有     | 无                       | 可重复调用  | Cookie 和会话清理                                             | 幂等成功                              |
| IAM 配置    | `GET /api/auth/sso/iam/config`    | 现有     | 无                       | 无          | `enabled:true`、`entries`、`requestIsaidByEntry`、`timeoutMs` | 配置不可用                            |
| IAM 登录    | `POST /api/auth/sso/iam/login`    | 现有     | 入口、票据               | 票据去重    | Cookie、用户、落点                                            | `SSO_INVALID`、`SSO_MAPPING_MISSING`  |
| UniSDP 登录 | `POST /api/auth/sso/unisdp/login` | 现有     | 票据                     | 票据去重    | Cookie、用户、落点                                            | `SSO_INVALID`                         |
| 修改密码    | 目标契约                          | 待补     | 旧密码、新密码、确认密码 | 旧密码校验  | 会话撤销并要求重新登录                                        | 密码策略错误                          |

## 5. 客户、报备与商机

| 动作     | 方法与路径                               | 当前状态                 | 关键字段                         | 幂等 / 并发          | 业务门禁           | 主要错误           |
| -------- | ---------------------------------------- | ------------------------ | -------------------------------- | -------------------- | ------------------ | ------------------ |
| 查询报备 | `GET /api/registrations`                 | 现有                     | 关键词、状态、区域、负责人、分页 | 无                   | 服务端范围过滤     | 403                |
| 报备详情 | `GET /api/registrations/:id`             | 现有                     | 无                               | 无                   | 对象范围           | 保护性 404         |
| 新建报备 | `POST /api/registrations`                | 现有                     | 客户、信用代码、联系人、归属     | `Idempotency-Key`    | 名称和信用代码查重 | 重复客户、字段错误 |
| 编辑报备 | `PUT /api/registrations/:id`             | 现有                     | 可编辑档案字段、版本             | `expectedRowVersion` | 状态和范围         | 409                |
| 审核报备 | `PUT /api/registrations/:id/status`      | 现有                     | `status`、`reason`               | 状态条件 + 版本      | 审核权限           | 驳回原因必填       |
| 商机列表 | `GET /api/opportunities`                 | 现有                     | 阶段、区域、客户、分页           | 无                   | 服务端范围         | 403                |
| 新建商机 | `POST /api/opportunities`                | 现有                     | 报备客户、项目、阶段、金额       | `Idempotency-Key`    | 客户已审批         | 客户无效、阶段非法 |
| 编辑商机 | `PUT /api/opportunities/:id`             | 现有                     | 项目、阶段、概率、时间           | `expectedRowVersion` | 当前状态允许编辑   | 409                |
| 记录跟进 | `POST /api/opportunities/:id/follow-ups` | 移动已有，正式接口待统一 | 方式、内容、下一步、阶段、提醒   | `Idempotency-Key`    | 商机访问范围       | 关联商机错误       |

商机接口对 UI 统一返回七阶段值：`客户建联 / 需求挖掘 / 客户方案 / POC 试用 / 立项推进 / 招投标 / 成单`。现有代码值必须由后端兼容映射；“立项推进”新增或派生规则未确认前，接口不得让前端自行推断。`输单` 和 `项目取消` 作为终止结果单独返回。

### 5.1 渠道核心档案

| 动作             | 方法与路径                      | 当前状态 | 关键字段                                                 | 幂等 / 并发          | 业务门禁                 | 主要错误      |
| ---------------- | ------------------------------- | -------- | -------------------------------------------------------- | -------------------- | ------------------------ | ------------- |
| 查询渠道核心档案 | `GET /api/partners/:id/profile` | 现有     | 工商主体、规模、地址、联系人、合作画像、能力、评分和提醒 | 无                   | 渠道范围与字段权限       | 保护性 404    |
| 保存渠道核心档案 | `PUT /api/partners/:id/profile` | 现有     | 分组档案字段、版本                                       | `expectedRowVersion` | 查看和编辑权限分开校验   | 409、字段错误 |
| 更新渠道层级     | `PUT /api/partners/:id/level`   | 现有     | 一级 / 二级、上级渠道                                    | 条件更新             | 区域、层级和循环关系校验 | 层级冲突      |

### 5.2 线索管理

| 动作         | 方法与路径                           | 当前状态 | 关键字段                             | 幂等 / 并发          | 业务门禁             | 主要错误           |
| ------------ | ------------------------------------ | -------- | ------------------------------------ | -------------------- | -------------------- | ------------------ |
| 公告列表     | `GET /api/leads`                     | 目标契约 | 关键词、来源、区域、行业、时间和状态 | 无                   | 服务端范围过滤       | 403                |
| 公告详情     | `GET /api/leads/:id`                 | 目标契约 | 公告、附件、来源和关联               | 无                   | 公告可见范围         | 保护性 404         |
| 公告变更     | `GET /api/leads/:id/changes`         | 目标契约 | 变更类型、变更摘要和版本             | 无                   | 公告可见范围         | 保护性 404         |
| 关注或忽略   | `PUT /api/leads/:id/follow-state`    | 目标契约 | 处理状态、关注级别、提醒和原因       | `expectedRowVersion` | 当前账号处理权限     | 409                |
| 人工关联     | `POST /api/leads/:id/associations`   | 后续预留 | 线索、客户、商机和关联说明           | `Idempotency-Key`    | 后续版本确认         | 第一版不可调用     |
| 来源列表     | `GET /api/lead-sources`              | 目标契约 | 来源、区域、频率和同步状态           | 无                   | 来源管理权限         | 403                |
| 立即采集     | `POST /api/lead-sources/:code/run`   | 目标契约 | 来源、时间窗口和去重策略             | `Idempotency-Key`    | 来源启用且无冲突任务 | 来源暂停、任务冲突 |
| 启停来源     | `PUT /api/lead-sources/:code/status` | 目标契约 | `enabled`、`paused`                  | 条件更新             | 来源管理权限         | 409                |
| 采集任务日志 | `GET /api/lead-source-runs`          | 目标契约 | 来源、时间、结果、失败和重试         | 无                   | 来源管理或只读范围   | 403                |

第一版不提供客户和商机关联写接口。关联行只保留为后续契约占位，页面和接口均不得默认开启联动。

## 6. 报价

| 动作         | 方法与路径                                             | 当前状态       | 关键字段                       | 幂等 / 并发          | 业务门禁             | 主要错误               |
| ------------ | ------------------------------------------------------ | -------------- | ------------------------------ | -------------------- | -------------------- | ---------------------- |
| 报价列表     | `GET /api/quotes`                                      | 现有           | 客户、状态、区域、分页         | 无                   | 范围过滤             | 403                    |
| 报价详情     | `GET /api/quotes/:id`                                  | 现有           | 无                             | 无                   | 报价范围             | 保护性 404             |
| 报价试算     | `POST /api/quotes/workload-preview`                    | 现有           | 产品、数量、工作量参数         | 无需写幂等           | 服务端计算           | 价格或工作量规则缺失   |
| IPG 参考试算 | `POST /api/ipg/quote-preview`                          | 现有           | 产品编号、数量                 | 无                   | 服务端计算           | 规则缺失               |
| 创建报价     | `POST /api/quotes`                                     | 现有           | 客户、商机、产品、数量、有效期 | `Idempotency-Key`    | 客户、商机、渠道归属 | 金额禁传、规则缺失     |
| 修改报价     | `PUT /api/quotes/:id`                                  | 现有           | 产品、数量、有效期、版本       | `expectedRowVersion` | 未转单               | 已转单不可修改         |
| 报价状态     | `PUT /api/quotes/:id/status`                           | 现有           | 发送、确认、撤回、过期         | 状态条件 + 版本      | 角色和状态           | 409                    |
| PDF 下载     | `GET /api/quotes/:id/pdf`                              | 现有           | 无                             | 无                   | 范围重复校验         | 403 / 404              |
| 转订单       | `POST /api/quotes/:id/convert-order`；移动兼容路径已有 | 待统一正式契约 | 报价、收货、签约主体、一级渠道 | `Idempotency-Key`    | 报价已确认、未转单   | 重复转单、渠道层级错误 |
| 一级渠道候选 | `GET /api/quotes/:id/parent-partners`                  | 现有           | 无                             | 无                   | 二级渠道报价         | 403 / 404              |

报价金额、折扣、税费、价格版本、区域覆盖和工作量快照不得由客户端提交。

## 7. 订单

| 动作           | 方法与路径                                    | 当前状态 | 关键字段                     | 幂等 / 并发              | 业务门禁           | 主要错误                 |
| -------------- | --------------------------------------------- | -------- | ---------------------------- | ------------------------ | ------------------ | ------------------------ |
| 订单列表       | `GET /api/orders`                             | 现有     | 状态、区域、渠道、分页       | 无                       | 服务端范围         | 403                      |
| 订单详情       | `GET /api/orders/:id`                         | 现有     | 无                           | 无                       | 范围过滤           | 保护性 404               |
| 从报价创建订单 | `POST /api/orders`                            | 现有     | `quoteId`、收货、签约主体    | `Idempotency-Key`        | 报价已确认、未转单 | 重复转单                 |
| 一级确认       | `PUT /api/orders/:id/primary-confirm`         | 现有     | 版本、确认信息               | 状态条件 + 幂等          | 一级渠道角色       | 状态冲突                 |
| 一级驳回       | `PUT /api/orders/:id/primary-reject`          | 现有     | 退回目标、原因、版本         | 状态条件 + 幂等          | 一级渠道角色       | 原因必填                 |
| 区管确认       | `PUT /api/orders/:id/status`                  | 现有     | `status`、意见、版本         | 状态条件 + 幂等          | 区管范围和角色     | 状态冲突                 |
| 区管调价       | `PUT /api/orders/:id/price-adjust`            | 现有     | 新金额、原因、明细、版本     | 状态条件 + 幂等          | 区管角色且允许调价 | 调价后必须重审           |
| 超管确认       | `PUT /api/orders/:id/status`                  | 现有     | `status`、意见、版本         | 状态条件 + 幂等          | 超管               | 状态冲突                 |
| 超管退回       | `PUT /api/orders/:id/status`                  | 现有     | 退回目标、原因、版本         | 状态条件 + 幂等          | 超管               | 退回目标非法             |
| 申请回退修订   | `POST /api/orders/:id/revision-requests`      | 现有     | 原因、报价新版本、明细、版本 | `Idempotency-Key`        | 可修订状态         | 明细不一致               |
| 审批回退修订   | `PUT /api/order-revision-requests/:id/status` | 现有     | 批准 / 驳回、意见、版本      | 状态条件 + 幂等          | 超管               | 驳回原因必填             |
| 退回后重新提交 | `PUT /api/orders/:id/resubmit`                | 现有     | 模块、数量、处理说明、金额   | `Idempotency-Key` + 版本 | 仅退回目标可提交   | 模块不在目录、金额不一致 |
| 移动转订单     | `POST /api/mobile/quotes/:id/convert-order`   | 现有     | 收货、签约主体、一级渠道     | `Idempotency-Key`        | 移动会话和报价状态 | 同正式转单               |
| 履约动作       | 目标契约需统一到订单动作接口                  | 待收口   | 发货、完成、取消、物流       | 状态条件 + 幂等          | 履约角色           | 状态冲突                 |

订单接口必须返回或配合详情返回：

- 来源报价编号和版本。
- 客户确认时间和价格版本。
- 商品模块、数量、报价单价、订单单价和差异。
- 当前审批轮次、上一节点和下一允许节点。
- 当前角色可执行动作。
- 商品快照是否只读和可修订原因。

## 8. 渠道、成员与证书

| 动作            | 方法与路径                                      | 当前状态         | 幂等 / 并发          | 主要错误       |
| --------------- | ----------------------------------------------- | ---------------- | -------------------- | -------------- |
| 渠道列表 / 详情 | `/api/partners`                                 | 现有             | 无                   | 范围不足       |
| 渠道成员档案    | `/api/org/channel-members/:id/profile`          | 组织开关后       | `expectedRowVersion` | 写开关关闭     |
| 渠道树          | `/api/org/channel-tree`                         | 组织开关后       | 无                   | 组织未启用     |
| 证书模板        | `/api/org/certification-templates`              | 组织开关后       | `Idempotency-Key`    | 证书名称冲突   |
| 成员证书        | `/api/org/member-certifications`                | 组织开关后       | 无                   | 组织未启用     |
| 颁发证书        | `POST /api/org/users/:userId/certifications`    | 组织写开关后     | `Idempotency-Key`    | 重复有效证书   |
| 延期证书        | `PUT /api/org/member-certifications/:id/extend` | 组织写开关后     | 版本 + 幂等          | 已撤销不可延期 |
| 撤销证书        | `PUT /api/org/member-certifications/:id/revoke` | 组织写开关后     | 版本 + 幂等          | 原因缺失       |
| 手机号编辑      | 渠道成员统一资料                                | 受手机号编辑开关 | 版本                 | 开关关闭时 403 |

证书变化不得自动修改业务角色、系统权限或数据范围。

## 9. 组织、账号与权限

组织接口统一位于 `/api/org/*`，RBAC 接口位于 `/api/rbac/*`。

| 动作                   | 路径范围                                                      | 当前状态     | 门禁                        | 幂等 / 并发               |
| ---------------------- | ------------------------------------------------------------- | ------------ | --------------------------- | ------------------------- |
| 组织树、区域、渠道树   | `/api/org/units/tree`、`/regions`、`/channel-tree`            | 已实现       | `V3_ORGANIZATION_ENABLED`   | 只读                      |
| 新建和编辑组织         | `/api/org/units*`                                             | 已实现       | 组织写开关                  | 幂等 + 版本               |
| 岗位与任职             | `/api/org/positions*`、`/assignments*`                        | 已实现       | 组织写开关                  | 幂等 + 版本               |
| 业务角色               | `/api/org/business-roles*`                                    | 已实现       | 组织写开关                  | 单一生效角色              |
| 数据范围               | `/api/org/data-scopes/*`                                      | 已实现       | 组织写开关                  | 角色级 + 版本             |
| 企微身份导入           | `/api/org/wecom-identities/*`                                 | 已实现       | 组织写开关                  | 预览 / 确认 + 幂等        |
| 泛微身份候选           | `/api/org/users/:userId/eteams-identity*`                     | 已实现       | 组织写开关                  | 人工确认 + 幂等           |
| 离职预览和交接         | `/api/org/staff/:userId/offboarding-preview`、`/offboarding*` | 已实现待门禁 | 状态防护 + 交接独立开关     | 两阶段 + 租约 + 幂等      |
| 账号恢复 / 归档 / 归并 | `/api/org/users/:userId/*`                                    | 已实现待门禁 | 交接独立开关                | 目标账号二次确认          |
| 目录同步               | `/api/integrations/directory-sync/*`                          | 只读代码     | `V3_DIRECTORY_SYNC_ENABLED` | 批次 + 幂等；应用固定拒绝 |
| RBAC 角色              | `/api/rbac/roles*`                                            | 已实现       | 超管                        | 版本 + 内置角色保护       |
| 用户角色分配           | `/api/rbac/users/:userId/roles`                               | 已实现       | 超管                        | 当前账号可受控降权        |

配置校验必须拒绝“交接开启、账号状态防护关闭”的非法组合。

## 10. 产品和价格

| 动作                           | 路径                                                                     | 当前状态     | 约束                     |
| ------------------------------ | ------------------------------------------------------------------------ | ------------ | ------------------------ |
| 产品列表、树、功能、硬件、套餐 | `/api/products*`、`/features`、`/hardware`、`/packages`、`/product-tree` | 现有         | 渠道端仅公开字段         |
| 产品统计                       | `/api/products/stats`                                                    | 现有         | 按数据范围               |
| 工作量分类和映射               | `/api/workload/classifications`、`/mappings*`                            | 现有         | 超管写                   |
| 交付工作量规则                 | `/api/workload/delivery-rules*`                                          | 现有         | 超管写，规则版本         |
| 价格规则编辑                   | 目标统一契约                                                             | 原型完成     | 阶梯、渠道比例、区域覆盖 |
| 硬件成本规则                   | `/api/quote-profit/hardware-cost-rules*`                                 | 已实现待验收 | 仅超管，版本化           |

内部成本、成本和收益规则不得通过渠道端或 OpenAPI 返回。

## 11. 消息与提醒

### 11.1 个人消息

| 动作         | 方法与路径                                     | 约束               |
| ------------ | ---------------------------------------------- | ------------------ |
| 查询通知     | `GET /api/messages/notifications`              | 只读取当前会话主体 |
| 未读数       | `GET /api/messages/notifications/unread-count` | 只读取当前会话主体 |
| 标记全部已读 | `PUT /api/messages/notifications/read-all`     | 幂等               |
| 标记已读     | `PUT /api/messages/notifications/:id/read`     | 对象属主           |
| 归档         | `PUT /api/messages/notifications/:id/archive`  | 对象属主           |
| 查询偏好     | `GET /api/messages/preferences`                | 当前用户           |
| 修改偏好     | `PUT /api/messages/preferences`                | 字段白名单         |

### 11.2 平台消息配置

| 动作               | 方法与路径                                                    | 当前状态 | 门禁                       |
| ------------------ | ------------------------------------------------------------- | -------- | -------------------------- |
| 通道列表与就绪状态 | `GET /api/messages/platform/channels`、`/readiness`           | 已实现   | 超管                       |
| 保存通道           | `PUT /api/messages/platform/channels/:channelCode`            | 已实现   | 超管、同源、二次确认、密文 |
| 测试通道           | `POST /api/messages/platform/channels/:channelCode/test`      | 已实现   | Worker 已启用、超管        |
| 启用 / 停用        | `POST /api/messages/platform/channels/:channelCode/enable     | disable` | 已实现                     | 测试通过、二次确认 |
| 查询测试投递       | `GET /api/messages/platform/tests/:deliveryId`                | 已实现   | 超管                       |
| 投递状态           | `GET /api/messages/platform/deliveries`                       | 已实现   | 脱敏字段                   |
| 事件规则           | `/api/messages/platform/rules`                                | 已实现   | 超管、保护规则、版本       |
| 到期提醒规则       | `/api/messages/platform/rules/reminders/:ruleCode`            | 已实现   | 30 / 7 / 1 天，版本        |
| 模板和任务模板     | `/api/messages/platform/rules/templates*`、`/task-templates*` | 已实现   | 变量白名单、版本           |
| 自建任务           | `/api/messages/platform/rules/tasks*`                         | 已实现   | 超管、幂等                 |

外部通道默认关闭。保存凭据不等于启用，保存时留空敏感字段表示保持原值。

## 12. 报价收益

| 动作         | 方法与路径                                                 | 角色        | 幂等 / 并发          | 说明                               |
| ------------ | ---------------------------------------------------------- | ----------- | -------------------- | ---------------------------------- |
| 读取收益     | `GET /api/quotes/:quoteId/profit-calculation`              | 区管 / 超管 | 无                   | 可返回实时预估、草稿、不完整、冻结 |
| 保存草稿     | `PUT /api/quotes/:quoteId/profit-calculation/draft`        | 区管 / 超管 | `expectedRowVersion` | 不阻断报价                         |
| 重算         | `POST /api/quotes/:quoteId/profit-calculation/recalculate` | 区管 / 超管 | 幂等 + 版本          | 缺失成本返回不完整                 |
| 请求冻结     | `POST /api/quotes/:quoteId/profit-calculation/freeze`      | 超管        | 事件幂等             | 正式冻结由 Worker 完成             |
| 成本规则历史 | `/api/quote-profit/hardware-cost-rules*`                   | 超管        | 版本                 | 历史只读                           |

状态必须区分计算态和持久化态：

- 计算态：`complete`、`incomplete`、`not_applicable`。
- 持久化态：`draft`、`incomplete`、`frozen`、`void`、`not_applicable`。
- 展示态：`estimated` 只能用于接口响应，不得写入数据库。

## 13. MCP 内部接口

MCP 只调用 API 内部只读接口，不直连数据库。

| 工具 / 内部动作 | 路径                                              | 权限                      | 约束                                 |
| --------------- | ------------------------------------------------- | ------------------------- | ------------------------------------ |
| 当前身份        | `POST /internal/mcp/context`                      | `integration.mcp.connect` | 唯一主身份，不接受客户端 userId 覆盖 |
| 产品搜索        | `POST /internal/mcp/products/search`              | MCP + 产品读取            | 仅已发布产品                         |
| 报备列表 / 详情 | `POST /internal/mcp/registrations/search`、`/get` | MCP + 报备读取            | 数据范围进入 SQL                     |
| 商机列表 / 详情 | `POST /internal/mcp/opportunities/search`、`/get` | MCP + 商机读取            | 返回 V3 链接                         |
| 报价列表 / 详情 | `POST /internal/mcp/quotes/search`、`/get`        | MCP + 报价读取            | 成本、底价、附件正文隐藏             |
| 订单列表 / 详情 | `POST /internal/mcp/orders/search`、`/get`        | MCP + 订单读取            | 不改变订单状态                       |

内部调用必须：

- 校验签名主体断言、`jti` 和 60 秒有效期。
- 重新读取账号状态、权限、范围和字段策略。
- 审计失败时拒绝业务工具调用。
- 不接收客户端自报 `userId`、`roleCode`、`regionId`、`partnerId` 或 `operatorId`。

## 14. 导入导出、审计与运维

| 动作             | 路径范围                                 | 当前状态 | 约束                                   |
| ---------------- | ---------------------------------------- | -------- | -------------------------------------- |
| 导入导出任务     | `/api/import-export/tasks`               | 现有     | 范围、预检、错误明细、文件过期         |
| 审计日志         | `/api/audit-logs`                        | 现有     | 只读，字段脱敏                         |
| OpenAPI 客户端   | `/api/open-api/clients*`                 | 现有     | 资源未配置时默认拒绝                   |
| 重签密钥         | `/api/open-api/clients/:id/reset-secret` | 现有     | 只展示一次                             |
| OpenAPI 调用日志 | `/api/open-api/logs`                     | 现有     | 401、403、404 追踪                     |
| 健康检查         | `/api/health/*`                          | 现有     | 依赖状态、迁移和 Worker                |
| 备份和恢复       | 目标契约                                 | 未建设   | 双人复核、隔离恢复、不可浏览器下载备份 |

## 15. 必测契约样例

### 15.1 一级确认订单

```json
{
  "expectedRowVersion": 7,
  "comment": "产品、数量和金额核对无误"
}
```

要求：仅一级渠道角色、仅 `pending_primary_confirm` 状态；重复请求返回第一次结果；状态冲突返回 409。

### 15.2 区管调价

```json
{
  "expectedRowVersion": 9,
  "newAmount": "318600.00",
  "items": [],
  "reason": "按区域商务政策调整渠道结算金额"
}
```

要求：新金额和明细必须一致；调价后进入超管确认；不得发起预审 OA。

### 15.3 回退修订

```json
{
  "expectedRowVersion": 11,
  "reason": "客户要求替换硬件型号",
  "newQuotePayload": {},
  "items": []
}
```

要求：批准后生成递增版本的新报价和新订单，原订单和外部流程事实保留。

### 15.4 消息通道启用

```json
{
  "confirm": "确认",
  "expectedVersion": 3
}
```

要求：测试通过、Worker 启用、同源请求和超管权限同时满足；凭据不回显。

### 15.5 组织写入

请求头必须包含 `Idempotency-Key`，请求体包含 `expectedRowVersion` 或正式契约定义的版本字段。写开关关闭时固定拒绝，不得只在前端隐藏入口。

## 16. 契约补齐要求

在进入并行开发前，必须把以下内容补进 `packages/contracts`：

- 所有新增页面查询和详情接口。
- 所有高风险动作的请求、响应、错误码和权限。
- 订单报价快照、商品明细和修订关系。
- 消息事件、渠道、模板和投递状态。
- MCP 内部接口与十个工具的输出结构。
- 未来模块的保留路径和禁用错误码，避免前端猜测。
