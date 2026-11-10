# 报价免审批直接转订单实施单

## 实施切片

| 编号   | 任务                                               | 主要文件                                                                                                                                                                                         | 验收标准                                                                       | 状态   |
| ------ | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ | ------ |
| QDA-01 | 服务端开放草稿及历史报价直接转单，同时拦截关闭状态 | `apps/api/src/business-store.ts`                                                                                                                                                                 | 草稿、提交、通过、驳回可转；取消、过期、已转单不可转；重复转单优先返回已有订单 | 已完成 |
| QDA-02 | 新 UI 报价中心移除报价审批入口，改为待转订单视图   | `apps/web/src/features/quote/QuoteCenterPage.vue`                                                                                                                                                | 页面无报价审批按钮，草稿可打开转单弹窗                                         | 已完成 |
| QDA-03 | 商机报价弹窗移除报价审批入口                       | `apps/web/src/features/opportunity/OpportunityCenterPage.vue`                                                                                                                                    | 保留查看、打印、修改和直接转订单，不出现报价审批动作                           | 已完成 |
| QDA-04 | 审核中心退役报价审批分类和待办                     | `apps/web/src/features/approval/ApprovalCenterPage.vue`                                                                                                                                          | 不展示报价审核分类；历史报价审批不进入列表；其他审批正常                       | 已完成 |
| QDA-05 | 工作台和路由文案同步免审批口径                     | `apps/web/src/features/dashboard/DashboardPage.vue`、`apps/web/src/router/index.ts`                                                                                                              | “待转订单”统计和页面说明准确，标准报价不显示 0 元                              | 已完成 |
| QDA-06 | 补齐 API 与 Web 自动化回归                         | `apps/api/tests/quote-order-shipping-contract-metrics.test.ts`、`apps/web/tests/r43-opportunity-inline-followup-quote-entry.test.ts`、`apps/web/tests/quote-order-shipping-contract-web.test.ts` | 覆盖四种可转状态、关闭状态、重复转单、新 UI 无审批按钮                         | 已完成 |
| QDA-07 | 生成测试环境真实链路验收脚本                       | `outputs/01a11954-3564-7ba0-bf8f-5db6972bbbe4/测试执行-报价免审批直接转单-20261104/验收.mjs`                                                                                                     | 覆盖页面、接口、区管补价、附件、取消、权限和数据清理                           | 已完成 |
| QDA-08 | 构建并发布测试环境                                 | 新版本镜像与测试环境 Compose 配置                                                                                                                                                                | 版本、提交、健康检查一致，数据库仍为 79 个迁移版本                             | 已完成 |
| QDA-09 | 测试环境实机验收与数据核对                         | 验收结果、截图、报告                                                                                                                                                                             | 所有验收项通过，临时数据清理，数据总量回到基线                                 | 已完成 |

## 阻塞关系

- QDA-07 依赖 QDA-01 至 QDA-06 完成。
- QDA-08 依赖 QDA-01 至 QDA-07 完成并通过本地验证。
- QDA-09 依赖 QDA-08 发布成功。

## 验证命令

```bash
npm --workspace @lianruan/api exec -- vitest run tests/quote-order-shipping-contract-metrics.test.ts --maxWorkers=1 --minWorkers=1
npm --workspace @lianruan/web exec -- vitest run tests/r43-opportunity-inline-followup-quote-entry.test.ts tests/quote-order-shipping-contract-web.test.ts
npm --workspace @lianruan/api run check
npm --workspace @lianruan/web run check
npx prettier --check apps/api/tests/quote-order-shipping-contract-metrics.test.ts apps/web/src/features/quote/QuoteCenterPage.vue apps/web/src/features/opportunity/OpportunityCenterPage.vue
```

## 回归与回滚

- 回归必须覆盖标准报价免价、渠道分销自动取价、直接转单、区管补价、附件、取消订单、审核中心和老 UI 兼容接口。
- 本轮无数据库迁移，回滚应用镜像即可。
- 发布前保留测试数据库和配置备份，发布后不得执行生产操作。
