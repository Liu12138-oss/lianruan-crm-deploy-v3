# 联软渠道管理平台 V3

## 重要维护边界

本仓库当前只维护 V3 工程化应用。后续功能改动、缺陷修复、入口调整和部署配置均以 `apps/web`、`apps/api`、`apps/worker`、`packages/*`、`deploy/single-server` 为准。

旧版 V2 静态目录 `frontend`、旧后端目录 `backend`、旧升级包和旧启动脚本已从主线清理，不再作为新需求落点。V3 迁移兼容资产继续保留，包括 `database/mapping`、`scripts/migration`、`apps/api/src/v2-compat-routes.ts` 及对应测试。

V3 对外发布优先只发布站点根路径 `/`。用户登录后由账号权限和访问设备自动进入现有正式业务页面：管理员电脑端 `/admin.html`、管理员移动端 `/admin-mobile.html`、渠道电脑端 `/partner.html`、渠道移动端 `/partner-mobile.html`。规则集中维护在 `apps/web/src/router/entry-target.ts`，详细协作约定见 `AGENTS.md`。

V3 单机部署说明见 `deploy/single-server/README.md`。

V3 现有功能收口、平台底座、组织架构、合同收款、企微 OA、公海与报备池、消息提醒及后续业务模块的实施基线，统一见 [V3业务平台底座与业务扩展实施交付方案](docs/V3业务平台底座与业务扩展实施交付方案.md)。

## 本地开发

```bash
npm install
npm run build
npm test
```

## 单机部署

V3 单机部署以 `deploy/single-server` 为唯一维护入口，部署前请阅读 [离线安装说明](deploy/single-server/docs/离线安装说明.md)。

常用校验命令：

```bash
npm run verify
```

## 入口说明

| 场景 | V3 入口 |
| --- | --- |
| 统一入口 | `/` |
| 登录页 | `/login` |
| 管理员电脑端 | `/admin.html` |
| 管理员移动端 | `/admin-mobile.html` |
| 渠道电脑端 | `/partner.html` |
| 渠道移动端 | `/partner-mobile.html` |

入口分流规则集中维护在 `apps/web/src/router/entry-target.ts`。

## 主线目录

```
apps/web              V3 前端
apps/api              V3 后端
apps/worker           V3 后台任务进程
packages/*            共享包
deploy/single-server  V3 单机部署
database              V3 迁移与数据库资产
```
