# 统一入口与旧入口重定向实施说明（r12）

实施日期：2026-09-24

测试环境：`http://10.9.86.66`

本轮镜像：`lianruan-crm-v3-nginx:3.0.0-stage10.20260924-unifiedentry1`

上一版本镜像：`lianruan-crm-v3-nginx:3.0.0-stage10.20260923-uirefactor11`

生产环境 `10.20.3.10` 未连接、未部署、未修改。

## 1. 统一入口设计

站点根路径 `/` 是唯一对外入口，由 V3 登录态、账号权限和访问设备共同决定落点：

| 场景 | 落点 |
| --- | --- |
| 未登录 | `/login` |
| 管理员账号（桌面端） | `/admin` |
| 渠道账号（桌面端） | `/partner` |
| 移动端一期 | `/admin-mobile.html`、`/partner-mobile.html` |
| 携带安全 `redirect` 参数 | 仅在当前账号允许范围内跳转 |

旧桌面入口不再作为业务落点，一律 301 重定向：

| 旧入口 | 重定向目标 |
| --- | --- |
| `/login.html` | `/login` |
| `/admin.html` | `/admin` |
| `/partner.html` | `/partner` |

浏览器重定向时会继承原 URL 的 fragment，`entry-target.ts` 已支持把 `/admin.html#/partners` 这类旧哈希深链转换成 `/admin/partners`。

## 2. 本轮改动

| 文件 | 改动 |
| --- | --- |
| `deploy/single-server/config/nginx/default.conf` | 新增 `/login.html`、`/admin.html`、`/partner.html` 三个精确匹配 301 重定向 |
| `apps/web/src/pages/admin/platform-admin/OrganizationWorkspacePage.vue` | 「返回管理工作台」链接由 `/admin.html` 改为 `/admin` |
| `AGENTS.md` | 统一入口规则同步为 `/admin`、`/partner`，并登记旧入口 301 规则 |

测试环境同步动作：更新 `/opt/lianruan-crm-v3/config/nginx/default.conf`（备份为 `default.conf.bak-before-unified-entry`），`nginx -t` 通过后热加载，再重建 Nginx 容器发布 r12。

## 3. 验证证据

### 3.1 HTTP 重定向

```text
/admin.html    HTTP/1.1 301 Moved Permanently  Location: http://10.9.86.66/admin
/partner.html  HTTP/1.1 301 Moved Permanently  Location: http://10.9.86.66/partner
/login.html    HTTP/1.1 301 Moved Permanently  Location: http://10.9.86.66/login
/admin         HTTP/1.1 200 OK
/partner       HTTP/1.1 200 OK
/login         HTTP/1.1 200 OK
/              HTTP/1.1 200 OK
```

### 3.2 浏览器端到端

| 场景 | 结果 |
| --- | --- |
| 超管打开 `/admin.html` | 跳转到 `/login?redirect=/admin`，登录后落到 `/admin` |
| 渠道打开 `/partner.html` | 跳转到 `/login?redirect=/partner`，登录后落到 `/partner` |
| 打开 `/login.html` | 跳转到 `/login` |
| 三个角色打开工作台 | 超管 `/admin`、区管 `/admin`、渠道 `/partner` 工作台均正常渲染 |

### 3.3 构建与健康

| 项目 | 结果 |
| --- | --- |
| `npm --workspace @lianruan/web run check` | 通过 |
| `npm --workspace @lianruan/web run test` | 22 个文件、130 项通过 |
| `npm --workspace @lianruan/web run build` | 通过，资源 `index-zD-E7k_T.js` |
| 线上资源与本地构建 | 一致 |
| `/health/live` | 200 |
| Nginx 容器 | healthy |

## 4. 回滚

```bash
cd /opt/lianruan-crm-v3
# 还原 nginx 配置
cp config/nginx/default.conf.bak-before-unified-entry config/nginx/default.conf
# 还原镜像标签
sed -i 's/^V3_IMAGE_TAG=.*/V3_IMAGE_TAG=3.0.0-stage10.20260923-uirefactor11/' compose/.env
docker compose --env-file compose/.env -f compose/docker-compose.yml up -d --no-deps --force-recreate nginx
```

`.env` 变更前备份：`/opt/lianruan-crm-v3/compose/.env.bak-before-unifiedentry`。

## 5. 待确认事项：升级包自检脚本

以下升级包自检脚本仍按「`/admin.html` 返回旧版 admin-app.js 页面」设计断言，与统一入口冲突，会在下次制作/部署 SP 升级包时报「正式 admin.html 未找到带版本号的 admin-app.js」：

- `deploy/single-server/sp-app/tests/smoke.sh`（第 39-76 行）
- `deploy/single-server/sp-app/tests/smoke-sp-full.sh`（第 39-60 行）
- `deploy/single-server/sp-app/scripts/verify.sh`（第 305-350 行）
- `deploy/single-server/scripts/package-sp-full.sh`（第 140-200 行，校验 `admin.html` 内的 `admin-app.js`/`style.css` 引用）

处理建议：把这四处断言改成「旧入口 301 到 `/admin`，且 `/admin` 返回重构后 SPA」，并移除对 `admin-app.js` 内嵌组织架构、企业微信身份映射等旧页面内容的断言。该改动影响发布包验证流程，需项目负责人确认后执行。
