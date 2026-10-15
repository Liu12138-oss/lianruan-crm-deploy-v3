# R23：作战室画板自适应口径交付报告（Windows 松 / Mac 紧）

- 日期：2026-10-08
- 环境：`http://10.9.86.66`（测试环境，唯一发布目标）
- 版本：前端 `lianruan-crm-v3-nginx:3.0.0-stage10.20261008-protolign7`
  - 后端镜像内容未变，仅补打 `protolign7` 同名标签（api 实际内容同 `protolign4`、worker/mcp 同 `protolign5`），保证 compose 期望状态与运行状态一致
- 账号：`liulonghai`（超管）、`liulongfei`（渠道）
- 生产环境 `10.20.3.10` 未连接、未修改
- 证据目录：`test-evidence/20261008-r23-responsive-artboard/`
- 回退点：`/opt/lianruan-crm-v3/compose/.env.bak-before-r23artboard`（镜像 `protolign6` 仍在测试机保留）

## 1. 问题与结论

用户反馈：**同一套新 UI，Windows 电脑打开不够紧凑，左右和下方空出一大块；Mac 电脑打开却很紧凑。**

根因是画板把原型的 **1440×742 设计画布当成了固定尺寸**，做了「信箱式」留白：视口比 1440 宽多少，两侧就平分多少空白；高度固定 742px，比 742 高多少，下方就空多少。Mac 常见视口（1440×790）恰好与设计画布几乎等宽等高，所以看起来正常；越大的屏越松。

修复口径：**画板铺满内容区，四周只保留统一的 10px 外边距**，原型内部的几何（六项指标区高度、三栏列宽、列内滚动、面板间距）一律不变。

### 1.1 修复前后实测留白对照（测试环境实测，非推算）

| 路由 | 视口 | 修复前 左右留白 / 下方留白（板尺寸） | 修复后 左右留白 / 下方留白（板尺寸） |
| --- | --- | --- | --- |
| `/admin/quote` | 1440×790 类 MacBook | 0 / 0，−24（1440×742） | 10 / 10，10（1420×708） |
| `/admin/registration` | 1440×790 类 MacBook | 0 / 0，−24（1440×742） | 10 / 10，10（1420×708） |
| `/admin/audit-logs` | 1440×790 类 MacBook | 0 / 0，−24（1440×742） | 10 / 10，10（1420×708） |
| `/admin/quote` | 1712×900 | 136 / 136，86（1440×742） | 10 / 10，10（1692×818） |
| `/admin/registration` | 1712×900 | 136 / 136，86（1440×742） | 10 / 10，10（1692×818） |
| `/admin/audit-logs` | 1712×900 | 136 / 136，86（1440×742） | 10 / 10，10（1692×818） |
| `/admin/quote` | **1918×976 用户 Windows 截图** | **239 / 239，162**（1440×742） | **10 / 10，10**（1898×894） |
| `/admin/registration` | **1918×976 用户 Windows 截图** | **239 / 239，162**（1440×742） | **10 / 10，10**（1898×894） |
| `/admin/audit-logs` | **1918×976 用户 Windows 截图** | **239 / 239，162**（1440×742） | **10 / 10，10**（1898×894） |
| `/admin/quote` | 2560×1300 大屏 | 560 / 560，486（1440×742） | 10 / 10，10（2540×1218） |
| `/admin/registration` | 2560×1300 大屏 | 560 / 560，486（1440×742） | 10 / 10，10（2540×1218） |
| `/admin/audit-logs` | 2560×1300 大屏 | 560 / 560，486（1440×742） | 10 / 10，10（2540×1218） |

- 修复前 1918 宽的 239px 双侧空白与用户 Windows 截图逐像素一致，确认根因判断正确。
- 修复前 1440×790 下方为 **−24**，说明「Mac 很紧凑」实际是画板比视口高 24px、页面被撑出滚动条——并非真正贴合。
- 完整量测（含组织架构页与新建页）：`test-evidence/20261008-r23-responsive-artboard/画板几何量测-测试环境.txt`
- 修复前后截图对照：`test-evidence/20261008-r23-responsive-artboard/对照/`

## 2. 根因拆解

| 序号 | 位置 | 原值 | 后果 |
| --- | --- | --- | --- |
| 1 | `war-artboard.css` `.vui.war-artboard` | `width: min(1440px, 100%)`、`height: 742px` | 宽度封顶 1440、高度固定 742，宽屏/高屏出现信箱式留白 |
| 2 | `war-artboard.css` `.war-artboard-flow` / `.war-artboard-plain(.war-artboard-fixed)` | 同口径固定尺寸 | 除三栏作战室外，新建流程页、专属布局页同样留白 |
| 3 | `theme.css` `.v2-顶部导航布局 .v2-页面内容` | `max-width: 1680px; margin: 0 auto` | 宽屏下画板被内容区二次收窄，即使在 1680 以内也仍会居中留白 |
| 4 | `OrganizationWorkspacePage.vue` `.组织工作区` | `height: 742px` | 组织架构工作区沿用旧画布高度，高屏下方空出 |

原型 `docs/tasks/ui-reconstruction-leadership-review/visual-designs/screenshots/02-war-full.png` 是 **1440×742 的设计画布**，原型里画板本身就铺满画布；生产环境不能把画布尺寸当成固定尺寸使用。

