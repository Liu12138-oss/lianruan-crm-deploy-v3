# 阶段7单机离线部署资产说明

本目录用于交付V3阶段7首版单机部署资产，目标环境为欧拉 Linux x86服务器，安装目录为 `/opt/lianruan-crm-v3`，访问方式先使用服务器IP，镜像交付方式为离线镜像安装包。

## 目录说明

| 路径 | 用途 |
| --- | --- |
| `docker/` | API、Worker、Nginx Web镜像构建文件 |
| `compose/docker-compose.yml` | 单机生产候选编排文件 |
| `config/` | 生产环境变量、Nginx和部署变量模板 |
| `scripts/` | 构建、导出、安装、启动、停止、健康检查、备份和回退脚本 |
| `images/` | 离线镜像包目录，实际 `.tar` 文件不进入代码仓库 |

## 推荐执行顺序

构建机执行：

```bash
deploy/single-server/scripts/build-images.sh
deploy/single-server/scripts/save-images.sh
deploy/single-server/scripts/package-offline.sh
```

生产服务器执行：

```bash
sudo ./scripts/install.sh
sudo ./scripts/start.sh
./scripts/health-check.sh
```

## 当前边界

- 当前阶段只交付部署底座，不执行V2正式数据迁移。
- 当前阶段不新增业务功能，不切换正式用户。
- 暂无域名和证书时先使用HTTP加服务器IP访问；正式上线前必须补HTTPS。
- 暂不启用异机备份，但保留 `BACKUP_REMOTE_ENABLED` 和 `BACKUP_REMOTE_TARGET` 配置位。
- 真实密钥不进入仓库，使用 `generate-secrets.sh` 在目标服务器生成或写入。
