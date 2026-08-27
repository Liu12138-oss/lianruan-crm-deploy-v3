// 生成「超管审核界面 - 审批渠道账号」相关的表与字段清单 Excel。
// 数据来源：apps/api/src/business-store.ts、apps/api/src/v2-compat-routes.ts 实际 SQL，
// 字段定义与 database/migrations/*.sql 对齐。
// 用法：node scripts/export-approval-tables.mjs
import path from 'node:path';
import * as XLSX from 'xlsx';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'output', `超管审核_审批渠道账号_表与字段_${new Date().toISOString().slice(0, 10).replaceAll('-', '')}.xlsx`);

// ---------- Sheet 1：涉及表总览 ----------
const 表总览 = [
  ['表名', '模式', '中文名', '在「审批渠道账号」流程中的作用'],
  ['approvals', 'ops', '审批主档', '渠道账号审批记录（target_type=user），超管审核列表/详情的主数据源'],
  ['approval_events', 'ops', '审批事件', '记录提交/通过/驳回等状态流转历史'],
  ['users', 'iam', '账号用户', '被审批的渠道账号本体；通过→active，驳回→disabled'],
  ['partner_members', 'channel', '渠道成员', '账号与渠道的归属关系；通过→active（ended_at 置空），驳回→disabled（ended_at=now()）'],
  ['partners', 'channel', '渠道伙伴', '渠道商本体；仅审批类型为 partner 时更新状态'],
  ['audit_logs', 'audit', '操作审计日志', '记录审核动作 review_pending_approval'],
  ['outbox_events', 'ops', '发件箱事件', '审批待办/结果事件通知（消息平台订阅）'],
  ['regions', 'org', '区域', '列表展示关联：渠道所属区域'],
  ['registrations', 'crm', '客户报备', '审核查询 SQL 中 LEFT JOIN，用于同一审核中心展示报备审批'],
  ['customers', 'crm', '客户主档', '审核查询 SQL 中 LEFT JOIN'],
  ['orders', 'crm', '订单', '审核查询 SQL 中 LEFT JOIN，用于订单审批展示'],
];

// ---------- Sheet 2：ops.approvals 字段 ----------
const 审批字段 = [
  ['字段名', '数据类型', '字段含义', '审批渠道账号时的取值/说明'],
  ['id', 'uuid', '主键 ID（UUID）', '审批记录 ID'],
  ['v2_source_id', 'text', 'V2 原始记录 ID（迁移来源标识）', `固定为 account:{账号UUID}，唯一，ON CONFLICT 用于幂等重提`],
  ['approval_type_code', 'text', '审批类型编码', 'partner_admin（企业管理员）或 staff（员工）'],
  ['target_type', 'text', '目标类型', "渠道账号审批固定为 'user'；另有 staff/account/partner/registration/order"],
  ['target_id', 'uuid', '目标 ID', '被审批账号 id（指向 iam.users.id）'],
  ['applicant_user_id', 'uuid', '申请人（用户 ID）', '提交审批的区管/渠道管理员（指向 iam.users.id）'],
  ['applicant_partner_id', 'uuid', '申请渠道伙伴 ID', '账号所属渠道（指向 channel.partners.id）'],
  ['status_code', 'text', '状态编码', 'pending=待审核 / approved=已通过 / rejected=已驳回'],
  ['created_at', 'timestamptz', '创建时间', '提交审批时间'],
  ['updated_at', 'timestamptz', '更新时间', '审核处理时间'],
  ['extra_json', 'jsonb', '扩展字段（JSON 对象）', '审批快照，见下方「extra_json 业务键」'],
];

const 审批extra键 = [
  ['键名', '含义', '示例/取值'],
  ['targetType', '目标类型', "固定 'user'"],
  ['type', '账号角色', 'partner_admin / staff'],
  ['targetName', '姓名/显示名', '来自输入 name/displayName'],
  ['username', '登录用户名', '来自输入 username'],
  ['staffRole', '员工职位', '来自输入 staffRole'],
  ['partnerUuid', '渠道 UUID', 'channel.partners.id'],
  ['partnerId', '渠道编号', 'v2_source_id/partner_code'],
  ['targetPartnerId', '渠道编号（冗余）', '同上'],
  ['targetPartnerName', '渠道名称', 'channel.partners.partner_name'],
  ['region', '区域名称', 'org.regions.region_name'],
  ['regionId', '区域 ID', 'org.regions.id'],
  ['createdBy', '申请人姓名', '当前用户 displayName'],
  ['createdByRole', '申请人角色', '当前用户 roleName'],
  ['phone', '联系电话', '来自输入 phone'],
  ['email', '邮箱', '来自输入 email'],
  ['status', '审批状态快照', 'pending/approved/rejected'],
  ['reviewRemark', '审核备注', '超管审核时填写'],
  ['reviewedByName', '审核人姓名', '超管 displayName'],
  ['reviewedAt', '审核时间', 'ISO 时间'],
  ['approvedBy', '通过人', 'approve 时写入'],
  ['approvedAt', '通过时间', 'approve 时写入'],
];

