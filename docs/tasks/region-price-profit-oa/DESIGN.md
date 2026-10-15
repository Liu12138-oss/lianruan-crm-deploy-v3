# 区管调价、报价一致性与 OA 收益表 PDF

## 已确认口径

1. 区管调价时，模块单价和模块小计统一显示为 `/`。
2. 区管必须填写产品合同额、服务合同额、质保年限和采购维保年限。
3. 产品合同额与服务合同额之和必须等于调整后订单总价，服务端强制校验。
4. 调价同时更新订单总额和关联报价单总额，不修改原始模块数量与历史价格快照。
5. 调价订单收益使用 `weidun-v2-total-input`：以产品合同额、服务合同额和成本规则计算，不再依赖模块展示单价。
6. OA 第一个附件为正式报价单 PDF；第二个附件改为收益核算表 PDF，不再重复上传报价单。
7. 收益不完整或不适用时仍生成 PDF，列出缺失说明，不阻断 OA。
8. 历史单 `LP-2505018-H-smb-liuchengzhou-0512-02` 按订单最终总价 `6630.00` 修复报价金额，产品合同额为 `6630.00`，服务合同额为 `0.00`。

## 本地实现范围

- UI 重构前页面：`apps/web/public/admin-app.js`
- API：`apps/api/src/business-store.ts`、`apps/api/src/quote-profit-store.ts`
- Worker：`apps/worker/src/order-preapproval-store.ts`、`apps/worker/src/quote-profit-store.ts`
- Shared：`packages/shared/src/quote-profit.ts`、`packages/shared/src/formal-quote-pdf.ts`
- 迁移：`20260923_S10_026_区管调价收益口径与历史单修复.sql`
