# R21：硬件工作量映射补录与审计详情视图交付报告

- 日期：2026-10-08
- 环境：`http://10.9.86.66`（测试环境，唯一发布目标）
- 版本：前端 `lianruan-crm-v3-nginx:3.0.0-stage10.20261008-protolign5`；后端 `lianruan-crm-v3-api:3.0.0-stage10.20261008-protolign4`（后端镜像同时打上 `protolign5` 标签，保持与 `.env` 的 `V3_IMAGE_TAG` 一致）
- 账号：`liulonghai`（超管）、`liulongfei`（渠道）
- 生产环境 `10.20.3.10` 未连接、未修改
- 证据目录：`test-evidence/20261008-r21-hardware-workload-audit/`

## 1. 结论

本轮收口 R20 报告第 5 章遗留的两项：

| R20 遗留项 | 本轮结果 |
| --- | --- |
| 5.1 15 条硬件工作量映射未迁移 | **已补录**：`catalog.workload_mappings` 由 35 条增至 50 条（功能 35 + 硬件 15）；15 条迁移错误全部关闭；报价试算由“未命中回退公式”改为命中交付规则 |
| 5.2 审计日志缺“变更前后”详情 | **已补齐**：后端返回变更前后与请求上下文，前端新增行点击详情弹窗（基本信息 / 变更前后 / 附加信息） |

顺带修复了同一根因导致的第二处缺陷：35 条功能映射的 `delivery_tags` 在迁移时全部写空，导致软件产品同样命中不到交付规则；本轮按 V2 快照回填，标签非空映射由 0 条变为 40 条（功能 35 + 硬件 5）。

## 2. 硬件工作量补齐

### 2.1 根因

V2 的 `implementationWorkloadMappings` 共导出 50 条（35 条 `itemType=feature`、15 条 `itemType=hardware`）。

迁移脚本按 `featureId` 关联 `catalog.product_features.v2_source_id`：

- 功能记录 `featureId=FEAT-*`，能关联成功，35 条落表；
- 硬件记录 `featureId=HW-*`，实际指向 `catalog.hardware_products.v2_source_id`，关联失败，15 条被跳过并写入 `migration.migration_errors`（错误码 `S8_4_WORKLOAD_FEATURE_MISSING`）。

第二个根因：落表的 35 条功能映射 `delivery_tags` 写成空数组。报价试算取标签时会回退到 `workload_classifications.classification_code`（`EPP` / `DES` / `NXG`），与交付规则的 `deliveryTag`（`EPP_BASE` / `SENSITIVE_DATA` / `UNIDES` / `UNIAV` / `NXG_NO_DLP` / `NXG_WITH_DLP`）对不上，于是全部走到“工作量规则未命中，按基础公式建议”。

### 2.2 数据补录（测试库，事务内执行）

补录脚本：`test-evidence/20261008-r21-hardware-workload-audit/硬件工作量补录.sql`
执行记录：先以 `ROLLBACK` 预演核对行数，再正式 `COMMIT`。

1. **回填功能映射交付标签**（35 条）：按 `v2_source_id` 取 `migration.v2_raw_records` 中 `source_updated_at` 最新一条的 `data.deliveryTags` 写回。标签分布：`EPP_BASE` 30、`SENSITIVE_DATA` 2、`UNIAV` 2、`UNIDES` 1。
2. **补录硬件映射**（15 条）：`v2_source_id = IWM-HW-*`，`product_ref_type='hardware'`，`product_ref_id` 取 `catalog.hardware_products.v2_source_id = replace(source_id,'IWM-HW-','HW-')` 的行；`status_code='active'`。
   - 5 条带交付标签且分类为 `NXG`：`IWM-HW-1779257477317`（安渡-X2，`NXG_NO_DLP`）、`IWM-HW-1779257534676`（安渡-X3，`NXG_WITH_DLP`）、`IWM-HW-1779258190923`（安渡-X3-hc，`NXG_WITH_DLP`）、`IWM-HW-1779258506553`（UNXG-PatchEx，`NXG_NO_DLP`）、`IWM-HW-1779258563041`（LS-HW-AV-T，`NXG_NO_DLP`）；
   - 10 条 V2 本身无标签：`LV-7050`、`LV-7050-A`、`准入-N1/N2/N3`、`UNACC-1050/1100`、`P1/P2/P3`，分类留空、`delivery_tags` 为空数组——**按 V2 原样保留，未替业务臆造标签**。
3. **关闭迁移错误**（15 条）：`resolved_at` 置当前时间，`resolution_note` 写明补录口径。

