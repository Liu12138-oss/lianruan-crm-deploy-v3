# 组织架构显示企业微信 userid 设计

## 目标

在 V3 组织架构账号详情中显示账号已维护的企业微信 `userid`，保留现有泛微 OA 身份展示和维护能力，不改变任何业务流程、权限、登录、OA 发起或自动建群逻辑。

## 实现范围

- API：在现有账号外部身份详情响应中追加 `wecomIdentities`，读取 `iam.external_identities` 中 `provider_code='wecom'` 的身份。
- 前端：在正式管理员页 `apps/web/public/admin-app.js` 和工程化工作区 `OrganizationWorkspacePage.vue` 的账号抽屉增加只读“企业微信身份”区块。
- 仅展示身份编号、外部账号和状态；不在本任务新增企业微信身份编辑入口。
- 组织架构接口已有超级管理员鉴权，继续沿用，不扩大可见范围。

## 数据与兼容

- 现有 `formalIdentity`、`inactiveFormalIdentities`、`candidates` 字段保持不变。
- `wecomIdentities` 缺失或为空时显示“未记录已确认的企业微信身份”，旧 API 响应不会导致页面报错。
- 企业微信映射只读，不参与泛微 OA 发起人判定；泛微 OA 仍只读取 `provider_code='eteams'`。

## 验收与回退

- API 返回 `wecomIdentities`，并且不改变泛微字段。
- 组织架构账号抽屉显示已启用企业微信 userid；无映射时显示空状态。
- 既有组织、登录、订单、OA、企微群聊相关测试通过。
- 回退仅需移除新增查询、类型和只读展示，数据库无需回退。
