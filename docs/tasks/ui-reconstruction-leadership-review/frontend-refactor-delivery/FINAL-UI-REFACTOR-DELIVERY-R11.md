# UI 重构最终开发与交付说明（r11）

交付日期：2026-09-23

测试环境：`http://10.9.86.66`

发布镜像：`lianruan-crm-v3-nginx:3.0.0-stage10.20260923-uirefactor11`

回滚镜像：`lianruan-crm-v3-nginx:3.0.0-stage10.20260923-uirefactor10`

生产环境：`10.20.3.10` 未连接、未部署、未修改。

## 1. 交付结论

本轮把 UI 重构从「页面能打开」推进到「全角色、全分辨率、全路由、关键动作可验证」的交付状态：

- 50 个「角色 × 路由」组合在 `1280 / 1366 / 1440 / 1600 / 1920` 五种分辨率下全部通过（250 条访问记录、0 失败）。
- 10 项关键交互探针全部通过（含超管订单确认/退回动作、提醒规则真实数据）。
- 10 项越权直链全部被拦截到 `/403`。
- 本地类型检查、130 项单元测试、生产构建全部通过。
- 修复了提醒规则接口路径错误这一真实前端缺陷。

详细数据见 `20-FULL-MATRIX-VERIFICATION-R11.md` 与 `21-COVERAGE-MATRIX-R11.md`。

## 2. 本轮代码变更

| 文件 | 变更 |
| --- | --- |
| `apps/web/src/features/message/MessageSettingsPage.vue` | 提醒规则接口由 `/api/messages/rules` 修正为 `/api/messages/platform/rules`；增加真实字段映射（规则名、事件、接收人、渠道代码、状态），停用状态使用中性色标签 |
| `assets/index-Ces1o_NH.js` | 重新构建的生产资源，已随 uirefactor11 镜像发布 |

构建产物与线上资源哈希一致（`index-Ces1o_NH.js`），确认测试环境运行的就是本次代码。

## 3. 页面与动作覆盖

### 3.1 管理端（超管）

工作台、客户报备（列表/新建）、商机管理（七阶段、新建）、报价管理（列表/新建）、订单中心、产品目录、模块价格规则、渠道商、渠道报表、审核中心、消息中心、消息渠道配置、提醒规则与模板、证书与风险、线索管理、数据来源与采集、管理配置、工作量配置、账号管理、审计日志、开放接口、组织与岗位。

### 3.2 管理端（湖南区区域管理员）

工作台、客户报备、客户跟进（档案编辑 + 跟进记录）、商机、报价、订单、订单处理（按状态与角色显示动作）、产品目录、模块价格规则、渠道商、渠道核心档案、渠道成员维护、审核中心、消息中心、线索管理。

### 3.3 渠道端（渠道销售代表）

总览仪表盘、客户报备（列表/新建）、客户跟进、商机（列表/新建）、报价、订单、订单处理、产品目录。

## 4. 视觉与适配规则（研发对齐用）

- 默认电脑端：13 / 14 / 15 英寸笔记本与 21 / 24 英寸显示器，`1280`–`1920` 全区间不换行、不出现整页横向滚动条。
- 表格与弹窗使用稳定列宽与最小宽度，缩放浏览器窗口不改变列语义顺序。
- 二级页面统一 `.页面标签 + h1 + 说明` 头部结构，动作按钮限定在页头右侧或面板内。
- 空态、加载态、错误态、403 态均有独立样式，不允许只保留空白区域。
- 状态色：启用/已完成使用绿色，停用/待处理使用中性琥珀色，驳回/退回使用红色系。

## 5. 权限规则

| 角色 | 范围 |
| --- | --- |
| 超级管理员 | 全部业务模块 + 管理配置（证书、消息渠道、提醒规则、账号、审计、开放接口、组织） |
| 区域管理员 | 本区域客户、商机、报价、订单、渠道、产品价格、线索；管理配置类入口不可见且直链返回 403 |
| 渠道销售代表 | 本渠道客户、商机、报价、订单、产品；管理端路由直链返回 403 |

## 6. 部署与回滚

本轮只重建 Nginx/Web，未重建 API、Worker、PostgreSQL、Redis。

