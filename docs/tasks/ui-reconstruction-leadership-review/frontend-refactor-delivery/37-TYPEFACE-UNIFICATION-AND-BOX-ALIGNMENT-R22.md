# R22：字体族统一（楷体_GB2312 + Times New Roman）与方框对齐修复交付报告

- 日期：2026-10-08
- 环境：`http://10.9.86.66`（测试环境，唯一发布目标）
- 版本：前端 `lianruan-crm-v3-nginx:3.0.0-stage10.20261008-protolign6`
  - 后端镜像内容未变，仅补打 `protolign6` 同名标签（api 实际内容同 `protolign4`、worker/mcp 同 `protolign5`），保证 compose 期望状态与运行状态一致
- 账号：`liulonghai`（超管）、`liulongfei`（渠道）
- 生产环境 `10.20.3.10` 未连接、未修改
- 证据目录：`test-evidence/20261008-r22-typography-and-alignment/`
- 回退点：`/opt/lianruan-crm-v3/compose/.env.bak-before-r22type`（镜像 `protolign5` 仍在测试机保留）

## 1. 结论

针对反馈的两点问题收口：

| 反馈问题 | 处理结果 |
| --- | --- |
| 格式没有对齐，有的方框明显上下不对齐 | 定位到根因并修复；30 条管理路由的对齐扫描由 52 处错位降到 **0 处** |
| 字体没有统一：中文要楷体_GB2312、西文/数字要 Times New Roman | 全站字号族收敛为 **1 套**；27 条路由 17215 个文本元素 100% 命中同一字族 |

另外在核查过程中发现并修复了一处更严重的结构缺陷：组织架构页「成员卡片 / 部门树 / 编辑用户抽屉」在重构时**整块样式未接入**，页面右栏实际为空白。本轮按老 UI 口径补齐后恢复正常。

## 2. 方框上下不对齐

### 2.1 根因

`apps/web/src/styles/war-demo.css` 中有一条用于「上下堆叠面板」的间距规则：

```css
.vui .panel + .panel { margin-top: 12px; }
```

该规则没有排除网格容器。`.extended-center-grid`（`display: grid; gap: 12px;`）内部并排的两个面板，
第二个会额外多出 12px 上边距，于是出现「底部齐、顶部差 12px」的错位——正是报价管理页
「报价明细 / 报价信息」两个方框的错位现象。

该缺陷并非报价页独有，商机、订单、客户、渠道、产品、证书、消息、线索等页面共 9 处受影响。

### 2.2 修复

```css
/* 网格内面板由 grid gap 统一控制间距，panel 自身不再叠加 margin-top */
.vui .extended-center-grid > .panel + .panel { margin-top: 0; }
```

### 2.3 第二处错位（线索页）

线索管理页动作区第三个按钮带 `margin-top: 18px`，与同排另外两个按钮上下错开 18px。
根因是新 UI 复用了业务工作台遗留的全局类名 `.主按钮`（`theme.css:144` 定义 `margin-top: 18px`）。
修复方式是在页面内提高优先级覆盖，不改动老页面依赖的全局规则：

```css
.线索按钮.主按钮 { margin-top: 0; }
```

### 2.4 对齐扫描口径修正

R21 的扫描脚本把「居中容器的子元素上下不齐」「网格跨行元素」也计入错位，产生大量误报
（info-grid / form-grid / 分页 / 搜索栏 / 步骤条等）。R22 改为：

1. 只比较**垂直方向真正重叠**且**水平并列**的兄弟元素，并用连通分量聚类，跨行网格不再互相比较；
2. 按父容器 `align-items` 判定正确基准——`center` 视为设计意图跳过、`flex-end` 只要求底边齐、其余要求顶边齐。

修复前后（1918×976，30 条管理路由）：

| 阶段 | 错位总数 |
| --- | --- |
| R22 修复前（同一口径） | 52 |
| R22 修复后（本地） | 0 |
| R22 部署后（测试环境复验） | 0 |

## 3. 字体族统一

### 3.1 目标口径

```css
--font: "Times New Roman", "楷体_GB2312", "KaiTi_GB2312", "KaiTi", "STKaiti", "Kaiti SC", serif;
```

CSS 字体族按「先西文、后中文」排序，浏览器按字符逐个回退：西文与数字命中首个 Times New Roman，
中文因 Times New Roman 无对应字形继续回退到楷体_GB2312，从而**一条声明同时满足两种字形要求**。

