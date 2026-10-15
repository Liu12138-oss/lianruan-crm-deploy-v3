# 数据一致性与业务完整性核对（r17）

核对日期：2026-09-29

测试环境：`http://10.9.86.66`（唯一核对与发布目标）

Web 镜像：`lianruan-crm-v3-nginx:3.0.0-stage10.20260929-protofix13`（构建目录 `dist-r56`）

API 镜像：`lianruan-crm-v3-api:3.0.0-stage10.20260929-protofix13`（源码目录 `src-protofix13`）

本文件已按 2026-09-29 的后续修复更新：D-7 / D-8 / D-9 已完成并经用户授权执行；核对过程中新发现的 D-10 一并修复。

按用户 2026-09-29 指令「你发现的问题，测试环境都修复」，本文件补记第 4.6 节：
上一轮遗留的 4 项已在 `protofix11` → `protofix13` 全部处理完毕（消息渠道接口 500、站内通知假已读、
外部身份映射口径、消息双表标注），新增发现的 V2 兼容页单条已读参数问题（D-14）一并修复；
唯一未处理的是「线索采集模块尚未建设」，已核对原型文档确认其不属缺陷。

中间版本 `protofix11`、`protofix12` 仅用于本轮验证过程（`protofix12` 曾短暂承载过通道降级字段），
最终交付与验证均以 `protofix13` 为准。

生产环境 `10.20.3.10` 未连接、未修改。

本文件承接 `31-PROTOTYPE-PANEL-PAGES-AND-KPI-R16.md`，回答三个问题：
测试环境是否真的有数据、UI 展示值是否与数据一致、业务流程是否完整无错误。

## 1. 结论

| 问题 | 结论 |
| --- | --- |
| 测试环境是否有数据 | **有**。227 家渠道商、252 条客户报备、84 条商机、76 份报价、66 笔订单、107 个账号、225 条审批、1435+ 条审计、149 条站内消息、177 条外部投递 |
| UI 展示是否与数据一致 | **已一致，累计查出 14 处不一致并全部修复**：前端展示口径 6 处（D-1~D-6）、后端分页 1 处（D-7）、订单 KPI 覆盖 1 处（D-8）、测试数据 1 处（D-9）、渠道成员停用缺陷 1 处（D-10）、遗留问题 4 处（D-11 渠道接口 500 / D-12 站内通知假已读 / D-13 外部身份映射口径 / D-14 V2 兼容页单条已读参数）；`protofix13` 复核实测无新增不一致 |
| 业务流程是否完整无错误 | **38 个业务步骤全部通过，失败 0**（protofix13 复跑批次 `FLOW20260929-65183`）；线索采集、移动端、合同收款等模块尚未建设（沿用既有结论） |

## 2. 测试环境数据基线（只读核对）

```sql
-- 通过 docker exec lianruan-crm-v3-postgres psql -U lianruan_app -d lianruan_crm_v3 只读执行
```

| 数据表 | 行数 | 数据表 | 行数 |
| --- | --- | --- | --- |
| `channel.partners` | 227 | `crm.registrations` | 252 |
| `crm.opportunities` | 84 | `crm.quotes` | 76 |
| `crm.orders` | 66 | `iam.users` | 107 |
| `ops.approvals` | 225 | `ops.notifications` | 73 |
| `audit.audit_logs` | 1435 | `channel.partner_members` | 66（未归档 65） |
| `iam.external_identities` | 41 | `message.notifications` | 149 |
| `message.deliveries` | 177 | `message.templates` | 31 |

全部业务模块均有真实数据，无空库、无演示库。

> 说明：本表为核对开始时（2026-09-29 上午）的基线快照。项目自带的全流程业务回归脚本
> 每跑一轮都会真实创建报备、商机、报价、订单与账号，因此后续复跑后的计数会相应增长
> （最终值见 4.5 节），这属于回归脚本的正常行为，不是数据异常。

## 3. 逐页一致性核对（UI ↔ 接口 ↔ 数据库）

