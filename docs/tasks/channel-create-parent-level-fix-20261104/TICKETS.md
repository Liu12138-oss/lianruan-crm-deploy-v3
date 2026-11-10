# 新建渠道商、一级渠道选择与分销层级保存实施单

| 编号    | 任务                             | 主要文件                                    | 验收标准                                         | 状态   |
| ------- | -------------------------------- | ------------------------------------------- | ------------------------------------------------ | ------ |
| CCPL-01 | 透传渠道接口真实错误             | `channel-profile-client.ts`、Web 客户端测试 | 字符串与对象错误均显示原文                       | 已完成 |
| CCPL-02 | 统一一级渠道有效判断与候选过滤   | `channel-level.ts`、渠道列表、渠道档案      | P175 可选；停用、归档、跨区域不可选              | 已完成 |
| CCPL-03 | 修复历史一级渠道档案与保存       | `v2-compat-routes.ts`、API 回归测试         | 有有效下级且主档为 none 时返回 primary，保存成功 | 已完成 |
| CCPL-04 | 后端上级校验兼容有效下级关系     | `v2-compat-routes.ts`、API 回归测试         | 有有效下级的历史一级可被选为上级                 | 已完成 |
| CCPL-05 | 关系统计排除归档渠道             | `business-store.ts`、`v2-compat-routes.ts`  | 归档渠道不进入上下级数量与候选                   | 已完成 |
| CCPL-06 | 自动化、构建、测试环境验收与报告 | API/Web 测试、验收脚本、截图、报告          | 三项问题在测试环境全部通过，临时数据清理         | 已完成 |

## 完成结果

- 完成时间：2026-11-04。
- 测试环境版本：`3.0.0-stage10.20261104-channel-create-parent-fix-r1`。
- 构建提交：`local-channel-create-parent-fix-r1-20261104`。
- 实机验收：4/4 通过，0 失败。
- 自动化：API 242 项通过、3 项跳过；Web 241/241；Shared 20/20；Worker 62 项通过、10 项跳过。
- 发布前备份：`/opt/lianruan-crm-v3/backups/local/20261104-171312-before-channel-create-parent-fix-r1`。
- 数据状态：临时渠道与关系残留均为 0；P066 已写回一级；保留 1 条新建审计留痕；迁移仍为 79 个。
- 交付报告：`outputs/01a11954-3564-7ba0-bf8f-5db6972bbbe4/测试执行-新建渠道与一级选择-20261104/新建渠道商与一级渠道选择-测试环境最终报告.html`。

## 验证命令

```bash
npm --workspace @lianruan/api exec -- vitest run tests/v2-compat.test.ts --maxWorkers=1 --minWorkers=1
npm --workspace @lianruan/web exec -- vitest run tests/channel-level.test.ts tests/channel-profile-client-error.test.ts tests/channel-maintenance-completion.test.ts
npm --workspace @lianruan/api run check
npm --workspace @lianruan/web run check
```
