# 取消订单提示 [object Object] 修复 修改方案

> 由 hgrill-bug 访谈自动生成，来源：docs/tasks/order-cancel-error-message-fix/docs/DECISION-LOG.md。术语沿用仓库既有文档与代码用语（仓库暂无 docs/CONTEXT.md，见「补充说明」）。

## Problem Statement（问题陈述）

生产环境（旧 UI，`apps/web/public` 静态入口）点击订单"取消订单"时，弹窗提示 `操作失败：[object Object]`，用户无法看到真实失败原因。

复现路径：桌面端管理员/渠道页面在订单列表执行"取消订单" → 公共请求层把结构化错误体 `{success:false,error:{code,message,details}}` 原样返回 → 页面用 `'操作失败：' + result.error` 直接拼接对象 → 显示 `[object Object]`。

真实失败背景：2026-10-10 生产发生两次 401 会话授权变更（`V3_AUTH_AUTHORIZATION_CHANGED`）拦截，订单状态未变更；2026-10-12 生产已无该错误。本次要修的是**全站同类错误提示不可读**的问题，不是订单业务规则。

期望行为：提示后端返回的可读中文消息（如"账号授权已发生变化，请重新登录。"），并在会话失效时回到登录页。

## Solution（解决方案）

1. 旧 UI 公共请求层新增统一的"错误提示取消息函数"，兼容字符串、`Error`、`{error:{code,message}}`、`{message}` 等结构，避免 `[object Object]`，并对外暴露供各页面脚本复用。
2. 管理员页、渠道页所有把 `result.error / res.error` 直接拼接显示的调用点，全量替换为统一函数；消息中心错误提取复用同一函数。
3. 旧 UI 公共请求层统一识别 401（排除登录/单点登录接口）：派发会话失效事件；管理员页收到后清理登录态并回到登录页，渠道页收到后清理登录态并跳转统一登录入口。
4. 重构 UI 的接口请求层提取后端 `error.message`，缺失时回退到状态码文案；不改路由与页面。
5. 交付为标准 V3 升级包（KB-LAYER）：包内携带完整 Web 编译产物与差量 Dockerfile，服务器离线构建新 nginx 镜像并只重启 nginx。

## 涉及模块（Implementation Impact）

- 数据层：无 schema 变更、无数据迁移。
- 接口层：无契约变更；不改后端错误体格式；不改 V2 兼容接口。
- 前端（旧 UI）：公共请求层、管理员页面脚本、渠道页面脚本、消息中心脚本的错误提示与会话失效处理。
- 前端（重构 UI）：接口请求层错误消息提取（生产不上线重构 UI 业务页面，仅随包更新构建产物）。
- 部署：KB-LAYER 升级包（完整 Web 产物 + 差量 Dockerfile + 元数据/自检/回滚脚本），只替换 nginx 镜像层。

## Compatibility（兼容性分析）

- 存量数据：无影响。
- 存量调用方：接口契约不变；旧 UI 页面 URL 不变。
- 第三方对接：无影响。
- 浏览器缓存：生产 Nginx 对非 `/assets/` 路径统一 `no-store`（已与仓库配置逐字节核对），无需修改 HTML 内 `?v=` 版本号。
- 镜像标签：源镜像标签不被覆盖，旧镜像保留，支持一键回滚；未重启的 api/worker/mcp 容器镜像内容不变（脚本在服务器本地补打目标版本标签，保持 compose 单变量一致）。

## Acceptance Criteria（验收标准）

- [ ] 复现用例通过：结构化错误体不再显示 `[object Object]`，显示后端中文消息；无消息时显示可读兜底文案。
- [ ] 401 用例通过：登录接口自身 401 不触发会话失效处理；业务接口 401 触发会话失效事件并回到登录页。
- [ ] 旧 UI 全量替换完成：管理员页、渠道页不再存在 `+ (result.error || ...)` 类拼接写法（静态守卫测试通过）。
- [ ] 重构 UI 用例通过：非 OK 响应优先展示后端 `error.message`，缺失时回退 `接口请求失败：{status}`。
- [ ] 本地构建与生产基线逐文件比对：除本次改动文件外零差异。
- [ ] 本地门禁通过：`npm run check`、`npm test`、`npm run build` 与 `node --check` 旧 UI 脚本。
- [ ] 升级包自检通过：外层 `.zip.sha256`、包内 `manifest/SHA256SUMS`、全部脚本 `bash -n`、元数据可被 bash 读取。
- [ ] 生产升级后：nginx 容器镜像为目标版本且层继承基线；`/health/live`、`/health/ready` 返回成功 JSON；`/`、`/login`、`/admin.html`、`/partner.html` 可访问；页面动态引用的脚本为升级后新资源；升级前旧哈希资源返回 404；api/worker/mcp 容器未重启、镜像内容与升级前一致；升级后错误日志无新增异常。

## Regression Scope（回归范围）

- 管理员旧页面：登录/会话恢复、订单列表与取消/发货/完成操作提示、报价单相关操作提示。
- 渠道旧页面：登录/退出、报备提交提示、报价转订单提示。
- 消息中心：错误提示保持可读。
- 重构 UI：入口、登录、单点登录流程的错误提示；SPA 构建产物可正常加载。
- 部署：nginx 健康检查、API 代理不受影响；api/worker 容器不受升级影响。

## Rollback Plan（回滚方案）

- 代码回滚：升级包自带 `rollback.sh`，恢复升级前 `compose/.env`、`config/deploy.env`、`config/v3.env` 快照并重建 nginx；源镜像标签未被覆盖，回退后立即恢复升级前静态产物。
- 数据回滚：无数据变更，无需数据回滚。
- 回滚验证：回滚后断言 nginx 容器镜像回到源版本、旧哈希资源可访问、新资源标记消失。

## Out of Scope（范围外）

- 不修改后端错误体格式与订单状态机；不修改 V2 兼容接口。
- 不上线重构 UI 业务页面（生产继续使用旧 UI 入口页面）。
- 不修改 Nginx 配置、不修改 Compose 文件、不修改数据库。
- 不引入新依赖、不做与本次无关的重构。
- 不在主工作区同步修改（该处含未发布功能，另行安排前移）。

## 待确认（Open Questions）

- 无（5 项决策已由用户"按推荐"确认，生产更新已获授权）。

## Further Notes（补充说明）

- 仓库暂无 `docs/CONTEXT.md` 与 `docs/adr/`：本次不新建仓库级文档，术语沿用代码既有用语；本任务决策记录在任务目录 `docs/DECISION-LOG.md`，必要时在主线统一补建。
- 生产基线核对结论：生产 `3.0.0-stage10.20260929-quotefix1` 的 Web 内容与 `regionfix-20260923` 工作区 `apps/web/dist` 48 个文件逐一哈希一致；本机在无改动状态下重跑 Web 构建产物与生产完全一致（可复现）。
- 参考文件清单（可能随代码演进过时）：旧 UI `apps/web/public/api-client.js`、`admin-app.js`、`partner-app.js`、`message-client.js`；重构 UI `apps/web/src/api/client.ts`；升级包落在 `tmp/kb-20261012-027-build/`。