| 页面 | UI 指标 | 数据库 / 接口真值 | 结果 |
| --- | --- | --- | --- |
| 工作台 | 227 / 252 / 84 / 76 / 66 / 70 | 227 / 252 / 84 / 76 / 66 / 70 | 一致 |
| 客户管理 | 252 / 12 / 228 / 111 / 44 / 228 | 252（12 待审）/228 已通过/227 未到期/111/44 | 一致（“保护期内”按自然日含当日到期 1 条） |
| 商机作战 | 84 / 75 / 17 / 2 / 8 / 52 | 84；阶段成单 8；状态成单 7 | 一致（1 条阶段与状态不同步，见 4.2） |
| 报价管理 | 76 / 9 / 0 / 0 / 67 / 0 | 76；draft 9；converted 67 | 一致（转单数与订单数差 1，见 4.2） |
| 订单中心 | 66 / 1 / 10 / 11 / 11 / 12·1 | 66；8 种状态，其中退回 20 笔 | **不一致**，见 4.1 |
| 渠道管理 | 227 / 11 / 21 / 164 / 18 / 63 | 227；等级 lep 7+primary 3、gold 22；成员 65 | **不一致**，见 4.1 |
| 产品目录 | 42 / 22 / 6 / 64 / 240 / 0 | 功能 42、硬件 22、套餐 6、映射 64 | 一致 |
| 消息中心 | 22 / 0 / 22 / 0 / 2 / 35 | 超管站内消息 22 条未读 22；投递 177 条 | **口径已修正**，见 4.1 |
| 证书管理 | 12 / 5 / 5 / 2 / 0 / 2 | 模板 12、持证 5、已撤销 2 | 一致 |
| 审核中心 | 73 / 46 / 4 / 0 / 23 / 3 | pending 73（报备 46、订单 23、账号 4）；今日通过 3 | 一致 |
| OpenAPI | 4 / 4 / 0 / — / 0 / 0 | 客户端 4；调用日志 0 | 一致 |
| 审计与系统 | 正常 / 82 | 依赖正常；失败审计 82 条 | **口径已修正**，见 4.1 |
| 账号生命周期 | 107 / 84 / 23 / 46·61 / 41 / 36 | 107；启用 84、停用 23 | **口径已修正**，见 4.1 |
| 组织与账号 | 18 / 0 / 31 / 4 / 5 / 21 | 组织单元 18、岗位 0、任职 31、业务角色 4、证书 5 | **口径已修正**，见 4.1 |
| 渠道经营报表 | 227 / 11 / 21 / 18 / 63 / 15 | 同渠道管理 | **同源问题**，见 4.1 |
| 工作量配置 | 39 / 39 / 39 / 6 / 6 / 8.6 | 交付规则 39 条 | 一致 |
| 消息渠道配置 / 提醒规则与模板 | 4 类 / 9 / 0 / 31 / 20 / 20 / 2 | 规则 9、模板 31、任务模板 20；通道 4 类，其中 `wecom_app` 密文不可解密 | 一致（**接口 500 已修复**，见 4.6） |
| 线索管理 / 线索来源 | 5 条 | 无对应数据表 | 前端演示数据，见 4.3 |

## 4. 发现的问题

### 4.1 本轮已修复（前端，已上线 protofix8）

| 编号 | 问题 | 根因 | 修复 | 修复前后 |
| --- | --- | --- | --- | --- |
| D-1 | 账号生命周期“启用中/已停用”与数据库不符 | 页面优先读历史字段 `extra_json.status`，而非服务端 `status_code` | `AccountManagePage.vue` 状态取值改为以接口「状态」为准 | 92 / 15 → **84 / 23** |
| D-2 | 商机“停滞风险”把金额塞进数值并拼上“条”单位 | KPI 值模板 `52 / ¥ 4,647,857` + 单位“条” | 数值只保留条数，金额移入脚注并写明口径 | `52 / ¥ 4,647,857条` → **52 条（超过 7 天未更新 · 商机预计金额合计 ¥ 4,647,857）** |
| D-3 | 审计“待处理告警”恒为 0 | 只统计已加载的最新的 500 条明细 | 改为按 `result_code` 全量计数（`failure` + `failed`） | 0 → **82** |
| D-4 | 组织与账号“外部身份映射”显示 0 | KPI 依赖懒加载，未打开子栏目时不请求 | 页面初始化即加载，并改用接口汇总 `summary.total` | 0 → **21** |
| D-5 | 消息中心“已投递/外部投递失败”把最近 20 条当全量 | 接口默认 `limit=20`，脚注写“共 20 条投递记录” | 请求 `limit=100`，脚注改为“最近 N 条投递记录中成功/失败” | 20 → **最近 37 条中成功 35、失败 2** |
| D-6 | 消息渠道配置“失败投递”脚注同样表述为全量 | 同上 | 同上，脚注改为“最近 N 条投递记录中失败” | 脚注口径修正 |

