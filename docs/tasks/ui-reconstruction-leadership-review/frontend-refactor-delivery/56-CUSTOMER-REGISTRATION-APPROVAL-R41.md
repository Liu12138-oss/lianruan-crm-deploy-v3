# R41：客户报备审核动作补齐与审批同步修复

- 日期：2026-10-14
- 环境：`http://10.9.86.66`（测试环境，唯一发布目标）
- 版本：`lianruan-crm-v3-nginx` / `lianruan-crm-v3-api` = `3.0.0-stage10.20261014-protolign38`
  - `api-1` / `api-2` 本轮由源码重建并切换（修复 `/api` 下两个报备接口的服务函数颠倒）
  - `worker` = `3.0.0-stage10.20260923-regionpriceoa1`（未改动，镜像同步打 protolign38 标签）
- 生产环境 `10.20.3.10` 未连接、未修改
- 老 UI 未改动（`apps/web/public/*` 本轮零改动）
- 证据目录：`test-evidence/20261014-r41-customer-registration-approval/`
- 回退点：`compose/.env.bak-before-r41-protolign38`（回到 R40 的 protolign37）

## 1. 用户反馈与结论

| # | 反馈 | 结论 |
| --- | --- | --- |
| 1 | 新 UI 用户提交客户报备，管理员无法审批 | 成立。审核中心「处理」跳到客户跟进页后，页面只有「编辑客户档案 / 保存跟进记录」，没有任何通过 / 驳回动作，审批流程断在落地页。 |
| 2 | （审查中发现）审批后审核中心仍显示待审批 | 成立。`PUT /api/registrations/:id/status` 在 `/api` 路由下被映射到「资料更新」服务函数，报备状态改了但不写 `ops.approvals`，审批记录滞留待审核。 |
| 3 | （审查中发现）保存客户档案会误改状态 | 成立。`PUT /api/registrations/:id` 被映射到「状态流转」服务函数，未带 status 时默认 approved，编辑档案会把待审核 / 已驳回记录静默改成已通过。 |

## 2. 实现内容

### 2.1 报备审核动作组件（`apps/web/src/features/customer/RegistrationReviewActions.vue` 新增）

- 待审核 + 内部管理员（超管 / 区管）：「✓ 通过报备」「✕ 驳回报备」；驳回必填原因，留空拦截。
- 已驳回 + 内部管理员：「↻ 重新提交」，状态回到待审核（对齐老 UI 审核页 `resubmitReg`）。
- 已通过：「🎯 报备商机」，携带 `registrationId` 跳转新建商机页。
- 渠道端不渲染审核按钮；服务端仍按角色二次校验。
- 弹窗沿用新 UI 动作弹窗规范（标题、业务编号、说明、原因输入、取消 / 确认）。

### 2.2 接入位置

- 客户跟进页 `CustomerFollowupPage.vue`：页头动作区（审核中心「处理」的落地页），大尺寸按钮，与「保护期至 / 编辑客户档案」同排。
- 客户管理页 `CustomerManagementPage.vue`：中栏动作区，标准尺寸按钮，与「编辑客户档案 / 记录客户跟进」同排。
- 审核成功后原位更新页面数据（状态、保护期、KPI 不刷新丢失选中）。

### 2.3 报备商机预选（`OpportunityCreatePage.vue`）

- 读取 `registrationId` 查询参数，在已通过报备下拉中自动预选对应客户，承接「报备商机」入口。

### 2.4 后端路由映射修复（`apps/api/src/business-routes.ts`）

- `PUT /api/registrations/:id/status` → `更新报备状态`：状态流转并同步 `ops.approvals` 审批记录，与 `/api/v2` 兼容路由口径一致。
- `PUT /api/registrations/:id` → `更新报备`：资料维护，未显式传状态时保持当前状态不变。

## 3. 实测（测试环境真实数据，详见证据目录）

| 场景 | 结果 |
| --- | --- |
| 审核中心 → 客户报备「处理」 | 落点客户跟进页，出现「✓ 通过报备」「✕ 驳回报备」 |
| 通过报备 | 提示「客户报备已通过，保护期开始生效。」，保护期至 2027-04-12，记录离开待审批 |
| 驳回报备 | 空原因被拦截；填写原因后提示「客户报备已驳回。」，出现「↻ 重新提交」 |
| 重新提交 | 提示「客户报备已重新提交，等待审核。」，回到待审核状态 |
| 客户管理列表 | 待审核客户出现「✓ 通过报备」「✕ 驳回报备」，与既有按钮同排对齐 |
| 客户档案保存 | 状态保持待审核（修复前会被改成已通过） |
| 审核中心同步 | 通过后待审批行数 87 → 86，该记录出现在「已审批」；`ops.approvals` 直连核对 `pending → approved → pending` |
| 渠道端 | 待审核跟进页无任何审核按钮；已通过页「报备商机」跳转 `/partner/opportunity/new?registrationId=...` 且下拉预选命中 |
| 管理端报备商机 | 已通过页「报备商机」跳转 `/admin/opportunity/new?registrationId=...`，下拉预选命中「联软湘潭分公司」 |
| 全路由巡检 | 62 条路由全部正常，异常 0，横向溢出 0（与 R40 基线噪声一致） |
| 自动化测试 | 前端 159/159（含新增 5 条）；后端 180 通过 + 新增 1 条，仅 1 条既有无关失败 |

## 4. 发布与回退

- 前端发布：`apps/web` 执行 `npm run build` → 上传 `dist-web-protolign38` → 基于 `Dockerfile.nginx-protolign38` 构建 `lianruan-crm-v3-nginx:3.0.0-stage10.20261014-protolign38` → 切换 `compose/.env` 的 `V3_IMAGE_TAG` → `docker compose up -d --no-deps nginx`。
- 后端发布：上传源码包到 `/opt/lianruan-crm-v3/build/src-r41` → 远端 `docker build -f deploy/single-server/docker/api.Dockerfile` 构建 `lianruan-crm-v3-api:3.0.0-stage10.20261014-protolign38` → `docker compose up -d --no-deps api-1 api-2` → 两实例健康检查通过。
- 回退：`cd /opt/lianruan-crm-v3/compose && cp .env.bak-before-r41-protolign38 .env && docker compose up -d --no-deps nginx api-1 api-2`，即回到 R40 的 protolign37（前端与后端同时回退）。

## 5. 口径说明

- 审核权与老 UI 一致：只有内部管理员（超管 / 区管）能通过、驳回与重新提交；渠道端只保留「报备商机」。
- 驳回必须填写原因，原因写入审批记录（`reviewRemark`）与 `ops.approval_events`。
- 通过后由服务端计算保护期（默认 180 天）并回填 `expireAt`，页面保护期展示取自服务端返回。
- 状态流转接口只改状态与审批记录，资料维护接口只改资料，两者职责分离，禁止再交叉。
