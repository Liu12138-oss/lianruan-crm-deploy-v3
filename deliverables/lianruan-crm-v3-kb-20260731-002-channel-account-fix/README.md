# 联软 CRM V3 渠道商账号热修复 KB

适用目录：`/opt/lianruan-crm-v3`

执行顺序：

```bash
cd /tmp
sha256sum -c lianruan-crm-v3-kb-20260731-002-channel-account-fix.zip.sha256
unzip -q lianruan-crm-v3-kb-20260731-002-channel-account-fix.zip
cd lianruan-crm-v3-kb-20260731-002-channel-account-fix
sudo bash scripts/precheck.sh /opt/lianruan-crm-v3
sudo bash scripts/upgrade.sh /opt/lianruan-crm-v3
sudo bash scripts/verify.sh /opt/lianruan-crm-v3
```

影响服务：`api-1`、`api-2`、`nginx`。

不包含数据库迁移，不重启 `postgres`、`redis-state`、`redis-cache`、`worker`。

