# Agent 执行与交付手册

## 1. 使用方式

其他 Agent 开始开发前按以下顺序阅读：

1. 仓库 `AGENTS.md`。
2. `00-MASTER-FRONTEND-REFACTOR-PLAN.md`。
3. `01-DESIGN-SYSTEM-AND-ADAPTATION.md`。
4. `02-PERMISSION-AND-SCOPE.md`。
5. 当前模块对应的 `03` 至 `11` 模块文档。
6. `12-IMPLEMENTATION-TEST-AND-ROLLBACK.md`。
7. `16-TRACEABILITY-MATRIX.md` 和 `17-ISSUE-FEEDBACK-AND-REWORK-PROTOCOL.md`。

## 2. 本轮边界

- 只修改前端。
- 不修改后端、数据库、爬虫、部署配置和外部接口。
- 线索管理只做 UI 和 mock Repository。
- 客户与商机关联只做不可操作的预留，不接入正式数据。
- 未建设模块不新增正式入口。

## 3. 开发工作流

每个任务严格按照以下顺序执行：

```text
领取任务
→ 阅读模块文档
→ 确认依赖和风险
→ 建立 mock 数据
→ 开发页面和组件
→ 编写单元 / 组件测试
→ 本地浏览器检查
→ 提交测试报告
→ 反馈问题
→ 修复和回归
→ 输出交付证据
```

## 4. 分支和提交

- 分支前缀：`codex/`。
- 每个模块独立提交，不混入无关重构。
- 提交说明包含模块 ID、动作和验证结果。
- 不提交临时截图、构建产物和本地配置。
- 不覆盖其他 Agent 的未完成修改。

## 5. 目标目录

新页面优先进入 Vue feature 目录：

```text
apps/web/src/features/<module>/
  pages/
  components/
  repositories/
  models/
  fixtures/
  permissions/
  tests/
```

公共组件进入：

```text
apps/web/src/design-system/
```

共享状态和阶段字典进入：

```text
packages/shared/src/
```

不得继续把大规模新页面加入：

```text
apps/web/public/admin-app.js
apps/web/public/partner-app.js
```

## 6. 必跑命令

```bash
npm --workspace @lianruan/web run check
npm --workspace @lianruan/web run test
npm --workspace @lianruan/web run build
npm --workspace @lianruan/web run test:e2e
npm run lint
npm run format
```

本轮没有后端修改时，不需要执行数据库迁移和发布命令。

## 7. 开工条件

模块开始开发前必须明确：

- 页面和路由。
- 目标角色。
- 数据范围和字段权限。
- 页面状态。
- 动作和禁用条件。
- mock 数据字段。
- 验收用例。
- 不在范围内的功能。

任一项缺失时不得静默假设，必须记录到问题清单。

## 8. 完成条件

模块完成必须同时满足：

- 页面、路由和导航可实现。
- 角色显示和权限控制通过。
- 所有状态、动作和异常状态完成。
- 单元、组件、浏览器和视觉测试通过。
- 1366 / 1440 / 1600 / 1920 无横向页面溢出和自动换行。
- 无控制台错误和缺失资源。
- 交付报告、测试报告和截图证据完整。
- 已知限制和回滚方式已记录。

## 9. 交付报告

每个 Agent 使用 `templates/MODULE-DELIVERY-REPORT.md` 提交模块结果，并使用 `templates/TEST-EXECUTION-REPORT.md` 记录验证证据。
