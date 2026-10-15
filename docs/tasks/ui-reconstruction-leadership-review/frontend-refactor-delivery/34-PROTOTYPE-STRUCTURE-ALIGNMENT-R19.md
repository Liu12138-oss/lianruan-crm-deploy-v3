# R19：新 UI 与目标视觉模型结构对齐（商机 / 报价 / 客户）

- 日期：2026-10-08
- 验收环境：`http://10.9.86.66`（测试环境，唯一发布目标）
- 代码位置：`/Users/liu/.aicodex/worktrees/6e0a/lianruan-crm-deploy-v3`
- 目标视觉模型：`docs/tasks/ui-reconstruction-leadership-review/ui-demo/index.html`（交互原型，`window.demoGo("opportunities")` 等屏）
- 本轮范围：按用户 5 条反馈逐条修复结构、入口与业务缺口，并补齐报价编辑的落库链路

## 1. 用户反馈与处理结果

| 编号 | 用户反馈 | 根因 | 处理结果 |
| --- | --- | --- | --- |
| 1 | 整体框架大小/格式/结构不对 | 页面资产为固定 1440×740 画板，几何正常；问题在画板内部：中心区多出「口径说明」独立行、报价卡与信息行偏高 | 中心区内容高度 804 → 635；三栏 304/792/342、KPI 96、三栏顶 180 与原型完全一致 |
| 2 | 商机阶段进度重复 | `OpportunityCenterPage.vue` 中心区左侧另有一个自带「阶段进度」面板，与顶部 `stage-band` 重复 | 删除重复面板，仅保留顶部标准化商机作战流程（7 步） |
| 3 | 新建商机、新建客户入口没有 | 顶栏只有消息与用户区，没有模块主操作 | `AdminLayout.vue` 增加模块主操作按钮：报备页「＋新建客户」、商机页「＋新建商机」、报价页「＋新建报价」，新建/编辑子页自动隐藏 |
| 4 | 模块内返回不见；商机报价单不见、报价单编辑没有、返回也没有 | 商机详情无关联报价面板；报价编辑页不加载数据、保存走的是「只改状态」的接口 | 商机详情新增「关联报价单」面板（卡片＋新建报价＋查看报价）；报价编辑真实回填并可保存；各子页返回入口复核齐全 |
| 5 | 差的内容很多 | 报价明细字段中英文键名不一致导致表格显示「未命名模块 / —」；试算预览接口未套用渠道定价导致预览价为 0 | 明细键名兼容（中文/英文双键）；后端试算补齐「区域覆盖价 → 渠道等级价 → 阶梯价 → 固定价」定价链路 |

## 2. 修改清单

### 2.1 前端（apps/web）

| 文件 | 改动 |
| --- | --- |
| `src/components/war/WarLayout.vue` | 流程区改为原型 `stage-band` 结构（step-head / step-dots / step-item）；新增 `center-head` 插槽与 `流程标题`、`流程说明` 属性 |
| `src/features/opportunity/OpportunityCenterPage.vue` | 删除重复阶段面板；并行加载商机/报价/订单；新增关联报价面板、订单表格、健康度、下一步建议；页签（概览/跟进/报价/订单/档案与审计）；排版对齐原型（口径说明移入档案页签、报价卡紧凑化仅展示最近 2 份、商机信息 6 项 3 行） |
| `src/features/customer/CustomerManagementPage.vue` | 删除与原型不符的竖向「客户全生命周期」重复面板；中心头部移入 `center-head` 插槽；流程卡标题与阶段按状态推导 |
| `src/features/quote/QuoteCenterPage.vue` | 支持 `?quoteId=` 定位选中报价；新增「修改报价」入口（已转订单禁用）；流程卡按状态映射；明细键名兼容 |
| `src/features/quote/QuoteCreatePage.vue` | 编辑模式真实回填（关联商机/端点/产品/已保存明细）；保存改走 `PUT /api/quotes/:id`；新建支持 `?opportunityId=` 预选商机；明细键名兼容 |
| `src/features/order/OrderCenterPage.vue`、`src/features/order/OrderActionCenterPage.vue` | 明细表字段兼容中文键（名称/数量/单价/小计） |
| `src/api/business-client.ts` | 新增 `更新报价`（`PUT /api/quotes/:id`） |
| `src/shared/format/business-format.ts` | 新增 `取数()`：中英文键与数字类型的统一取值助手 |
| `src/layouts/AdminLayout.vue`、`src/styles/theme.css` | 模块主操作按钮（＋新建商机/客户/报价）与样式 |

