# SP-FULL 变更说明

- 包编号：`__PACKAGE_ID__`
- 包型：`SP-FULL`
- 源版本：`none`
- 目标版本：`__TARGET_VERSION__`

本次交付为 V3 离线全量服务包，包含：

- API、Worker、Nginx 三类业务镜像与 PostgreSQL 16.4、Redis 7.2.5 基础镜像。
- 离线 Docker 与 Docker Compose 运行时（x86_64）。
- 全部数据库正向迁移（S2/S8/S9/S10/M01~M06 等）。
- Compose、Nginx、配置模板与运维脚本。
- SP-FULL 专用预检查、升级、验证、回退与冒烟脚本。

支持从任意已部署版本升级，也支持全新服务器安装。升级保留既有配置与业务数据；数据库迁移为正向兼容扩展，已执行迁移自动跳过。

组织架构写入、目录同步、消息自动投递等能力默认关闭，须按功能门禁分阶段启用。

__PACKAGE_NOTE__
