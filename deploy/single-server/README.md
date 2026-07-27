# 阶段7单机离线部署资产说明

本目录用于交付V3阶段7首版单机部署资产，目标环境为欧拉 Linux x86服务器，安装目录为 `/opt/lianruan-crm-v3`，访问方式先使用服务器IP，镜像交付方式为ZIP离线镜像安装包。

## 目录说明

| 路径 | 用途 |
| --- | --- |
| `docker/` | API、Worker、Nginx Web镜像构建文件 |
| `compose/docker-compose.yml` | 单机生产候选编排文件 |
| `config/` | 生产环境变量、Nginx和部署变量模板 |
| `scripts/` | 构建、导出、安装、启动、停止、健康检查、备份和回退脚本 |
| `images/` | 离线镜像包目录，实际 `.tar` 文件不进入代码仓库 |
| `runtime/` | 阶段7.1 Docker和Docker Compose离线运行时目录，实际运行时大文件不进入代码仓库 |

## 推荐执行顺序

构建机执行：

```bash
deploy/single-server/scripts/download-runtime.sh
deploy/single-server/scripts/build-images.sh
deploy/single-server/scripts/save-images.sh
deploy/single-server/scripts/package-offline.sh
```

如构建机无法访问Docker Hub，可指定等价镜像源后构建，导出的离线包内镜像名仍保持生产编排需要的标准名称：

```bash
V3_NODE_IMAGE=public.ecr.aws/docker/library/node:22.13.1-bookworm-slim \
V3_NGINX_IMAGE=public.ecr.aws/docker/library/nginx:1.27-alpine \
deploy/single-server/scripts/build-images.sh

V3_POSTGRES_IMAGE_SOURCE=public.ecr.aws/docker/library/postgres:16.4-alpine \
V3_REDIS_IMAGE_SOURCE=public.ecr.aws/docker/library/redis:7.2.5-alpine \
deploy/single-server/scripts/save-images.sh

deploy/single-server/scripts/package-offline.sh
```

如果基础服务镜像已经由内网仓库、镜像缓存或人工方式准备为标准标签，可跳过拉取直接导出：

```bash
V3_SKIP_PULL=1 deploy/single-server/scripts/save-images.sh
```

跨平台构建机如遇旧Docker构建器无法处理Nginx多架构镜像，`build-images.sh` 会默认启用Web镜像应急构建；如需强制标准Dockerfile构建，可设置 `V3_WEB_FALLBACK_ENABLED=0`。

生产服务器执行：

```bash
sha256sum -c lianruan-crm-v3-offline-版本号.zip.sha256
unzip lianruan-crm-v3-offline-版本号.zip
cd lianruan-crm-v3-offline-版本号
sudo SERVER_HOST=服务器IP ./scripts/install-all.sh
sudo /opt/lianruan-crm-v3/scripts/health-check.sh
```

## 当前边界

- 当前阶段只交付部署底座，不执行V2正式数据迁移。
- 当前阶段不新增业务功能，不切换正式用户。
- 暂无域名和证书时先使用HTTP加服务器IP访问；正式上线前必须补HTTPS。
- 暂不启用异机备份，但保留 `BACKUP_REMOTE_ENABLED` 和 `BACKUP_REMOTE_TARGET` 配置位。
- 真实密钥不进入仓库，使用 `generate-secrets.sh` 在目标服务器生成或写入。
- 阶段7.1默认使用Docker官方静态运行时和Compose插件二进制，适合无Docker测试服务器离线验证；正式生产如要求RPM审计闭包，需要按欧拉具体版本补充RPM包。
- 重复执行安装时不会覆盖既有 `docker-compose.yml`、Nginx配置、部署变量和 `v3.env`，新模板会保留为 `.new` 文件或 `nginx.new` 目录。
