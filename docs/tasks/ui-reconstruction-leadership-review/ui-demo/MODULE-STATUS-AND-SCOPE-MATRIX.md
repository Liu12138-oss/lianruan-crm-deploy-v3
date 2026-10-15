# V3 模块状态与范围矩阵

更新日期：2026-09-21

## 1. 目的

本矩阵用于阻止前端、后端、测试和运维 Agent 把“已有代码”“本地验证”“原型完成”“生产已启用”和“尚未建设”混为一谈。

本文状态优先级如下：

1. 项目规范和正式 OpenAPI 契约。
2. 本矩阵的模块状态与功能开关。
3. `ARCHITECTURE-OPTIMIZATION-BLUEPRINT.md` 和 `IMPLEMENTATION-SPEC.md`。
4. HTML 原型和视觉截图。

## 2. 状态定义

| 状态           | 定义                                                     | 是否允许安排生产开发                 |
| -------------- | -------------------------------------------------------- | ------------------------------------ |
| `现有主链`     | 正式页面和接口可运行，但仍需按阶段零收口                 | 允许局部修复和收口，不允许无边界重构 |
| `已实现待验收` | 代码、迁移和自动化已完成，目标环境或真实外部依赖尚未验收 | 允许准备验收，不得宣称生产完成       |
| `已实现待门禁` | 代码和流程已存在，但功能开关默认关闭，需专项签字         | 只允许门禁内工作，禁止默认开启       |
| `原型完成`     | 页面和交互原型完成，业务规则已明确，正式代码未完成       | 可进入设计和编码评审                 |
| `设计完成`     | 业务和技术方案已明确，数据或代码尚未完成                 | 先确认契约和依赖再编码               |
| `未建设`       | 没有正式闭环、代码和可发布数据模型                       | 不在当前 UI 重构范围擅自实现         |
| `明确排除`     | 本轮 UI 重构明确不涉及                                   | 不编码，保留扩展边界                 |

## 3. 全局工程状态

