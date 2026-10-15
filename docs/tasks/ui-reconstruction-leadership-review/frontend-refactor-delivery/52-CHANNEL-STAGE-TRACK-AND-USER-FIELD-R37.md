# R37：渠道合作环节进度轨道、页面后端字段中文化

- 日期：2026-10-13
- 环境：`http://10.9.86.66`（测试环境，唯一发布目标）
- 版本：`lianruan-crm-v3-nginx` = `3.0.0-stage10.20261013-protolign34`（新 UI 前端）
  - `api-1` / `api-2` = `3.0.0-stage10.20261008-protolign32`（本轮后端零改动，镜像同步打 protolign34 标签）
  - `worker` = `3.0.0-stage10.20260923-regionpriceoa1`（未改动，镜像同步打 protolign34 标签）
- 生产环境 `10.20.3.10` 未连接、未修改
- 老 UI 未改动（`apps/web/public/*` 本轮零改动）
- 证据目录：`test-evidence/20261013-r37-channel-stage-user-field/`
- 回退点：`compose/.env.bak-before-r37-protolign34`（回到 R36 的 protolign33）

## 1. 用户反馈与结论

| # | 反馈 | 结论 |
| --- | --- | --- |
| 1 | 渠道商的合作环节，能不能做成商机进度那种类似的样式 | 成立。R36 的六个环节是 3×2 六宫格卡片，与商机页横向「标准化商机作战流程」进度条（圆点 + 连线 + 已完成打勾 + 当前高亮）视觉不一致。 |
| 2 | 页面还在展示后端字段、参数，普通用户看不懂 | 成立。实测确认多处：渠道 KPI `partnerLevel = …`、订单/报价 KPI 状态码、定价 KPI `priceType = fixed` 与 `MOD-…` 模块编号、订单审批历史状态码、账号角色代码、操作审计详情的角色/模块/对象类型代码、变更字段英文键名与请求编号 `requestId`、历史审计标题里的 `approvedBy / level / partnerLevel / techServiceType` 等字段名。 |

## 2. 实现内容

### 2.1 渠道合作环节改为商机进度式横向轨道（`ChannelListPage.vue`）

- 六个环节由六宫格改为横向进度轨道（与商机页 `.step-dots` 同款视觉口径）：
  - 圆点 + 贯穿连线：已完成显示蓝色 ✓，未完成显示序号；
  - 当前节点：第一个未完成环节使用蓝色描边 + 光晕高亮（与商机进度一致）；
  - 节点下方依次为：环节名称、手动确认/自动更新标签、环节明细（如「2 条客户报备」「已成交 1 单」）、操作按钮（标记完成 / 撤销完成 / 恢复自动）。
- 保留 R36 全部业务口径：前三个环节手动确认，后三个按证书、报备、成交数据自动更新；六个环节全部完成 → 「已进入持续运营阶段」；手动结果落在渠道核心档案 `extra_json.cooperationSteps`。
- 原「渠道运营指标」（活跃度、客单价、原厂资质）面板不变。

### 2.2 页面后端字段中文化（面向普通用户的「用户视图」）

| 页面 | 修复内容 |
| --- | --- |
| 渠道商列表 | KPI 说明 `partnerLevel = lep / primary`、`partnerLevel = gold` 改为「核心渠道与一级渠道」「渠道等级为金牌」。 |
| 订单中心 | KPI 说明的五组状态码改为中文业务描述；审批历史不再回退展示状态码（`订单状态文本(项.to)`），并补充 `primary_rejected / rejected / revision_requested / replaced` 中文映射。 |
| 报价单 | KPI 说明 `draft / submitted / approved / converted` 改为中文业务描述。 |
| 产品定价 | KPI 说明 `priceType = fixed` 改为「按固定单价计价」；列表与详情中的 `MOD-…` 模块编号改为产品目录里的中文模块名（取不到时不展示编号）。 |
| 账号管理 | 角色代码（`superadmin / admin / staff / partner_admin / channel_sales …`）翻译为中文角色名；卡片与详情的所属渠道不再展示 `P-…` 渠道编号，改为渠道名称或「渠道账号」。 |
| 操作审计 | 详情弹窗：角色、模块、对象类型翻译为中文；隐藏 `requestId` 与 UUID/哈希形式的对象编号（业务编号如 `REG-…` 仍保留）；「变更前后」表用中文标签（含状态值中文化、时间字段转 `YYYY/MM/DD hh:mm`），未登记的内部技术字段自动隐藏并给出数量提示，未登记英文代码值统一显示「已设置」；「附加信息」改为白名单业务字段（仅中文或数值），不再直出 `query / params / body / resultMeta` 等 JSON；动作标题清洗历史数据里的英文字段名（审批人、渠道级别、技术服务类型、最近跟进时间等）与枚举值；弹窗高度放宽，长内容不再被裁切。 |
| 订单处理审批 | 未知状态兜底由原样输出改为「其他状态」，不再出现状态码。 |

