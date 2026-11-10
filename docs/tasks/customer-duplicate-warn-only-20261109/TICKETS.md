# 任务清单

- [x] 增加 `V3_CUSTOMER_DUPLICATE_BLOCK_ENABLED` 配置，默认 `true`。
- [x] 创建报备和修改报备接入放行分支。
- [x] 放行时写入 `warning` 审计，保留冲突客户与提交快照。
- [x] 审计页面补充“警告”中文显示。
- [x] 补充配置测试和 API 集成测试。
- [x] 测试环境切换为放行并完成真实接口验证。
- [x] 清理临时客户、报备、审批数据；受审计只读约束保留 1 条放行审计。

## 验证证据

- `npm --workspace @lianruan/config run test`：12/12 通过。
- `npm --workspace @lianruan/api run check`：通过。
- 报备查重相关定向测试：4/4 通过。
- 测试环境 `10.9.86.66`：`/health/live`、`/health/ready`、根页面均正常。
- 真实重复报备：`HTTP 200`，审计 `result_code=warning`、`duplicatePolicy=warn_only`。

