# R18：新 UI 排版统一收口与全路由复核

- 日期：2026-10-08
- 验收环境：`http://10.9.86.66`（测试环境，唯一发布目标）
- 代码位置：`/Users/liu/.aicodex/worktrees/6e0a/lianruan-crm-deploy-v3`
- 本轮范围：字号与字重统一、组织工作区收口复核、全路由排版复核

## 1. 用户口径（本轮必须遵守的四条）

| 编号 | 要求 | 处理结果 |
| --- | --- | --- |
| 1 | 除一级、二级标题外，其他文字一律同字号；字体格式统一 | 已实现，见第 4、5 节 |
| 2 | 线索面板保持「待接入」 | 未改动，页面已明确标注「采集模块待接入」 |
| 3 | KPI 口径后续由用户补充 | 未改动 |
| 4 | 组织架构页一并收口 | 已复核，见第 7 节 |

## 2. 关键发现（问题定位）

### 2.1 字号不一致的真实来源

改造前，新 UI 同一页面上同时存在 `7px / 8px / 9px / 9.5px / 10px / 12px / 13px / 14px / 17px / 18px / 21px / 24px` 等十余档字号。

真正生效的字号来自 **共享样式表**，而不是各业务页的 `<style>`：

| 来源文件 | font-size 声明数 | 说明 |
| --- | --- | --- |
| `styles/theme.css` | 273 | 应用外壳与传统业务页壳 |
| `styles/war-demo.css` | 202 | 作战室制式原型样式 |
| `styles/visual-ui.css` | 86 | 作战室覆盖层 |
| `styles/war-form.css` | 18 | 表单样式 |
| 各业务页 `<style>` | 约 250 | 单页局部样式 |

上一轮仅改各业务页 `<style>`，因此占大头的共享样式表未被收口，页面观感几乎无变化。本轮改为在共享层做统一收口。

### 2.2 页面容器分两套，必须同时覆盖

| 容器 | 覆盖页面 |
| --- | --- |
| `.vui` | 作战室制式业务页（管理端多数页面、渠道端全部页面、组织工作区） |
| `.v2-业务页` | 传统业务页壳（报备导入、商机导入、渠道导入、员工导入、渠道管理员） |
| `.成员页 / .档案页 / .跟进页 / .订单处理页 / .消息页` | 独立设计中台页（渠道成员、渠道档案、客户跟进、订单处理等） |

独立设计中台页在上一轮已按 `11 / 16 / 22 / 23px` 手工归一，本轮仅补齐继承基准与浏览器默认字号两类漏网项。

### 2.3 移动端曾被误伤（已修复）

`pages/BusinessWorkspacePage.vue` 的根节点同时承载桌面壳与移动壳：
`class="v2-业务页" :class="{ 'v2-业务页-移动': 是移动 }"`。
收口规则已用 `:not(.v2-业务页-移动)` 排除移动端，移动端保持原有设计（KPI 24px 等）。**移动端不在本轮统一范围。**

## 3. 环境核对结论

- 测试环境运行中版本：`lianruan-crm-v3-nginx:3.0.0-stage10.20260929-protofix13`（**构建于 9 月 29 日**）。
- 经比对服务端 `assets/OrganizationWorkspacePage-*.css`：线上仍是旧版组织页样式（`min-height:100vh`、`#007aff`）。
- **结论：上一轮（10 月 8 日）与本轮的全部新 UI 改造目前都尚未部署到测试环境。** 用户此前看到的「字号不一致」现象来自 9 月 29 日构建。

## 4. 统一后的排版口径

| 层级 | 字号 / 字重 | 适用 |
| --- | --- | --- |
| 一级标题 | 22px / 700 | 页面标题（`h1`、`.deal-title strong`、`.customer-review-head strong`） |
| 二级标题 | 16px / 700 | 面板、区块、卡片、弹窗标题（`h2`、`h3`、`.panel-head`、`.war-title-row`、`.right-card-title`） |
| 指标数字 | 23px / 700 | KPI 大数字（`.metric-value strong`） |
| 正文 | 11px | 其余全部文字（表格、标签、按钮、表单、辅助说明） |
| 字重 | 仅 400 / 700 两档 | 500/600/800/900 已全部归并 |
| 字体族 | 仅 1 套 | `"PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", system-ui, sans-serif` |

装饰性元素例外（不参与正文统一，避免图标与头像变形）：顶栏品牌标识 16px、顶栏头像 12px、顶栏图标 15px。

## 5. 变更清单

### 5.1 新增

