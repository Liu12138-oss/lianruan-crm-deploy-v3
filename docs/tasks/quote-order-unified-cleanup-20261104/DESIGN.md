# 报价转订单、新建报价默认值与测试入口清理方案

## 问题陈述

测试环境新 UI 存在三个问题：

1. 报价转订单弹窗填写完整后，点击“确认转订单”没有反应。
2. 新建报价会自动选中第一个套餐，并带入套餐内模块和功能。
3. 独立 `/unified` 测试入口仍可通过路由访问。

## 根因

1. 出货金额输入框使用 `type="number"`，运行时 `v-model` 返回数字；提交方法对其调用 `trim()`，直接抛出 `TypeError`。异常发生在请求前，因此既没有接口请求，也没有页面错误提示。
2. 新建报价初始化时，在地址栏没有 `packageId` 的情况下自动选中套餐列表第一项并应用套餐。
3. `/unified` 仍是独立布局路由，状态页也保留返回该测试页面的链接。

## 修复方案

1. 出货金额先统一转为字符串再校验；提交方法覆盖完整异常边界，任何校验或请求错误都同时显示在弹窗内并使用消息提示。
2. 新建报价默认不选择套餐、模块、功能或硬件；只有地址栏明确携带有效 `packageId` 时才预选对应套餐。切换报价方式也不再自动选择第一个套餐。
3. 删除 `/unified` 路由和独立测试布局；状态页“返回入口”改为回到站点根路径；登录分流忽略历史 `/unified` 权限，无可进入工作区时进入 `/403`。

## 影响范围

- `apps/web/src/features/quote/QuoteToOrderDialog.vue`
- `apps/web/src/features/quote/QuoteCreatePage.vue`
- `apps/web/src/router/index.ts`
- `apps/web/src/router/entry-target.ts`
- `apps/web/src/layouts/UnifiedLayout.vue`（删除）
- `apps/web/src/pages/NotFoundPage.vue`
- `apps/web/src/pages/ForbiddenPage.vue`
- `apps/web/src/pages/MaintenancePage.vue`
- `apps/web/src/pages/SessionExpiredPage.vue`
- 对应 Web 回归测试

## 验收标准

- [x] 报价转订单填写有效数字出货金额后，点击确认会真实发出 `/api/orders/from-quote` 请求；请求失败时页面可见具体原因。
- [x] 新建报价首次打开时，套餐、模块、功能、硬件均为空。
- [x] 显式携带有效 `packageId` 时仍可预选对应套餐。
- [x] `/unified` 不再匹配独立页面，状态页不再返回该路径。
- [x] 管理员和渠道账号登录后仍分别进入 `/admin` 与 `/partner`。
- [x] 定向测试、类型检查和生产构建通过，并在测试环境完成页面复测。

## 实施与验证结果

- 前端构建通过；Web 全量测试 `243/243` 通过，Web 类型检查通过。
- 测试环境仅发布 Nginx r2 前端镜像；API、Worker 保持 r1，PostgreSQL、Redis 未重建。
- 真实页面验收 5/5 通过：环境健康、根路径进入管理端、`/unified` 返回 404、新建报价默认全空、报价转订单成功生成订单。
- 验收临时报价与订单均已清理，残留均为 0；本轮无数据库迁移。
- 根路径回归修复：已登录账号访问 `/` 时先恢复会话，再按角色进入 `/admin`、`/partner` 或移动端；无权限时进入 `/403`。

## 回退

- 本轮不涉及数据库迁移。
- 回退时恢复上一版本前端镜像并重建 `nginx`；API、Worker 和数据库无需回滚。
