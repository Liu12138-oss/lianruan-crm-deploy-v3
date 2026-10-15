# R32：工作量配置页收口、订单内部收益核算补齐、返回按钮全站统一

- 日期：2026-10-12
- 环境：`http://10.9.86.66`（测试环境，唯一发布目标）
- 版本：`lianruan-crm-v3-nginx` = `3.0.0-stage10.20261008-protolign27`（新 UI 前端）
  - `api-1` / `api-2` = `3.0.0-stage10.20261008-protolign27`（与 protolign26 内容一致，本轮未改后端代码）
  - `worker` 保持 `3.0.0-stage10.20260923-regionpriceoa1` 未改动
- 生产环境 `10.20.3.10` 未连接、未修改
- 老 UI 未改动：`style.css` = `9726b64d…`、`admin.html` = `8d461d33…`、`admin-app.js` = `72860e54…`（与 R31 一致）
- 证据目录：`test-evidence/20261012-r32-workload-profit-return/`
- 回退点：`compose/.env.bak-before-r32-workload-profit`（回退到 protolign26）

## 1. 用户反馈与结论

| # | 反馈 | 结论 |
| --- | --- | --- |
| 1 | 产品工作量映射、工作量规则页下面有空白，且没有返回按钮 | 成立。页面沿用固定画板外壳，叠加 `.vui { min-height: 100% }` 与 grid 默认拉伸，把多余高度摊给页头与面板行，面板正文下方出现大片空白；同时页面没有页头与返回入口。已改为普通页壳 + 卡片页头 + 返回按钮，面板高度随内容收口。 |
| 2 | 区管和超管在订单审批时应能看到收益表，新 UI 没有 | 成立。老 UI `QuoteProfitPanel` 有完整实现，新 UI 前端没有对应代码。已新增收益接口客户端与内部收益核算面板，挂在订单处理页「审批与履约历史」下方，仅区管 / 超管可见，只读口径与老 UI 一致。 |
| 3 | 返回按钮要固定在同一位置、统一样式 | 成立。此前 6 个页面样式相同但各自复制、3 个新建页把返回放在右上按钮组、工作量配置页没有返回。已抽全局 `.返回按钮`，新建客户 / 报价 / 商机的返回移到页头卡片左上第一行，工作量配置页补齐返回。 |

## 2. 修复内容

### 2.1 工作量配置页（`apps/web/src/features/product/WorkloadConfigPage.vue`）

- 外壳由 `.vui.war-artboard.war-artboard-flow`（固定画板、KPI 绝对定位、内容区顶部 180px 内边距）改为普通页壳（`grid` + `gap: 18px`），与「模块价格规则」页同款结构。
- 新增页头卡片：返回「← 返回产品与套餐」+「产品与配置」标签 + 一级标题「工作量配置」+ 说明文案；右侧为配置生效提示。
- KPI 指标区从绝对定位回到文档流；面板高度改为随内容自适应（映射表 / 规则表各保留自身滚动区）。
- 覆盖 `.vui` 的 `min-height: 100%` 与默认 grid 拉伸：`min-height: 0` + `align-content: start`，多余高度不再摊给页头与面板行。
- 实测页头高度由 175.5px 回到自然高度 149.7px，根容器高度由 882px 收口到 805px，面板底边 890.7px，1366 / 1720 视口横向溢出均为 0。

### 2.2 订单内部收益核算（新增 `QuoteProfitPanel.vue` + `quote-profit-client.ts`）

- 新增 `apps/web/src/api/quote-profit-client.ts`，对接既有后端 `/api/quotes/:quoteId/profit-calculation`（后端未改动，服务端已按区管 / 超管授权）。
- 新增 `apps/web/src/features/quote/QuoteProfitPanel.vue`：内部收益核算面板，含状态标签、「仅内部参考 / 已冻结 / 不适用」只读提示、4 个金额卡（产品合同额、服务合同额、合同有效收入、项目收益）与 `incomplete` 缺项说明。
- 订单处理页（`OrderActionCenterPage.vue`）在「审批与履约历史」下方挂载该面板，仅 `管理端角色`（`superadmin` / `region_manager`）渲染；报价单标识按老 UI 口径取 `quoteId` → `quoteNo` → `报价编号`。
- 权限与老 UI 对齐：老 UI「超级管理员 / 区管 / 带区域的 admin」对应新 UI 的 `superadmin` / `region_manager`；渠道端（`partner`）不渲染收益面板，实测数量为 0。

### 2.3 返回按钮统一（全局样式 + 页面收口）