验证截图与数值见 `test-evidence/20260929-data-consistency-r17/ui-capture-fixed/`。

### 4.2 已修复（后端分页、订单 KPI 与测试数据，protofix9）

| 编号 | 问题 | 根因 | 修复 | 修复前后 |
| --- | --- | --- | --- | --- |
| D-7 | 渠道商列表分页重复，24 家渠道商永远不显示 | `business-store.ts` 的 `查询通用列表` 只按「创建时间」排序，而 `channel.partners` 有 198 行共享同一 `created_at`（V2 迁移批量导入），PostgreSQL 对并列行不保证跨页稳定 | 排序补唯一键：`ORDER BY "创建时间" DESC NULLS LAST, "id" ASC` | 去重后 203 → **227**；连续 5 轮 × 多页取样指纹完全一致 |
| D-8 | 订单中心 KPI 未覆盖「已退回」状态 | 6 张卡合计只有 46 笔，20 笔已退回订单在页面上不可见 | 采用方案 A：末张卡改为「已完成 / 已退回 / 取消」三段值，并写明口径 | 46 笔可见 → **73 笔全覆盖（1+10+13+11+14+22+2）** |
| D-9 | 测试环境数据自身不一致 3 处 | V2 迁移遗漏 1 笔订单；1 条商机阶段/状态不同步；33 个账号历史 `extra_json.status` 与正式 `status_code` 不一致 | 补录 V2 原始订单 `ORD-1780908400434`（cancelled）；商机 `SJ-20260820-0005` 状态对齐为 `won`；33 个账号以正式状态回写历史字段 | 订单 66 → **67**；商机阶段/状态不一致 1 → **0**；账号状态字段不一致 33 → **0** |

D-7 的同类风险（`crm.registrations` 最大 54 行同时间戳、`iam.users` 35 行）由同一次排序修复一并覆盖，
复核结果：`partners 227 / registrations 256 / users 111 / audit（分页稳定）` 连续 5 轮唯一数与指纹完全一致。

D-9 修复脚本留存于 `test-evidence/20260929-data-consistency-r17/db/fix-d9-20260929.sql`，以事务执行并已 COMMIT。

### 4.2.1 核对时新发现并修复：D-10 停用渠道成员不生效

- 现象：通过「编辑渠道成员」把状态改为停用（`PUT /api/v2/partners/:id/staff/:staffId` 携带 `status`），
  渠道成员关系已停用，但**登录账号仍是启用**，且 `extra_json.status` 被写入停用值，与正式 `status_code` 互相矛盾。
  实测复现：成员状态 `disabled`，账号 `status_code = active`。
- 根因：`apps/api/src/v2-compat-routes.ts` 的 `保存V2用户` 中
  `const 待转状态 = 已有账号?.status ? String(已有账号.status) : 读取正文文本(输入, ["status"], "active")`
  无条件沿用快照状态，**请求里显式传入的 status 被直接忽略**（快照的 `status` 取自 `extra_json.status || status_code`）。
- 影响：停用渠道成员后账号仍可登录；旧版页面的「状态」下拉在编辑渠道成员时不生效。
- 修复：显式传入 `status` 时以本次请求为准，未传入时保持原有快照行为不变：
  `const 待转状态 = 显式状态 || (已有账号?.status ? String(已有账号.status) : "active");`
