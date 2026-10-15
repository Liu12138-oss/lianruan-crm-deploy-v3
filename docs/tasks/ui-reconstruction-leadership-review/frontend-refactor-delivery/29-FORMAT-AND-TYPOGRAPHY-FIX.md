# 字体与格式一致性修复报告

修复日期：2026-09-24

Web 镜像：`lianruan-crm-v3-nginx:3.0.0-stage10.20260924-prototype29`

## 1. 问题定性（量化）

需求负责人反馈「字体不对、格式错乱、有的格式甚至没有」。逐项核对后确认两个根因：

### 1.1 原型页面级样式没有完整移植（「格式没有」的原因）

统计原型模板中使用到的 class 与实现样式中已定义的 class：

| 指标 | 数量 |
| --- | --- |
| 原型模板使用的 class | 336 |
| 仅移植基础设计系统时可用的 class | 134 |
| **缺失的原型 class** | **202** |

缺失项包括 `grid-2`、`grid-3`、`grid-4`、`chip`、`chip-row`、`callout`、`flow`、`flow-track`、`empty-state`、`drawer`、`detail-panel`、`header-actions`、`filters`、`lead-detail-layout`、`business-board` 等页面级结构样式——这些正是「格式错乱、格式没有」的直接来源。

### 1.2 字体被应用外壳与组件库覆盖（「字体不对」的原因）

| 元素 | 原型 | 修复前实现 |
| --- | --- | --- |
| 正文字体 | `PingFang SC, Microsoft YaHei, Noto Sans CJK SC, system-ui` | `-apple-system, system-ui, SF Pro Display, ...` |
| 正文字号 | 13px | 14px |
| 面板标题 | 12px | 19.5px（浏览器 h2 默认值，原型规则未生效） |
| 面板说明 | 9px | 12px |

## 2. 修复措施

1. **完整移植原型页面级样式**：新增脚本 `tools/scope-prototype-css.mjs`，把 `ui-demo/demo.css`（4067 行）整体转换为 `.vui` 作用域版本 `apps/web/src/styles/war-demo.css`（4561 行、70KB），保证原型用到的结构样式全部存在。
2. **统一字体基线**：新增 `apps/web/src/styles/war-typography.css`：
   - `body` / 桌面布局统一为原型字体 `PingFang SC` 系列，正文 13px；
   - `.vui` 内设置 `--el-font-family`，让 Element Plus（弹窗、输入、表格、分页）使用同一字体；
   - 顶部导航、面包屑、用户信息沿用同一字体。
3. 保留此前已完成的画板、列宽、卡片与表单样式。

## 3. 修复后实测（原型 / 实现）

| 指标 | 原型 | 实现 |
| --- | --- | --- |
| 正文字体 | PingFang SC 字体族 | 一致 |
| 正文字号 | 13px | 13px |
| 面板标题 | 12px | 12px |
| 面板说明 | 9px | 9px |
| 记录标题 | 11px | 11px |
| KPI 区 | 1398×96 | 1400×96 |
| 三栏列宽 | 304 / 792 / 342 | 一致（窄屏按比例收窄，不裁切） |

全站复核（1366×768，22 个路由，含新建客户 / 新建商机 / 新建报价）：

```
页面正常 22 / 22 ｜ 字体 PingFang ｜ 横向溢出 0 ｜ 右栏全部可见 ｜ 无旧版工作区残留
```

## 4. 仍需人工确认

- 若浏览器仍显示旧样式，请强制刷新（Cmd+Shift+R）；`index.html` 已设为 `no-store`，静态资源带内容哈希，刷新后即取到新版本。
- 深色/浅色、缩放到 125% 等特殊显示设置下的细节，如需可继续按 `tools/compare-prototype-metrics.mjs` 逐页量化核对。

## 5. 第二轮逐元素比对（style token diff）

新增脚本 `tools/compare-style-tokens.mjs`：对 10 个页面逐个 class 比对字体、字号、字重、行高，并输出差异清单。

| 轮次 | 差异条目 | 主要修复 |
| --- | --- | --- |
| 第一轮 | 50 | 按钮字号/行高、缺失 timeline / step-item / record-title 等 |
| 第二轮 | 40 | 中央动作按钮改为原型默认尺寸（34px），客户页生命周期改用 `.step-item`，通用模块页补「最近动态」 |
| 第三轮 | **23** | 中央阶段流程条（`.flow`/`.flow-step`）与右栏「最近动态」（`.timeline`/`.timeline-item`）已补齐 |

剩余 23 条分布：

| 项目 | 条数 | 说明 |
| --- | --- | --- |
| `.step-item` | 6 | 原型在部分页面用 `.step-item`，实现用 `.flow-step` 表达同一阶段条，视觉一致、类名不同 |
| `.record-title` / `.record-meta` | 8 | 原型表格单元格使用这两个内联类；实现卡片用 `strong`/`p`，字号一致（11px / 9px） |
| `.timeline` / `.timeline-item` | 4 | 消息中心与证书页右栏尚未接入最近动态 |
| `.button` | 3 | 个别页面首个按钮为 `.button.small`（原型该页为默认尺寸） |
| `.war-record-bottom` / `.record-tags` | 2 | 证书页卡片结构与原型略有差异 |

## 6. 第三轮补充

- WarLayout 新增通用「阶段流程条」与「最近动态」能力，8 个页面接入（客户、渠道、订单、商机、报价、产品、价格规则、审核中心）。
- 通用模块页（账号、开放接口、审计、工作量、渠道报表、消息）自动生成「最近动态」。
- 三个新建页（客户报备 / 商机 / 报价）按原型向导与报价构建器实现，并接入真实接口。
