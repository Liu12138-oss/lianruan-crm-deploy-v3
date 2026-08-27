# 联软 CRM V3 SP-FULL 离线全量安装包

本包为 V3 离线全量服务包，目标版本：`__TARGET_VERSION__`。

## 包型

- 包编号：`__PACKAGE_ID__`
- 包族：`SP`
- 包型：`SP-FULL`
- 源版本：`none`（全新安装模式）；升级模式仅接受已识别的 V3 安装目录和数据库迁移谱系。
- 目标版本：`__TARGET_VERSION__`

## 适用范围

- 完全内网、无外网访问权限的 openEuler x86_64 单机服务器。
- 已有 V3 部署的服务器升级到 `__TARGET_VERSION__`。预检查会校验安装标识、运行环境和已执行迁移的文件与摘要；未知或校验不一致的历史环境会停止，不会覆盖业务数据。
- 全新服务器首次安装。

## 使用步骤

### 1. 上传并校验

```bash
sha256sum -c __PACKAGE_FILE__.sha256
unzip -q __PACKAGE_FILE__
cd __PACKAGE_NAME__
```

### 2. 预检查

```bash
sudo bash scripts/precheck-sp-full.sh /opt/lianruan-crm-v3
```

### 3. 升级或全新安装

同一入口会自动识别已有 V3 部署或全新服务器：

```bash
sudo bash scripts/upgrade-sp-full.sh /opt/lianruan-crm-v3
```

### 4. 复核与冒烟

```bash
sudo bash scripts/verify-sp-full.sh /opt/lianruan-crm-v3
bash tests/smoke-sp-full.sh http://127.0.0.1
```

## 数据与配置保护

- 升级模式保留 `/opt/lianruan-crm-v3/config/v3.env`、`config/deploy.env`、`compose/.env`、`secrets/`、`data/uploads`、`data/exports` 与 PostgreSQL 业务数据。
- 升级前自动执行 PostgreSQL `pg_dump` 与上传/导出文件 ZIP 备份，并保存升级前应用快照（Compose、配置、脚本、各组件真实镜像与摘要）。
- 数据库迁移只执行正向兼容迁移，`migration.schema_migrations` 已记录的迁移自动跳过。
- 应用切换后的失败会自动恢复升级前应用文件与镜像引用；数据库恢复必须由负责人确认后人工执行。

__PACKAGE_NOTE__

## 压缩与解压约束

- 外层包仅使用 ZIP，提供同名 `.zip.sha256`。
- 包内提供 `manifest/SHA256SUMS` 与 `manifest/文件清单.tsv`。
- 镜像归档统一使用 `.docker-image`，通过 `docker load -i` 加载。
- 包内不包含 TAR、GZIP、7Z、RAR 等格式。