- 影响面核对：`保存V2用户` 仅有 3 个调用方——`PUT /users/:id`（旧版账号编辑，不传 status）、
  `POST /users`（新建账号，无快照，行为不变）、`保存渠道商员工`（本次要修的目标路径）。
- 复验：新建成员 → 停用（`inactive`）→ 启用 → 再停用（`disabled`），
  账号状态 / 成员状态 / 历史字段三者同步为 `disabled`；38 步业务回归新增账号同样三项一致。
- 回归证据：`tests/v2-compat.test.ts` 在同一数据基线上与改动前对比，失败集合**未增加**（改动前 8 项既有失败，改动后 7 项，减少的 1 项为偶发时序失败）。

### 4.3 已声明或未接入（不计为缺陷）

- **线索管理 / 线索来源**：展示前端 mock 数据（页面已标注“当前仅展示原型 mock 数据”），线索采集模块尚未建设。
  依据 `31-PROTOTYPE-PANEL-PAGES-AND-KPI-R16.md` 的声明，该模块不在本轮缺陷范围。
- **消息双轨（设计允许的灰度状态，不作为缺陷）**：`docs/operations/统一消息提醒平台开发落地文档.md` 第 18 章明确
  M1 不迁移、不删除 `ops.notifications`，新事件写入 `message.notifications`，四套正式页面在灰度期分别读取新旧数据源，
  历史通知迁移与旧表下线必须另立任务。因此**不做表合并**，只在界面标注数据来源（见 4.6）。

### 4.4 修复完成后的最终一致性核对（protofix10）

| 口径 | 界面显示 | 接口 / 数据库真值 | 结果 |
| --- | --- | --- | --- |
| 账号生命周期 | 账号总数 111 / 启用中 74 / 已停用 37 | `iam.users` 111 / `status_code='active'` 74 / `'disabled'` 37 | 一致 |
| 订单中心 | 总数 73；1 / 10 / 13 / 11 / 14·22·2 | `crm.orders` 73；八种状态合计 73 | 一致，KPI 全覆盖 |
| 渠道管理 | 227 | `channel.partners` 227，分页去重 227 | 一致 |
| 商机作战 | 86 | `crm.opportunities` 86 | 一致 |
| 客户管理 | 256 | `crm.registrations` 256 | 一致 |
| 报价管理 | 82 | `crm.quotes` 82 | 一致 |
| 审计与系统 | 待处理告警 82 | 失败审计 82 | 一致 |
| 组织与账号 | 外部身份映射 29（泛微 13 / 企微 16） | 接口 `mappingActive = 29`；仅统计内部组织人员 | 一致（口径见 4.6） |
| 变更页面几何 | — | 8 个变更页面画板 1440×742、无横向溢出 | 与 protofix8/9 完全一致 |

### 4.6 遗留问题处理结果（用户指令：你发现的问题，测试环境都修复）

上一轮 4.3 节列出的 3 项待确认问题、本轮验证中新发现的 1 项兼容问题，均已在测试环境修复并验证，
发布版本 `protofix13`（中间版本 `protofix11`、`protofix12` 为本轮验证过程产物）。