补录后校验（库内真值）：

| 校验项 | 补录前 | 补录后 |
| --- | --- | --- |
| 工作量映射总数 | 35 | 50 |
| 其中硬件映射 | 0 | 15 |
| 交付标签非空映射 | 0 | 40（功能 35 + 硬件 5） |
| 未解决迁移错误 | 15 | 0 |

明细快照：`test-evidence/20261008-r21-hardware-workload-audit/工作量映射-库内快照.csv`

### 2.3 新 UI 补齐：工作量配置页新增「产品工作量映射」

> 背景：测试环境 nginx 已把 `admin.html / partner.html / login.html` 301 重定向到新入口（`/admin`、`/partner`、`/login`），
> 老 UI 页面不再对外可达。因此老 UI 的「产品映射规则」（产品名称 / 类型 / 模块分类 / 产品编码型号 / 已映射产品类型 / 状态 / 操作）
> 必须在新 UI 内闭环，本轮即按该列结构补面板。老 UI 与新 UI 读取的是同一张表、同一个接口 `/api/workload/mappings`，补录数据两边同时生效。

原 `/admin/workload-config` 只展示规则清单，看不到也改不了产品映射（老 UI 的「工作量配置 = 产品映射 + 交付规则」缺了一半）。本轮把该页改为 `war-kpis + grid-2` 骨架：

- 左面板「产品工作量映射」：产品名称、类型（硬件/软件）、产品编码/型号、交付标签、状态、配置；支持关键字搜索与类型筛选，行内选择交付标签后保存（复用既有接口 `PUT /api/workload/mappings/:id`）。
- 右面板「工作量规则」：合并展示交付工作量 15 条与实施工作量 24 条（共 39 条），带类型筛选；实施规则显示分类与点数区间，交付规则显示交付标签与适用条件。
- 六项指标：产品工作量映射 64 条（硬件 22 / 软件 42）、已配交付标签 40 条、工作量规则 39 条（交付 15 / 实施 24）、启用规则 39 条、交付标签 6 个、平均人天 8.6（与 R17 记录的口径值一致）。

保存语义与原「标准工作量配置」保持一致：保存时置 `active=true`；选择“不参与交付工作量”则写入空标签并由后端将该产品的映射整体停用（软删除，可再次配置恢复）。

### 2.4 报价试算验证（测试环境真实接口）

| 场景 | 结果 |
| --- | --- |
| 硬件 安渡-X3（`NXG_WITH_DLP`），100 点 | 8 人天，说明「100点，NXG（含DLP）8人天」 |
| 硬件 安渡-X2（`NXG_NO_DLP`），100 点 | 4 人天，说明「100点，NXG（不含DLP）4人天」 |
| 软硬件组合：敏感内容识别模块 + 安渡-X3 | 8 人天，说明「NXG（含DLP）6人天、敏感数据梳理2人天」——组合场景走 `comboPersonDays` |
| 硬件 准入-N1（V2 无标签） | 2.5 人天，仍走基础公式（与 V2 行为一致） |
| 软件 透明加解密客户端（`UNIDES`） | 1 人天，说明「100点，UniDES1人天」 |

## 3. 审计详情视图

### 3.1 后端

`apps/api/src/business-store.ts` 的 `审计查询SQL()`：`原始数据` 字段在原有 `extra_json` 上合并 `jsonb_strip_nulls(jsonb_build_object(...))`，新增暴露 `beforeJson`、`afterJson`、`moduleCode`、`actionCode`、`targetType`、`targetId`、`requestId`、`actorRole`、`ip`。原有键保持不变，`jsonb_strip_nulls` 保证空值不进入响应。

### 3.2 前端

`apps/web/src/features/platform/AuditLogPage.vue`：

- 列表行可点击，打开「审计详情」弹窗，分三段：
  - 基本信息：时间、操作人、角色、模块、动作、结果、对象类型、对象编号、IP、请求编号；
  - 变更前后：字段 / 变更前 / 变更后三列，值发生变化的行绿色高亮；两值相同时正常显示，未记录变更时给出空态提示；
  - 附加信息：`extra_json` 中的其余键值（排除内部键与空对象）。
- 保留 R20 的服务端分页（每页 40 条）与 300ms 防抖关键字查询。

### 3.3 验证