| 模块                      | 业务域          | 当前状态     | 已有资产                                                                       | 正式入口或路由                                                                          | 功能开关                                                                                                             | 主要未完成项                                                           |
| ------------------------- | --------------- | ------------ | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 统一入口与四端落点        | 身份权限        | 现有主链     | 根路径、设备与角色分流、四套正式页面、统一会话                                 | `/`、`/login`、`admin.html`、`partner.html`、`admin-mobile.html`、`partner-mobile.html` | 认证配置                                                                                                             | 目标环境构建和发布验收                                                 |
| 本地登录                  | 身份权限        | 现有主链     | Cookie 与页面会话、统一认证客户端                                              | `/login`                                                                                | `V3_DELIVERY_AUTH_ENABLED`                                                                                           | 阶段零鉴权覆盖继续收口                                                 |
| IAM / UniSDP              | 身份权限        | 现有主链     | 配置接口、登录中转、失败回退                                                   | `/sso/iam`、`/sso/unisdp`、兼容 SSO 路径                                                | `V3_IAM_H5_SSO_ENABLED`、`V3_UNISDP_SSO_ENABLED`                                                                     | 生产参数、失败审计和目标环境验收                                       |
| 管理端工作台与业务主链    | 客户与销售      | 现有主链     | 工作台、客户报备、商机、报价、订单、渠道、产品和审核页面                       | `admin.html#/*`                                                                         | 无统一总开关                                                                                                         | 权限菜单、范围过滤、端到端持续回归                                     |
| 渠道端                    | 客户与销售      | 现有主链     | 工作台、报备、商机、报价、订单、产品和通知                                     | `partner.html#/*`                                                                       | 无统一总开关                                                                                                         | 渠道专属范围、动作和回归                                               |
| 移动一期                  | 移动端          | 现有主链     | 管理端和渠道端高频查询、报备、跟进、报价和订单入口                             | `admin-mobile.html`、`partner-mobile.html` 或 `/mobile/*`                               | 端入口配置                                                                                                           | 四端持续回归、真实浏览器验收                                           |
| 移动二期                  | 移动端          | 原型完成     | `mobile-v2` 页面、写操作契约和原型                                             | 待正式入口确认                                                                          | 待确认                                                                                                               | 开放页面范围、写操作授权和验收                                         |
| 组织与账号                | 身份权限        | 已实现待门禁 | 组织、岗位、任职、业务角色、证书、数据范围、成员统一档案                       | `admin.html#/organization/*`                                                            | `V3_ORGANIZATION_ENABLED=false`、`V3_ORGANIZATION_WRITE_ENABLED=false`、`V3_ORGANIZATION_ACCOUNT_ENTRY_MERGED=false` | 只读观察、目标环境迁移和写入签字                                       |
| 停用归档与交接            | 身份权限        | 已实现待门禁 | 影响预览、两阶段停权、五领域交接、Worker 重试                                  | `admin.html#/organization/offboarding`                                                  | `V3_ORGANIZATION_OFFBOARDING_ENABLED=false`、`V3_AUTH_ACCOUNT_STATUS_CHECK_ENABLED=false`                            | 双开关顺序、真实 PostgreSQL、旧会话 401、专项签字                      |
| 企微组织同步              | 身份权限        | 已实现待验收 | 预览数据模型、差异、批次、只读接口                                             | `admin.html#/organization/directory-sync`                                               | `V3_DIRECTORY_SYNC_ENABLED=false`                                                                                    | 真实企微适配器、凭据、对账、7 天观察和人工应用规则                     |
| 证书管理                  | 渠道运营        | 已实现待门禁 | 证书模板、持证记录、颁发、延期、撤销和组织关联                                 | `admin.html#/organization/certifications`                                               | 受组织写开关约束                                                                                                     | 目标环境验证和权限复核任务                                             |
| 客户报备                  | 客户经营        | 现有主链     | 草稿、创建、审核、导入、保护期、区域归属                                       | `admin.html#/registration`、`partner.html#/registration`                                | 无独立总开关                                                                                                         | 服务端统一权限、范围过滤和状态审计                                     |
| 线索管理                  | 线索管理        | 原型完成     | 检索、详情、来源状态、采集日志、关注、忽略、备注和导出；客户与商机关联仅预留   | `/leads`、`/leads/:id`、`/lead-sources`（正式路由待立项）                               | 待确认                                                                                                               | 爬虫归一化协议、数据源接入、客户商机关联后续立项                       |
| 商机                      | 销售过程        | 现有主链     | 列表、看板、详情、跟进、七阶段历史、报价关联                                   | `admin.html#/opportunity`、`partner.html#/opportunity`                                  | 无独立总开关                                                                                                         | 旧阶段代码映射、立项推进落位、负责人变化和阶段权限收口                 |
| 报价                      | 销售过程        | 现有主链     | 试算、草稿、快照、版本、PDF、状态和转订单                                      | `admin.html#/quote`、`partner.html#/quote`                                              | 无独立总开关                                                                                                         | 版本锁定、折扣审批、合同引用                                           |
| 报价收益                  | 销售过程        | 已实现待验收 | 软件、硬件收益公式，草稿、重算、冻结、成本版本和报价/订单入口                  | 报价详情、订单详情、产品硬件管理                                                        | `QUOTE_PROFIT_WORKER_ENABLED=false`、`QUOTE_PROFIT_EVENT_CUTOVER_AT`                                                 | 生产迁移、发布和历史回填授权                                           |
| 订单                      | 订单履约        | 现有主链     | 明细、审批、驳回、调价、回退修订、重提、履约、报价与商品快照原型               | `admin.html#/order`、`partner.html#/order`                                              | 无独立总开关                                                                                                         | 合同、保证金和财务关联                                                 |
| 订单预审与企微 OA         | 外部集成        | 已实现待验收 | Worker、泛微创建流程、附件、企微建群、失败补偿                                 | 订单审批链，无独立用户页面                                                              | `ORDER_PREAPPROVAL_WORKER_ENABLED=false`、`ORDER_PREAPPROVAL_EVENT_CUTOVER_AT`                                       | 对方接口、测试参数、映射、网络和切换时间                               |
| 渠道商与成员              | 渠道运营        | 现有主链     | 渠道核心档案、层级、成员、企业管理员、导入和经营报表                           | `admin.html#/partners`、`partner.html#/dashboard`                                       | 成员手机号编辑受组织开关约束                                                                                         | 核心档案字段审计、协议、技术团队和外部运营关系                         |
| 产品与价格                | 产品配置        | 现有主链     | 目录、模块、功能、硬件、套餐、固定价、阶梯价、区域覆盖                         | `admin.html#/products`、`admin.html#/workload-config`                                   | 无独立总开关                                                                                                         | 发布版本、有效期和标品扩展                                             |
| 工作量配置                | 产品配置        | 现有主链     | 产品映射、交付规则、特殊比例和敏感词                                           | `admin.html#/workload-config`                                                           | `isSuperAdmin`                                                                                                       | 生产范围复核和规则版本治理                                             |
| 审核中心                  | 业务协同        | 现有主链     | 客户、渠道、员工和订单历史待办与处理接口                                       | `admin.html#/admin-review`                                                              | 无独立总开关                                                                                                         | 流程实例、通用任务、节点和超时                                         |
| 站内消息                  | 业务协同        | 已实现待验收 | M1 数据域、通知列表、未读、已读、归档、偏好和四端入口                          | 四端通知中心                                                                            | `MESSAGE_WORKER_ENABLED=false`                                                                                       | 四端真实登录态、Redis 多消费者和生产验收                               |
| 提醒规则                  | 业务协同        | 已实现待验收 | 订单、报备、审核待办、到期规则、版本和审计                                     | `admin.html#/message-rules`                                                             | `MESSAGE_WORKER_ENABLED`、`MESSAGE_EVENT_CUTOVER_AT`                                                                 | 多实例压力、目标环境迁移和生产演练                                     |
| 外部消息渠道              | 业务协同        | 已实现待验收 | 企微群、企微应用、短信、SMTP、密文配置、试发、启停和投递状态                   | `admin.html#/message-platform`                                                          | `MESSAGE_WECOM_GROUP_ENABLED`、`MESSAGE_WECOM_APP_ENABLED`、`MESSAGE_SMS_ENABLED`、`MESSAGE_EMAIL_ENABLED`           | 真实凭据、真实接收端、退订、退信和告警                                 |
| 消息运行监控              | 业务协同        | 原型完成     | P04 投递监控原型、15 类事件、5 类到期数据源、失败重试、通道告警和诊断边界      | `47-message-monitoring.png`（正式路由待立项）                                           | 待确认                                                                                                               | 正式页面、告警接入和生产演练                                           |
| OpenAPI                   | 平台治理        | 现有主链     | 客户端、密钥、资源、调用日志和只读开放接口                                     | `admin.html#/openapi-integration`                                                       | 按客户端资源授权                                                                                                     | 资源未配置默认拒绝、目标环境安全验收                                   |
| 审计、导入导出与运维      | 平台治理        | 现有主链     | 审计、导入导出任务、健康、迁移状态和任务补偿基础                               | `admin.html#/audit-logs` 等                                                             | 系统配置                                                                                                             | 统一任务监控、告警和补偿页面                                           |
| MCP 受控只读              | 分析智能        | 已实现待验收 | `apps/mcp`、stdio、Streamable HTTP、十个只读工具、主体断言、限流和审计边界     | `/admin.html#/mcp-management` 原型 + 平台配置/审计 UI 已设计                            | `V3_MCP_ENABLED=false`、`V3_MCP_REAL_TOOLS_ENABLED=false`、`V3_MCP_HTTP_ENABLED=false`                               | 正式 MCP 页面开发、真实 RedClaw 验收、性能、生产授权、HTTPS 和回退演练 |
| 合同与收款                | 协议合同 / 财务 | 设计完成     | 数据模型、状态机、接口、页面方案和 `48-contracts.png` / `49-receipts.png` 占位 | `/workspace/admin/contracts*`、`receipts*` 为规划路径                                   | 未建设                                                                                                               | 全文未编码，必须另行立项和授权                                         |
| 合作协议与框架协议        | 协议合同        | 设计完成     | 共用合同主档方案、页面边界和合同占位原型                                       | 规划路径 + `48-contracts.png`                                                           | 未建设                                                                                                               | 编码前确认类型、字段、审批和财务关系                                   |
| 下单保证金                | 财务应收        | 设计完成     | 保证金占用模型、接口边界和 `50-deposits.png` 占位                              | 规划路径                                                                                | 未建设                                                                                                               | 编码前确认冻结、释放和异常规则                                         |
| 客户公海池与报备池        | 客户关系        | 设计完成     | 入池、领取、保护、并发、任务方案和 `51-customer-pool.png` 占位                 | `/workspace/admin/customer-pool*` 为规划路径                                            | 未建设                                                                                                               | 池定义、领取规则和撞单规则签字                                         |
| AI 分析、大屏与企微机器人 | 分析智能        | 设计完成     | 分析库、指标、模型路由、MCP 边界、评测方案和 `52-ai-analytics.png` 占位        | 规划路径                                                                                | 未建设                                                                                                               | 指标口径、只读库、模型、评测和试点签字                                 |
| 系统备份与恢复中心        | 平台治理        | 设计完成     | 备份、恢复计划、执行器、双人复核、演练方案和 `53-backup-recovery.png` 占位     | 规划路径                                                                                | 未建设                                                                                                               | 对象存储、恢复目标、执行器和演练                                       |

