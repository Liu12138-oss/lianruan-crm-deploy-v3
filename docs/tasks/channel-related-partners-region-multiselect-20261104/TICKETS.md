# 渠道上下级可见性与区域价格多选实施单

## 实施切片

| 编号   | 任务                               | 主要文件                                                                                 | 验收标准                                                           | 状态   |
| ------ | ---------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------ |
| CRP-01 | 删除渠道列表重复快捷区块           | `apps/web/src/features/channel/ChannelListPage.vue`                                      | 红框区块及无引用样式删除，核心档案入口保留                         | 已完成 |
| CRP-02 | 扩展直属上下级渠道可见性与关系展示 | `apps/api/src/business-store.ts`、`apps/api/src/v2-compat-routes.ts`、渠道列表与档案页面 | 一级可看直属二级，二级可看直属一级；无关渠道不可见；上下级档案只读 | 已完成 |
| CRP-03 | 区域价格覆盖改为多选并补齐兼容校验 | 产品目录、价格规则页面、V2 产品接口                                                      | 单选/多选均可用，去重并同步 `region`/`regions`，按覆盖区域取价一致 | 已完成 |
| CRP-04 | 补齐 API 与 Web 自动化回归         | API 业务测试、报价价格矩阵测试、Web 源码契约测试                                         | 上下级范围、越权、多区域保存与展示均有回归                         | 已完成 |
| CRP-05 | 构建并发布测试环境                 | 新版本镜像与测试环境 Compose 配置                                                        | 版本、健康检查一致，数据库迁移数不变                               | 已完成 |
| CRP-06 | 测试环境真实账号验收与报告         | 验收脚本、截图、报告                                                                     | P066/P064、P175/P062 与无关渠道权限逐项通过，临时数据清理          | 已完成 |

## 完成结果

- 实施完成时间：2026-11-04。
- 测试环境版本：`3.0.0-stage10.20261104-channel-related-region-r2`。
- 构建提交：`local-channel-related-region-r2-20261104`。
- 实机验收：11/11 通过，0 失败。
- 自动化回归：API 242 项通过、3 项跳过；Web 236/236；Shared 20/20；Worker 62 项通过、10 项跳过。
- 交付报告：`outputs/01a11954-3564-7ba0-bf8f-5db6972bbbe4/测试执行-渠道关系与区域多选-20261104/渠道上下级可见性与区域价格多选-测试环境最终报告.html`。
- 数据状态：临时功能 `QWQ-REGION-1793779528068` 已归档；`QWQ-%` 活跃残留为 0；有效功能数量为 55。
- 发布保护：未新增数据库迁移；PostgreSQL、Redis 未重建；老 UI/V2 与生产环境未修改。

## 阻塞关系

- CRP-02 依赖 CRP-01 完成页面结构收口。
- CRP-03 可与 CRP-02 并行实施，但统一回归必须等待两者完成。
- CRP-04 依赖 CRP-01 至 CRP-03 完成。
- CRP-05 依赖 CRP-04 全部通过。
- CRP-06 依赖 CRP-05 发布成功。

## 验证命令

```bash
npm --workspace @lianruan/api exec -- vitest run tests/business.test.ts tests/quote-price-matrix.test.ts --maxWorkers=1 --minWorkers=1
npm --workspace @lianruan/web exec -- vitest run tests/channel-maintenance-completion.test.ts tests/ui-refactor-module-completion.test.ts tests/r38-org-subtree-members-and-region-filter.test.ts
npm --workspace @lianruan/api run check
npm --workspace @lianruan/web run check
npx prettier --check apps/api/src/business-store.ts apps/api/src/v2-compat-routes.ts apps/api/tests/business.test.ts apps/api/tests/quote-price-matrix.test.ts apps/web/src/features/channel/ChannelListPage.vue apps/web/src/features/channel/ChannelProfilePage.vue apps/web/src/features/product/ProductCatalogPage.vue apps/web/src/features/product/PricingRulesPage.vue apps/web/src/features/product/PricingCenterPage.vue apps/web/tests/channel-maintenance-completion.test.ts apps/web/tests/ui-refactor-module-completion.test.ts
```