### 2.2 后端（apps/api）

| 文件 | 改动 |
| --- | --- |
| `src/business-store.ts` | ① `试算报价` 复用 `查询修订产品单价`，按「区域覆盖价 → 渠道等级价 → 阶梯价 → 固定价」解析单价，并新增 `解析试算定价上下文`（由商机推导渠道等级与区域），使预览与创建/更新报价落库口径一致；② `更新报价` 增加终态守卫（已转订单/已取消/已过期禁止改内容，409）并同步落库 `endpoints / productIds / workloadSummary`；③ `查询修订产品单价` 的客户端参数放宽为 `Pick<PoolClient, "query">` 以支持连接池直调 |

> 说明：`创建报价` 原本就有「渠道存在时二次应用渠道定价」的逻辑，因此老报价价格正确；缺口只在**试算预览**，本次已对齐。

## 3. 目标视觉模型对比（1440 视口，单位 px）

| 项目 | 目标原型 | R19 收口后线上 |
| --- | --- | --- |
| 画板 | 1440 × 742 | 1440 × 742 |
| 三栏宽 | 304 / 792 / 342 | 304 / 792 / 342 |
| KPI 高度 / 顶部 | 96 / 73 | 96 / 73 |
| 三栏区顶部 / 高度 | 180 / 560 | 180 / 560 |
| 中心：对象头 | 67 | 67 |
| 中心：流程条 | 114 | 117 |
| 中心：页签行 | 37 | 35 |
| 中心：报价条 | 139（卡片 71） | 163（卡片 74） |
| 中心：底部双卡网格 | 182（信息卡 153） | 229（信息卡 200） |
| 中心内容总高 | 569 | 635 |

残差说明：约 75px 来自 R18 已确认的 11px 统一字号（原型正文 8–10px）与测试数据（4 份关联报价、更长的建议文案）。`VISUAL-RULES.md` 明确三栏为「列内滚动」，整页不随内容撑高，当前表现符合该设计。

证据：`test-evidence/20261008-prototype-structure-r19/layout-metrics.json`

## 4. 线上验证（测试环境实测）

### 4.1 报价试算与定价

| 场景 | 结果 |
| --- | --- |
| 30 端点（商机 SJ-20260929-0005，湖南区，一级渠道） | 单价 ¥14 × 30 = ¥420，与库内已存报价一致 |
| 120 端点 | 单价 ¥11 × 120 = ¥1,320 |
| 200 端点 | 单价 ¥9 × 200 = ¥1,800 |
| 150 端点 | 单价 ¥11 × 150 = ¥1,650 |

### 4.2 报价新建与编辑（真实 UI 操作）

1. 商机页 →「报价」页签 →「＋新建报价」→ 自动带 `?opportunityId=` 预选商机；
2. 勾选「屏幕水印与控制模块」→ 试算 ¥1,320 →「生成报价单」→ 生成草稿 `BJ-liulonghai-20261008-0001`（120 端点 / ¥1,320）；
3. 编辑页复开显示 ¥1,320 → 端点改 200 → ¥1,800 → 保存 → 库内 `金额=1800、items=200@9、endpoints=200`；
4. 二次编辑 200→150→保存 → ¥1,650；改回 200 → ¥1,800（往返一致）；
5. 已转订单报价 `BJ-liulongfei-20260929-0015` 直链保存 → 409：「该报价已转订单或已终止，不能修改内容；如需调整请退回订单后走修订流程。」