// ---------- Sheet 3：ops.approval_events 字段 ----------
const 事件字段 = [
  ['字段名', '数据类型', '字段含义', '渠道账号审批时的取值/说明'],
  ['id', 'uuid', '主键 ID（UUID）', '事件记录 ID'],
  ['approval_id', 'uuid', '审批 ID', '指向 ops.approvals.id'],
  ['event_code', 'text', '事件编码', 'submit=提交 / approve=通过 / reject=驳回 / update=更新'],
  ['from_status_code', 'text', '来源状态编码', '事件前审批状态'],
  ['to_status_code', 'text', '目标状态编码', '事件后审批状态'],
  ['actor_user_id', 'uuid', '操作人用户 ID', '审核人（超管）ID'],
  ['event_at', 'timestamptz', '事件时间', '事件发生时间'],
  ['reason', 'text', '原因', '审核备注/原因'],
  ['extra_json', 'jsonb', '扩展字段（JSON 对象）', 'actorName 等'],
];

// ---------- Sheet 4：被审批对象字段 ----------
const 用户字段 = [
  ['表名', '字段名', '数据类型', '字段含义', '审批流程中的作用'],
  ['iam.users', 'id', 'uuid', '主键 ID（UUID）', '被审批账号（ops.approvals.target_id 指向这里）'],
  ['iam.users', 'username', 'citext', '登录用户名', '审核界面展示账号'],
  ['iam.users', 'display_name', 'text', '显示名称', '审核界面展示姓名'],
  ['iam.users', 'status_code', 'text', '状态编码（active/disabled/locked）', '审批通过→active；驳回→disabled'],
  ['iam.users', 'extra_json', 'jsonb', '扩展字段', '审核时写入 {status: active|rejected}'],
  ['iam.users', 'v2_source_id', 'text', 'V2 原始记录 ID', 'V2 账号映射'],
  ['iam.users', 'region_id', 'uuid', '区域 ID', '账号所属区域'],
  ['iam.users', 'phone', 'text', '联系电话', '审批快照来源'],
  ['iam.users', 'email', 'citext', '邮箱', '审批快照来源'],
  ['iam.users', 'created_at', 'timestamptz', '创建时间', '账号创建时间'],
  ['iam.users', 'updated_at', 'timestamptz', '更新时间', '账号更新时间'],
  ['channel.partner_members', 'partner_id', 'uuid', '渠道伙伴 ID', '账号所属渠道'],
  ['channel.partner_members', 'user_id', 'uuid', '用户 ID', '账号'],
  ['channel.partner_members', 'member_role_code', 'text', '成员角色（partner_admin/staff）', '账号在渠道内的角色'],
  ['channel.partner_members', 'status_code', 'text', '状态（active/disabled）', '审批通过→active；驳回→disabled'],
  ['channel.partner_members', 'started_at', 'timestamptz', '开始时间', '关系开始时间'],
  ['channel.partner_members', 'ended_at', 'timestamptz', '结束时间', '驳回时置 now()'],
  ['channel.partner_members', 'source_code', 'text', '来源编码', 'manual/iam_sso/wecom'],
  ['channel.partner_members', 'created_by_user_id', 'uuid', '创建人', '提交审批的区管/渠道管理员'],
  ['channel.partners', 'id', 'uuid', '主键 ID', '渠道商（审批类型为 partner 时被更新）'],
  ['channel.partners', 'partner_name', 'text', '渠道名称', '审核界面展示渠道名'],
  ['channel.partners', 'partner_code', 'text', '渠道编码', '审核界面展示渠道编号'],
  ['channel.partners', 'status_code', 'text', '状态（active/disabled/archived）', 'partner 类型审批通过→active；驳回→disabled'],
  ['channel.partners', 'region_id', 'uuid', '区域 ID', '渠道所属区域'],
];

