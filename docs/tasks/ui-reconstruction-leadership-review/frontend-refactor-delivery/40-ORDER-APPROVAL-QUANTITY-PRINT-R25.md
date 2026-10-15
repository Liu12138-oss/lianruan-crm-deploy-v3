# R25：订单审批链对齐、报价单模块数量、报价单打印与中文正楷统一

- 日期：2026-10-09
- 环境：`http://10.9.86.66`（测试环境，唯一发布目标）
- 版本：`lianruan-crm-v3-nginx` = `3.0.0-stage10.20261008-protolign15`
  - `api-1` / `api-2` 复用 `3.0.0-stage10.20261008-protolign12` 同一镜像
  - `worker` 保持 `3.0.0-stage10.20260923-regionpriceoa1` 未改动
- 账号：`liulonghai`（超管）、`wangdawei`（一级渠道商 / 江苏汇鸿中天）、`liuchengzhou`（江苏区管）、`lishuangjian`（二级渠道商）、`liulongfei`（二级渠道商）
- 生产环境 `10.20.3.10` 未连接、未修改
- 老 UI（`apps/web/public/*.html`、`style.css`、`mobile.css`、`admin-app.js`、`partner-app.js`）本轮未改动
  - 部署前后 md5 复核一致：`style.css 9726b64d…`、`mobile.css 9cc4cb0b…`、`admin-app.js 72860e54…`、`partner-app.js 3a674ab5…`
- 证据目录：`test-evidence/20261009-r25-order-quantity-print/`（含 `实测记录.md`）
- 回退点（测试机 compose 目录内，逐轮保留）：
  - `.env.bak-before-r25order`（`protolign11`，R24 交付态）
  - `.env.bak-before-r25b`（`protolign12`）
  - 上述镜像仍在测试机 `docker images` 中，回退只需改 `compose/.env` 的 `V3_IMAGE_TAG` 后执行
    `docker compose up -d --no-deps api-1 api-2 nginx`

## 1. 用户反馈的四个问题与结论

| # | 反馈 | 结论 |
| --- | --- | --- |
| 1 | 订单处理审批不符合原业务逻辑 | 成立。新 UI 动作按「状态」铺开，未按「角色 + 状态」区分，导致一级确认出现在管理端、区管节点超管也能点、超管退回缺目标选择，且退回后无法修订重提。已按老 UI 审批链逐节点重写。 |
| 2 | 报价单单个模块数量无法调整 | 成立。软件模块表数量列是只读文本，服务端也只认整单 `endpoints`。已支持逐项数量并在服务端按逐项数量重新取价。 |
| 3 | 报价单无法打印 | 成立。报价列表中间区没有打印入口。已接入服务端正式报价单 PDF。 |
| 4 | 全部中文字体改成正楷 | 成立。字体栈中 Windows 楷体排在 `KaiTi_GB2312` 之后，部分环境会先命中间接字族。已把楷体族顺序前置并补全 macOS 楷体名称。 |

## 2. 问题 1：订单处理审批链对齐

新 UI 动作清单按角色 + 状态重写，与老 UI `admin-app.js`（列表 / 详情动作）、`partner-app.js`（一级确认 / 驳回）逐节点对齐：

| 状态 | 渠道端（`/partner`） | 管理端 |
| --- | --- | --- |
| `pending` / `pending_primary_confirm` | 一级确认、一级驳回 | V2 历史订单：确认订单（直接进入处理中）；新链订单只提示等待一级确认 |
| `primary_confirmed` | — | 区管：区管确认、区管驳回、区管调价；超管：只读（仅保留取消订单） |
| `pending_superadmin_confirm` | — | 超管：超管确认、超管退回（可选退回区管 / 一级 / 二级）；区管只读 |
| `returned_to_region` / `returned_to_primary` / `returned_to_secondary` | 修订后重新提交 | 修订后重新提交 |
| `confirmed` / `processing` | — | 确认发货 |
| `shipped` | — | 完成订单 |
| 非终态 | — | 取消订单 |

- 区管节点对超管只读、超管节点对区管只读，与老 UI「谁的节点谁操作」一致；动作清单仅做前端可见性，服务端仍逐次校验。
- 「修订后重新提交」补齐模块明细编辑器：可增删模块、调整数量，单价一律由服务端 `查询修订产品单价` 重新取价，前端不参与定价。
- 后端 `更新订单状态` 增加 `region_return` / `legacy_confirm` / `ship` / `complete` / `cancel` 动作映射。

### 2.1 全链路实测（测试环境真实数据）