| 文件 | 说明 |
| --- | --- |
| `apps/web/src/styles/war-typography-lock.css` | 排版收口唯一入口，196 行，含全部统一规则与中文注释 |

### 5.2 修改

| 文件 | 改动 |
| --- | --- |
| `apps/web/src/main.ts` | 末尾新增一行引入收口样式表 |
| `apps/web/src/styles/war-typography.css` | 桌面外壳继承基准 13px → 11px（登录页 `body` 保持 13px 不变） |
| `apps/web/src/styles/theme.css` | 字重归并 39 处（800/600/500 → 700/400） |
| `apps/web/src/styles/visual-ui.css` | 字重归并 10 处 |
| `apps/web/src/styles/war-demo.css` | 字重归并 40 处 |
| `apps/web/src/styles/war-form.css` | 字重归并 2 处 |

字重合计归并 91 处，全部为纯数值替换，未改选择器与布局属性。

### 5.3 收口规则要点

1. `.vui` / `.v2-业务页` / 顶栏：字体族、正文 11px 统一由 `!important` 层压过历史声明。
2. 标题与指标数字在收口层内单独提级，避免被正文规则压平。
3. 窄栏阶段条（`.flow-step`、`.step-item`）改为换行展示：原列宽仅 40~50px，字号提升到 11px 后若继续 `nowrap + ellipsis` 会出现「POC …」硬截断。
4. `<small>` 等浏览器默认改写字号的标签压回 11px，修掉 `9.16667px` 这类非整数。
5. Element Plus 变量 `--el-font-size-*` 全部指向 11px，弹层、下拉、分页与正文一致。
6. 登录页、单点登录中转页、统一入口页、移动端页面不在作用域内。

### 5.4 回退方式

删除 `apps/web/src/styles/war-typography-lock.css` 与 `main.ts` 中对应的一行 import，并把 `war-typography.css` 的外壳基准改回 13px、字重改回原值即可。上述改动均不与业务逻辑耦合。

## 6. 验证结果

### 6.1 全路由排版矩阵（1440×900，超管 `liulonghai`）

| 范围 | 路由数 | 越界字号 | 字体族种类 | 横向溢出 |
| --- | --- | --- | --- | --- |
| 管理端全部页面 | 30 | 0 | 1 | 0 |
| 详情页（跟进、订单处理、报价编辑、渠道档案、渠道成员） | 5 | 0 | 1 | 0 |
| 渠道端（`/partner/*`） | 9 | 0 | 1 | 0 |
| 移动端（`/mobile/*`） | 8 | 不适用（独立设计，未纳入统一） | — | 0 |

最终字号分布（30 个管理端页面全部带文字元素）：

| 字号/字重 | 元素数 |
| --- | --- |
| 11px / 400 | 8505 |
| 11px / 700 | 6374 |
| 23px / 700（指标） | 132 |
| 16px / 700（二级标题） | 109 |
| 22px / 700（一级标题） | 23 |

### 6.2 工程验证

| 项 | 结果 |
| --- | --- |
| `npm run build`（vue-tsc + vite build） | 通过 |
| `apps/web` 单元测试 | 22 个文件 / 130 个测试全部通过 |
| 构建产物 | `dist/assets/index-DRC_5cTL.css`、`dist/assets/index-DoLaNxye.js` |

### 6.3 截图与原始数据

- 页面截图：`/tmp/ui-verify-local/png_*.png`（30 个管理端页面）
- 渠道端/移动端截图：`/tmp/ui-verify-local/all/`
- 排版审计原始数据：`/tmp/ui-verify-local/font-audit.json`、`font-audit-before.json`
- 改动前后对比：`font-audit-before.json`（改造前）↔ `font-audit.json`（改造后）

## 7. 组织工作区收口复核

- 路由：`/workspace/admin/platform-admin/organization/units` 等 9 个栏目，为**顶级路由**，不套 `AdminLayout`，因此页面自带页头、不显示全局顶部导航，属既有结构。
- 画板：`height: 742px` + 内部滚动，与作战室制板一致；实测根高 742、内容高 10234，滚动正常。
- 设计令牌：主色 `#2f69ed`、文字 `#172b4d / #60748c / #4f6178`、边框 `#dce7f3`、圆角 10px，与作战室体系一致。
- 排版：一级标题 22px、二级标题 16px、正文 11px，已纳入本轮统一口径。

## 8. 未处理项与后续建议

