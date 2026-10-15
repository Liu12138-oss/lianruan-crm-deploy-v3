# R42：订单预审链路与生产数据导入前修复

- 日期：2026-10-14
- 范围：新 UI 重构（V3 `apps/*`）的后端、任务进程、导入脚本与数据库迁移；老 UI（`apps/web/public/*`）零改动
- 测试环境：`http://10.9.86.66` 已于 2026-10-15 发布 `protolign42`（api-1 / api-2 / worker 已切换，nginx 未重建）
- 生产环境：`10.20.3.10` 未连接、未修改
- 触发背景：用户要求把「渠道报备客户 → 报价 → 订单审批 → OA 自动拉群」全链路的现存问题从代码层面修复，随后将导入生产数据
- 证据目录：`test-evidence/20261014-r42-preapproval-chain/`

## 1. 问题清单与排查结论（测试环境只读核对）

| #   | 问题                      | 结论                                                                                                                                                                                                                                                                                              |
| --- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | 订单预审进程未启用        | 成立，属配置层。测试环境 `config/v3.env` 中 `ORDER_PREAPPROVAL_WORKER_ENABLED=false`，容器 `lianruan-crm-v3-worker-order-preapproval` 已 Exited 约 3 周；`ops.outbox_events` 中 `crm.order.preapproval.requested` 堆积 26 条 pending（另有 4 条 sent），最早可追溯到 9 月下旬。代码链路本身完整。 |
| P2  | 预审报价单 PDF 目录不可写 | 成立，属代码 + 部署。容器以 `node(1000:1000)` 运行，持久化目录 `data/uploads/order-preapproval` 历史上由 root 解压生成（750），写入会 `EACCES`；库中 9-09 留有 `ORDER_PREAPPROVAL_UNEXPECTED_ERROR` 失败记录。修复前该失败要等真实外呼后才暴露。                                                  |
| P3  | 存量预审事件有回放风险    | 成立。导入生产库会带回历史 `crm.order.preapproval.requested` 事件；其中 25 条订单已流转会被状态校验拦下，仅 `leagsoft-smb-chenqinyu-0731-03`（湖南区 / ¥23,300）仍满足条件，若直接启动预审进程会真实投递 OA。                                                                                     |
| P4  | 消息通知链路关闭          | 成立，属配置层。`MESSAGE_WORKER_ENABLED=false`，3 个 message 容器均为 Exited，`ops.outbox_events` 共 547 条 pending；直接启动同样会回放历史通知。                                                                                                                                                 |
| P5  | 报备审批幽灵记录          | 成立。`ops.approvals` 中「审批 pending 但报备已终态」共 42 条（27 条报备已通过 + 15 条报备已驳回），为 R41 之前状态流转未同步审批记录所致，审核中心会持续显示幽灵待办。                                                                                                                           |
| P6  | 企微成员映射缺口          | 成立，属数据问题。区管 `admin_west`、`fangmiaoqin`、`linhaowen` 均为 `region_manager`（active），但 `iam.external_identities` 无有效 `wecom` 映射；他们负责的区域订单建群会报 `WECOM_MEMBER_MAPPING_INVALID`。需管理员/运维补映射，代码无法自愈。                                                 |
| P7  | 审计覆盖缺口              | 成立。报备审批、订单创建、订单确认/退回/调价均未写 `audit.audit_logs`（此前订单操作审计只有「退回重提」19 条）。                                                                                                                                                                                  |

## 2. 代码实现内容

### 2.1 审计补齐（`apps/api/src/business-store.ts`）