| 场景 | 结果 |
| --- | --- |
| 最新记录（本轮工作量保存日志） | 弹窗三段齐全；变更前后显示 `active: — → 是`、`deliveryTags: — → []`；附加信息 `source=stage9.13` |
| V2 历史记录（2026/08/13 登录成功，梁婉琦） | 基本信息含 IP `10.18.16.22`、请求编号；变更前后 10 行 |
| 真实差异记录（2026/09/29 商机编辑·推进阶段） | 变更前后 10 行，`stage: registered → design` 高亮为变化行；`name`/`amount`/`customer` 等未变化行正常展示 |
| 数据面 | 库内审计 1820 条：1810 条有变更后、171 条有非空变更前、638 条为 V2 迁移来源、777 条含附加信息 |

## 4. 部署

| 项 | 值 |
| --- | --- |
| 前端镜像 | `lianruan-crm-v3-nginx:3.0.0-stage10.20261008-protolign5`（`WorkloadConfigPage--Vtz9qoK.js`、`AuditLogPage-Cuiy6CMw.js`） |
| 后端镜像 | `lianruan-crm-v3-api:3.0.0-stage10.20261008-protolign4`（`business-store.js` 含新审计 SQL）；同时打 `protolign5` 标签 |
| compose | `/opt/lianruan-crm-v3/compose`，`V3_IMAGE_TAG=3.0.0-stage10.20261008-protolign5` |
| 容器状态 | nginx / api-1 / api-2 全部 healthy |
| 回退备份 | `/opt/lianruan-crm-v3/compose/.env.bak-before-r21workload`、`.env.bak-before-r21audit`；数据备份 `/opt/lianruan-crm-v3/backups/r21-data-fix/pre-r21-workload-mappings-and-errors.sql` |

## 5. 回归验证

- 工作量配置页：`产品工作量映射` 首屏 64 行；搜索「安渡」命中 3 条硬件；类型筛选“硬件产品”命中 22 行；规则筛选“实施工作量”命中 24 行、默认 39 行。
- 编辑闭环：`准入-N1` 未映射 → 配置 `NXG（不含DLP）` 保存成功 → 还原为“不参与交付工作量”，页面与库内均回到 V2 原始状态（已用备份核对，测试残留行已清理）。
- 全量路由复验：62 条路由全部正常，桌面越界字号 0、横向溢出 0、控制台错误 3 条（公开页登录前 `/api/auth/me` 401，与 R20 基线一致）、疑似空白 6 条（移动端新建页，与 R20 基线一致）——**无回归**。明细：`test-evidence/20261008-r21-hardware-workload-audit/全量路由复验-protolign5.json`。
- 前端单测：`apps/web` 22 个测试文件 / 130 个用例全通过；`vue-tsc` 类型检查通过。
- 后端单测：`apps/api` 81 失败 / 69 通过 / 31 跳过，失败原因全部为本地无 PostgreSQL（`ECONNREFUSED 127.0.0.1:5432`，共 77 处直连失败，其余为同一根因导致的 500 断言），与改前基线一致，非代码回归。
- 后端审计 SQL 另在测试库上直接执行校验：列名、`jsonb_strip_nulls`、`host(ip)` 均正常返回，2 条样例数据字段完整。

## 6. 保留项与说明

1. 10 条 V2 无标签硬件映射保持空标签：这是 V2 原状，若业务要为其配置交付标签，可在页面「配置」中直接选择。
2. 实施工作量规则（按 `classification × 点数区间` 的 24 条）本轮只做展示保留，未新增编辑能力——老 UI 亦以只读为主，如需编辑另行立项。
3. `sensitiveKeyword` 字段未迁入 V3 数据模型（仅 V2 的文档水印模块为 true），本轮不臆造字段；如业务需要，需先补数据模型。
4. 无标签产品的“不参与交付工作量”为软停用：映射行保留但 `status_code='disabled'`，再次配置标签即可恢复。

## 7. 回退步骤

1. 前端：`cd /opt/lianruan-crm-v3/compose && cp -p .env.bak-before-r21audit .env && docker compose up -d --no-deps nginx api-1 api-2`（回退到 `protolign3` / `protolign2`）。
2. 后端：把 `.env` 的 `V3_IMAGE_TAG` 改回 `3.0.0-stage10.20261008-protolign2` 后同样执行上面命令。
3. 数据：`psql -f /opt/lianruan-crm-v3/backups/r21-data-fix/pre-r21-workload-mappings-and-errors.sql` 可还原 `catalog.workload_mappings` 与 `migration.migration_errors` 到补录前状态（脚本为 `--column-inserts` 数据快照，执行前需先 `TRUNCATE` 对应表或按 `v2_source_id` 精确删除）。