// ---------- Sheet 5：审计字段 ----------
const 审计字段 = [
  ['字段名', '数据类型', '字段含义', '审核动作取值'],
  ['module_code', 'text', '模块编码', "固定 'approvals'"],
  ['action_code', 'text', '动作编码', 'review_pending_approval'],
  ['target_type', 'text', '目标类型', 'user/partner/registration/order'],
  ['target_id', 'text', '目标 ID', '审批记录 id'],
  ['target_name', 'text', '目标名称', '审批标题（targetName）'],
  ['result_code', 'text', '结果编码', 'success'],
  ['message', 'text', '消息', '审核说明'],
  ['before_json', 'jsonb', '变更前', '审核前状态'],
  ['after_json', 'jsonb', '变更后', '审核后状态与备注'],
  ['actor_user_id', 'uuid', '操作人用户 ID', '审核超管'],
  ['actor_username', 'text', '操作人用户名', '审核超管'],
  ['actor_name', 'text', '操作人姓名', '审核超管'],
  ['actor_role', 'text', '操作人角色', 'superadmin'],
  ['request_id', 'text', '请求 ID', '本次请求标识'],
  ['created_at', 'timestamptz', '创建时间', '审计时间'],
];

// ---------- Sheet 6：流程说明 ----------
const 流程说明 = [
  ['步骤', '动作', '数据变更（表 + 字段）', '说明'],
  ['1', '渠道侧提交账号审批（区管/渠道管理员创建员工或企业管理员账号，status=pending）', 'INSERT iam.users（status_code 按 pending 映射）\nINSERT channel.partner_members（status_code=pending 映射，member_role_code=partner_admin|staff）\nINSERT ops.approvals（target_type=user, status_code=pending, v2_source_id=account:{账号UUID}, extra_json 存审批快照）\nINSERT ops.approval_events（event_code=submit → pending）', '入口：保存渠道商员工（v2-compat-routes.ts 保存渠道商员工 → 写入账号审批待办）'],
  ['2', '超管打开审核中心（admin-review / /mobile/pending-approvals）', 'SELECT ops.approvals 列表（审核查询SQL）+ 关联 iam.users / channel.partners / org.regions 展示', '列表行字段：编号、类型、标题、渠道名称、负责人、区域、状态、金额、创建时间、原始数据'],
  ['3', '超管审核通过（approve）', "UPDATE ops.approvals SET status_code='approved', updated_at=now(), extra_json 写入 reviewedByName/reviewedAt\nINSERT ops.approval_events（event_code=approve, from pending → approved）\nUPDATE iam.users SET status_code='active', extra_json.status='active'\nUPDATE channel.partner_members SET status_code='active', ended_at=NULL\nINSERT audit.audit_logs（action=review_pending_approval）", '账号激活，可正常登录使用'],
  ['4', '超管审核驳回（reject）', "UPDATE ops.approvals SET status_code='rejected', updated_at=now(), extra_json 写入 reviewRemark\nINSERT ops.approval_events（event_code=reject, from pending → rejected）\nUPDATE iam.users SET status_code='disabled', extra_json.status='rejected'\nUPDATE channel.partner_members SET status_code='disabled', ended_at=now()\nINSERT audit.audit_logs（action=review_pending_approval）", '账号停用，渠道成员关系结束'],
  ['5', '（仅渠道商入驻审批时）审批类型为 partner', "UPDATE channel.partners SET status_code='active'|'disabled', updated_at=now()", 'target_type=partner 时更新渠道商本体状态'],
];

// ---------- 写 Excel ----------
const wb = XLSX.utils.book_new();

const ws1 = XLSX.utils.aoa_to_sheet(表总览);
const ws2 = XLSX.utils.aoa_to_sheet(审批字段);
const ws2b = XLSX.utils.aoa_to_sheet(审批extra键);
const ws3 = XLSX.utils.aoa_to_sheet(事件字段);
const ws4 = XLSX.utils.aoa_to_sheet(用户字段);
const ws5 = XLSX.utils.aoa_to_sheet(审计字段);
const ws6 = XLSX.utils.aoa_to_sheet(流程说明);

setCols(ws1, [14, 10, 18, 60]);
setCols(ws2, [22, 14, 34, 56]);
setCols(ws2b, [20, 26, 40]);
setCols(ws3, [22, 14, 24, 52]);
setCols(ws4, [26, 22, 14, 30, 56]);
setCols(ws5, [18, 14, 20, 40]);
setCols(ws6, [6, 26, 60, 30]);

XLSX.utils.book_append_sheet(wb, ws1, '涉及表总览');
XLSX.utils.book_append_sheet(wb, ws2, '审批主档 approvals');
XLSX.utils.book_append_sheet(wb, ws2b, 'approvals.extra_json键');
XLSX.utils.book_append_sheet(wb, ws3, '审批事件 events');
XLSX.utils.book_append_sheet(wb, ws4, '账号与渠道字段');
XLSX.utils.book_append_sheet(wb, ws5, '审计日志字段');
XLSX.utils.book_append_sheet(wb, ws6, '审批流程说明');

XLSX.writeFile(wb, OUT);
console.log(`输出文件：${OUT}`);

function setCols(ws, widths) {
  ws['!cols'] = widths.map((w) => ({ wch: w }));
}