- `更新报备状态`：状态实际变化时写审计（模块 `registration`、动作 `change_status`），说明含「由「待审核」变更为「已通过」」等中文口径，`registration_no` 一并进入 `SELECT` / `RETURNING`。
- `创建订单`：新增审计，动作 `create_from_quote`，记录订单编号与报价来源。
- `更新订单状态`：新增审计（模块 `orders`），动作由新增辅助函数 `订单流转审计动作` 统一映射：调价 → `price_adjust`，一级确认 → `primary_confirm`，区管确认 → `region_confirm`，超管确认 → `superadmin_confirm`，完成 → `complete`，取消 → `cancel`，驳回 → `reject`，退回 → `return`，其余 → `status_change`。

### 2.2 预审附件目录自检（`apps/worker/src/order-preapproval-store.ts`、`order-preapproval-worker.ts`）

- 新增公开方法 `校验文件目录()`：确认报价单目录存在且当前进程可写，返回 `{ 可写, 目录, 错误 }`。
- 报价单落盘统一走新增的 `写入订单预审文件`：`EACCES/EPERM/EROFS` 抛 `ORDER_PREAPPROVAL_FILE_DIR_UNWRITABLE`（`retryable: true`），其余抛 `ORDER_PREAPPROVAL_FILE_WRITE_FAILED`。
- 预审进程启动时先自检目录：不可写则关闭连接池、记录 `order_preapproval.worker.file_dir_unwritable` 日志并**拒绝启动**，避免发出无效外呼。

### 2.3 生产数据导入健壮性（`apps/api/src/v2-compat-routes.ts`）

- `确保区域`：导入落区域时，若同名活跃区域已存在但编号不同（历史数据或人工维护），复用既有区域而不是触发 `uq_regions_active_region_name` 唯一约束导致整行导入失败。

### 2.4 导入脚本（`deploy/single-server/scripts/导入生产V3数据到测试.sh`）

- 停止与检查列表补入 `worker-order-preapproval`（独立 profile），导入期间不允许预审进程在跑。
- 恢复附件后 `mkdir -p data/uploads/order-preapproval`；root 执行时 `chown -R 1000:1000 data/uploads`，非 root 输出告警。
- 新增 `更新事件截止时间()`：导入前把 `ORDER_PREAPPROVAL_EVENT_CUTOVER_AT`、`MESSAGE_EVENT_CUTOVER_AT`、`QUOTE_PROFIT_EVENT_CUTOVER_AT` 推进到当前时刻（写前备份 `v3.env.bak-before-import-${timestamp}`），防止任务进程回放导入的历史事件；末尾提示预审进程的启用前置条件。
- `install.sh`：新增安装时创建 `data/uploads/order-preapproval`，root 执行安装时把 `data/uploads` 属主调整为 `1000:1000`，保证全新安装可直接启用预审进程。

### 2.5 数据迁移（`database/migrations/20261015_S10_027_报备审批记录同步修复.sql`）

- 回填「审批 pending 且报备已终态」的 42 条记录为报备真实状态，并向 `ops.approval_events` 补一条 approve/reject 事件，带 `reconcileReason` 修复标记；仅处理终态记录、可重复执行。
- 同名 `.rollback.sql` 为说明型：回退会重造幽灵待办，不提供回退语句。
- 编号说明：测试环境已存在 `20260923_S10_025_区域重复归并与唯一约束` 与 `20260923_S10_026_区管调价收益口径与历史单修复`（前者此前只存在于主仓库、后者此前只存在于测试服务器，本轮已一并补回本工作区），因此本迁移使用 `S10_027`，避免编号冲突。

### 2.6 测试补充

- `apps/api/tests/business.test.ts`：建单审计 `create_from_quote`、区管确认 `region_confirm`、超管确认 `superadmin_confirm`。
- `apps/api/tests/r41-registration-review-routes.test.ts`：报备通过后断言 `registration/change_status` 审计与中文说明。
- `apps/api/tests/r42-registration-approval-reconcile.test.ts`（新增）：S10-027 迁移静态断言 3 条（筛选条件、审批事件与修复标记、回退说明型）。
- `apps/worker/tests/order-preapproval-integration.test.ts`：新增目录自检与启动拒绝 2 条。