| 步骤 | 操作账号 | 状态变化 | 页面可见动作 |
| --- | --- | --- | --- |
| 1 | `lishuangjian`（二级渠道商）报价 `BJ-lishuangjian-20261009-0001` → 「报价转订单」 | — → `pending_primary_confirm` | 渠道端落点 `/partner/order`，生成订单 `LS-lishuangjian-20261009-0001`（¥2,200） |
| 2 | `wangdawei`（一级渠道商） | `pending_primary_confirm` → `primary_confirmed` | `["一级确认", "一级驳回"]` |
| 3 | `liulonghai`（超管） | `primary_confirmed`（只读） | `["取消订单"]` |
| 4 | `liuchengzhou`（江苏区管） | `primary_confirmed` → `pending_superadmin_confirm` | `["区管确认", "区管驳回", "区管调价", "取消订单"]` |
| 5 | `liulonghai`（超管） | `pending_superadmin_confirm` → `confirmed` | `["超管确认", "超管退回", "取消订单"]` |
| 6 | `liulonghai` | `confirmed` → `shipped` → `completed` | `["确认发货"]` → `["完成订单"]` |

退回分支实测：`LS-liulongfei-20260929-0011`（`returned_to_secondary`）在渠道端可见 `["修订后重新提交", "取消订单"]`；
修订数量 20 → 5 → 300 时单价按阶梯价联动 `¥14 → ¥15 → ¥9`，提交后状态回到「待一级确认」，
服务端复核金额 ¥560 → ¥280、明细为「屏幕水印与控制模块 × 20 @ ¥14」。

## 3. 问题 2：报价单单个模块数量可调

| 层 | 改动 |
| --- | --- |
| 前端 `QuoteCreatePage.vue` | 软件模块表数量列由只读文本改为 `number` 输入框（最小 1、步长 1），失焦即写入 `选中数量` 并触发重新试算；非法值回滚并提示 |
| 前端请求体 | 试算 / 建单同时携带 `itemQuantities`（键为产品 id，值为模块数量），未调整的模块不下发 |
| 后端 `business-store.ts` | 新增 `读取逐项数量输入 / 取逐项数量`，兼容 `itemQuantities`、`quantities`、`模块数量` 三种入参，以及 `itemQuantitiesList` / `逐项数量` 数组入参；匹配键支持产品 `id`、`v2_source_id`、`business_code` |
| 后端取价顺序 | `硬件数量 → 逐项数量 → 端点类模块取端点数 → 其余取 1`，随后照常执行「区域覆盖价 → 渠道等级比例 → 标准阶梯价」 |

实测（产品「屏幕水印与控制模块」，商机 `SJ-20260917-0001`，江苏区一级渠道商）：

| 场景 | 数量来源 | 最终单价 | 说明 |
| --- | --- | --- | --- |
| 整单 120 端点 | 端点数量兜底 | ¥7.20 / 点 | R24 基线口径，未被破坏 |
| 单模块手工填 10 | 逐项数量 | **¥8.70 / 点** | 命中 1–19 阶梯价，说明确实按新数量重新取价 |

## 4. 问题 3：报价单打印

- 报价列表中间区新增按钮「打印 / 下载 PDF」，调用服务端正式报价单 `GET /api/quotes/:id/pdf`。
- 取回 blob 后新窗口打开，直接进入浏览器打印预览（可另存为 PDF）；弹窗被拦截时自动降级为下载，按钮始终可用。
- 实测：接口返回 `200 application/pdf`，`Content-Disposition` 文件名正常；PDF 用本地渲染核对为 A4 正式报价单，
  含客户 / 报价单信息、产品明细、业绩合计 ¥2,200、工作量 2.5 人天。
- 证据：`test-evidence/20261009-r25-order-quantity-print/报价单-98605992-0365-4368-ba37-861815137392.pdf` 及其渲染图。

## 5. 问题 4：中文正楷统一

字体栈统一为：

```
"Times New Roman", "KaiTi", "楷体", "KaiTi_GB2312", "楷体_GB2312", "STKaiti", "华文楷体",
"Kaiti SC", "Kaiti TC", "TW-Kai", "全字库正楷体", "正楷", serif
```

- 西文与数字固定 `Times New Roman`，中文落到楷体族；`theme.css`（5 处）、`visual-ui.css`、`war-demo.css`、`war-typography.css` 完全一致。
- 用 CDP `CSS.getPlatformFontsForNode` 读取**真实渲染字体**（非声明值），16 条桌面路由共采样 7962 个文本元素：

| 平台字体 | 字形数 | 说明 |
| --- | --- | --- |
| `STKaiti` | 57807 | macOS 华文楷体 = 楷体 |
| `Times New Roman` | 53844 | 西文 / 数字 |
| `Apple Color Emoji` | 16 | 状态图标 emoji，非文字 |

- Windows 端命中的是 `KaiTi`（中易楷体 / 楷体），macOS 端命中 `STKaiti`（华文楷体），两端均为正楷，无衬线字体混入。
- 说明：`KaiTi` 是 Windows 的系统字族名，macOS 上不存在同名字族，因此 macOS 会按字体栈回退到 `STKaiti`；
  两者都是楷体，观感一致。若后续要求两端像素级一致，需内嵌楷体字体文件（属于新增资源，本轮未做）。

## 6. 附带修复：渠道端硬编码 `/admin` 跳转