### 3.2 收口位置（8 处历史声明全部替换）

| 文件 | 位置 | 原值 |
| --- | --- | --- |
| `war-typography.css` | `:root --font` | PingFang SC 系列 |
| `war-demo.css` | `.vui --font` | PingFang SC 系列 |
| `visual-ui.css` | `.vui --font` | PingFang SC 系列 |
| `theme.css` | `:root font-family` | Inter + PingFang SC 系列 |
| `theme.css` | `.v2-页面容器` | -apple-system / SF Pro 系列 |
| `theme.css` | `.移动端页面` | -apple-system 系列 |
| `theme.css` | `.v2-code-text` | ui-monospace 等宽 |
| `war-demo.css` | `.vui .auth-route-list strong` | ui-monospace 等宽 |
| `CertificateRiskPage.vue` | `code` | ui-monospace 等宽 |

同时补齐两处会绕开字族收口的漏洞：

1. `war-typography.css` 的 `:root` 增加 `--el-font-family: var(--font)`。
   Element Plus 默认字族为 Helvetica / PingFang，弹窗、下拉、气泡等浮层挂在 `body` 下，
   不在 `.vui` 作用域内，只有改根变量才能覆盖。
2. 通知面板 `.notif-item` 是原生 `<button>`，浏览器按钮不继承字族，导致面板落到 Arial；
   补 `font: inherit`，并把面板内 15px / 14px / 13px / 12px 四档字号收敛为 16px（面板标题）与 11px（正文）。

### 3.3 字号口径（沿用 R18 锁定，未改动）

- 一级标题（页面标题）22px / 700
- 二级标题（面板、区块、卡片标题）16px / 700
- 指标数字（KPI）23px / 700
- 其余全部 11px；字重仅 400 / 700 两档
- 唯一例外：顶栏品牌标识、头像圆块、图标字形三处装饰元素（16px / 12px / 15px），沿用 R18 既有例外

### 3.4 验证

用 CDP `CSS.getPlatformFontsForNode` 读取真实参与渲染的字体（而非声明的 font-family）：

| 取样元素 | 实际字体 | 命中字符数 |
| --- | --- | --- |
| `.panel-head h2`（中文标题） | STKaiti（楷体） | 4 |
| `.deal-title strong`（中英数字混排） | STKaiti + Times New Roman | 2 + 18 |
| `.vui-table td`（表格） | STKaiti + Times New Roman | 14 + 1 |
| `.metric-value strong`（KPI 数字） | Times New Roman | 2 |

说明：开发机为 macOS，`楷体_GB2312` 不存在，回退命中 `STKaiti`（楷体-简）；
Windows 环境将优先命中 `楷体_GB2312`，未安装该字体时回退 `KaiTi`。字形外观一致。

全站字体审计（27 条管理路由，17215 个直接承载文本的元素）：

```
17215  "Times New Roman", 楷体_GB2312, KaiTi_GB2312, KaiTi, STKaiti, "Kaiti SC", serif
```

字族分布由修复前的 2 档（主字族 + 通知面板 1560 处 Arial）收敛为 1 档。

## 4. 附带修复：组织架构页样式缺失

### 4.0 作用边界（经用户确认）

本轮字体与对齐改动**只作用于新重构 UI**（Vue 应用，`apps/web/src/**` 与打包产物 `assets/index-*.css`）。
老 UI（`apps/web/public/*.html` + `style.css` / `mobile.css` / `mobile-v2.css`）明确保持原样，作为新旧对比基准。

边界核实证据：

| 核实项 | 结果 |
| --- | --- |
| 老 UI 页面是否引用新 UI 打包样式 | `admin.html`、`partner.html`、`admin-mobile.html`、`partner-mobile.html`、`login.html` 对 `assets/index-*.css` 的引用数均为 **0** |
| 老 UI 样式表是否被改写 | `style.css` 在 `protolign5` 与 `protolign6` 两个包中 **md5 完全一致**（`9726b64ddc1ee983169586060b7b37ce`），且不含 `楷体_GB2312` |
| 仍可直接访问的老 UI 页面实际字族 | `/mobile.html`、`/mobile-v2.html`、`/admin-mobile.html` 仍为 `-apple-system, "system-ui", "PingFang SC", "Microsoft YaHei", sans-serif` |
| 老 UI 桌面入口 | nginx 既有规则将 `/login.html`、`/admin.html`、`/partner.html` 301 到 `/login`、`/admin`、`/partner`，本轮未修改该规则 |