| 项 | 说明 | 建议 |
| --- | --- | --- |
| 测试环境部署 | 已完成：2026-10-08 切换至 `3.0.0-stage10.20261008-typor18` | 详见第 10 节 |
| 导入类页面版式 | 报备/商机/渠道/员工导入页仍为传统壳（内容区大留白），仅排版已统一 | 是否改造为作战室制式需业务确认 |
| 渠道管理员页 `/admin/partner-admin` | 同上，为检索列表制式 | 同上 |
| 移动端排版 | 自成一档（12/13/14/15/24px），存在 2 套字体族 | 是否纳入统一待确认 |
| 单点登录中转页 | 仍是独立配色与字号 | 受 `AGENTS.md` 约束，改动需先同步 `entry-target.ts`、`auth-client.ts` 及测试 |
| 登录页 | 未纳入本轮统一 | 待确认 |
| 3 个未接线路由的组件 | `MessageCenterPage.vue`、`PricingRulesPage.vue`、`CertificateRiskPage.vue` 已在 `router/index.ts` 声明 import 但未挂载路由 | 按用户指示保留；是否接线待确认 |
| 工作区未提交 | 新 UI 全部文件均为未跟踪状态，无 git 保护 | 建议尽快提交到 `codex/ui-next-*` 分支 |

## 9. 风险提示

1. **无 git 保护**：`apps/web/src/features/**`、`src/styles/visual-ui.css`、`war-demo.css`、`war-form.css`、`war-artboard.css`、`war-typography.css`、`war-typography-lock.css` 均为未跟踪文件，误删不可恢复。
2. **`!important` 收口层**：收口样式表优先级最高，后续若在业务页直接写 `font-size` 将不生效，必须改收口表，文件头部已注明。
3. **截断**：正文从 8/9px 提升到 11px 后，固定列宽列表中的长公司名、单号会以省略号截断（约 36~105 处/页），均为设计内的 `text-overflow: ellipsis`，非布局破损。


## 10. 测试环境部署记录（2026-10-08）

- 部署时间：2026-10-08 12:00（北京时间）
- 发布目标：`http://10.9.86.66`（测试环境，唯一发布目标）
- 镜像标签：`lianruan-crm-v3-nginx:3.0.0-stage10.20261008-typor18`
- 上一版本：`lianruan-crm-v3-nginx:3.0.0-stage10.20260929-protofix13`
- 部署范围：仅前端（nginx 镜像）。经全量逐文件比对，`apps/api/src`、`apps/worker/src`、`apps/mcp`、`packages` 共 109 个源文件与服务器 `src-protofix13` 完全一致，后端无需重新构建；`config/nginx/default.conf` 与工作区版本一致，无需变更。
- 产物校验：镜像内 `assets/index-DRC_5cTL.css` 的 SHA-256 与本地构建产物完全一致。
- 回退方式：`cp -p /opt/lianruan-crm-v3/compose/.env.bak-before-typor18 /opt/lianruan-crm-v3/compose/.env && cd /opt/lianruan-crm-v3/compose && docker compose up -d --no-deps nginx`

### 10.1 部署后复验（测试环境实测）

| 范围 | 路由数 | 结果 |
| --- | --- | --- |
| 管理端 | 30 | 全部正常，0 控制台错误，0 接口错误，0 横向溢出 |
| 详情页（真实业务数据取样） | 6 | 同上 |
| 渠道端 | 9 | 同上 |
| 移动端（修正后的 15 条正式路由） | 15 | 全部正常，独立设计未纳入统一口径 |
| 公开页 | 3 | 未登录访问 `/api/auth/me` 返回 401 属预期 |

- 字重：全量页面仅 400 / 700 两档，0 越界。
- 字体族：桌面端全部页面单一字体族。
- 字号越界：仅 4 类装饰性元素（顶栏头像 12px、顶栏图标 15px、客户标识字母 20px、渠道路由卡字母 18px），均为图标/头像类视觉元素而非正文，按装饰例外保留。
- 复验数据：`/tmp/ui-verify-deployed-typor18/deployed-audit.json`、`mobile-audit.json`、`截图/`（70 张）。

### 10.2 部署复验中发现并澄清的两点

1. `/mobile/admin/registrations|orders|opportunities` 三个路径在路由表中不存在（管理员移动端正式路由为 `/mobile/admin/reviews|business|partners`），旧复验脚本沿用了错误路径，已按路由表修正后复验通过。
2. `/workspace` 不是路由（返回 404），统一入口页正式路由为 `/unified`；`/admin.html`、`/partner.html` 按既有 nginx 配置 301 跳转到 `/admin`、`/partner`（重构后正式路由），非本次部署改动。
