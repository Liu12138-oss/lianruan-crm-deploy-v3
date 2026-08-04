# KB说明

## 基本信息

- KB 编号：`KB-20260803-001`
- KB 名称：V3 统一入口分流与 IAM H5 单点登录补丁
- 目标版本：`3.0.0-stage9.23.20260803-kb001`
- 最低建议版本：`3.0.0-stage9.22.20260730`
- 包类型：热修复
- 影响服务：`api-1`、`api-2`、`nginx`

## 问题背景

V3 需要收口为统一入口 `/`，登录后按账号权限和访问设备进入管理员、渠道端或移动端页面。旧配置仍可能让 `/login`、`/admin`、`/partner` 走旧静态入口或固定跳转，导致统一分流规则无法生效，也会影响 IAM H5 单点登录落点。

## 修复内容

1. 新增统一入口分流规则文件 `apps/web/src/router/entry-target.ts`，集中维护登录后落点。
2. V3 登录页改为使用统一分流规则，已登录用户和账号密码登录成功后都按角色、移动端和安全 `redirect` 参数跳转。
3. 新增 `SingleSignOnPage.vue`，支持 IAM H5 管理员入口和渠道端入口。
4. API 新增 IAM H5 单点登录配置与登录接口：`/api/auth/sso/iam/config`、`/api/auth/sso/iam/login`、`/api/auth/sso/iam/admin-login-v2`、`/api/auth/sso/iam/partner-login-v2`。
5. Nginx 根路径和 `/login`、`/admin`、`/partner` 改为返回 V3 工程化页面 `index.html`。
6. 升级脚本同步生产挂载的 `config/nginx/default.conf`，并在 `config/v3.env` 缺失时补齐 IAM H5 单点登录配置项，不覆盖现场已有值。
7. 本包保留前序渠道商员工创建、企业管理员创建、企业管理员列表显示、删除渠道商员工刷新残留修复，作为累积升级包交付。

## 验证方式

自动验证：

```bash
bash scripts/verify.sh /opt/lianruan-crm-v3
```

接口验证：

```bash
curl -sS http://127.0.0.1/health/live
curl -sS http://127.0.0.1/
curl -sS http://127.0.0.1/login
curl -sS http://127.0.0.1/admin
curl -sS http://127.0.0.1/partner
curl -sS http://127.0.0.1/api/auth/sso/iam/config
```

成功标准：

1. `/health/live` 返回版本 `3.0.0-stage9.23.20260803-kb001`。
2. `/`、`/login`、`/admin`、`/partner` 返回 V3 工程化页面。
3. IAM H5 配置接口返回成功，并包含管理员请求标识 `QdCRMguanlyuan123`、渠道端请求标识 `QdCRMkeduduan123`。
4. 管理员、渠道端、移动端登录后落点符合 `apps/web/src/router/entry-target.ts` 中的统一规则。
5. 前序渠道商账号相关修复继续有效。

## 回退方式

升级脚本会输出回退命令，格式如下：

```bash
sudo bash scripts/rollback.sh /opt/lianruan-crm-v3 /opt/lianruan-crm-v3/releases/3.0.0-stage9.23.20260803-kb001-pre-时间戳
```

回退只恢复应用配置、Nginx 配置和镜像标签，不自动恢复数据库。由于本 KB 不包含数据库结构迁移，通常不需要数据库回退。