```bash
# 部署（测试环境）
cd /opt/lianruan-crm-v3
docker compose --env-file compose/.env -f compose/docker-compose.yml up -d --no-deps --force-recreate nginx

# 回滚到 r10
sed -i 's/^V3_IMAGE_TAG=.*/V3_IMAGE_TAG=3.0.0-stage10.20260923-uirefactor10/' compose/.env
docker compose --env-file compose/.env -f compose/docker-compose.yml up -d --no-deps --force-recreate nginx
```

- `.env` 变更前已备份为 `/opt/lianruan-crm-v3/compose/.env.bak-before-r11`。
- r11 同时为 API / Worker / MCP 补齐了同名镜像标签，避免 `V3_IMAGE_TAG` 指向不存在的镜像导致重启失败；API / Worker / MCP 容器本身未重启、未变更。

## 7. 已知阻塞

| 项 | 状态 | 责任方 |
| --- | --- | --- |
| `GET /api/messages/platform/channels` 返回 500 | 测试环境缺少 `message` 架构迁移（`database/migrations/20260814_M04_001_message_channel_configuration.sql`），前端已降级并保留页面结构 | 后端 / 运维执行迁移后复验 |
| 线索管理数据 | 本轮只做前端 UI，真实线索数据与爬虫下月接入 | 后续排期 |
| 客户与商机关联 | 只预留入口，不做正式联动 | 后续排期 |
| `liangwanqi` 账号 | 登录返回 401；本轮超管验证账号为 `liulonghai` | 环境账号管理 |

## 8. 验证命令

```bash
# 本地门禁
npm --workspace @lianruan/web run check
npm --workspace @lianruan/web run test
npm --workspace @lianruan/web run build

# 测试环境全量矩阵（需要测试账号密码，通过环境变量传入）
cd docs/tasks/ui-reconstruction-leadership-review/frontend-refactor-delivery
V3_TEST_SUPERADMIN_USERNAME=<账号> V3_TEST_SUPERADMIN_PASSWORD=<密码> \
V3_TEST_REGION_USERNAME=<账号> V3_TEST_REGION_PASSWORD=<密码> \
V3_TEST_CHANNEL_USERNAME=<账号> V3_TEST_CHANNEL_PASSWORD=<密码> \
V3_TEST_BEFORE_URL=<重构前镜像地址> \
node tools/verify-test-env-full-matrix.mjs

# 关键交互探针
node tools/probe-interactions.mjs

# 重新生成覆盖矩阵与对比画廊
node tools/render-r11-release-docs.mjs
```

## 9. 交付物清单

| 交付物 | 路径 |
| --- | --- |
| 最终交付说明 | `FINAL-UI-REFACTOR-DELIVERY-R11.md` |
| 全量矩阵验证报告 | `20-FULL-MATRIX-VERIFICATION-R11.md` |
| 页面覆盖矩阵 | `21-COVERAGE-MATRIX-R11.md` |
| 重构前后对比画廊 | `COMPARISON-GALLERY.html` |
| 全量矩阵脚本 | `tools/verify-test-env-full-matrix.mjs` |
| 交互探针脚本 | `tools/probe-interactions.mjs` |
| 证据数据 | `test-evidence/20260923-refactor-verification-r11/` |
| 总体方案与模块文档 | `00` 至 `18` 编号文档 |
| 完整交付包 | `../lianruan-crm-v3-ui-refactor-delivery-20260923-r11.zip` |
| 交付包校验 | `../lianruan-crm-v3-ui-refactor-delivery-20260923-r11.zip.sha256` |

交付包 SHA256 以同名 `.sha256` 文件为准，校验命令：

```bash
shasum -a 256 -c lianruan-crm-v3-ui-refactor-delivery-20260923-r11.zip.sha256
```

交付包内容：本目录全部文档与证据（398 个文件、含 266 张截图）+ 前端实现源码（`apps/web/src/features`、`apps/web/src/router`、`apps/web/src/shared`、`apps/web/src/api`、`apps/web/src/pages/BusinessWorkspacePage.vue`、`apps/web/tests`）。

发送给他人评审的最小集合：`FINAL-UI-REFACTOR-DELIVERY-R11.md`、`20-FULL-MATRIX-VERIFICATION-R11.md`、`21-COVERAGE-MATRIX-R11.md`、`COMPARISON-GALLERY.html` 与 `test-evidence/20260923-refactor-verification-r11/`。
