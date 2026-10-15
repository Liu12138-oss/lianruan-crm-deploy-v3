# 前端 UI 重构落地文档索引

本目录面向前端开发、测试和交付，按“总方案 + 公共基线 + 模块落地 + 测试交付”组织。

## 阅读顺序

1. `00-MASTER-FRONTEND-REFACTOR-PLAN.md`
2. `01-DESIGN-SYSTEM-AND-ADAPTATION.md`
3. `02-PERMISSION-AND-SCOPE.md`
4. 按模块阅读 `03` 至 `11`
5. `12-IMPLEMENTATION-TEST-AND-ROLLBACK.md`
6. `13-REFERENCE-ARCHITECTURE-AND-MODERNIZATION.md`
7. `14-RISK-REGISTER.md`
8. `15-AGENT-EXECUTION-GUIDE.md`
9. `16-TRACEABILITY-MATRIX.md`
10. `17-ISSUE-FEEDBACK-AND-REWORK-PROTOCOL.md`
11. `templates/`
12. `TEST-ENV-BASELINE-20260923.md`
13. `TEST-ENV-BUSINESS-BASELINE-REPORT.md`
14. `TEST-ENV-REFACTOR-VERIFICATION.md`
15. `FINAL-UI-REFACTOR-DELIVERY-R10.md`
16. `18-REMAINING-UI-IMPLEMENTATION-PLAN.md`
17. `20-FULL-MATRIX-VERIFICATION-R11.md`
18. `21-COVERAGE-MATRIX-R11.md`
19. `FINAL-UI-REFACTOR-DELIVERY-R11.md`
20. `COMPARISON-GALLERY.html`

- 开发与验证脚本：`tools/verify-test-env-full-matrix.mjs`、`tools/probe-interactions.mjs`、`tools/render-r11-release-docs.mjs`

