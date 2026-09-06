# 决策记录

## 共识摘要

- 用户要求在组织架构中显示企业微信 userid。
- 只做本地代码改动，不能影响其他功能和业务。
- 现有泛微 OA userid 展示继续保留。
- 本次只读展示，不在组织架构新增企业微信映射编辑或匹配操作。

## 已确认事实

1. 企业微信身份保存在 `iam.external_identities`，提供方编码为 `wecom`。
2. 泛微 OA 身份使用 `provider_code='eteams'`，现有接口与页面已支持展示和维护。
3. 组织架构账号详情接口只允许超级管理员访问。
4. 正式运行时 `apps/web/public/admin-app.js` 是管理员页面主要来源，工程化工作区仍需保持一致。

## 风险与处理

- 风险：企业微信和泛微身份共用一张表，查询条件错误会把企业微信 userid 当作 OA 发起人。
- 处理：新增查询固定限定 `provider_code='wecom'`，仅返回展示字段；不修改 OA 查询。

## 未授权事项

- 未授权修改测试或生产环境。
- 未授权新增企业微信身份写入、自动匹配、OA 重试或自动建群。

## 验证记录

- `npm --workspace @lianruan/api exec vitest run tests/org-routes.test.ts --maxWorkers=1 --minWorkers=1`：19 项通过。
- `npm --workspace @lianruan/api run check`：通过。
- `npm --workspace @lianruan/web run check`：通过。
- `node --check apps/web/public/admin-app.js`：通过。
- 组织架构前端定向测试通过。正式管理员页脚本资源版本更新为 `admin-app.js?v=161`，以确保浏览器获取本次只读展示代码；当前 `style.css?v=17` 保持不变。
