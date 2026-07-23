
# SQLite实体到PostgreSQL映射说明

生成日期：2026-07-23

## 1. 源数据形态

V2业务库使用SQLite通用表 `entities(entity_name, id, data_json, updated_at)` 保存业务对象，审计库使用 `audit_logs` 独立保存审计记录。阶段2迁移不得直接修改源库，必须先生成一致性快照，再只读导出。

## 2. 映射原则

- 每条V2记录先进入 `migration.v2_raw_records`，保存原始实体名、原始编号、原始JSON、摘要和批次号。
- 正式装载成功后写入 `migration.v2_record_mappings`，记录目标表、目标主键和转换版本。
- 不确定字段不丢弃，先保留在迁移暂存和目标表允许的 `extra_json` 中，并进入产品确认清单。
- 账号密码、开放接口密钥只在内存中转换为散列，不输出到中间文件。
- 任何未知角色、未知状态、断裂渠道关系、金额重算不一致，必须按规则进入自动映射、业务补录、隔离或阻断迁移。

## 3. 实体映射总表

| V2实体 | 记录数 | 目标表 | 批次 | 默认处理方式 |
| --- | ---: | --- | --- | --- |
| `users` | 70 | `iam.users`、`iam.password_credentials`、`iam.user_roles`、`org.staff_profiles`、`channel.partner_members` | 02 | 密码转换散列，角色按映射装载 |
| `partners` | 192 | `channel.partners`、`channel.partner_relations` | 03 | 渠道主档先装载，上下级关系后校验 |
| `registrations` | 151 | `crm.customers`、`crm.registrations`、`crm.registration_events` | 05 | 客户名称归一化，状态映射 |
| `opportunities` | 42 | `crm.customers`、`crm.opportunities`、`crm.opportunity_followups`、`crm.opportunity_stage_history` | 06 | 中文阶段映射为规范阶段，原值保留 |
| `notifications` | 50 | `ops.notifications` | 09 | 按通知对象和阅读状态迁移 |
| `quotes` | 4 | `crm.quotes`、`crm.quote_items`、`crm.quote_snapshots`、`crm.quote_status_history` | 07 | 金额逐分校验，快照保留 |
| `orders` | 1 | `crm.orders`、`crm.order_items`、`crm.order_status_history` | 08 | 订单与报价关系校验 |
| `channelTargets` | 0 | `ops.import_export_tasks` 或隔离表 | 09 | 当前无样本，保留策略 |
| `channelVisits` | 0 | `ops.import_export_tasks` 或隔离表 | 09 | 当前无样本，保留策略 |
| `pendingApprovals` | 21 | `ops.approvals`、`ops.approval_events` | 05 | 审批主档和事件拆分 |
| `categories` | 3 | `catalog.product_categories` | 04 | 直接迁移 |
| `modules` | 7 | `catalog.product_modules` | 04 | 直接迁移 |
| `features` | 34 | `catalog.product_features`、`catalog.price_rules` | 04 | 功能和价格拆分 |
| `hardwareProducts` | 15 | `catalog.hardware_products`、`catalog.price_rules` | 04 | 硬件和价格拆分 |
| `packages` | 6 | `catalog.product_packages`、`catalog.package_items`、`catalog.price_rules` | 04 | 套餐主档和明细拆分 |
| `products` | 0 | `catalog.product_features` 或 `catalog.hardware_products` | 04 | 当前无样本，保留兼容策略 |
| `partnerProfiles` | 0 | `channel.partner_profiles` | 03 | 当前无样本，保留策略 |
| `partnerProfileProducts` | 4 | `channel.partner_profile_products` | 03 | 依赖渠道画像和产品 |
| `openApiClients` | 4 | `integration.open_api_clients`、`integration.open_api_client_secrets`、`integration.open_api_permissions` | 09 | 密钥转散列，权限拆分 |
| `implementationWorkloadClassifications` | 3 | `catalog.workload_classifications` | 04 | 直接迁移 |
| `implementationWorkloadMappings` | 49 | `catalog.workload_mappings` | 04 | 直接迁移 |
| `implementationWorkloadRules` | 24 | `catalog.workload_rules` | 04 | 直接迁移 |
| `implementationDeliveryWorkloadRules` | 15 | `catalog.delivery_workload_rules` | 04 | 直接迁移 |
| `audit_logs` | 待导出 | `audit.audit_logs` | 09 | 审计库单独导出，按月分区 |

## 4. 字段处理分类

| 类型 | 处理方式 | 示例 |
| --- | --- | --- |
| 强业务字段 | 独立列，建立约束和索引 | 用户名、渠道编号、客户名称、状态、金额 |
| 可重复子结构 | 子表 | 报价明细、订单明细、跟进、审批事件 |
| 历史快照 | `jsonb`快照表 | 报价产品快照、计算输入输出 |
| 待确认低频字段 | `extra_json`并进入决策清单 | 历史页面遗留字段 |
| 不可迁移字段 | 隔离并记录原因 | 无法识别状态、断裂外键 |
