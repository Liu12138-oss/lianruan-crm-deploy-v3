# order-cancel-error-message-fix 决策日志

> 本文件按时间顺序追加，绝不重写。任务产物目录：docs/tasks/order-cancel-error-message-fix/

## 2026-10-12 — Preflight 预检（五域）

### 1️⃣ 现象域

- **bug 现象**：生产环境（10.20.3.10，旧 UI，重构 UI 未上线）点击订单"取消订单"，弹窗提示 `操作失败：[object Object]`，未显示真实失败原因。
- **期望行为**：提示后端返回的可读中文消息（本次真实原因是 401 会话授权变更："账号授权已发生变化，请重新登录。"）；而不是 `[object Object]`。
- **复现步骤**：旧 UI（admin.html / partner.html）订单列表执行"取消订单" → 请求 `PUT /api/v2/orders/{id}/status` → 后端返回结构化错误体 `{success:false,error:{code,message,details}}` → 前端 `'操作失败：' + result.error` 把对象直接拼字符串。2026-10-10 15:46（北京时间）生产真实发生过两次（均为 401 `V3_AUTH_AUTHORIZATION_CHANGED`）；2026-10-12 生产已无该错误，复现需本地/单测构造结构化错误响应。
- **影响范围**：旧 UI 全部走 `apps/web/public/api-client.js` 的调用点。`admin-app.js` 约 53 处、`partner-app.js` 约 28 处把 `result.error / res.error` 直接拼接显示；`message-client.js` 的对象型错误会退化为兜底文案。重构 UI（`apps/web/src`）不会出现 `[object Object]`，但 `client.ts` 未提取后端 `error.message`（只显示 `接口请求失败：{status}`），属于同类共性问题。
- **严重程度**：中（提示不可读、误导用户；订单未真正变更，业务本身未损坏）。
- **引入时机**：长期存在。后端错误体由字符串升级为结构化对象后暴露，属存量共性问题，非近期改动引入。

### 2️⃣ 技术域

- **涉及模块**：前端（旧 UI：`apps/web/public/api-client.js`、`admin-app.js`、`partner-app.js`、`message-client.js`；重构 UI：`apps/web/src/api/client.ts`）+ 单测。
- **不改数据库、不改接口契约、不改订单状态机**；"取消订单"业务规则原本合法（后端对 `cancelled` 无条件放行），本次失败为会话失效，不是业务规则问题。
- **兼容性**：只影响错误提示文本与会话失效跳转行为；接口契约与存量调用方不变。

### 3️⃣ 环境域

- **生产**：`root@10.20.3.10`，安装目录 `/opt/lianruan-crm-v3`。Docker 27.5.1、Compose v2.32.4。当前版本 `3.0.0-stage10.20260929-quotefix1`（2026-09-29 上线）。
- **生产基线镜像**：nginx `sha256:3ae5663d9d7d1f19c5e3b2903de7c65a9ed38e754267d92defbc56df8a101146`；api `sha256:cd1387412324aca23282e7f314c70c54f4c13a5c0e5209156246fef872a0f658`；worker `sha256:bebda51ff8c0…`（以升级前只读核对为准）。
- **基线工作区**：`/Users/liu/Documents/Codex/lianruan-crm-deploy-v3-regionfix-20260923`（分支 `codex/region-price-profit-oa-20260923`，HEAD `bab11f6` + 未提交的 quotefix1 改动）。已只读核对：该工作区 `apps/web/dist`（48 个文件）与生产 nginx 容器 `/usr/share/nginx/html` 逐字节哈希一致（生产多一个基础镜像自带的 `50x.html`）。
- **版本分叉事实**：主工作区 `/Users/liu/Documents/Codex/lianruan-crm-deploy-v3`（cwd）比生产基线多 5 个提交之外的未发布改动（`admin-app.js` 等含"消息中心"等未上线功能），不能直接用于本次生产出包。
- **测试环境**：`10.9.86.66`（本次无后端改动，按需使用）。
- **本机构建**：Node v22.13.1（与 `V3_NODE_IMAGE=node:22.13.1-bookworm-slim` 一致）；本机 Docker daemon 未运行（KB-LAYER 差量镜像由服务器离线构建，不依赖本机 Docker）。已实测：在基线工作区执行 `npm --workspace @lianruan/web run build`，产物与生产 dist 48 个文件逐一哈希一致（构建可复现）。
- **数据库**：无 schema 变更。
- **离线约束**：生产服务器完全离线，升级脚本禁止 `docker pull`/`npm`/联网命令；差量构建使用 `docker build --pull=false --network=none`，只允许 `COPY` 本地文件。