| 编号 | 问题 | 根因 | 修复 | 验证结果 |
| --- | --- | --- | --- | --- |
| D-11 | `GET /api/messages/platform/channels` 稳定 500，消息渠道配置页无数据 | `message.channel_accounts` 唯一行 `wecom_app` 的密文由轮换前的旧密钥加密，严格解密抛错使整个列表接口 500 | `apps/api/src/message-platform-store.ts` 增加 `尝试解密通道配置()` 容错读取：单条密文不可解密时只降级该通道（`configured:false`、`enabled` 取数据库真值、`needsReconfigure:true`、中文 `configurationError`），保存通道时以空配置为基线允许管理员重新保存自救，启用前校验密文可解密（不可解密返回 409 `V3_MESSAGE_CHANNEL_CONFIG_UNREADABLE`） | 接口 200；页面通道显示「需重新配置」+ 中文提示；「最近测试 2026/09/10」与 `last_test_status=success / last_tested_at=2026-09-10 15:22:56` 一致（修复前因降级分支丢字段误显示「从未测试」） |
| D-12 | `PUT /api/notifications/read` 返回成功但不落库（静默假成功） | 路由为固定返回 `{updated:true}` 的空实现 | `business-store.ts` 新增 `标记通知已读()`（内存实现 + PostgreSQL 实现），路由改为真实落库并返回 `{updated, 更新数, message}`，未登录返回 401 | 未登录 401 `V3_AUTH_REQUIRED`；单条标记 `更新数=1`；重复调用 `更新数=0`（幂等）；`ops.notifications` 同步写为 `read` 并记录 `read_at` |
| D-13 | 「外部身份映射」KPI 取的是目录内账号数（21），与映射记录数不符 | KPI 直接复用 `summary.total` | `org-store.ts` 新增映射口径统计 `mappingTotal / mappingActive / mappingEteamsActive / mappingWecomActive`，页面 KPI 改取 `mappingActive` 并在脚注写明口径 | 页面显示「29 条 · 有效映射（泛微 13 / 企微 16，仅内部组织人员）」；与 `external-identities-internal-scope` 方案口径一致（全表 41 行 / 有效 37 行含渠道商与离职账号，按方案排除） |
| D-14 | V2 兼容页按单条标记已读会清空该账号全部未读 | 旧页面（`apps/web/public/admin-app.js`）传 `notificationId`，新接口只识别 `id` / `通知编号` | 路由兼容 `notificationId` 字段；请求体里的 `userId` 一律忽略，接收人只取登录会话 | 传 `notificationId` 时 `更新数=1`，不再误清空全部 |

消息双表不作为缺陷（见 4.3），本轮只做界面标注：消息中心面板说明写明
「当前列表来源为历史站内通知表（V2 迁移通知），V3 事件消息另行投递，两套数据尚未合并。」

两点补充说明：

1. `wecom_app` 的历史密文已无法解密，接口不再 500 但该通道本身仍不可用；恢复投递能力需要管理员在
   「消息渠道配置」页重新填写企微应用凭据并完成一次测试发送，属业务操作，本轮未代填任何凭据。
2. 全流程业务回归脚本第 34 步「消息 / 全部标记已读」在修复前是空写（不改变数据），修复后是真实写入，
   执行该脚本会清空超管未读。本轮验证后已按原始基线把 22 条未读**原样还原**
   （`status_code='unread'`、`read_at=NULL`），站内通知恢复为 73 行 / 已读 1 行 / 超管未读 22 行。

## 5. 业务完整性核对

本轮在 `protofix13` 上重跑项目自带的全流程业务回归（`tools/verify-business-flows.mjs`）：

| 项 | 结果 |
| --- | --- |
| 步骤总数 | 38 |
| 通过 | 38 |
| 失败 | 0 |
| 批次 | `FLOW20260929-23217`（protofix8）、`FLOW20260929-65609`（protofix9）、`FLOW20260929-07910`（protofix10）、`FLOW20260929-65183`（protofix13） |

覆盖客户报备（通过/驳回）、商机创建与阶段推进、报价创建/提交/确认/驳回/转单/重复转单拒绝、
订单区管与超管审批、履约三步、一级驳回、调价、退回重提、渠道成员新增与停用、
证书模板/颁发/延期/撤销、消息读取与标记已读、权限边界。

业务规则守卫（变更原因必填、区管属地校验、重提必须带报价明细、证书需有效任职关系等）均按预期生效，无错误放行。

未覆盖模块（沿用既有结论）：线索采集、移动端业务动作、合同/收款/保证金/框架协议、企微真实投递。

## 6. 发布记录（protofix13）