实现位置：`ChannelListPage.vue`、`OrderCenterPage.vue`、`QuoteCenterPage.vue`、`PricingCenterPage.vue`、`AccountManagePage.vue`、`AuditLogPage.vue`、`OrderActionCenterPage.vue`、`shared/format/business-format.ts`。

## 3. 实测（测试环境真实数据，详见证据目录）

| 场景 | 结果 |
| --- | --- |
| 渠道环节轨道（云南奇通） | 6 节点横向轨道，第 1 节点蓝色高亮为当前节点，其余灰色序号 |
| 渠道环节轨道（江苏仟成易 2/6） | 商机报备、首单合作成功显示 ✓，徽标「推进中 2/6」 |
| 环节交互 | 「标记完成」→ ✓ + 撤销按钮；「撤销完成」→ 恢复序号，刷新后一致 |
| 渠道 KPI | `partnerLevel = …` 已消失，全部为中文说明 |
| 订单 / 报价 / 定价 KPI | 状态码与 `priceType` 已消失，全部为中文说明 |
| 定价列表 | 模块显示「桌面安全管理」「PAM」等中文名，无 `MOD-…` |
| 订单审批历史 | 管理端 6 条、渠道端 4 条全部中文状态；整页泄漏词扫描 `[]` |
| 账号管理 | 角色中文名；渠道账号不再显示 `P-…` 编号 |
| 审计详情 | 超级管理员 / 消息与提醒 / 消息渠道 / 数量；请求编号与 UUID 已移除 |
| 审计动作列 | 「审批人由「空」变更为「A030」」「渠道级别由「空」变更为「核心渠道」」 |
| 字段泄漏巡检 | 管理端与渠道端全路由无后端字段名与开发枚举（剩余命中仅产品编码、登录账号名等业务数据） |
| 全路由巡检 | 62 条路由全部正常，异常 0，横向溢出 0 |
| 自动化测试 | 前端 140/140（含新增 R37 用例 5 条）；后端 `business.test.ts` 24/24 |

## 4. 发布与回退

- 发布方式：`apps/web` 执行 `npm run build` → 上传 `dist-web-protolign34` → 基于 `Dockerfile.nginx-protolign34`（`FROM nginx:1.27-alpine` + `COPY . /usr/share/nginx/html`）构建 `lianruan-crm-v3-nginx:3.0.0-stage10.20261013-protolign34` → 切换 `compose/.env` 的 `V3_IMAGE_TAG` → `docker compose up -d --no-deps nginx`；api / worker / mcp 镜像同步打同名标签，保证 compose 口径一致。
- 回退：`cp compose/.env.bak-before-r37-protolign34 compose/.env && docker compose up -d --no-deps nginx`，即回到 R36 的 protolign33。

## 5. 口径说明与后续建议

- 审计详情的「用户视图」采用白名单字典：新增业务字段时在 `AuditLogPage.vue` 的 `变更字段中文映射 / 附加字段中文映射 / 状态值中文映射` 中登记即可；未登记字段会被自动隐藏，不会以英文键名直出。
- 历史审计标题里的英文词通过 `动作清洗()` 实时翻译，不改数据库历史数据；后续如统一回刷审计标题，可直接复用同一份映射表。
- 渠道环节的「当前节点」取第一个未完成环节；自动环节手动覆盖后仍可「恢复自动」，与 R36 口径一致。
- 本轮未改动老 UI 与后端接口；`apps/api/tests/v2-compat.test.ts` 中「区管正式区域迁移」用例失败属于既有测试库唯一索引问题，与本轮无关。
