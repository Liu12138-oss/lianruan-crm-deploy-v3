# 测试环境 UI 重构最终验证报告（r10）

> 本文件为 r10 阶段的验证记录，保留存档。
> 最新验证结论请以 `20-FULL-MATRIX-VERIFICATION-R11.md` 与 `21-COVERAGE-MATRIX-R11.md` 为准（r11 已覆盖全角色、全分辨率与关键交互探针）。

验证日期：2026-09-23

环境：`http://10.9.86.66`

## 1. 发布结果

- Web 镜像：`lianruan-crm-v3-nginx:3.0.0-stage10.20260923-uirefactor10`
- 上一版本备份：`lianruan-crm-v3-nginx:3.0.0-stage10.20260923-uirefactor9-backup-r10`
- Web/Nginx 已重建。
- API、Worker、PostgreSQL 和 Redis 未重建。
- 生产环境 `10.20.3.10` 未连接、未修改。

## 2. 健康检查

- `/health/live`：200。
- `/health/ready`：200。
- 登录、管理端、渠道端和移动端统一入口未发现回归。

## 3. 浏览器验证

验证脚本：

`tools/verify-test-env-refactor.mjs`

结果：

```json
{
  "pages": 37,
  "failures": [],
  "widths": [1440, 1920]
}
```

覆盖角色：

- 超级管理员。
- 湖南区区域管理员。
- 渠道销售代表。

覆盖路由：

```text
/admin/dashboard
/admin/registration
/admin/opportunity
/admin/quote
/admin/order
/admin/products
/admin/products/pricing
/admin/partners
/admin/admin-review
/admin/notifications
/admin/certifications
/admin/notifications/platform
/admin/notifications/rules
/admin/registration/:id/followup
/admin/partners/:id/profile
/admin/partners/:id/members
/admin/order/:id/actions
/partner/dashboard
/partner/registration
/partner/opportunity
/partner/quote
/partner/order
/partner/products
/partner/registration/:id/followup
/partner/order/:id/actions
```

## 4. 交互验证

- 客户档案进入编辑态并可取消。
- 客户跟进表单、关联商机和时间线正常显示。
- 渠道成员新增弹窗可打开和关闭。
- 订单处理页按角色显示动作，处理弹窗可打开和取消。
- 价格规则页可切换产品、区域覆盖和渠道比例标签。
- 证书模板弹窗可打开和关闭。
- 消息渠道和提醒规则页面可加载，接口失败时保留页面结构。
- 页面宽度与视口宽度一致，无整页横向溢出。

## 5. 截图与 JSON 证据

证据目录：

`test-evidence/20260923-refactor-verification-r10/`

主要截图：

- `superadmin--admin-dashboard.png`
- `superadmin--admin-opportunity.png`
- `superadmin--admin-order.png`
- `superadmin--admin-products-pricing.png`
- `superadmin--admin-certifications.png`
- `superadmin--admin-notifications-platform.png`
- `region--admin-registration-*.png`
- `region--admin-partners-*-members.png`
- `region--admin-order-*-actions.png`
- `channel--partner-registration-*-followup.png`
- `channel--partner-order-*-actions.png`

## 6. 已知接口问题

测试环境当前仍存在两个既有后端问题：

- `GET /api/messages/platform/channels`：500。
- `GET /api/messages/rules`：404。

前端已提供错误提示和结构 fallback，不阻塞其他 UI 链路。后端接口恢复后需要复验这两条配置链路。

## 7. 结论

r10 已完成本轮前端 UI 重构的测试环境发布、三角色权限验证、关键交互验证、1366/1440/1600/1920 页面宽度验证和重构前后截图对比。除已记录的消息配置后端接口外，未发现 UI 重构失败项。