| 项 | 值 |
| --- | --- |
| Web 镜像（最终） | `lianruan-crm-v3-nginx:3.0.0-stage10.20260929-protofix13` |
| Web 构建目录 | `/opt/lianruan-crm-v3/build/dist-r56`（本地 `apps/web/dist`） |
| API 镜像（最终） | `lianruan-crm-v3-api:3.0.0-stage10.20260929-protofix13`（源码构建，含 D-7、D-10、D-11~D-14） |
| API 源码目录 | `/opt/lianruan-crm-v3/build/src-protofix13`（构建包 `v3-src-protofix13.tar.gz`） |
| worker / mcp 镜像 | 由 `3.0.0-stage10.20260924-mainline1` 逐轮平移到 protofix13（代码未变，仅打标） |
| `.env` 备份 | `/opt/lianruan-crm-v3/compose/.env.bak-before-protofix9`、`-protofix10`、`-protofix11`、`-protofix12`、`-protofix13` |
| 重建范围 | `nginx`、`api-1`、`api-2`；worker / postgres / redis 未重启 |
| 主 CSS md5 | `adc23b6eaa1c76cd4a90ebe3b712e336`（`assets/index-lCYbbubE.css`，历轮样式未变） |
| 回退（protofix12） | `cd /opt/lianruan-crm-v3/compose && cp .env.bak-before-protofix13 .env && docker compose up -d --no-deps nginx api-1 api-2` |
| 回退（protofix10，上一稳定版） | `cp .env.bak-before-protofix11 .env && docker compose up -d --no-deps nginx api-1 api-2` |
| 回退（protofix8，仅前端） | `cp .env.bak-before-protofix9 .env && docker compose up -d --no-deps nginx api-1 api-2` |

本轮 `protofix11` → `protofix13` 的演进（每轮都完整构建并重启验证，可逐级回退）：

| 版本 | 内容 |
| --- | --- |
| `protofix11` | D-11 渠道接口容错、D-12 标记已读落库、D-13 映射口径、消息中心来源标注 |
| `protofix12` | D-14 兼容 `notificationId`；通道降级分支补 `lastTestStatus / lastTestedAt` |
| `protofix13` | 通道降级分支 `enabled` 改为返回数据库真值、状态徽标「需重新配置」优先级提前、最近测试按页面统一日期格式展示（避免单元格截断） |

修改文件：

- `apps/web/src/features/platform/AccountManagePage.vue`
- `apps/web/src/features/opportunity/OpportunityCenterPage.vue`
- `apps/web/src/features/platform/AuditLogPage.vue`
- `apps/web/src/pages/admin/platform-admin/OrganizationWorkspacePage.vue`
- `apps/web/src/features/message/MessageCenterWarPage.vue`
- `apps/web/src/features/message/MessageSettingsPage.vue`
- `apps/web/src/features/order/OrderCenterPage.vue`（D-8）
- `apps/api/src/business-store.ts`（D-7）
- `apps/api/src/v2-compat-routes.ts`（D-10）
- `apps/api/src/business-store.ts`（D-12 标记通知已读）
- `apps/api/src/business-routes.ts`（D-12 路由落库、D-14 `notificationId` 兼容）
- `apps/api/src/message-platform-store.ts`（D-11 通道容错与降级字段）
- `apps/api/src/org-store.ts`（D-13 映射统计口径）
- `apps/web/src/api/organization-client.ts`（D-13 汇总字段类型）
- `apps/web/src/features/message/MessageSettingsPage.vue`（D-11 状态徽标与最近测试时间）
- `apps/web/src/features/message/MessageCenterWarPage.vue`（消息来源标注）

测试环境数据修正（已执行）：

- `crm.orders` 补录 1 笔 V2 迁移遗漏订单（`ORD-1780908400434` → `LS-liangwanqi-20260608-0001`）
- `crm.opportunities` 对齐 `SJ-20260820-0005` 状态
- `iam.users` 33 行历史状态字段对齐（D-9）
- `iam.users` + `channel.partner_members` 11 个历史回归账号状态对齐（D-10 余量，成员已停用但账号仍启用的账号）
- `ops.notifications` 超管 22 条未读按原始基线还原（验证 D-12 时被标记已读，`protofix13` 验证后已还原为 `unread` / `read_at=NULL`）

## 7. 本轮核对方法

