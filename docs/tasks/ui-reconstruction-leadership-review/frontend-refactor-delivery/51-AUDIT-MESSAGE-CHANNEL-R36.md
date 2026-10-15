# R36：审计分类筛选、消息中心返回与中文化、渠道六环节与运营指标

- 日期：2026-10-13
- 环境：`http://10.9.86.66`（测试环境，唯一发布目标）
- 版本：`lianruan-crm-v3-nginx` = `3.0.0-stage10.20261008-protolign33`（新 UI 前端）
  - `api-1` / `api-2` = `3.0.0-stage10.20261008-protolign32`（新增审计分类查询参数）
  - `worker` 保持 `3.0.0-stage10.20260923-regionpriceoa1` 运行（未改动，镜像同步打 protolign32 / protolign33 标签）
- 生产环境 `10.20.3.10` 未连接、未修改
- 老 UI 未改动（`apps/web/public/*` 本轮零改动）
- 证据目录：`test-evidence/20261013-r36-audit-message-channel/`
- 回退点：`compose/.env.bak-before-r36-audit-channel`（回到 protolign31 = R35）、`compose/.env.bak-before-r36-protolign33`

## 1. 用户反馈与结论

| # | 反馈 | 结论 |
| --- | --- | --- |
| 1 | 操作审计希望分「客户操作、线索操作、商机操作、渠道操作、订单操作、后台管理操作」，支持分类查看看 | 成立。审计列表此前只有关键词搜索，服务端也不支持按模块分类过滤，2276 条记录无法按业务域收口。 |
| 2 | 消息渠道配置、规则分类没有返回消息列表的按钮；页面不应出现 `pending`、`pending_primary_confirm` 这类开发字段 | 成立。两个配置页没有任何返回入口；「消息模板」的事件列直接渲染 `iam.account.approval.pending` 等 eventCode，任务模板说明渲染 `event / todo` 等代码。 |
| 3 | 渠道建档、资质审核的四个阶段要改成六个环节（不区分阶段、可手动更新、能自动更新的自动更新），六个环节完成归纳为持续运营阶段，并增加活跃度、业务能力、原厂资质三项指标 | 成立。渠道商页顶部此前是写死的「渠道建档 → 资质审核 → 合作中 → 续签评估」四段进度条，与真实合作推进状态无关；三项运营指标缺失。 |

## 2. 实现内容

### 2.1 操作审计分类（前端 `AuditLogPage.vue` + 后端查询参数）

- 服务端：`阶段9查询参数` 新增 `module`，`/api/stage9/:module` 读取 `module` 查询参数并对 `audit` 模块追加分类条件；分类口径集中在 `审计分类模块代码`：
  - 客户操作：`registration / customer / customer_followup` 等；
  - 线索操作：`lead / lead_source / lead_pool` 等（当前 0 条，见空态说明）；
  - 商机操作：`opportunity / opportunities / quote / quote_profit`；
  - 渠道操作：`partner / channel_member / partner_profile` 等；
  - 订单操作：`order / orders / order_preapproval`；
  - 后台管理操作：反向收口其余全部模块（含未识别模块），保证新增模块不会漏出分类。
- 前端：审计面板新增分类标签条（含各分类记录数），切换分类重置页码并按 `module` 查询；「线索操作」空态给出业务解释，不再显示空白表。
- 兼容：同一查询同时支持单复数历史编码（`opportunity`/`opportunities`、`order`/`orders` 等），默认「全部」口径不变。

### 2.2 消息中心返回按钮与中文化（`MessageSettingsPage.vue`）

- 消息渠道配置、规则分类两个页面统一在中间栏第一行左侧增加「← 返回消息列表」胶囊按钮（复用全站 `.返回按钮` 样式），点击回到 `/admin/notifications`。
- 事件代码中文化：新增 `事件中文名()`，优先用规则/任务模板里的中文名称（如 `crm.order.approval.pending → 订单待审批`），并保留兜底映射；消息模板「事件」列、规则列表标签全部改为中文。
- 状态/分类代码中文化：任务模板说明改为「事件提醒 · 待办」等中文，`reminderCode`、`categoryCode`、`channelCode` 不再以英文形式出现在页面上。

### 2.3 渠道六环节与运营指标（`ChannelListPage.vue`）

