# 联软 CRM V3 KB-20260804-005 升级包

## 一、用途

修复企业管理员看不到所属企业客户、商机、报价、订单的问题，并新增所有账号联系电话全局唯一校验和创建企业管理员时的渠道商检索。

## 二、适用版本

- 最低建议版本：3.0.0-stage9.26.20260803-kb004
- 目标版本：3.0.0-stage9.27.20260804-kb005
- 适用环境：openEuler x86_64，V3 单机 Docker Compose 部署

## 三、上传解压

```bash
cd /tmp
sha256sum -c lianruan-crm-v3-kb-20260804-005-partner-admin-phone-unique-fix.zip.sha256
unzip -q lianruan-crm-v3-kb-20260804-005-partner-admin-phone-unique-fix.zip
cd lianruan-crm-v3-kb-20260804-005-partner-admin-phone-unique-fix
```

## 四、预检查

```bash
sudo bash scripts/precheck.sh /opt/lianruan-crm-v3
```

预检查会确认安装目录、镜像文件、校验和、磁盘空间、容器状态，并检查现有账号联系电话是否已有重复值。若已有重复联系电话，必须先清理重复账号后再升级。

## 五、执行升级

```bash
sudo bash scripts/upgrade.sh /opt/lianruan-crm-v3
```

升级日志会写入 `/opt/lianruan-crm-v3/logs/install`。脚本会自动生成升级前数据库、附件和配置备份。

## 六、验证

```bash
sudo bash scripts/verify.sh /opt/lianruan-crm-v3
```

## 七、回退

升级脚本会输出应用配置快照目录。按输出执行：

```bash
sudo bash scripts/rollback.sh /opt/lianruan-crm-v3 快照目录
```

本次升级会新增数据库唯一索引。回退脚本默认只恢复应用配置和镜像引用；如确需撤销数据库唯一索引，必须先确认业务允许联系电话重复，再由数据库管理员人工处理。
