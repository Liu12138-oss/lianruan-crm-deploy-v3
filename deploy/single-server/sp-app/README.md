# 联软 CRM V3 SP-APP 升级包

本包用于把已部署的联软 CRM V3 从 `__SOURCE_VERSION__` 升级至 `__TARGET_VERSION__`。

本包按目标测试环境的真实混合基线制作：API 为 `__SOURCE_API_IMAGE__`，Worker 与消息 Worker 为 `__SOURCE_WORKER_IMAGE__`，Nginx 为 `__SOURCE_NGINX_IMAGE__`。预检查会同时核对镜像名称和实际摘要，其他环境不得强行执行。

执行前请确认已在维护窗口内，且当前服务器为已安装 Docker、Docker Compose、PostgreSQL 和 Redis 的 openEuler x86_64 环境。

```bash
sha256sum -c __PACKAGE_FILE__.sha256
unzip -q __PACKAGE_FILE__
cd __PACKAGE_NAME__
bash scripts/precheck.sh /opt/lianruan-crm-v3
bash scripts/upgrade.sh /opt/lianruan-crm-v3
```

升级脚本会备份数据库、上传文件、导出文件和应用配置，加载离线业务镜像，执行正向兼容迁移后自动停启应用服务。

若应用启动或验证失败，脚本会自动恢复升级前的 Compose、配置、脚本，以及 API、Worker、三个消息 Worker、Nginx 各自真实运行的镜像和摘要；不会自动恢复 PostgreSQL 备份。数据库扩展迁移将保留，以避免覆盖升级窗口内可能产生的数据。停用归档交接开启时禁止直接回退；账号状态防护已经开启而目标快照不具备同等防护时，回退脚本会拒绝执行，避免已停用账号旧会话恢复。

升级成功后可重复执行 `bash scripts/verify.sh /opt/lianruan-crm-v3`，也可执行 `bash tests/smoke.sh` 复核业务入口。手工回退必须使用升级日志输出的应用快照目录。