### 4.3 空态

无关联报价的商机显示：「该商机还没有关联报价单，可点击「＋新建报价」创建。」（面板标题同步为「共 0 份」）

### 4.4 全路由复验（部署后）

| 范围 | 路由数 | 结果 |
| --- | --- | --- |
| 管理端 + 详情页 | 32 | 全部正常，0 控制台错误，0 接口错误，0 横向溢出 |
| 渠道端 | 9 | 同上 |
| 移动端 | 14 | 同上（`/mobile/admin/registrations|opportunities|quotes|products` 4 条为不存在的路径，属探针多余项） |
| 公开页 | 3 | `/api/auth/me` 401 属未登录预期 |
| 合计 | 62 | 异常 0 |

排版口径：只有已知 3 类装饰性元素越界（顶栏图标 15px、顶栏头像 12px、渠道首字母 18px），0 字重越界。

## 5. 测试环境部署记录（2026-10-08）

| 项 | 值 |
| --- | --- |
| 发布目标 | `http://10.9.86.66` |
| 镜像标签 | `lianruan-crm-v3-nginx:3.0.0-stage10.20261008-protolign2`、`lianruan-crm-v3-api:3.0.0-stage10.20261008-protolign2`（worker/mcp 同标签打标，容器未重建） |
| 前端产物 | 本地 `apps/web/dist` → `/opt/lianruan-crm-v3/build/dist-protolign2`，镜像内 `assets` SHA-256 与本地一致 |
| 后端产物 | 本地 `apps/api/dist` → `/opt/lianruan-crm-v3/build/api-dist-protolign2`，基于 `protofix13` 镜像逐文件替换 `apps/api/dist` 后 `docker commit` |
| 重建范围 | `nginx`、`api-1`、`api-2`；worker / mcp / postgres / redis 未重启 |
| `.env` 备份 | `/opt/lianruan-crm-v3/compose/.env.bak-before-protolign1`（回退点：typor18 + protofix13） |
| 回退方式 | `cd /opt/lianruan-crm-v3/compose && cp .env.bak-before-protolign1 .env && docker compose up -d --no-deps nginx api-1 api-2` |
| 产物校验 | `assets/index-DPY6teN8.js`、`assets/index-lSaSsFnd.css`（md5 `9fe2913b2bb8203941e1c254eec00a00`），线上与本地逐一比对一致 |
| 单测 | `apps/web` 22 文件 / 130 用例全通过；`apps/api`、`apps/web` 类型检查 0 报错 |

### 5.1 测试数据说明

- 新增草稿报价 `BJ-liulonghai-20261008-0001`（200 端点 / ¥1,800）为验证产物，保留在报价中心供业务查看，可随时转单或删除；
- `BJ-liulongfei-20260929-0015` 在验证中做了 30→50→30 的往返编辑，金额已还原（¥420），`updated_at/updatedByName` 有更新。

## 6. 风险与遗留

1. **未跟踪文件**：新 UI 代码（`src/features/**`、`src/components/war/**`、样式收口表）仍为未跟踪状态，无 git 保护，请勿手动清理工作区。
2. **固定画板 + 列内滚动**：中心区在数据量大时仍会在列内滚动（原型设计如此）；如需彻底消除，需要调整 R18 的字号口径或压缩字段。
3. **定价链路**：试算已与创建/更新报价同口径；但订单修订、报价转单后的价格调整仍走各自既有逻辑，未在本轮改动。
4. **移动端**：仍为独立设计，未纳入本次统一口径。

## 7. 证据文件

`test-evidence/20261008-prototype-structure-r19/`

- `deployed-audit.json`：部署后 62 条路由审计明细
- `layout-metrics.json`：目标原型与线上实现的几何对比
- `截图/`：管理端、详情页、渠道端关键页面截图（21 张）
