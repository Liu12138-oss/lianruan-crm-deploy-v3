# 任务单

## BAK-001：记录实际容器和镜像

- 状态：已完成
- 实现：在备份元数据中记录容器快照、运行容器、实际镜像引用和摘要，并生成 Compose 实际镜像覆盖文件。
- 验收：Worker 实际标签与 Compose 声明标签不一致时，清单明确标记“存在不一致”。

## BAK-002：无外网备份恢复

- 状态：已完成
- 实现：原机恢复使用 `docker start`；跨机器恢复使用覆盖文件和 `--pull never`；镜像在停止业务前导出。
- 验收：恢复日志中不存在无 `--pull never` 的 `docker compose up`；原容器存在时不执行 Compose 重建。

## BAK-003：兼容性与验证

- 状态：已完成
- 实现：保留 v1 备份校验与还原路径，新增离线恢复模拟测试和中文运维说明。
- 验收命令：
  - `bash -n deploy/single-server/scripts/system-backup-restore.sh`
  - `bash -n deploy/single-server/tests/系统全量备份离线恢复测试.sh`
  - `bash deploy/single-server/tests/系统全量备份离线恢复测试.sh`
  - `bash deploy/single-server/tests/数据库迁移顺序测试.sh`
  - `git diff --check`