## 4. 当前 UI 重构范围

### 4.1 本阶段纳入

- 现有管理端、渠道端、移动端正式页面。
- 组织、证书、消息和报价收益等已实现待门禁模块的 UI 收口。
- 用户已经确认的信息架构、订单报价快照、管理配置中心和系统架构原型。
- 四端共享的鉴权、权限、数据范围、状态机、审计和任务边界。

### 4.2 本阶段只做设计占位

- 合同、收款、保证金、公海池、报备池、AI 分析、大屏和机器人。
- 这些模块只能按后续阶段进入编码，不能因为原型中出现入口就默认实现。

### 4.3 本阶段明确排除

- 新建独立登录入口或第二套权限系统。
- 绕过服务端状态机修改业务状态。
- 渠道端和 OpenAPI 返回内部成本、收益、底价或凭据。
- MCP 写工具、MCP 直连数据库、MCP 自建权限体系。
- 把生产恢复、合同确认、财务核销交给前端或普通管理账号。

## 5. 功能开关矩阵

| 功能            | 开关                                   | 默认值  | 开启前提                                  |
| --------------- | -------------------------------------- | ------- | ----------------------------------------- |
| 组织只读        | `V3_ORGANIZATION_ENABLED`              | `false` | 迁移、只读对账和目标环境准入通过          |
| 组织写入        | `V3_ORGANIZATION_WRITE_ENABLED`        | `false` | 组织写入专项评审和回归通过                |
| 账号状态防护    | `V3_AUTH_ACCOUNT_STATUS_CHECK_ENABLED` | `false` | 停用账号旧会话 401、异常 503 验收通过     |
| 停用归档交接    | `V3_ORGANIZATION_OFFBOARDING_ENABLED`  | `false` | 状态防护稳定、五领域交接和回退演练通过    |
| 企微组织同步    | `V3_DIRECTORY_SYNC_ENABLED`            | `false` | 真实适配器、凭据、对账和观察窗口通过      |
| 消息工作进程    | `MESSAGE_WORKER_ENABLED`               | `false` | 固定启用时间和目标环境迁移通过            |
| 企微群          | `MESSAGE_WECOM_GROUP_ENABLED`          | `false` | Webhook、测试群和脱敏规则通过             |
| 企微应用        | `MESSAGE_WECOM_APP_ENABLED`            | `false` | 应用凭据、可见范围、UserId 映射和试发通过 |
| 短信            | `MESSAGE_SMS_ENABLED`                  | `false` | 供应商、模板、签名、频控和试发通过        |
| 邮箱            | `MESSAGE_EMAIL_ENABLED`                | `false` | SMTP、发信域名、退信和频率治理通过        |
| 收益 Worker     | `QUOTE_PROFIT_WORKER_ENABLED`          | `false` | 生产迁移授权、成本和冻结验证通过          |
| 订单预审 Worker | `ORDER_PREAPPROVAL_WORKER_ENABLED`     | `false` | 泛微、企微、模板、网络和切换时间确认      |
| MCP 总开关      | `V3_MCP_ENABLED`                       | `false` | 协议、授权、审计、性能和生产授权通过      |
| MCP 真实工具    | `V3_MCP_REAL_TOOLS_ENABLED`            | `false` | P0 身份权限修复和真实工具验收通过         |
| MCP HTTP        | `V3_MCP_HTTP_ENABLED`                  | `false` | HTTPS、OAuth、Origin 白名单和端口隔离通过 |

## 6. 开发范围判定规则

1. 若模块状态低于“已实现待验收”，只能做设计、契约和门禁准备。
2. 若功能开关默认关闭，前端可以展示只读观察状态，不得展示“已启用”。
3. 若接口未进入 `packages/contracts`，后端和前端不得各自创建冲突字段。
4. 若模块依赖外部系统，外部失败不能回滚已提交的 V3 主业务状态。
5. 若文档与代码冲突，以代码事实和正式契约为准，并先记录差异再实施。

## 7. 用于开发任务的输出

- 路由和角色：`PAGE-ROUTE-PERMISSION-MATRIX.md`。
- 接口、动作、幂等和错误：`ACTION-API-IDEMPOTENCY-CONTRACT.md`。
- 实施顺序和任务边界：`IMPLEMENTATION-TICKETS.md`。
- 测试、验收和回退：`TEST-AND-ROLLBACK-MATRIX.md`。