- 在 `apps/web/src/styles/visual-ui.css` 新增全局 `.返回按钮`：`display: block`、蓝色 `#2f69ed`、11px / 700、无边框透明底、`margin: 0 0 12px`，固定为页头卡片内第一行左侧。
- 删除 6 个页面 scoped 中重复的 `.返回按钮` 样式定义（订单处理、证书与风险、模块价格规则、渠道成员、渠道档案、客户跟进），改由全局样式统一提供。
- 新建客户 / 新建商机 / 新建报价三页：返回按钮从右上 `.button-row` 移到页头左侧第一行（客户、商机页右上仅保留提交按钮；报价页右上保留「返回商机 / 重新试算 / 生成报价单」），页头同步改为与其它页面一致的卡片（`padding: 22px 24px`、圆角 12、边框、渐变底）。
- 实测订单处理、渠道档案、渠道成员、客户跟进、工作量配置五页返回按钮坐标完全一致（x=73、y=109，距页头左 25、上 23），新建三页为画板内 x=56、y=107，样式属性逐项一致（11px / 700 / rgb(47,105,237)）。

## 3. 实测（测试环境真实数据）

| 场景 | 结果 |
| --- | --- |
| 工作量配置页返回按钮 | x=73、y=109，与订单处理页一致；`← 返回产品与套餐` |
| 工作量配置页面板留白 | 页面高度由 882px 收口到 805px，面板底边 890.7px，面板内无拉伸留白 |
| 工作量配置页窄屏 | 1366×768 横向溢出 0，返回按钮仍在 y=109 |
| 订单收益（超管） | 可见 4 个金额卡：产品合同额 ¥2,200.00 / 合同有效收入 ¥2,090.00 / 项目收益 ¥2,090.00 |
| 订单收益（区管 chenqinyu） | 可见 4 个金额卡：产品合同额 ¥420.00 / 合同有效收入 ¥399.00 / 项目收益 ¥399.00（即用户反馈订单） |
| 订单收益（渠道端 wangdawei） | 面板数量 0，不展示内部金额 |
| 新建客户 / 商机 / 报价返回 | 均位于页头卡片左上第一行，`← 返回客户列表 / 返回商机列表 / 返回报价列表` |
| 全路由巡检 | 62 条全部正常，异常 0；横向溢出 0；越界字号 44 页（顶栏头像 12px、顶栏图标 15px），与基线一致 |
| 单元测试 | 132 / 132 通过 |
| 类型检查 / 构建 | `vue-tsc --noEmit` 通过，`vite build` 通过 |

## 4. 变更文件

- `apps/web/src/features/product/WorkloadConfigPage.vue`
- `apps/web/src/features/quote/QuoteProfitPanel.vue`（新增）
- `apps/web/src/api/quote-profit-client.ts`（新增）
- `apps/web/src/api/business-client.ts`（导出通用请求函数供收益客户端复用）
- `apps/web/src/features/order/OrderActionCenterPage.vue`
- `apps/web/src/features/customer/CustomerCreatePage.vue`
- `apps/web/src/features/opportunity/OpportunityCreatePage.vue`
- `apps/web/src/features/quote/QuoteCreatePage.vue`
- `apps/web/src/styles/visual-ui.css`
- 返回按钮 scoped 样式删除：`OrderActionCenterPage.vue`、`CertificateRiskPage.vue`、`PricingRulesPage.vue`、`ChannelMembersPage.vue`、`ChannelProfilePage.vue`、`CustomerFollowupPage.vue`

## 5. 回归与回退

- 回归范围：管理端产品配置（工作量配置、产品目录、价格规则）、订单处理与审批（含渠道端订单处理）、订单来源报价收益读取、客户 / 商机 / 报价新建页页头。
- 未触及：老 UI 静态资源、后端代码、数据库、worker、生产环境。
- 回退方式：恢复 `compose/.env.bak-before-r32-workload-profit` 的 `V3_IMAGE_TAG=3.0.0-stage10.20261008-protolign26` 并重启 `nginx / api-1 / api-2`；protolign26 镜像与 dist 均在测试环境保留。

## 6. 遗留与后续建议

- 收益面板目前只在订单处理页以只读形态接入；报价单编辑页的收益编辑（保存草稿 / 重新计算 / 冻结）尚未在新 UI 接入，后端接口已就绪，可作为下一轮任务。
- `PricingRulesPage.vue` 与 `CertificateRiskPage.vue` 当前未被任何路由挂载（实际路由分别使用价格规则作战页与证书中心页），本轮只统一了它们的返回样式，未删除文件。
