# 阶段9离线运行时目录

本目录用于放置欧拉 Linux x86_64 测试服务器离线安装 Docker 和 Docker Compose 所需的运行时文件。

默认版本：

| 组件 | 版本 | 文件 |
| --- | --- | --- |
| Docker静态运行时 | 27.5.1 | `docker/docker-27.5.1.tgz` |
| Docker Compose插件 | v2.32.4 | `compose/docker-compose-linux-x86_64-v2.32.4` |

生成方式：

```bash
deploy/single-server/scripts/download-runtime.sh
```

生成后应出现：

```text
runtime/
├── docker/docker-27.5.1.tgz
├── docker-bin/docker/
├── compose/docker-compose-linux-x86_64-v2.32.4
└── sha256sum.txt
```

说明：

- 运行时大文件不进入代码仓库。
- 最终离线安装包会包含本目录下的运行时文件。
- `docker-bin/docker/` 是从 `docker-27.5.1.tgz` 预解压出的Docker二进制目录，用于适配缺少 `tar` 命令的欧拉最小化服务器。
- 当前阶段9目标架构为 `linux/x86_64`，不覆盖 ARM 欧拉。
