# 收益核算报价与订单入口完善验证记录

## 1. 验证范围

- 管理员“报价管理”详情收益入口。
- 管理员“订单管理”详情只读收益入口。
- 商机关联报价详情收益组件复用。
- 区管、超管、普通管理员前端显隐。
- 订单冻结前非正式结果和冻结后正式快照提示。
- 旧区管登录缓存自动刷新和区域恢复。

## 2. 修改文件

- `apps/web/public/admin-app.js`
- `apps/web/tests/quote-profit-entry.test.ts`
- `apps/web/e2e/quote-profit-entries.spec.ts`
- `docs/tasks/quote-profit-quote-order-entries/DESIGN.md`
- `docs/tasks/quote-profit-quote-order-entries/TICKETS.md`
- `docs/tasks/quote-profit-quote-order-entries/docs/DECISION-LOG.md`
- `docs/tasks/quote-profit-quote-order-entries/docs/VERIFICATION-RECORD.md`

## 3. 执行结果

| 检查项 | 命令 | 结果 |
| --- | --- | --- |
| JavaScript 语法 | `node --check apps/web/public/admin-app.js` | 通过 |
| 收益入口专项单元测试 | `npx vitest run tests/quote-profit-entry.test.ts` | 5/5 通过 |
| Web 全量测试 | `npm test` | 18 个测试文件、116 项通过 |
| Web 类型检查与构建 | `npm run build` | 通过 |
| Web 全量端到端测试 | `npm run test:e2e` | 54/54 通过 |
| 补丁格式检查 | `git diff --check` | 通过 |

专项 Playwright 覆盖：

1. 超管从报价管理详情查看并可操作收益。
2. 所属区域区管从报价管理详情查看收益。
3. 无收益权限的普通管理员不渲染收益面板。
4. 订单冻结前显示只读非正式收益。
5. 订单冻结后显示只读正式收益快照。
6. 旧区管缓存刷新后恢复区域并显示收益。

## 4. 边界与后续

- 本轮未修改后端接口、数据库、Worker、生产配置和测试服务器。
- 测试使用本地隔离浏览器和模拟接口，不代表测试环境 `10.9.86.66` 已部署。
- 发布前仍需按项目生产升级规范制作包、执行迁移预检、备份、发布和真实账号验收。