## 3. 修复内容（3 个文件）

### 3.1 `apps/web/src/styles/war-artboard.css`

四类画板几何统一为自适应口径：

| 选择器 | 宽度 | 高度 | 使用页面数 |
| --- | --- | --- | --- |
| `.vui.war-artboard`（三栏作战室） | `calc(100% - 20px)` | `calc(100vh - 顶栏 - 20px)`，下限 620px | 12 |
| `.vui.war-artboard.war-artboard-flow`（流式专属页） | `calc(100% - 20px)` | 同上 | 6 |
| `.vui.war-artboard-plain`（专属布局页） | `calc(100% - 20px)` | `min-height: calc(100vh - 顶栏 - 20px)` | 6 |
| `.vui.war-artboard-plain.war-artboard-fixed`（plain 的固定高度变体） | 继承 plain | `calc(100vh - 顶栏 - 20px)`，下限 620px | 0（保留口径） |

四类同时统一：`max-width: none`、`margin: 10px auto`、`min-width: 1180px`（窄屏收窄到 1180 后横向滚动，避免右栏被裁切）。
原型内部几何（`padding: 73px 0 0`、`grid-template-rows: 96px minmax(0,1fr)`、`gap: 11px`、三栏 `304 / auto / 342`、列内滚动）**全部保持不变**。

### 3.2 `apps/web/src/styles/theme.css`

- `:root` 新增 `--v3-board-topbar-h: 0px`（无顶栏路由兜底）。
- `.v2-顶部导航布局.v2-桌面布局`（62px 顶栏外壳）置 `--v3-board-topbar-h: 62px`。
- 画板页的内容区（`:has(> .vui.war-artboard)` / `:has(> .war-artboard-plain)`）追加 `max-width: none`，取消 1680px 二次收窄；原有 `padding: 0` 保留。

变量口径说明：画板被 **3 种外壳**承载——顶部导航外壳（62px sticky 顶栏）、组织架构等无顶栏的独立工作区（0px）、以及产品价格中心等工作区路由。用 CSS 变量表达「外壳顶栏高度」，三种外壳共用同一套画板几何，不写死单一数值。

### 3.3 `apps/web/src/pages/admin/platform-admin/OrganizationWorkspacePage.vue`

`.组织工作区` 由 `height: 742px` 改为 `height: calc(100vh - var(--v3-board-topbar-h, 0px) - 20px)`，内容超出在画板内滚动。

### 3.4 受影响页面清单（24 个 Vue 页面）

- 三栏作战室 `.vui.war-artboard`（12 处）：工作台、客户管理、线索中心、商机、报价、订单中心、渠道商、价格规则、消息设置、证书、配置、通用业务模块页。
- 流式专属页 `.war-artboard-flow`（6 处）：审批中心、消息中心、审计日志、开放接口、产品目录、工作量配置。
- 专属布局页 `.war-artboard-plain`（6 处）：证书风险、新建客户、线索管理、新建商机、新建报价、组织工作区。

三组共 24 个页面，全部按第 3.1 节口径统一。

## 4. 验证结果

| 验证项 | 结果 |
| --- | --- |
| 本地构建 `npm run build` | 通过 |
| 本地单测 `npm run test` | 130 项全通过 |
| 全量路由复验（62 条，含渠道端与移动端） | 正常 62 / 异常 0；与 R22 基线逐字段比对**完全一致**（无回归） |
| 横向溢出 > 0 的页面 | 0 条 |
| 对齐扫描（30 条管理路由） | 错位 0 处 |
| 画板几何量测（4 视口 × 5 路由） | 除新建商机页外全部为 10 / 10 / 10 |
| 控制台 / 接口错误 | 仅 3 条公开页预期的 `401 /api/auth/me`，与 R22 基线一致 |

唯一非 10px 值：`/admin/opportunity/new`（新建商机）在 1440/1712/1918 视口下板高 1086px（下方 −182），是**表单内容本身超过一屏的正常纵向滚动**；在 2560×1300 下已是 1218px 铺满。该页为纯高度问题，未做裁剪。

## 5. 变更文件

- `apps/web/src/styles/war-artboard.css`
- `apps/web/src/styles/theme.css`
- `apps/web/src/pages/admin/platform-admin/OrganizationWorkspacePage.vue`

老 UI（`apps/web/public/*.html` 与 `style.css` / `mobile.css`）本轮未做任何改动。

## 6. 回退方式

本轮仅前端样式改动，回退只需切回上一版镜像：

```bash
cd /opt/lianruan-crm-v3/compose
cp -p .env.bak-before-r23artboard .env      # V3_IMAGE_TAG 回到 protolign6
docker compose up -d --no-deps nginx
```

后端 api / worker / mcp 容器全程未重启，业务数据未做任何写入。

## 7. 可调参数

若后续对留白口径有新的偏好，只需调整两个数值（均在 `war-artboard.css`）：

- 外边距：`margin: 10px auto` 与 `calc(100% - 20px)`（20 = 左右各 10px 之和）；
- 高度扣减：`calc(100vh - var(--v3-board-topbar-h, 0px) - 20px)` 中的 `20px`（上下各 10px）。
