# 联软 CRM V3 统一入口分流升级 KB

适用目录：`/opt/lianruan-crm-v3`

用途：升级 V3 统一入口分流规则，让 `/`、`/login`、`/admin`、`/partner` 进入工程化 V3 应用，由登录态、角色权限和访问设备自动分流到管理员、渠道端或移动端页面。本包同时包含 IAM H5 单点登录配置接口和登录接口，并保留前序渠道商账号相关修复。

## 使用方法

把 `lianruan-crm-v3-kb-20260803-001-unified-entry-routing.zip` 和同名 `.zip.sha256` 上传到服务器 `/tmp` 后执行：

```bash
cd /tmp
sha256sum -c lianruan-crm-v3-kb-20260803-001-unified-entry-routing.zip.sha256
unzip -q lianruan-crm-v3-kb-20260803-001-unified-entry-routing.zip
cd lianruan-crm-v3-kb-20260803-001-unified-entry-routing
sudo bash scripts/precheck.sh /opt/lianruan-crm-v3
sudo bash scripts/upgrade.sh /opt/lianruan-crm-v3
sudo bash scripts/verify.sh /opt/lianruan-crm-v3
```

影响服务：`api-1`、`api-2`、`nginx`。

不包含数据库迁移，不重启 `postgres`、`redis-state`、`redis-cache`、`worker`。由于生产 Compose 使用统一镜像标签，脚本会为现场已有 `worker` 镜像增加目标版本别名，但不会重建或重启 `worker`。

升级成功后，`/health/live` 应显示版本 `3.0.0-stage9.23.20260803-kb001`，`/`、`/login`、`/admin`、`/partner` 均应返回 V3 工程化页面，`/api/auth/sso/iam/config` 应返回管理员和渠道端单点登录请求标识。

回退命令会在升级脚本最后输出，按输出内容执行即可。
