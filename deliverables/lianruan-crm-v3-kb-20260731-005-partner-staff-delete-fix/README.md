# 联软 CRM V3 渠道商员工删除热修复 KB

适用目录：`/opt/lianruan-crm-v3`

用途：修复渠道商销售团队删除员工后，刷新页面仍显示灰色员工卡片的问题。本包同时保留前序渠道商员工创建、企业管理员创建修复，作为累积热修复包使用。

执行顺序：

```bash
cd /tmp
sha256sum -c lianruan-crm-v3-kb-20260731-005-partner-staff-delete-fix.zip.sha256
unzip -q lianruan-crm-v3-kb-20260731-005-partner-staff-delete-fix.zip
cd lianruan-crm-v3-kb-20260731-005-partner-staff-delete-fix
sudo bash scripts/precheck.sh /opt/lianruan-crm-v3
sudo bash scripts/upgrade.sh /opt/lianruan-crm-v3
sudo bash scripts/verify.sh /opt/lianruan-crm-v3
```

影响服务：`api-1`、`api-2`、`nginx`。

不包含数据库迁移，不重启 `postgres`、`redis-state`、`redis-cache`、`worker`。

升级成功后，`/health/live` 应显示版本 `3.0.0-stage9.22.20260731-kb005`，`admin-app.js` 应包含 `removePartnerStaffFromList`，渠道商接口应返回 `staff` 字段。删除渠道商员工后，刷新渠道商详情不应再看到该员工卡片；禁用员工仍可保留为灰色卡片。
