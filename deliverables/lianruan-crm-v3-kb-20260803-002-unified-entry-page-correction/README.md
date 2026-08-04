# 联软 CRM V3 统一入口页面纠正 KB

适用目录：`/opt/lianruan-crm-v3`

本包修复 `KB-20260803-001` 登录后进入错误页面的问题。统一入口 `/` 保持不变，登录后按账号角色和设备进入现有正式业务页面：`admin.html`、`admin-mobile.html`、`partner.html`、`partner-mobile.html`。

本交付包已修正入口跳转自检脚本，兼容服务器响应头行尾回车和绝对地址形式，避免正确跳转被误判为失败。

## 使用方法

将以下两个文件上传到服务器 `/tmp`：

- `lianruan-crm-v3-kb-20260803-002-unified-entry-page-correction.zip`
- `lianruan-crm-v3-kb-20260803-002-unified-entry-page-correction.zip.sha256`

执行：

```bash
cd /tmp
sha256sum -c lianruan-crm-v3-kb-20260803-002-unified-entry-page-correction.zip.sha256
unzip -q lianruan-crm-v3-kb-20260803-002-unified-entry-page-correction.zip
cd lianruan-crm-v3-kb-20260803-002-unified-entry-page-correction
sudo bash scripts/precheck.sh /opt/lianruan-crm-v3
sudo bash scripts/upgrade.sh /opt/lianruan-crm-v3
sudo bash scripts/verify.sh /opt/lianruan-crm-v3
```

影响服务：`api-1`、`api-2`、`nginx`。

本包不包含数据库迁移，不重启 `postgres`、`redis-state`、`redis-cache`、`worker`。升级脚本会先备份 PostgreSQL、上传目录、导出目录和现场配置，再替换受影响服务。

升级成功后，`/health/live` 显示版本 `3.0.0-stage9.24.20260803-kb002`；`/` 与 `/login` 返回统一登录页；`/admin` 跳转 `/admin.html`；`/partner` 跳转 `/partner.html`；四个正式业务页面均可访问。