### 4.1 现象与定性

`/admin/organization`（组织与岗位）右侧「成员卡片」区域实际为空白：
选中部门后，成员卡片以纯文本形式堆叠，头像仅 11×12px、无边框无内边距。
同时被影响的还有部门树、外部身份筛选栏与身份统计、账号检索结果、编辑用户抽屉。

核对方式与结论：

- 用脚本枚举页面模板中出现、但计算样式完全为默认值的类名，定位到 25 个类名；
- `git log -S` 全历史检索确认上述样式**从未进入 V3 新 UI**（非本轮改动引入的回归）；
- 老 UI `apps/web/public/style.css` 存在同名样式定义，说明新 UI 移植时整块遗漏。

### 4.2 修复

在 `OrganizationWorkspacePage.vue` 的 scoped 样式中按老 UI 口径补齐，并适配新 UI 视觉基准
（边框 `#dce7f3`、圆角 10px、主色 `#2f69ed/#1557d6`、文字 `#172b4d/#60748c/#8391a5`）：

`组织左右布局`、`组织部门树`（含 el-tree 节点与当前选中态）、`组织树节点`、`组织树计数`、
`组织成员面板`、`组织成员面板标题`、`组织成员网格`、`组织成员卡片`、`组织成员头部`、
`组织成员头像`、`组织成员身份`、`组织成员姓名`、`组织成员账号`、`组织成员概要`、
`组织成员证书`、`组织无证书`、`组织筛选栏`、`外部身份统计`、`组织账号检索结果`、
`组织账号检索项`、`组织账号检索提示`、`组织抽屉遮罩`、`组织抽屉`、`组织抽屉头部`、
`组织抽屉主体`、`组织抽屉区块`、`组织抽屉小卡`、`组织抽屉小卡主`、`组织抽屉小卡次`、
`组织抽屉空`、`组织抽屉新增行`、`组织说明文字`，并在 900px 断点补充左右布局的纵向堆叠。

### 4.3 复验

- 成员卡片：`display:block → block`、`border:1px solid #e3ecf6`、`padding:14px`、`border-radius:10px`；
  头像由 11×12px 变为 36×36px 圆形；头部由默认块级变为 `display:flex; align-items:center`（此项同时消除了扫描出的 2px 错位）
- 编辑用户抽屉：宽 880px、6 个区块、遮罩正常
- 剩余的 `组织面包屑`/`组织说明` 两项为检测脚本启发式误报（其样式以分组选择器定义，仅含颜色与字号）

## 5. 验证结果

### 5.1 本地

- `npm run build`（vue-tsc + vite build）通过
- `npm run test`：22 个测试文件、130 项测试全部通过

### 5.2 测试环境（部署 protolign6 后）

| 验证项 | 结果 |
| --- | --- |
| 对齐扫描（30 条管理路由，1918×976） | 错位 0 处 |
| 字体族审计（27 条管理路由，17215 个元素） | 1 套字族 |
| 全量路由复验（62 条，含渠道端与移动端） | 正常 62 / 异常 0 |
| 横向溢出 | 0 条 |
| 控制台 / 接口错误 | 仅 3 条公开页预期的 `401 /api/auth/me` |
| 越界字号页面数（对比 R21 基线） | 43 → 43（均为顶栏装饰元素，口径未变） |

## 6. 变更文件

- `apps/web/src/styles/war-typography.css`
- `apps/web/src/styles/war-demo.css`
- `apps/web/src/styles/visual-ui.css`
- `apps/web/src/styles/theme.css`
- `apps/web/src/features/lead/LeadManagementPage.vue`
- `apps/web/src/features/certificate/CertificateRiskPage.vue`
- `apps/web/src/pages/admin/platform-admin/OrganizationWorkspacePage.vue`

## 7. 回退方式

本轮仅前端样式改动，回退只需切回上一版镜像：

```bash
cd /opt/lianruan-crm-v3/compose
cp -p .env.bak-before-r22type .env      # V3_IMAGE_TAG 回到 protolign5
docker compose up -d --no-deps nginx
```

后端 api / worker / mcp 容器全程未重启，业务数据未做任何写入。

## 8. 后续衔接

本轮之后另有 R23：作战室画板自适应口径（修复 Windows 松 / Mac 紧），详见 `38-RESPONSIVE-ARTBOARD-R23.md`。
