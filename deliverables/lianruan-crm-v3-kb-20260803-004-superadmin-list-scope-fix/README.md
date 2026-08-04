# 联软 CRM V3 KB-20260803-004 升级包

## 一、用途

修复超管登录后区域管理员、超管、企业管理员、渠道商、订单、报价等列表被错误筛空的问题。

## 二、适用版本

- 最低建议版本：3.0.0-stage9.25.20260803-kb003
- 目标版本：3.0.0-stage9.26.20260803-kb004
- 适用环境：openEuler x86_64，V3 单机 Docker Compose 部署

## 三、上传解压

```bash
cd /tmp
sha256sum -c lianruan-crm-v3-kb-20260803-004-superadmin-list-scope-fix.zip.sha256
unzip -q lianruan-crm-v3-kb-20260803-004-superadmin-list-scope-fix.zip
cd lianruan-crm-v3-kb-20260803-004-superadmin-list-scope-fix
```

## 四、预检查

```bash
sudo bash scripts/precheck.sh /opt/lianruan-crm-v3
```

## 五、执行升级

```bash
sudo bash scripts/upgrade.sh /opt/lianruan-crm-v3
```

## 六、验证

```bash
sudo bash scripts/verify.sh /opt/lianruan-crm-v3
```

## 七、回退

升级脚本会输出配置快照目录。按输出执行：

```bash
sudo bash scripts/rollback.sh /opt/lianruan-crm-v3 快照目录
```

本次升级不变更数据库。回退脚本恢复应用配置和镜像引用。