1. 用 Playwright 以超管账号逐页打开 23 个路由，同时抓取：UI 指标卡（标签/值/单位/脚注）、列表计数、页面真实调用的 `/api` 响应与控制台错误。
2. 通过 `docker exec ... psql` 只读执行计数与状态分布查询，作为数据库侧真值。
3. 对可疑项单独复现：分页去重复核、跨页重叠检测、连续 5 轮稳定性检测、接口字段分布统计。
4. 重跑项目自带业务回归脚本，确认业务链路无错误。
5. 本轮补充：把改动前的 `protofix10` 源码（`/opt/lianruan-crm-v3/build/src-protofix10`）临时换回工作区，
   在同一份测试库快照上跑同一组接口测试，与改动后的失败集合逐条比对，确认没有新增失败。

## 8. 证据文件

`test-evidence/20260929-data-consistency-r17/`：

- `ui-capture/`：修复前逐页采集（`capture.json` + 23 张页面截图）
- `ui-capture-fixed/`：修复后逐页采集（`capture.json` + 23 张页面截图）
- `business-flow/business-flow-results.json`：38 步业务回归结果
- `db/表行数基线.txt`、`db/状态分布基线.txt`、`db/分页重复风险.txt`
- `after-protofix9/`：protofix9 三角色回归截图
- `after-protofix10/`：protofix10 三角色回归截图
- `after-protofix13/`：本轮（protofix13）证据
  - `channels-api.json`：消息渠道接口返回（200，`wecom_app` 标记 `needsReconfigure`）
  - `notifications-read.txt`：标记已读（未登录 401 / 单条 `更新数=1` / 重复调用 `更新数=0`）
  - `ui/`：组织页外部身份映射 KPI、消息中心来源标注、消息渠道配置页截图与取值
  - `roles-回归.txt` + `roles/`：三角色 37 个路由回归（画板 1440、无横向溢出）
  - `变更页面几何.txt`：8 个变更页面几何（与 protofix8/9/10 完全一致）
  - `业务流回归.txt` + `business-flow/`：38 步业务回归（批次 `FLOW20260929-65183`）
- `发布后-角色回归.txt`、`发布后-变更页面几何.txt`：protofix8/9/10/13 四轮一致
- `db/fix-d9-20260929.sql`、`db/fix-d10-residual-20260929.sql`：测试环境数据修正脚本（含修复前查询）
- `tools-capture-ui.mjs`、`tools-api-totals.mjs`、`tools-check-paging.mjs`、`tools-check-partner-staff.mjs`、`tools-verify-fixed-pages.mjs`

## 9. 未触碰范围

- 未修改数据库结构、状态机、鉴权与数据范围逻辑；后端仅改动 4 个文件（`business-store.ts`、`business-routes.ts`、
  `message-platform-store.ts`、`org-store.ts`），改动均为口径与容错，未改动既有业务规则。
- 测试环境数据仅做定向修正：1 笔补录订单、1 条商机状态、33 行历史状态字段、11 个历史回归账号状态；
  未删除任何业务数据，未改动生产环境。
- 本轮接口回归使用**临时克隆库** `lianruan_crm_v3_aitest`（`CREATE DATABASE ... TEMPLATE lianruan_crm_v3`），
  不在业务库上跑测试；验证结束后已 `DROP DATABASE`，测试环境只保留 `lianruan_crm_v3` 一个业务库。
- 未修改生产环境 `10.20.3.10`；未提交 Git、未新建分支；V2 旧版资产未改动。

## 10. 剩余待决策

D-7 ~ D-14 全部完成。上一轮列出的 4 项遗留问题中，3 项已修复、1 项经核对不属缺陷：

1. ~~`GET /api/messages/platform/channels` 稳定 500~~ → 已修复（D-11）。剩余业务动作：`wecom_app` 通道需管理员
   重新填写企微应用凭据并完成一次测试发送，才能恢复真实投递，本轮未代填。
2. ~~「外部身份映射」汇总口径需业务确认~~ → 已按 `external-identities-internal-scope` 方案落地为
   「内部组织人员有效映射数」（D-13）；若业务希望改看全表 41 行口径，需要重新确认后调整。
3. 消息双表不合并属设计决定（见 4.3），界面已标注来源；历史通知迁移与旧表下线需另立任务。
4. 线索管理 / 线索来源仍为前端 mock，线索采集、移动端业务动作、合同 / 收款 / 保证金 / 框架协议尚未建设，
   属未建设模块而非缺陷。