管理端与渠道端复用同一批业务组件，组件内跳转原先写死 `/admin/...`，渠道账号点击后会落到无权路由。新增
`apps/web/src/shared/navigation/shell-prefix.ts`（`use外壳前缀`），按当前路由返回 `/admin` 或 `/partner`，并替换到：
订单列表 / 订单动作 / 报价列表 / 报价新建 / 商机列表 / 商机新建 / 客户列表 / 客户新建 / 客户跟进，共 9 个页面。

## 7. 变更文件

| 文件 | 说明 |
| --- | --- |
| `apps/web/src/features/order/OrderActionCenterPage.vue` | 动作清单按角色 + 状态重写；新增修订重提模块明细编辑器、重提试算与提交载荷 |
| `apps/web/src/api/business-client.ts` | `执行订单动作` 增加 `region_return / legacy_confirm / ship / complete / cancel` 映射 |
| `apps/web/src/features/quote/QuoteCreatePage.vue` | 模块数量可编辑、请求体携带 `itemQuantities`、外壳前缀跳转 |
| `apps/web/src/features/quote/QuoteCenterPage.vue` | 新增「打印 / 下载 PDF」，接入 `下载报价PDF` |
| `apps/api/src/business-store.ts` | 逐项数量解析与取价；订单动作 `region_return / legacy_confirm` 支持 |
| `apps/web/src/shared/navigation/shell-prefix.ts` | 新增外壳前缀工具 |
| `apps/web/src/features/{order,quote,opportunity,customer}/*.vue` | 去掉硬编码 `/admin` 跳转（9 处） |
| `apps/web/src/styles/theme.css`、`visual-ui.css`、`war-demo.css`、`war-typography.css` | 楷体族前置，统一字体栈 |

## 8. 验证结果

| 验证项 | 结果 |
| --- | --- |
| 前端类型检查（`vue-tsc`） | 通过 |
| 前端构建（`vite build`） | 通过 |
| 前端单测（`vitest`） | 130 / 130 通过 |
| 测试环境全路由巡检（桌面 + 移动 + 公开 62 条） | 正常 62 / 异常 0，横向溢出 0 |
| 订单审批全链路（渠道下单 → 一级 → 区管 → 超管 → 发货 → 完成） | 6 步全部按预期流转，刷新后状态保持 |
| 退回单修订重提（数量 5 / 20 / 300 阶梯价联动） | 取价与金额复核通过 |
| 报价单逐项数量（120 端点 vs 单模块 10） | ¥7.20 / ¥8.70，按新数量重新取价 |
| 报价单 PDF | `200 application/pdf`，版式与金额核对通过 |
| 字体真实渲染扫描（16 条桌面路由 / 7962 个元素） | 中文全部 `STKaiti`（楷体），西文数字全部 `Times New Roman` |
| 老 UI 资源 md5（部署态 vs 本地） | 4 个文件完全一致，未被新 UI 改动影响 |
| 部署产物 vs 本地构建（前端） | `apps/web/dist/assets` 79 个资源文件名逐一比对完全一致 |
| 部署产物 vs 本地构建（后端） | `business-store.js` md5 均为 `d27c7570dab5f8a3f0fc0071ee86f9e8` |

> 后端接口单测（`apps/api`）依赖本机 PostgreSQL（默认 `127.0.0.1:5432`），本轮本机未起本地数据库，未执行；
> 后端改动以测试环境真实链路（下单 / 审批 / 重提取价 / 逐项数量重算）验证，覆盖同一批代码路径。

> 巡检脚本报出的 `越界字号 43 页`（12px、15px 少量元素）与 3 条公开路由的 `401 /api/auth/me` 均为 R22 起的既有基线，与本轮改动无关。

## 9. 已知遗留（本轮未处理，需知悉）

1. 渠道端新建报价页 `/partner/quote/new` 仍是 V2 兼容页（`BusinessWorkspacePage.vue`，按钮为「生成报价单」且无提交入口）。
   本轮渠道下单链路通过报价接口建单验证；该页改造需单独立项。
2. 一级渠道商 `wangdawei` 的 `/api/orders` 只返回本人订单，看不到二级子渠道订单，属**后端数据范围**口径，
   本轮只修前端动作可见性，未改后端数据范围。
3. 区管驳回目前只能退回一级或二级渠道商（后端 `校验订单所属区域区管` 也不允许退给自己），与老 UI 同口径；
   若需「退回区管」，需同时改后端校验。
4. macOS 与 Windows 的楷体字族不同名（`STKaiti` / `KaiTi`），字形一致但非同一字体文件；如需完全一致需内嵌字体。

## 10. 风险与回退

- 风险：`试算报价` 新增 `itemQuantities` 入参，属向后兼容的可选参数；不传时行为与 R24 完全一致，老 UI 与移动端不受影响。
- 风险：订单动作增加 `region_return / legacy_confirm / ship / complete / cancel` 映射，服务端原有状态机校验不变，
  非法动作仍被后端拒绝。
- 回退：改回 `compose/.env` 的 `V3_IMAGE_TAG=3.0.0-stage10.20261008-protolign11` 后执行
  `docker compose up -d --no-deps api-1 api-2 nginx`，即回到 R24 交付态。
