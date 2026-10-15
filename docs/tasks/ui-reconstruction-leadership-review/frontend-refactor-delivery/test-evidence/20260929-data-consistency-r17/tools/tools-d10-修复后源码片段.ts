// 文件：apps/api/src/v2-compat-routes.ts（函数 保存V2用户）
// D-10 修复：显式传入 status 时以本次请求为准，未传入时保持原有快照行为。

  // 显式传入 status 时必须以本次请求为准：历史实现无条件沿用快照状态，
  // 会导致「编辑渠道成员并把状态改为停用」不生效，出现成员已停用、登录账号仍可登录的矛盾。
  const 显式状态 = 是否包含正文键(输入, ["status"]) ? 读取正文文本(输入, ["status"], "").trim() : "";
  const 待转状态 = 显式状态 || (已有账号?.status ? String(已有账号.status) : "active");
  const status = 转V3账号状态(待转状态);

// 修复前（基线，仅供对比）：
//   const 待转状态 = 已有账号?.status
//     ? String(已有账号.status)
//     : 读取正文文本(输入, ["status"], "active");

// 文件：apps/api/src/business-store.ts（函数 查询通用列表）
// D-7 修复：补唯一键兜底排序，消除同 created_at 并列行的跨页漂移。
//
//   // 必须带唯一键兜底排序：V2 迁移数据存在大量同一 created_at 的并列行，
//   // 只按「创建时间」排序时 PostgreSQL 不保证跨页稳定，会出现翻页重复与记录遗漏。
//   const listSql = `SELECT * FROM (${baseSql}) t ORDER BY "创建时间" DESC NULLS LAST, "id" ASC LIMIT ...`;
