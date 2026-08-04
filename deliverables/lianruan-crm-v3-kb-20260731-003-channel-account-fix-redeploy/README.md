# 联软 CRM V3 渠道商账号热修复强制生效 KB

适用目录：`/opt/lianruan-crm-v3`

用途：复用 `3.0.0-stage9.22.20260731-kb002` 业务镜像，修正上一版升级后可能仍运行旧容器的问题。

执行顺序：

```bash
cd /tmp
sha256sum -c lianruan-crm-v3-kb-20260731-003-channel-account-fix-redeploy.zip.sha256
unzip -q lianruan-crm-v3-kb-20260731-003-channel-account-fix-redeploy.zip
cd lianruan-crm-v3-kb-20260731-003-channel-account-fix-redeploy
sudo bash scripts/precheck.sh /opt/lianruan-crm-v3
sudo bash scripts/upgrade.sh /opt/lianruan-crm-v3
sudo bash scripts/verify.sh /opt/lianruan-crm-v3
```

影响服务：`api-1`、`api-2`、`nginx`。

不包含数据库迁移，不重启 `postgres`、`redis-state`、`redis-cache`、`worker`。

升级成功后，`/health/live` 应显示版本 `3.0.0-stage9.22.20260731-kb002`，渠道商接口应返回 `staff` 字段，`admin-app.js` 应包含 `accountRole` 修复逻辑。
