# 取消订单提示 [object Object] 修复 修改步骤

> 由 hgrill-bug 自动生成，来源：DESIGN.md。按依赖顺序编号，编号越小越先做。

## 01 — 旧 UI 统一取消息函数与会话失效收口

**要做什么：** 旧 UI 公共请求层新增统一取消息函数（兼容字符串、Error、结构化 error 对象，杜绝 `[object Object]`）并对外暴露；业务接口 401 时派发会话失效事件（登录/单点登录接口除外）；消息中心错误提取复用同一函数。用户视角：任何调用点都能拿到可读中文消息；会话失效可被页面统一感知。

**阻塞于：** 无 — 可立即开始

**状态：** 已完成

- [x] 单元测试覆盖：结构化错误对象、字符串、Error、`[object Object]`、空值兜底的取消息行为（`apps/web/tests/api-client-error-message.test.ts`）
- [x] 单元测试覆盖：业务接口 401 派发会话失效事件；登录接口 401 不派发（同上用例集）
- [x] `node --check` 通过，旧 UI 其余脚本加载顺序与既有用法不受影响

## 02 — 管理员/渠道旧页面错误提示全量替换

**要做什么：** 管理员页与渠道页所有把 `result.error / res.error` 直接拼接显示的调用点，全量替换为统一取消息函数；两个页面监听会话失效事件，分别清理登录态并回到登录页（管理员页沿用页内登录路由，渠道页沿用统一登录入口）。用户视角：取消订单等操作失败时显示真实原因；会话失效时直接回登录页。

**阻塞于：** 01

**状态：** 已完成

- [x] 静态守卫测试：两个页面脚本不再存在 `+ (result.error || ...)` / `+ (res.error || ...)` 类拼接写法（`legacy-ui-error-message-guard.test.ts`；admin 92 处、partner 30 处已全量替换）
- [x] `node --check` 通过；页面加载顺序与既有变量作用域不受影响
- [x] 既有 Web 单测全绿（`npm --workspace @lianruan/web run test`，14 文件 132 用例全部通过）

## 03 — 重构 UI 接口请求层错误消息提取

**要做什么：** 重构 UI 接口请求层在非 OK 响应时优先提取后端 `error.message`（兼容字符串 error），缺失时回退 `接口请求失败：{status}`；不改路由与页面。用户视角：重构 UI 的接口错误提示与后端消息一致。

**阻塞于：** 无 — 可立即开始

**状态：** 已完成

- [x] 单元测试覆盖：结构化 `error.message`、字符串 error、无消息回退状态码文案（`refactor-ui-error-message.test.ts`）
- [x] `npm --workspace @lianruan/web run check`（vue-tsc）通过；`apps/web/dist` 的 `assets/*` 无变化（构建产物比对确认）

## 04 — 本地全面验证与生产基线零差异比对

**要做什么：** 执行仓库门禁与构建，并把新构建产物与生产基线逐文件哈希比对，确认除本次改动文件外零差异。

**阻塞于：** 01、02、03

**状态：** 已完成（含基线遗留说明）

- [x] `node --check` 覆盖本次改动的全部旧 UI 脚本
- [x] Web 工作区门禁全绿：`npm --workspace @lianruan/web run check`、`run test`（132 用例）、eslint、prettier
- [x] `npm run build` 成功；`apps/web/dist`（48 文件）与生产 nginx 容器实际内容（49 文件，含基础镜像自带 `50x.html`）逐文件比对：仅 6 个预期文件内容变化（`admin-app.js`、`partner-app.js`、`api-client.js`、`message-client.js`、`mobile-v2-api.js`、`partner-level-module.js`），`assets/*` 全部未变
- [!] 基线遗留（与本任务无关，未修改）：仓库级 `npm run check` 有 4 个 eslint 报错（`packages/shared/src/index.ts`、`packages/shared/tests/shared.test.ts`，来自基线未提交的 quotefix1 改动）；`npm test` 仅 `tests/v2-compat.test.ts` 1 个用例失败（S10_025 唯一约束迁移与旧测试断言不一致，属基线状态）

## 05 — KB-IMAGE 升级包制作与包体自检

**要做什么：** 生成 `KB-20261012-027` 升级包（包型 KB-IMAGE：完整 nginx 镜像，符合《V3_SP与KB离线升级包分级规则》第十二章；第3轮决策由 KB-LAYER 改为 KB-IMAGE）；元数据、预检/升级/复核/回退脚本与冒烟脚本；完成外层与包内全部本地等价校验，并从最终 ZIP 独立解压后重跑完整演练。

**阻塞于：** 04

**状态：** 已完成

- [x] 元数据字段齐全且可被 bash 读取（源版本、源镜像 ID、目标版本、受影响服务；`KB元数据.env` 与 `构建与验证证据.env` 均已实测可 source）
- [x] 全部脚本 `bash -n` 通过；精确扫描确认无非 ASCII 变量名（命中项均为 `${var:-默认值}`/位置参数等语法构造，非变量名）
- [x] 包内 `manifest/SHA256SUMS` 校验通过（12 项全部 OK）；外层 `.zip.sha256` 校验通过（`7d0c5b4b…`）
- [x] 自检脚本从页面动态读取资源路径（`admin.html`/`index.html` 动态解析，不写死 Vite 哈希文件名）
- [x] 预检/升级/回退脚本对源镜像 ID、层继承、旧镜像保留的断言与真实设计一致
- [x] 独立目录解压复验：`unzip -t`、实际解压、包内校验、脚本语法、元数据读取、禁用依赖与明文密钥扫描全部通过
- [x] 从**最终 ZIP 解压目录**完成运行级演练：预检查 → 升级 → 复核 → 冒烟 → 瞬时 502 重试 → HTML 假健康拦截 → 失败回退 → 再次升级 → 再次复核，全部通过（证据见 `evidence/`）

## 06 — 生产升级执行与升级后全面核对

**要做什么：** 将升级包上传生产，执行预检、升级、复核、冒烟，并核对容器、版本、接口、日志与业务页面；保留回滚能力。

**阻塞于：** 05

**状态：** 已完成（2026-10-12 10:09 CST 生产升级完成）

- [x] 生产上传包 SHA256 与本地一致（`f0b3432b…`，生产侧 `sha256sum -c` 成功）
- [x] 预检通过（源版本、源镜像 ID、包体完整性、磁盘空间；含 Compose 引用只读预演）
- [x] 升级后 nginx 目标镜像层继承基线（前 8 个基础层逐层一致）；`/health/live`、`/health/ready` 成功
- [x] `/`、`/login`、`/admin.html`、`/partner.html`、`/admin-mobile.html`、`/partner-mobile.html` 全部 200；`admin.html` 动态引用仍为 `admin-app.js?v=167`
- [x] api/worker/mcp 容器未重启（启动时间与升级前完全一致）且镜像内容不变；nginx 错误日志无新增异常、当日访问日志无 5xx
- [x] 输出升级前后证据与回滚方式说明（见 `交付记录.md` 与 `evidence/`）
- [x] 升级过程拦截并修正 2 个真实包脚本缺陷（Compose profiles 渲染、目标镜像 ID 比对），修正后从最终 ZIP 重跑完整演练