## 3. 验证结果

| 项目                                                                     | 结果                                                                                                                 |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `@lianruan/api check` / `@lianruan/worker check` / `@lianruan/web check` | 全部通过                                                                                                             |
| 后端测试（`apps/api`）                                                   | 182 通过 / 3 跳过；Excel 导入用例由本轮修复转绿；剩余 2 条为既有环境/时序问题（见下）                                |
| 任务进程测试（`apps/worker`）                                            | 61 通过 / 10 跳过 / 0 失败                                                                                           |
| 前端测试（`apps/web`）                                                   | 159/159 通过                                                                                                         |
| 导入脚本                                                                 | `bash -n` 语法检查通过                                                                                               |
| 新增预审目录自检                                                         | 可写目录通过、指向普通文件判定不可写、不可写时拒绝启动，3 条断言通过                                                 |
| 测试环境发布（2026-10-15）                                               | api-1 / api-2（healthy）、worker（运行中）、nginx 200；S10-027 迁移已登记；幽灵审批 42 → 0；导入脚本干跑保护校验通过 |

既有失败说明（均非本轮引入，R36/R41 基线一致）：

- `v2-compat`「区管正式区域迁移」：唯一索引 `uq_regions_active_region_name` 来自 `20260923_S10_025_区域重复归并与唯一约束`（本轮已补回本工作区）；该用例需要构造两个同名活跃区域，无法在真实约束下成立，属用例与真实约束不适配，R36 起即为既有问题。
- `org-rbac-integration`「同名账号可定位」：默认 5 秒超时临界用例，R36 实测 4838ms，本轮偶发超时，属时序噪声。

## 4. 发布与回退（已于 2026-10-15 发布测试环境）

- 发布方式：源码包上传 `/opt/lianruan-crm-v3/build/src-r42` → 服务器内构建 `lianruan-crm-v3-api:3.0.0-stage10.20261015-protolign42` 与 `lianruan-crm-v3-worker:3.0.0-stage10.20261015-protolign42` → 未变的 nginx 镜像同步打新标签 → `compose/.env` 的 `V3_IMAGE_TAG` 切到 `protolign42` → `docker compose up -d --no-deps api-1 api-2 worker`。
- 迁移：`20261015_S10_027_报备审批记录同步修复` 已于 13:51 执行（回填 42 条审批记录 + 42 条审批事件）。
- 健康检查：api-1 / api-2（healthy）、worker（运行中）、nginx（200）全部通过；镜像内已核验包含本轮新代码。
- 预审进程保持关闭；导入核对完成后，再按运维文档以 `--profile order-preapproval` 启动。
- 回退：`cd /opt/lianruan-crm-v3/compose && cp .env.bak-before-r42-protolign42 .env && docker compose up -d --no-deps api-1 api-2 worker` 即回到 protolign38；S10-027 迁移为一次性数据修复，不提供回退语句（回退会重造幽灵待办）；导入脚本对 `v3.env` 的修改留有 `v3.env.bak-before-import-${timestamp}` 备份。
- 生产数据同步操作手册：`docs/operations/生产V3数据同步到测试环境操作手册.md`（生产只读导出 → 测试覆盖导入的完整步骤）。

## 5. 后续建议

- 请管理员补录 3 名区管的企微 UserId 映射（P6），否则对应区域订单无法自动建群。
- 索引 `uq_regions_active_region_name` 来自 `20260923_S10_025_区域重复归并与唯一约束`（本轮已把 S10-025 / S10-026 补回本工作区，主仓库与测试环境一致），无需再单独治理。
- 两条既有测试噪声建议单独修复：为 `org-rbac` 超时用例显式提高超时；按真实约束调整区域迁移用例的构造方式。
- `apps/api/src/business-store.ts` 存在 2 条既有 lint error（`计算产品定价明细` 中未使用变量，R28 遗留），与本轮改动无关，建议后续清理。
