# HexHub迁移用户统一密码初始化执行记录

记录日期：2026-07-29

目标资产：HexHub「渠道CRM（新架构）」

目标服务器：10.20.3.10

安装目录：/opt/lianruan-crm-v3

## 执行目标

将V2迁移到V3的启用账号统一初始化为临时密码：

```text
LrCRM@2026!
```

脚本默认范围为 `iam.users.v2_source_id` 不为空且 `status_code = 'active'` 的账号。

## 已完成事项

1. 本地新增脚本：

```text
/Users/liu/Documents/Codex/lianruan-crm-deploy-v3/deploy/single-server/scripts/init-migrated-user-passwords.sh
```

2. 本地新增说明文档：

```text
/Users/liu/Documents/Codex/lianruan-crm-deploy-v3/docs/operations/V3迁移用户统一密码初始化脚本说明.md
```

3. 已在 HexHub「渠道CRM（新架构）」远端资产覆盖下载脚本到：

```text
/root/initpwd.sh
```

4. 已在远端执行只读预览：

```bash
bash initpwd.sh --dry-run
```

预览结果：

```text
PostgreSQL目标账号数：71
当前登录配置账号数：1
演练完成：不会写入数据库，不会修改配置，不会重启API。
```

5. 已停止本地临时下载服务，确认本机80端口无遗留监听。

## 待执行正式变更

正式变更会修改V3登录凭据，需在 HexHub 当前远端终端执行：

```bash
bash initpwd.sh --yes
```

脚本将自动完成：

1. 备份 `/opt/lianruan-crm-v3/config/v3.env`。
2. 调用 `/opt/lianruan-crm-v3/scripts/backup.sh` 做发布前本机备份。
3. 更新 PostgreSQL 表 `iam.password_credentials`。
4. 更新 `/opt/lianruan-crm-v3/config/v3.env` 中的 `V3_DELIVERY_AUTH_USERS_JSON`。
5. 重启 `api-1` 和 `api-2`。
6. 执行健康检查。

## 执行后验收项

正式执行完成后应确认：

1. 脚本输出 `迁移用户密码初始化完成`。
2. 脚本输出 `初始化账号数：71`。
3. 脚本输出 `登录配置账号数：72`，即原管理员账号加71个迁移账号。
4. 健康检查通过。
5. `admin / LrCRM@2026!` 可以登录。
6. 任意一个V2迁移账号可以使用 `LrCRM@2026!` 登录。

## 风险与说明

1. 脚本只设置统一临时密码，不恢复V2旧密码。
2. 脚本默认只处理迁移账号，不处理停用账号。
3. 正式上线前建议要求迁移用户首次登录后修改密码。
4. 如需回退，可使用脚本输出的 `v3.env.*.password-init.bak` 恢复登录配置，并使用发布前备份恢复数据库。