### 4️⃣ 验收与质量域（结合仓库既有门禁）

- **验收标准（待收录最终结论）**：复现用例通过（结构化错误体不再显示 `[object Object]`，显示后端中文消息）；订单取消等既有流程回归通过；升级包在服务器自检通过；`/health/live`、`/health/ready` 正常；`/`、`/login`、`/admin.html`、`/partner.html` 正常返回。
- **回归**：`npm run check`、`npm test`（web 工作区）、`node --check apps/web/public/*.js`，以及包内 `tests/smoke.sh` 生产等价自检。
- **单元测试**：新增旧 UI 取消息函数与 api-client 行为的单元测试（沿用 `apps/web/tests/mobile-app-error-message.test.ts` 方式）；新增重构 UI `client.ts` 错误提取测试。

### 5️⃣ 汇报域

- 结果按"变更文件、验证结果、风险与回退"整理；产物落在本任务目录；结尾统一汇报（含生产升级前后的可核对证据）。

## 2026-10-12 — 第1轮访谈（用户已定）

- 问了什么：修复方案取"前者/后者"、包型、技能获取方式、是否覆盖重构 UI、生产 UI 选择、影响面约束。
- 定了什么：
  1. 采用"统一收口错误提示取消息函数"方案（不只订单模块，全站类似写法一起修）。
  2. 走标准 V3 升级包（不热改生产静态文件）。
  3. 缺失技能自行查找并安装（已安装 hgrill-bug / hgrill-feature / hgrill）。
  4. 重构 UI 也要一并处理类似共性问题。
  5. 生产继续使用旧 UI（`apps/web/public`），不上线重构 UI。
  6. 不影响其他功能与业务。
- 否了什么：只修订单单点写法；热改生产静态文件；只改旧 UI、忽略重构 UI。
- 权衡了什么：统一收口会带来约 81 处机械替换（admin/partner 旧 UI），换取全站提示一致、不再出现 `[object Object]`。

## 2026-10-12 — 第2轮访谈（待用户确认，前沿问题）

- **Q1 基线工作区**：在 `regionfix-20260923` 工作区（= 生产基线）修复并出包；主工作区不动。
- **Q2 401 会话失效行为**：是否在显示真实消息之外，统一补 401 会话失效处理（清理本地会话并跳转 `/login`）。
- **Q3 版本与包号命名**：拟 `KB-20261012-027`、目标版本 `3.0.0-stage10.20261012-kb027`。
- **Q4 重构 UI 收口范围**：最小收口（公共取消息函数 + `client.ts` 使用）还是更大范围。
- **Q5 出包机制**：KB-LAYER（包内只带完整 `apps/web/dist` + 差量 Dockerfile，服务器离线构建新 nginx 镜像）及配套的镜像标签处理方式。

## 2026-10-12 — 第2轮访谈（用户全部"按推荐"确认）

- 问了什么：Q1 基线工作区、Q2 401 会话失效行为、Q3 版本与包号、Q4 重构 UI 收口范围、Q5 出包与镜像方式。
- 定了什么：
  1. 在 `regionfix-20260923` 工作区（生产基线）修复并出包；主工作区不动。
  2. 401 统一收口：显示后端消息 + 清理本地会话 + 回登录页。
  3. `KB-20261012-027`，目标版本 `3.0.0-stage10.20261012-kb027`。
  4. 重构 UI 最小收口：公共取消息函数 + `client.ts` 提取后端 `error.message`，不动路由/页面。
  5. KB-LAYER：包内带完整 `apps/web/dist` + 差量 Dockerfile，服务器离线构建新 nginx 镜像；只重启 nginx；api/worker/mcp 现有镜像本地补打目标版本标签（内容不变）。
