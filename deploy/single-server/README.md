# V3阶段9单机离线部署资产说明

本目录用于生成联软CRM V3阶段9离线安装包，目标环境为 openEuler x86_64 单机服务器，推荐安装目录为 `/opt/lianruan-crm-v3`，访问方式先使用 `http://服务器IP`。

## 1. 目录说明

| 路径 | 用途 |
| --- | --- |
| `docker/` | API、Worker、Nginx Web镜像构建文件 |
| `compose/docker-compose.yml` | 单机生产编排文件 |
| `config/` | 生产环境变量、Nginx和部署变量模板 |
| `scripts/` | 构建、导出、安装、启动、停止、迁移、健康检查、备份、回退和诊断脚本 |
| `images/` | 离线镜像目录 |
| `runtime/` | Docker和Docker Compose离线运行时目录 |
| `docs/` | 离线安装说明 |

## 2. 构建机执行

```bash
npm ci
npm run verify
deploy/single-server/scripts/download-runtime.sh
V3_IMAGE_TAG=3.0.0-stage9.20260727 deploy/single-server/scripts/build-images.sh
V3_IMAGE_TAG=3.0.0-stage9.20260727 V3_SKIP_PULL=1 deploy/single-server/scripts/save-images.sh
V3_IMAGE_TAG=3.0.0-stage9.20260727 V3_PACKAGE_FORMAT=zip deploy/single-server/scripts/package-offline.sh
```

生成物：

```text
tmp/phase7-package/lianruan-crm-v3-offline-3.0.0-stage9.20260727.zip
tmp/phase7-package/lianruan-crm-v3-offline-3.0.0-stage9.20260727.zip.sha256
```

## 3. 生产服务器执行

```bash
sha256sum -c lianruan-crm-v3-offline-3.0.0-stage9.20260727.zip.sha256
unzip lianruan-crm-v3-offline-3.0.0-stage9.20260727.zip
cd lianruan-crm-v3-offline-3.0.0-stage9.20260727
sudo SERVER_HOST=服务器IP ./scripts/install-all.sh
sudo /opt/lianruan-crm-v3/scripts/migrate-db.sh
sudo /opt/lianruan-crm-v3/scripts/health-check.sh
```

默认验收账号：

```text
admin / LrCRM@2026!
```

## 4. 边界

- 阶段9只迁移V2已有业务能力，不新增公海池等后续功能。
- 当前无域名证书时先使用HTTP加服务器IP；正式上线前必须补HTTPS。
- 暂不启用异机备份，但保留 `BACKUP_REMOTE_ENABLED` 和 `BACKUP_REMOTE_TARGET` 配置位。
- V2密码和OpenAPI旧密钥不恢复，正式上线前需要初始化密码和重新签发密钥。
