# 联软 CRM V3 KB-20260803-003 升级包

## 一、用途

修复渠道员工数据越权、商机缺少渠道指派、既往客户无法检索回填、退出登录落点不统一等问题。

## 二、适用版本

- 最低建议版本：3.0.0-stage9.24.20260803-kb002
- 目标版本：3.0.0-stage9.25.20260803-kb003
- 适用环境：openEuler x86_64，V3 单机 Docker Compose 部署

## 三、上传解压

```bash
cd /tmp
sha256sum -c lianruan-crm-v3-kb-20260803-003-channel-scope-opportunity-known-customer-fix.zip.sha256
unzip -q lianruan-crm-v3-kb-20260803-003-channel-scope-opportunity-known-customer-fix.zip
cd lianruan-crm-v3-kb-20260803-003-channel-scope-opportunity-known-customer-fix
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

数据库不自动回滚。如需恢复数据库，必须使用升级前备份并经负责人确认。