- 移除写死的四段阶段条，新增「合作环节」面板：
  - 手动确认：初次拜访、统一培训、客户开放（协同拜访）；
  - 自动更新：技术认证情况（渠道成员有效证书）、商机报备情况（客户报备记录）、首单合作成功（成交订单）；
  - 手动结果写入渠道核心档案 `extra_json.cooperationSteps`；自动环节可手动覆盖并「恢复自动」；手动环节撤销时不留 false 留痕。
  - 六环节全部完成 → 徽标显示「已进入持续运营阶段」（绿色）；否则显示「推进中 x/6」。
- 新增「渠道运营指标」面板：
  - 活跃度（当年）：当年成交订单数 × 1%，封顶 100%，并展示去年同口径对比；
  - 业务能力（当年）：客单价 = 当年成交金额 ÷ 当年成交单数；
  - 原厂资质（当前）：渠道成员有效证书数量 + 等级分（模板名称含初级/中级/高级（专家）折算 1/2/3 分），并区分售前 / 售后 / 其他。
- 成交口径：`completed / confirmed / primary_confirmed`（不含退回、取消、待审批）；页面固定展示口径说明。

## 3. 实测（测试环境真实数据，详见证据目录）

| 场景 | 结果 |
| --- | --- |
| 审计分类计数 | 全部 / 客户操作 57 / 线索操作 0 / 商机操作 73 / 渠道操作 98 / 订单操作 60 / 后台管理操作 2012 |
| 点击客户操作 | 列表全部为客户报备审计（创建/状态变更），分类过滤生效 |
| 点击线索操作 | 显示「线索模块暂未产生审计记录」空态说明 |
| 消息两页返回 | 「← 返回消息列表」位于中间栏第一行左侧，点击回到 `/admin/notifications` |
| 规则页英文 | 除 Logo 的 Channel Management 外无英文代码；消息模板事件列显示中文 |
| 六环节自动更新 | 江苏仟成易：商机报备=已完成（2 条）、首单合作成功=已完成（1 单）、技术认证=未完成（0 证书） |
| 手动更新 | 标记「初次拜访」→ 提示已更新，徽标 2/6 → 3/6；撤销后恢复未完成且无残留数据 |
| 持续运营阶段 | 六环节全完成 → 「已进入持续运营阶段」（绿色）；撤销后回到「推进中 2/6」 |
| 运营指标 | 江苏仟成易：活跃度 1%（去年 0%）、客单价 ¥2,200、原厂资质 0 张 / 等级分 0 |
| 核心档案兼容 | 环节写入 `cooperationSteps` 后核心档案页正常打开，字段齐全 |
| 渠道端回归 | `liulongfei` 登录落 `/partner`，工作台数据正常 |
| 全路由巡检 | 62 条路由全部正常，异常 0，横向溢出 0 |
| 自动化测试 | 前端 135/135；后端 `business.test.ts` 24/24（含新增审计分类用例） |

## 4. 发布与回退

- 发布方式：
  1. `npm --workspace @lianruan/api run build` → 打包 `apps/api/dist` 上传 `/opt/lianruan-crm-v3/build/dist-api-protolign32` → 基于 `protolign29` 叠加构建 `lianruan-crm-v3-api:3.0.0-stage10.20261008-protolign32`；
  2. `apps/web` 执行 `vite build` → 上传 `dist-protolign32` / `dist-protolign33` → 构建 nginx 镜像；
  3. 切换 `compose/.env` 的 `V3_IMAGE_TAG` → `docker compose up -d --no-deps api-1 api-2 nginx`。
- 回退：`cp compose/.env.bak-before-r36-audit-channel compose/.env && docker compose up -d --no-deps api-1 api-2 nginx`，即回到 protolign31（R35，审计分类与渠道环节将不可用）。

## 5. 口径说明与后续建议

- 审计「前台管理操作」采用反向归口：会话新增模块默认进入后台管理分类，需要单独成类时再在 `审计分类模块代码` 中登记即可。
- 线索操作暂无可归集数据：外采线索为只读数据，接入写入链路后会自动出现在该分类。
- 活跃度、业务能力按「成交订单」统计，原厂资质按「有效证书」统计；如后续需要按自然月/季度活跃度或按证书等级加权，只需调整 `ChannelListPage.vue` 中的口径函数。
- 本轮未改动老 UI、报价、订单等既有业务逻辑；`apps/api/tests/v2-compat.test.ts` 中「区管正式区域迁移」用例失败属于既有环境问题（测试库存在一条不在仓库迁移脚本里的唯一索引 `uq_regions_active_region_name`），与本轮改动无关，建议单独跟进。