- 否了什么：主工作区直接出包；只改提示不处理会话失效；本地构建完整镜像（KB-IMAGE）；重构 UI 大范围改造。
- 权衡了什么：为保持 compose `V3_IMAGE_TAG` 单变量一致性，接受"api/worker/mcp 容器不重启、镜像内容不变但补打目标标签"的过渡状态，并把它写入验收断言。
- 用户追加授权：完成后做全面检查，并更新生产。

## 2026-10-12 — 收尾检查

- **影响范围**：旧 UI（管理员/渠道桌面页）全部走公共请求层的错误提示；401 会话失效时的页面行为；消息中心错误提取；重构 UI 接口请求层的错误消息文本；升级包只替换 nginx 静态资源层。
- **回归风险**：81 处机械替换可能引入语法错误（用 node --check + 构建 + 单测兜底）；401 处理不得误伤登录接口本身（排除 `/auth/login`、`/sso/` 路径）；新 UI 错误文案变化（用单测 + 生产入口冒烟覆盖）；差量镜像必须完整继承基线层（用镜像层前缀校验）。
- **兼容性**：接口契约不变、后端不变、数据库不变；旧 UI 页面 URL 不变；浏览器缓存由 Nginx `no-store` 保证（生产配置已核对与仓库一致）。
- **回滚方案**：`rollback.sh` 恢复升级前 `compose/.env`、`config/deploy.env`、`config/v3.env` 快照并重建 nginx；源镜像标签未被覆盖，可直接回退；无数据变更。
- **验收标准**：见 DESIGN.md「验收标准」清单（本地单测 + 构建零差异比对 + 包体校验 + 生产自检 + 容器与日志核对）。
- **非目标**：不改后端错误体、不改 V2 兼容接口、不上线重构 UI 业务页面、不改 Nginx 配置、不动数据库、不引入新依赖、不动主工作区。
- **决策缺口**：无。

## 2026-10-12 — 第3轮：包型回归合规（用户选择"最安全"）

- 问什么：制包阶段发现《V3_SP与KB离线升级包分级规则》第十二章明确"在配套脚本和自动测试落地前，不得直接在生产使用手工制作的 KB-LAYER"。第2轮既定方案（KB-LAYER）与该规范冲突，需要用户在 A/B 两个方案中选择。
- 用户答复（原话）："我不太能理解，但是采用最安全的就行。"
- 定了什么（按"最安全"解释并执行）：
  - **A 方案 = KB-IMAGE**：包内携带**完整 nginx 镜像**（`lianruan-crm-v3-nginx:3.0.0-stage10.20261012-kb027`），服务器 `docker load` 后只重建 nginx。
  - 合规性：KB-IMAGE 是第十二章明确允许的"已验证的完整镜像 KB"，不存在手工 KB-LAYER 的规范冲突。
  - 安全性：目标镜像前 8 个基础层与生产当前镜像逐层 diffID 一致（同源基础镜像 + 仅静态资源层差异），基础层与生产逐层一致，不引入未知层。
  - 影响面：只重启 nginx（秒级）；api/worker/mcp 容器不重建、镜像内容不变（仅在服务器补打目标版本标签，保证 Compose 单变量 `V3_IMAGE_TAG` 一致）；无数据库变更。
  - 回退：源镜像标签未被覆盖，`rollback.sh` 恢复配置快照并重建 nginx 即可回到 `3.0.0-stage10.20260929-quotefix1`。
- 否了什么：B 方案（继续 KB-LAYER，需先落地制包器与自动测试，工期不可控且违反现行规范）。
- 权衡了什么：包体从约 1MB 级差量变为 22MB 完整镜像，换取规范合规、逐层可验证与一键回退。

## 2026-10-12 — 本地等价沙箱演练（发现并修复 2 个真实缺陷）

- 沙箱：`tmp/kb027-rig`（colima 容器 + 命令垫片模拟 root 与 x86_64，nginx 端口 18000；源镜像与 api/worker/mcp 为等价替身，包内脚本与目标镜像归档为原件）。
- 演练中发现并修复的真实缺陷（已修复进正式包，属本次任务交付物）：
  1. `scripts/upgrade.sh` 在重建 nginx 后立即调用健康检查，nginx 容器尚处 `starting` 状态导致误判失败 → 已补充"等待 nginx 达到 healthy/none（最多 120 秒）"。
  2. `tests/smoke.sh` 早期版本经命令替换取回响应正文后再计算哈希，末尾换行丢失导致哈希误判不匹配 → 已改为 `curl | sha256sum` 直取并保留重试。