21. `22-UNIFIED-ENTRY-R12.md`（统一入口与旧入口 301 重定向说明）
22. `23-PROTOTYPE-FIDELITY-AUDIT.md`（原型一致性审计与改造方案）
23. `24-FULL-PROTOTYPE-REBUILD-PLAN.md`（全量原型一致性重构方案，含真实数据与升级兼容口径）
24. `25-PROTOTYPE-ALIGNMENT-R13.md`（原型一致性改造交付说明 r13）
25. `26-LEAD-MODULE-API-CONTRACT.md`（线索管理接口契约：UI 已完成，业务待接入）
26. `27-PROTOTYPE-METRIC-ALIGNMENT-R14.md`（原型画板逐页对齐报告 r14）
27. `28-BUSINESS-FLOW-VERIFICATION.md`（业务流程回归验证报告：38 步全通过）
28. `29-FORMAT-AND-TYPOGRAPHY-FIX.md`（字体与格式一致性修复报告）
29. `30-PROTOTYPE-FIDELITY-FIX-R15.md`（原型保真修复 r15）
30. `31-PROTOTYPE-PANEL-PAGES-AND-KPI-R16.md`（面板页与 KPI 对齐 r16）
31. `32-DATA-CONSISTENCY-AND-BUSINESS-COMPLETENESS-R17.md`（数据一致性与业务完整性 r17）
32. `33-NEW-UI-TYPOGRAPHY-UNIFICATION-R18.md`（新 UI 排版统一与全路由复核 r18）
33. `34-PROTOTYPE-STRUCTURE-ALIGNMENT-R19.md`（与目标视觉模型结构对齐 r19：商机 / 报价 / 客户）
34. `35-TEST-DATA-AVAILABILITY-R20.md`（测试环境数据与原始数据可用性核查 r20）
35. `36-HARDWARE-WORKLOAD-AND-AUDIT-DETAIL-R21.md`（硬件工作量映射补录与审计详情视图 r21）
36. `37-TYPEFACE-UNIFICATION-AND-BOX-ALIGNMENT-R22.md`（字体族统一与方框对齐修复 r22）
37. `38-RESPONSIVE-ARTBOARD-R23.md`（作战室画板自适应口径：修复 Windows 松 / Mac 紧 r23）
38. `39-QUOTE-BUILDER-AND-TOP-GAP-R24.md`（报价单三栏重构、区域覆盖与分销等级取价展示、全站 62px 顶部留白修复 r24）
39. `40-ORDER-APPROVAL-QUANTITY-PRINT-R25.md`（订单审批链按角色对齐、报价单模块数量可调、报价单打印、中文正楷统一与渠道端跳转修正 r25）
40. `41-EMBEDDED-KAITI-FONT-R26.md`（内嵌霞鹜文楷 GB 子集，Windows 与 macOS 字形完全一致 r26）
41. `42-QUOTE-MODULE-GRID-R27.md`（报价单模块改回 V2 圆角方格，渠道端报价页统一到新 UI r27）
42. `43-QUOTE-TIER-BOUNDARY-R28.md`（报价单阶梯价越界不再算 0，渠道等级专用价全 0 时按标准阶梯 × 比例折算 r28）
43. `44-CHANNEL-PRODUCT-ORG-AUDIT-R29.md`（渠道工商与合作经营摘要、产品目录维护、组织账号入口与审计导航 r29）
44. `45-CONFIG-SUBMENU-AND-PRODUCT-CATALOG-R30.md`（管理配置收口为顶部「配置」二级菜单，产品维护按老 UI 拆成子目录 r30）
45. `46-PROFILE-APPROVAL-AND-REVIEW-ENTRY-R31.md`（渠道档案格式对齐、审批「已审批」留存、审核中心独立一级入口 r31）
46. `47-WORKLOAD-PROFIT-AND-RETURN-R32.md`（工作量配置页空白与返回收口、订单内部收益核算补齐、返回按钮全站统一 r32）
47. `48-WORKLOAD-RULE-ALIGN-ORDER-DETAIL-R33.md`（交付工作量规则可维护、返回按钮胶囊化、成员/档案页头对齐、订单中心中栏补齐 r33）
48. `49-ORDER-DETAIL-MERGE-R34.md`（订单中心四区融合、区管/提报人姓名口径、明细总价、内部收益核算落位 r34）
49. `50-QUOTE-MODE-SELECTION-R35.md`（报价单套餐选中与报价方式切换不再清空已勾选模块 r35）
50. `51-AUDIT-MESSAGE-CHANNEL-R36.md`（操作审计分类筛选、消息中心返回与中文化、渠道六环节与活跃度/客单价/原厂资质指标 r36）
51. `52-CHANNEL-STAGE-TRACK-AND-USER-FIELD-R37.md`（渠道合作环节改商机进度式轨道、全站后端字段与状态码中文化 r37）
52. `53-ORG-SUBTREE-AND-REGION-FILTER-R38.md`（组织架构部门含子部门成员、渠道商与商机列表按区域检索 r38）
53. `54-DASHBOARD-ORDER-AND-PARTNER-CATALOG-R39.md`（工作台我的待办移到左侧、渠道端产品目录隐藏价格规则入口与管理员说明 r39）
54. `55-PARTNER-CATALOG-CREATE-ORDER-TOTAL-R40.md`（渠道端产品目录隐藏全部价格、渠道端补齐新建客户/商机/报价入口、订单明细总价贴底 r40）
55. `56-CUSTOMER-REGISTRATION-APPROVAL-R41.md`（客户报备审核动作补齐：通过/驳回/重新提交、审批记录同步修复、报备商机入口 r41）
56. `57-ORDER-PREAPPROVAL-R42.md`（订单预审目录自检与拒绝启动、报备/订单审计补齐、幽灵审批迁移 S10-027、导入脚本防事件回放与附件权限修复 r42）

完整交付包：`../lianruan-crm-v3-ui-refactor-delivery-20260923-r11.zip`（SHA256 见同名 `.sha256` 文件）。

## 模块索引

- 工作台：`03-DASHBOARD-WORKBENCH.md`
- 客户：`04-CUSTOMER-MANAGEMENT.md`
- 线索：`05-LEAD-MANAGEMENT.md`
- 商机：`06-OPPORTUNITY-MANAGEMENT.md`
- 报价：`07-QUOTE-MANAGEMENT.md`
- 订单：`08-ORDER-MANAGEMENT.md`
- 渠道：`09-CHANNEL-MANAGEMENT.md`
- 产品与价格：`10-PRODUCT-PRICING-WORKLOAD.md`
- 审核、消息、组织与账号：`11-APPROVAL-MESSAGE-ORGANIZATION.md`

## 当前边界

- 只做前端。
- 线索管理只做 UI。
- 客户与商机关联只预留。
- 未建设和未上线模块不进入本轮正式 UI。
- 默认电脑端，支持 13 / 14 / 15 英寸笔记本和 21 / 24 英寸显示器。

## 文档自检

```bash
node docs/tasks/ui-reconstruction-leadership-review/frontend-refactor-delivery/validate-delivery-docs.mjs
```
