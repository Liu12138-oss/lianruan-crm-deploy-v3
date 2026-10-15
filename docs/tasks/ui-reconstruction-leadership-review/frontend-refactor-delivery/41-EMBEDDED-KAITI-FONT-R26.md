# R26：内嵌楷体字库，Windows 与 macOS 字形完全一致

- 日期：2026-10-09
- 环境：`http://10.9.86.66`（测试环境，唯一发布目标）
- 版本：`lianruan-crm-v3-nginx` = `3.0.0-stage10.20261008-protolign16`
  - `api-1` / `api-2` 复用 `3.0.0-stage10.20261008-protolign12` 同一镜像（未改动）
  - `worker` 保持 `3.0.0-stage10.20260923-regionpriceoa1` 未改动
- 生产环境 `10.20.3.10` 未连接、未修改
- 老 UI（`apps/web/public/*.html`、`style.css`、`mobile.css`）与原型 `apps/web/public/ui-next/` 均未改动
- 证据目录：`test-evidence/20261009-r26-embedded-font/`
- 回退点：`compose/.env.bak-before-r26font`（`protolign15`），回退只需改回 `V3_IMAGE_TAG` 后
  `docker compose up -d --no-deps nginx`

## 1. 为什么必须内嵌

R25 已把字体栈统一为楷体族，但「楷体」在不同系统上是不同字体文件：

| 平台 | 实际命中字体 | 结果 |
| --- | --- | --- |
| Windows | 中易楷体 `KaiTi` | 字形 A |
| macOS | 华文楷体 `STKaiti` / `Kaiti SC` | 字形 B |

系统字体无法随应用分发，因此只要依赖系统楷体，两端就必然存在字重、字面宽度和笔画差异（用户反馈「老显示不一样」）。
唯一解法是把字体文件随应用一起发布，用 `@font-face` 指定同一份文件。

## 2. 选字与许可

| 项 | 取值 |
| --- | --- |
| 字体 | 霞鹜文楷 GB（LXGW WenKai GB）Regular v1.522 |
| 字形风格 | 楷体 / 教科书体，简体字形规范，与「正楷」要求一致 |
| 许可 | SIL Open Font License 1.1，**明确允许**子集化与转换为 WOFF/WOFF2 用于 Web 字体分发 |
| 分发件 | `apps/web/public/fonts/lxgwwenkai-gb-regular.woff2` + `OFL-LXGWWenKaiGB.txt`（同目录随包分发） |

> 未采用中易楷体 / 华文楷体：二者为商业授权字体，不允许随应用分发。

## 3. 子集化（体积控制）

原始字体 24.6MB，直接内嵌不可接受，按「GB2312 全集 + 前端源码用字 + 常用中文符号」子集化：

| 项 | 数值 |
| --- | --- |
| 收录字符 | 7593 个（GB2312 全集 6763 汉字 + 682 符号，再并入 `apps/web/src` 全部文案用字与常用标点） |
| 产物 | `lxgwwenkai-gb-regular.woff2`，**1.54MB**（24.6MB → 1.54MB） |
| 脚本 | `tmp/r26-subset-font.py`（fontTools + brotli，可复跑） |
| 未覆盖字符 | 自动回退到字体栈后续的系统楷体 / `serif`，不会出现方框 |

## 4. 接入方式

1. `theme.css` 顶部新增 `@font-face`：

```css
@font-face {
  font-family: "LXGW WenKai GB";
  src: url("/fonts/lxgwwenkai-gb-regular.woff2") format("woff2");
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
}
```

2. 字体栈统一改为「西文在前、内嵌中文在后」：`"Times New Roman", "LXGW WenKai GB", "KaiTi", "楷体", …`，
   共 8 处（`theme.css` 5、`visual-ui.css` 1、`war-demo.css` 1、`war-typography.css` 1），浏览器按字符逐个回退，
   西文与数字仍固定 Times New Roman，中文命中内嵌楷体。
3. `index.html` 增加 `<link rel="preload" as="font" type="font/woff2" crossorigin>`，避免首屏先显示系统字体再跳变。
4. `font-display: swap` 保证字体未下载完时先显示回退字体，不阻塞渲染。

## 5. 验证结果

| 验证项 | 结果 |
| --- | --- |
| 字体文件可访问 | `GET /fonts/lxgwwenkai-gb-regular.woff2` → `200`、`font/woff2`、1619552 字节 |
| 字体是否真正加载 | `document.fonts.check('16px "LXGW WenKai GB"')` → `true` |
| 真实渲染字体（CDP，6 条桌面路由） | 中文 `LXGW WenKai GB` 10075 字形、西文数字 `Times New Roman` 9068 字形，**系统楷体 0 字形** |
| 全路由回归（桌面 + 移动 + 公开 62 条） | 正常 62 / 异常 0，横向溢出 0（与换字体前基线完全一致） |
| 前端类型检查 / 构建 | `vue-tsc` 通过、`vite build` 通过 |
| 前端单测 | 130 / 130 通过 |
| 老 UI 与原型 | 未引入该字体，资源未变（老 UI 页面不引用新 UI 样式表） |

结论：Windows 与 macOS 现在使用**同一份字体文件**，字形、字宽、字重完全一致；换字体前「两端不一样」的问题从根因上消除。

## 6. 变更文件

| 文件 | 说明 |
| --- | --- |
| `apps/web/public/fonts/lxgwwenkai-gb-regular.woff2` | 新增，内嵌楷体子集（1.54MB） |
| `apps/web/public/fonts/OFL-LXGWWenKaiGB.txt` | 新增，字体许可证（OFL-1.1） |
| `apps/web/src/styles/theme.css` | 新增 `@font-face`，字体栈插入内嵌字体 |
| `apps/web/src/styles/visual-ui.css`、`war-demo.css`、`war-typography.css` | 字体栈同步（含 `--font` 变量与注释） |
| `apps/web/index.html` | 字体预加载 |
| `tmp/r26-subset-font.py` | 子集化脚本（可复现） |

## 7. 验收

- 2026-10-09：用户确认内嵌楷体字形「看起来还行，能接受」，本方案通过验收，保持内嵌字体不变。

## 8. 风险与回退

- 风险：字形由系统楷体改为霞鹜文楷，笔画风格略有差异（更接近手写楷体）；如不接受，替换
  `apps/web/public/fonts/` 下的字体文件并改 `@font-face` 名称即可，无需改其它代码。
- 风险：前端发布包增大约 1.6MB（离线升级包同量级增长），局域网内首次加载一次、之后走浏览器缓存。
- 回退：改回 `compose/.env` 的 `V3_IMAGE_TAG=3.0.0-stage10.20261008-protolign15` 后执行
  `docker compose up -d --no-deps nginx`，即回到 R25 交付态（系统楷体）。