- 交接状态澄清：上一轮 `logs/install/KB-20261012-027-20261012-095522.log` 显示修复前的冒烟失败（旧写法），修复后**未留下成功日志**；因此本轮必须从最终 ZIP 重跑同等深度演练，未采信"已通过"的口头结论。
- 演练结论（从最终 ZIP 独立解压目录执行，留证于 `evidence/`）：
  - 预检查通过 → 升级完成 → `verify.sh` 通过 → `tests/smoke.sh` 通过；
  - 补充验证：瞬时 502 重试通过（api-1/api-2 停机 6 秒后自愈，自检重试成功）；HTML 假健康拦截通过（`admin.html` 不含 `"success":true`，不会被误判为健康）；
  - 失败回退演练通过（版本、镜像、静态文件哈希全部回到 quotefix1：`admin-app.js` = `73fb134a…`）；
  - 回退后再次升级通过，升级后 6 个关键静态文件哈希与包内元数据逐一一致。
- 最终 ZIP 交付前复验（规范第 10.2 节）：外层 `.zip.sha256` 校验通过、`unzip -t` 通过、独立目录实际解压通过、包内 `manifest/SHA256SUMS` 12 项全部 OK、5 个脚本 `bash -n` 通过、元数据可被 bash 正确读取、无禁用压缩格式、无明文密钥、无非 ASCII 变量名。
- 包体编码验证：在本机与生产（`unzip 6.00` + `LANG=zh_CN.UTF-8`）分别实测 macOS `zip -X`（无 UTF-8 标志位）与 Python zip（带 UTF-8 标志位）两种包体，中文文件名解压均正常；沿用与历史 KB 包一致的 macOS `zip -qr -X` 方式。
- 清理：沙箱容器、临时目录已在通过演练后清理，仅保留正式包目录与证据日志。

## 2026-10-12 — 生产升级执行（Ticket 06）

- **授权**：用户明确"搞完后做好全面检查，然后更新在生产上"。
- **最终包**：`lianruan-crm-v3-kb-20261012-027-image-cancel-order-error-message.zip`，SHA-256 `f0b3432be921d80d9f4492ce67db8d69f32aba9ae643f48be54f6067384da308`（第 3 版，前两版均在预检查阶段被拦截、未影响生产）。
- **执行**：上传校验一致 → 包内 12 项校验通过 → 预检查通过 → 升级完成（退出码 0）→ `verify.sh` 通过 → `tests/smoke.sh` 通过。
- **升级过程拦截并修正的 2 个真实缺陷（均未造成生产影响，详见交付记录第三节）**：
  1. 生产 `mcp` 服务在 Compose `profiles` 段，默认渲染不含它 → 改为按 `--profile mcp` 渲染校验；同时把版本变量写入移动到全部校验之后（校验失败零改动）。当次中止后已用快照把三处版本变量恢复原状。
  2. 目标标签镜像 ID 与构建机不同（docker 27 加载时改写，规范不要求一致）→ 目标镜像校验改为按镜像内静态资源内容 + 架构 + 文件数校验；正反两向均已在沙箱验证。
- **升级后核对结论**：版本三处一致（目标版本，`v3.env` 权限 600）；nginx 切换目标镜像并 healthy；api-1/api-2/worker 系列/mcp 启动时间与升级前完全一致（未重启）；`/health/live`、`/health/ready` 成功；6 个页面 200；6 个关键静态文件 HTTP 直取哈希与包内元数据逐一致；线上 `admin-app.js` 含 `readApiErrorMessage` 104 处、`partner-app.js` 31 处，旧拼接写法 0 处；nginx 错误日志仅正常启动；10 月 12 日访问日志无 5xx；磁盘可用约 40 GB。
- **回退边界**：`rollback.sh /opt/lianruan-crm-v3 /opt/lianruan-crm-v3/releases/3.0.0-stage10.20261012-kb027-pre-20261012-100913`；只恢复配置快照并重建 nginx，源镜像标签保留，无数据库变更。
- **待用户人工验收**：管理员端/渠道端按 `tests/验证清单.md` 第二节执行失败场景与告警提示复核。
