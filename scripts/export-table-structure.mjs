// 解析 database/migrations/*.sql，聚合全部表结构并导出 Excel。
// 用法：node scripts/export-table-structure.mjs [输出路径]
import fs from 'node:fs';
import path from 'node:path';
import * as XLSX from 'xlsx';

const ROOT = path.resolve(import.meta.dirname, '..');
const MIGRATIONS_DIR = path.join(ROOT, 'database', 'migrations');
const OUT_DEFAULT = path.join(ROOT, 'output', `V3数据库表结构_${new Date().toISOString().slice(0, 10).replaceAll('-', '')}.xlsx`);

// ---------- SQL 语句拆分（兼容字符串、双引号标识符、美元引用、注释、括号深度） ----------
function splitStatements(sql) {
  const stmts = [];
  let cur = '';
  let i = 0;
  const n = sql.length;
  let inStr = null;
  let inDollar = null;
  let inLineComment = false;
  let inBlockComment = false;
  let depth = 0;

  while (i < n) {
    const ch = sql[i];
    const next = sql[i + 1];

    if (inLineComment) {
      if (ch === '\n') inLineComment = false;
      i++;
      continue;
    }
    if (inBlockComment) {
      if (ch === '*' && next === '/') { inBlockComment = false; i += 2; continue; }
      i++;
      continue;
    }
    if (inDollar !== null) {
      if (sql.startsWith(inDollar, i)) {
        cur += inDollar;
        i += inDollar.length;
        inDollar = null;
        continue;
      }
      cur += ch;
      i++;
      continue;
    }
    if (inStr !== null) {
      cur += ch;
      if (ch === inStr) {
        if (next === inStr) { cur += next; i += 2; continue; }
        inStr = null;
      }
      i++;
      continue;
    }

    if (ch === '-' && next === '-') { inLineComment = true; i += 2; continue; }
    if (ch === '/' && next === '*') { inBlockComment = true; i += 2; continue; }
    if (ch === "'" || ch === '"') { inStr = ch; cur += ch; i++; continue; }
    if (ch === '$') {
      const m = sql.slice(i).match(/^\$[A-Za-z0-9_]*\$/);
      if (m) {
        inDollar = m[0];
        cur += m[0];
        i += m[0].length;
        continue;
      }
    }
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ';' && depth === 0) {
      const t = cur.trim();
      if (t) stmts.push(t);
      cur = '';
      i++;
      continue;
    }
    cur += ch;
    i++;
  }
  const t = cur.trim();
  if (t) stmts.push(t);
  return stmts;
}

// 从 start 指向的 '(' 提取配对的括号组内容（不含首尾括号）
function extractParenGroup(text, start) {
  let i = start;
  let depth = 0;
  let inStr = null;
  while (i < text.length) {
    const ch = text[i];
    const next = text[i + 1];
    if (inStr !== null) {
      if (ch === inStr) {
        if (next === inStr) { i += 2; continue; }
        inStr = null;
      }
      i++;
      continue;
    }
    if (ch === "'" || ch === '"') { inStr = ch; i++; continue; }
    if (ch === '(') depth++;
    if (ch === ')') {
      depth--;
      if (depth === 0) return text.slice(start + 1, i);
    }
    i++;
  }
  return null;
}

// 按顶层逗号切分
function splitTopLevelComma(text) {
  const parts = [];
  let depth = 0;
  let inStr = null;
  let cur = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (inStr !== null) {
      cur += ch;
      if (ch === inStr) {
        if (next === inStr) { cur += next; i++; continue; }
        inStr = null;
      }
      continue;
    }
    if (ch === "'" || ch === '"') { inStr = ch; cur += ch; continue; }
    if (ch === '(') { depth++; cur += ch; continue; }
    if (ch === ')') { depth--; cur += ch; continue; }
    if (ch === ',' && depth === 0) {
      parts.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

const TYPE_PATTERNS = [
  /^timestamp\s+with\s+time\s+zone/i,
  /^timestamp\s+without\s+time\s+zone/i,
  /^time\s+with\s+time\s+zone/i,
  /^time\s+without\s+time\s+zone/i,
  /^double\s+precision/i,
  /^character\s+varying/i,
  /^character/i,
  /^varchar/i,
  /^char/i,
  /^numeric/i,
  /^decimal/i,
  /^integer/i,
  /^bigint/i,
  /^smallint/i,
  /^citext/i,
  /^boolean/i,
  /^text/i,
  /^timestamptz/i,
  /^timestamp/i,
  /^jsonb/i,
  /^json/i,
  /^uuid/i,
  /^bytea/i,
  /^real/i,
  /^serial/i,
  /^bigserial/i,
  /^money/i,
  /^interval/i,
  /^inet/i,
  /^xml/i,
  /^regclass/i,
  /^oid/i,
  /^date/i,
  /^time/i,
];

const CONSTRAINT_KEYWORDS = /^(CONSTRAINT|PRIMARY|UNIQUE|CHECK|FOREIGN|EXCLUDE|LIKE)/i;

// ---------- CREATE TABLE 解析 ----------
function parseCreateTable(stmt, srcFile, ctx) {
  const m = stmt.match(/^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([A-Za-z0-9_.$"]+)\s*\(/i);
  if (!m) return;
  const tableName = m[1].replaceAll('"', '');
  const openIdx = stmt.indexOf('(', stmt.indexOf(m[1]) + m[1].length);
  const body = extractParenGroup(stmt, openIdx);
  if (body === null) return;

  const table = ctx.getTable(tableName, srcFile);
  // CREATE TABLE IF NOT EXISTS：表已存在（前面文件已创建）时第二次定义不生效，跳过避免重复列
  if (table.columns.length > 0) return;
  const parts = splitTopLevelComma(body);

  for (const part of parts) {
    if (CONSTRAINT_KEYWORDS.test(part)) {
      parseTableConstraint(part, table, srcFile);
      continue;
    }
    const colMatch = part.match(/^([A-Za-z0-9_]+)\s+([\s\S]+)$/);
    if (!colMatch) continue;
    const colName = colMatch[1];
    const rest = colMatch[2].trim();
    const col = parseColumnDef(colName, rest, srcFile);
    table.columns.push(col);
  }
}

function parseColumnDef(colName, rest, srcFile) {
  const col = {
    table: null,
    name: colName,
    type: '',
    pk: false,
    unique: false,
    notNull: false,
    default: '',
    references: '',
    checks: '',
    generated: '',
    comment: '',
    source: srcFile,
  };

  let r = rest;
  // 类型
  for (const pat of TYPE_PATTERNS) {
    const mm = r.match(pat);
    if (mm && (mm.index === 0 || /^\s/.test(r.slice(0, mm.index)) === false)) {
      if (mm.index === 0) {
        col.type = mm[0].trim();
        r = r.slice(mm[0].length).trim();
        if (/^\[\]/.test(r)) { col.type += '[]'; r = r.slice(2).trim(); }
        break;
      }
    }
  }
  if (!col.type) {
    // 未知类型：取第一个 token
    const tok = r.match(/^([A-Za-z0-9_.]+)/);
    col.type = tok ? tok[1] : r;
    r = tok ? r.slice(tok[1].length).trim() : '';
  }
  // 也可能有带括号长度（character varying(255)），类型正则没包含括号，补一次
  const lenMatch = col.type.match(/^(character varying|varchar|char|numeric|decimal|timestamp|time)\(/i);
  // （上面类型正则匹配的是 token 本身，带括号的情况单独处理）
  if (/^([A-Za-z ]+?)\(\d/.test(rest) && !col.type.includes('(')) {
    const tm = rest.match(/^([A-Za-z ]+?)\(\s*\d+[^)]*\)/);
    if (tm && tm[0].length > col.type.length) {
      col.type = tm[0];
      r = rest.slice(tm[0].length).trim();
    }
  }

  // 约束
  if (/PRIMARY\s+KEY/i.test(r)) col.pk = true;
  if (/\bUNIQUE\b/i.test(r)) col.unique = true;
  if (/NOT\s+NULL/i.test(r)) col.notNull = true;
  const defM = r.match(/DEFAULT\s+([\s\S]*)$/i);
  if (defM) col.default = defM[1].trim();
  const refM = r.match(/REFERENCES\s+([A-Za-z0-9_.]+)\s*(?:\(([^)]*)\))?([\s\S]*?)(?:ON\s+DELETE\s+(\w+))?(?:ON\s+UPDATE\s+(\w+))?(?:\s*(?:CHECK|UNIQUE|PRIMARY|GENERATED|DEFAULT)\b|$)/i);
  if (refM) {
    col.references = `${refM[1]}(${(refM[2] || '').trim()})${refM[4] ? ' ON DELETE ' + refM[4] : ''}${refM[5] ? ' ON UPDATE ' + refM[5] : ''}`;
  }
  const checkM = r.match(/CHECK\s*\(/i);
  if (checkM) {
    const open = r.indexOf('(', checkM.index);
    const body = extractParenGroup(r, open);
    if (body !== null) col.checks = body;
  }
  const genM = r.match(/GENERATED\s+(ALWAYS|BY\s+DEFAULT)\s+AS\s+([\s\S]*?)(?=\s+(?:STORED|\()|$)/i);
  if (genM) {
    const open = r.indexOf('(', genM.index);
    let expr = genM[2].trim();
    if (open !== -1) {
      const body = extractParenGroup(r, open);
      if (body !== null) expr = body;
    }
    col.generated = `GENERATED ${genM[1]} AS ${expr} STORED`;
  }
  return col;
}

function parseTableConstraint(part, table, srcFile) {
  let rest = part;
  let name = '';
  let def = part;
  const nameM = rest.match(/^CONSTRAINT\s+([A-Za-z0-9_]+)\s+([\s\S]+)$/i);
  if (nameM) {
    name = nameM[1];
    rest = nameM[2].trim();
  }

  let type = '';
  let bodyText = rest;
  if (/^PRIMARY\s+KEY/i.test(rest)) {
    type = 'PRIMARY KEY';
    bodyText = extractParenGroup(rest, rest.indexOf('('));
  } else if (/^UNIQUE/i.test(rest)) {
    type = 'UNIQUE';
    bodyText = extractParenGroup(rest, rest.indexOf('('));
  } else if (/^CHECK/i.test(rest)) {
    type = 'CHECK';
    bodyText = extractParenGroup(rest, rest.indexOf('('));
  } else if (/^FOREIGN\s+KEY/i.test(rest)) {
    type = 'FOREIGN KEY';
    const open = rest.indexOf('(');
    const body = extractParenGroup(rest, open);
    const refM = rest.match(/REFERENCES\s+([A-Za-z0-9_.]+)\s*\(([^)]*)\)([\s\S]*?)(?:ON\s+DELETE\s+(\w+))?(?:ON\s+UPDATE\s+(\w+))?$/i);
    bodyText = `(${body}) REFERENCES ${refM ? refM[1] + '(' + refM[2] + ')' + (refM[4] ? ' ON DELETE ' + refM[4] : '') + (refM[5] ? ' ON UPDATE ' + refM[5] : '') : ''}`;
  } else if (/^EXCLUDE/i.test(rest)) {
    type = 'EXCLUDE';
  } else {
    type = 'OTHER';
  }

  const key = name || `${type}:${(bodyText || '').slice(0, 40)}`;
  table.constraints[key] = {
    tableName: table.name,
    name: name || '',
    type,
    def: bodyText !== null ? bodyText : def,
    source: srcFile,
  };

  // 表级主键/唯一 → 回填字段标记
  if (type === 'PRIMARY KEY' && bodyText) {
    for (const c of splitTopLevelComma(bodyText)) {
      const cname = c.trim().match(/^([A-Za-z0-9_]+)/);
      if (cname) {
        const col = table.columns.find((x) => x.name === cname[1]);
        if (col) col.pk = true;
      }
    }
  }
  if (type === 'UNIQUE' && bodyText) {
    for (const c of splitTopLevelComma(bodyText)) {
      const cname = c.trim().match(/^([A-Za-z0-9_]+)/);
      if (cname) {
        const col = table.columns.find((x) => x.name === cname[1]);
        if (col) col.unique = true;
      }
    }
  }
}

// ---------- ALTER TABLE 解析（含 DO 块内） ----------
function parseAlterStatements(stmt, srcFile, ctx) {
  const re = /ALTER\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([A-Za-z0-9_.$"]+)\s+ADD([\s\S]*?)(?=ALTER\s+TABLE|\bCOMMIT\b|\bEND\b|$)/gi;
  let m;
  while ((m = re.exec(stmt)) !== null) {
    const tableName = m[1].replaceAll('"', '');
    let addPart = m[2];
    const semi = addPart.indexOf(';');
    if (semi !== -1) addPart = addPart.slice(0, semi);
    addPart = addPart.trim();
    if (!addPart) continue;

    // 单个 ALTER TABLE 语句可含多个 ADD COLUMN / ADD CONSTRAINT（逗号分隔）
    const segments = splitTopLevelComma(addPart);
    for (const seg of segments) {
      const s = seg.trim();
      if (s) parseAlterSegment(tableName, s, srcFile, ctx);
    }
  }
}

function parseAlterSegment(tableName, s, srcFile, ctx) {
  // ADD CONSTRAINT [IF NOT EXISTS] name ...
  let m = s.match(/^(?:ADD\s+)?CONSTRAINT\s+(?:IF\s+NOT\s+EXISTS\s+)?([A-Za-z0-9_]+)\s+([\s\S]+)$/i);
  if (m) {
    const table = ctx.getTable(tableName, srcFile);
    parseTableConstraint(`CONSTRAINT ${m[1]} ${m[2]}`, table, srcFile);
    return;
  }
  // 无名约束：ADD CHECK / UNIQUE / PRIMARY KEY / FOREIGN KEY / EXCLUDE
  m = s.match(/^(?:ADD\s+)?(PRIMARY\s+KEY|UNIQUE|CHECK|FOREIGN\s+KEY|EXCLUDE)([\s\S]*)$/i);
  if (m) {
    const table = ctx.getTable(tableName, srcFile);
    parseTableConstraint(`CONSTRAINT ${m[1]} ${m[2]}`, table, srcFile);
    return;
  }
  // ADD [COLUMN] [IF NOT EXISTS] col def
  m = s.match(/^(?:ADD\s+)?(?:COLUMN\s+)?(?:IF\s+NOT\s+EXISTS\s+)?([A-Za-z0-9_]+)\s+([\s\S]+)$/i);
  if (m && !/^(PRIMARY\s+KEY|UNIQUE|CHECK|FOREIGN\s+KEY|EXCLUDE)\b/i.test(m[2])) {
    const table = ctx.getTable(tableName, srcFile);
    const col = parseColumnDef(m[1], m[2], srcFile);
    table.columns.push(col);
  }
}

// ---------- COMMENT 解析 ----------
function parseComment(stmt, ctx) {
  const tm = stmt.match(/^COMMENT\s+ON\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([A-Za-z0-9_.]+)\s+IS\s+('(?:[^']|'')*')/i);
  if (tm) {
    ctx.getTable(tm[1], '').comment = unquote(tm[2]);
    return;
  }
  const cm = stmt.match(/^COMMENT\s+ON\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?([A-Za-z0-9_.]+)\.([A-Za-z0-9_]+)\s+IS\s+('(?:[^']|'')*')/i);
  if (cm) {
    const table = ctx.getTable(cm[1], '');
    const col = table.columns.find((c) => c.name === cm[2]);
    if (col) col.comment = unquote(cm[3]);
  }
}

function unquote(s) {
  return s.slice(1, -1).replaceAll("''", "'");
}

// ---------- CREATE INDEX 解析 ----------
function parseIndex(stmt, srcFile, ctx) {
  const m = stmt.match(/^CREATE\s+(UNIQUE\s+)?INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+NOT\s+EXISTS\s+)?([A-Za-z0-9_.]+)\s+ON\s+([A-Za-z0-9_.$"]+)\s*\(([\s\S]*?)\)\s*(?:WITH[\s\S]*?)?(?:WHERE\s+([\s\S]*))?$/i);
  if (!m) return;
  const unique = !!m[1];
  const idxName = m[2];
  const tableName = m[3].replaceAll('"', '');
  const cols = m[4];
  const where = m[5] ? m[5].trim() : '';
  const table = ctx.getTable(tableName, srcFile);
  table.indexes.push({
    tableName,
    name: idxName,
    unique,
    columns: cols,
    where,
    source: srcFile,
  });
}

// ---------- 字段含义生成 ----------
// 90 张表的中文名（用于推断字段含义）
const TABLE_CN = {
  audit_logs: '操作审计日志',
  delivery_workload_rules: '交付工作量规则',
  hardware_products: '硬件产品',
  package_items: '套餐明细项',
  price_rules: '价格规则',
  product_categories: '产品分类',
  product_features: '功能产品',
  product_modules: '产品模块',
  product_packages: '产品套餐',
  workload_classifications: '工作量分类',
  workload_mappings: '工作量映射',
  workload_rules: '工作量规则',
  partner_members: '渠道成员',
  partner_profile_products: '渠道画像产品',
  partner_profiles: '渠道画像',
  partner_relations: '渠道伙伴关系',
  partners: '渠道伙伴',
  business_number_counters: '业务编号计数器',
  customer_aliases: '客户别名',
  customers: '客户主档',
  opportunities: '商机',
  opportunity_followups: '商机跟进记录',
  opportunity_stage_history: '商机阶段历史',
  order_items: '订单明细',
  order_status_history: '订单状态历史',
  orders: '订单',
  quote_items: '报价明细',
  quote_snapshots: '报价快照',
  quote_status_history: '报价状态历史',
  quotes: '报价单',
  registration_events: '报备事件',
  registrations: '客户报备',
  data_scope_bindings: '数据范围绑定',
  external_identities: '外部身份',
  password_credentials: '密码凭据',
  permissions: '权限点',
  role_permissions: '角色-权限关联',
  roles: '角色',
  user_roles: '用户-角色关联',
  users: '账号用户',
  directory_callback_events: '通讯录回调事件',
  directory_connectors: '通讯录连接器',
  directory_mappings: '通讯录映射',
  directory_sync_changes: '通讯录同步变更',
  directory_sync_runs: '通讯录同步运行',
  open_api_access_logs: '开放接口访问日志',
  open_api_client_secrets: '开放接口客户端密钥',
  open_api_clients: '开放接口客户端',
  open_api_permissions: '开放接口客户端权限',
  channel_accounts: '消息通道账号配置',
  deliveries: '消息投递',
  delivery_attempts: '投递尝试',
  event_consumptions: '事件消费记录',
  event_subscriptions: '事件订阅',
  notifications: '站内通知',
  reminder_rules: '到期提醒规则',
  reminder_schedules: '到期提醒计划',
  reminder_templates: '提醒模板',
  templates: '消息模板',
  user_preferences: '用户偏好',
  worker_failure_streaks: '任务进程失败连续记录',
  migration_batches: '迁移批次',
  migration_errors: '迁移错误记录',
  migration_locks: '迁移锁',
  schema_migrations: '迁移版本记录',
  v2_import_expected_counts: 'V2导入预期数量',
  v2_raw_records: 'V2原始记录暂存',
  v2_record_mappings: 'V2记录映射',
  v2_region_manager_account_repairs: 'V2区域管理员账号恢复审计',
  validation_results: '迁移校验结果',
  approval_events: '审批事件',
  approvals: '审批',
  files: '文件',
  idempotency_keys: '幂等键',
  import_export_tasks: '导入导出任务',
  outbox_events: '发件箱事件',
  business_roles: '业务角色',
  certification_expiry_events: '证书到期事件',
  certification_templates: '证书模板',
  manager_relations: '直属关系矩阵',
  member_business_roles: '成员业务角色',
  member_certifications: '成员证书',
  offboarding_handover: '离职交接',
  offboarding_handover_items: '离职交接项',
  org_units: '组织部门',
  positions: '岗位',
  regions: '区域',
  staff_assignments: '员工任职',
  staff_profiles: '员工档案',
};

// 词根翻译词典（用于把英文词根拼成中文含义）
const ROOT_CN = {
  id: 'ID', customer: '客户', partner: '渠道伙伴', region: '区域', user: '用户',
  order: '订单', quote: '报价', product: '产品', feature: '功能', module: '模块',
  package: '套餐', category: '分类', workload: '工作量', price: '价格', rule: '规则',
  item: '明细项', status: '状态', owner: '负责人', approval: '审批', event: '事件',
  delivery: '投递', channel: '通道', template: '模板', reminder: '提醒', schedule: '计划',
  notification: '通知', role: '角色', permission: '权限', unit: '部门', position: '岗位',
  staff: '员工', member: '成员', certification: '证书', handover: '交接',
  registration: '报备', opportunity: '商机', code: '编码', amount: '金额', total: '合计',
  expected: '预计', snapshot: '快照', history: '历史', mapping: '映射', batch: '批次',
  entity: '实体', source: '来源', target: '目标', raw: '原始', validation: '校验',
  result: '结果', attempt: '尝试', due: '到期', scope: '范围', priority: '优先级',
  version: '版本', extra: '扩展', title: '标题', note: '备注', description: '描述',
  contact: '联系人', name: '名称', date: '日期', time: '时间', phone: '电话', email: '邮箱',
  city: '城市', level: '级别', type: '类型', key: '键', hash: '散列', secret: '密钥',
  token: '令牌', username: '用户名', display: '显示', password: '密码', credential: '凭据',
  identity: '身份', external: '外部', manager: '直属上级', primary: '主', secondary: '二级',
  relation: '关系', business: '业务', number: '编号', counter: '计数器', alias: '别名',
  normalized: '归一化', credit: '信用', discount: '折扣', cost: '成本', profit: '利润',
  margin: '毛利', hour: '小时', day: '天数', month: '月份', year: '年份', week: '周',
  limit: '限额', quota: '配额', start: '开始', end: '结束', provider: '供应商',
  message: '消息', app: '应用', wecom: '企微', config: '配置', preference: '偏好',
  retry: '重试', fail: '失败', streak: '连续记录', worker: '任务进程', lock: '锁',
  account: '账号', repair: '修复', sync: '同步', change: '变更', run: '运行',
  connector: '连接器', directory: '通讯录', callback: '回调', open: '开放', api: '接口',
  client: '客户端', access: '访问', log: '日志', resource: '资源', action: '动作',
  allowed: '允许', whitelist: '白名单', ip: 'IP', file: '文件', import: '导入',
  export: '导出', task: '任务', outbox: '发件箱', consumption: '消费',
  subscription: '订阅', failure: '失败', deduplication: '去重', semantic: '语义',
  request: '请求', response: '响应', offboarding: '离职', certification: '证书',
  expiry: '到期', category: '类别', rate: '比率', percentage: '百分比', quantity: '数量',
  count: '数量', title: '标题', text: '文本', desc: '描述', description: '描述',
  url: '链接地址', label: '标签', seq: '序号', interval: '间隔',
  days: '天数', period: '周期', mobile: '手机号', address: '地址', gender: '性别',
  birthday: '生日', age: '年龄', salary: '薪资', income: '收入', expense: '支出',
  currency: '币种', tax: '税率', unit_price: '单价', list_price: '挂牌价', final: '最终',
  submitted: '已提交', verified: '已核验', frozen: '已冻结', enabled: '启用',
  disabled: '停用', archived: '归档', deleted: '已删除', is_read: '已读',
  read: '已读', handled: '已处理', processed: '已处理', valid: '有效',
  pending: '待处理', approved: '已批准', applied: '已应用', resolved: '已解决',
  visible: '可见', hidden: '隐藏', default: '默认', system: '系统', builtin: '内置',
  template: '模板', member: '成员', org: '组织', parent: '上级', root: '根',
  code: '编码', name: '名称', type: '类型', status: '状态', check: '校验',
  constraint: '约束', index: '索引', unique: '唯一', normal: '普通', invoice: '发票',
  serial: '序号', business_no: '业务编号', protect: '保护', due_date: '到期日',
  days_left: '剩余天数', current: '当前', last: '上次', next: '下次', first: '首次',
  finally: '最终', result: '结果', source: '来源', target: '目标', from: '来源',
  to: '目标', at: '时间', on: '日期', by: '操作人', reason: '原因',
  remark: '备注', comment: '备注', summary: '摘要', detail: '明细', policy: '策略',
  action: '动作', object: '对象', scope: '范围', data: '数据', json: 'JSON',
  origin: '来源', merged: '合并', joined: '已加入', left: '已退出', content: '内容',
  algorithm: '算法', body: '正文', sha256: 'SHA-256', nonce: '随机数',
  retryable: '可重试', published: '已发布', ciphertext: '密文', sort: '排序',
  last_ping: '最近心跳', last_error: '最近错误', error: '错误',
  enabled: '启用', protected: '保护', matched: '已匹配', unmatched: '未匹配',
  assigned: '已分配', unassigned: '未分配', overridden: '已覆盖', inherited: '继承',
  actor: '操作人', agent: '代理', value: '值', effective: '生效', tags: '标签',
  submitter: '提交人', subject: '主体', previous: '原', digest: '摘要',
  payload: '载荷', dispatch: '发送', workday: '工作日', window: '窗口',
  variable: '变量', threshold: '阈值', records: '记录', field: '字段', path: '路径',
  suggested: '建议', locked: '锁定', record: '记录', group: '分组', table: '表',
  size: '大小', storage: '存储', progress: '进度', validity: '有效期', revoke: '撤销',
  minutes: '分钟', months: '月数', duration: '时长', until: '截止', snapshot: '快照',
  summary: '摘要', number: '序号', in_app: '站内', region_manager: '区域管理员',
  actual: '实际', expected: '预期', after: '之后', only: '仅', defs: '定义',
  transfer: '转移', strategy: '策略', ref: '引用', classification: '分类',
  min: '最小', max: '最大', statistics: '统计', started: '开始', completed: '完成',
  finished: '完成', submitted: '提交', approved: '批准', rejected: '驳回', joined: '加入',
  occurred: '发生', queued: '已排队', running: '运行中', previewed: '已预览',
  incremental: '增量', full: '全量', preview: '预览', list: '挂牌', fixed: '一口价',
  hardware: '硬件', feature: '功能', package: '套餐', assignment: '任职', expired: '过期',
  ended: '结束', changed: '变更', received: '接收', configured: '配置', repaired: '修复',
  detected: '检测', revoked: '撤销', closed: '关闭', scanned: '扫描', requested: '请求',
  followup: '跟进', expires: '过期',
};

// 精确匹配的通用字段含义（优先级最高，除 COMMENT 外）
const GENERAL_FIELD = {
  id: '主键 ID（UUID）',
  created_at: '创建时间',
  updated_at: '更新时间',
  row_version: '乐观锁版本号（并发控制）',
  extra_json: '扩展字段（JSON 对象，预留业务扩展）',
  status_code: '状态编码',
  deleted_at: '软删除时间',
  created_by_user_id: '创建人（用户 ID）',
  updated_by_user_id: '最后更新人（用户 ID）',
  v2_source_id: 'V2 原始记录 ID（迁移来源标识）',
  must_change_password: '是否必须修改密码（首次登录强制改密）',
  credit_code: '统一社会信用代码',
  username: '登录用户名',
  phone: '联系电话',
  email: '邮箱',
  user_agent: '用户代理（浏览器/客户端标识）',
  started_at: '开始时间',
  completed_at: '完成时间',
  finished_at: '完成时间',
  submitted_at: '提交时间',
  approved_at: '批准时间',
  rejected_at: '驳回时间',
  joined_on: '加入日期',
  occurred_at: '发生时间',
  ended_at: '结束时间',
  changed_at: '变更时间',
  received_at: '接收时间',
  expires_at: '过期时间',
  configured_at: '配置时间',
  repaired_at: '修复时间',
  detected_at: '检测时间',
  revoked_at: '撤销时间',
  closed_at: '关闭时间',
  scanned_at: '扫描时间',
  requested_at: '请求时间',
  followup_at: '跟进时间',
};

// CHECK 枚举值翻译
const ENUM_CN = {
  active: '启用', disabled: '停用', archived: '归档', locked: '锁定',
  draft: '草稿', published: '已发布', pending: '待处理', processing: '处理中',
  completed: '已完成', shipped: '已发货', cancelled: '已取消', success: '成功', failed: '失败',
  confirmed: '已确认', rejected: '已驳回', primary_confirmed: '一级已确认', primary_rejected: '一级已驳回',
  pending_primary_confirm: '待一级确认', pending_superadmin_confirm: '待超管确认',
  manual: '手动', automatic: '自动', synced: '已同步', not_synced: '未同步', syncing: '同步中',
  sync_conflict: '同步冲突', sync_failed: '同步失败', offboarding: '离职中', offboarded: '已离职',
  reactivated: '已恢复', local: '本地', iam_sso: 'IAM单点登录', wecom: '企微', none: '无',
  primary: '一级', secondary: '二级', in_app: '站内', wecom_app: '企微应用', email: '邮件', sms: '短信',
  true: '是', false: '否', mapped: '已映射', loaded: '已装载', isolated: '已隔离',
  default: '默认', custom: '自定义', enabled: '启用', disabled: '停用',
  mandatory: '强制', configurable: '可配置', read: '只读', write: '读写', delete: '删除',
  create: '新建', edit: '编辑', approve: '审批', report: '报表', review: '审核', message: '消息',
  organization: '组织', account: '账号', reset: '重置', registered: '已注册', invited: '已邀请',
  joined: '已加入', left: '已退出', current: '当前', expired: '已过期', normal: '正常',
  isolated: '已隔离', pending: '待处理', success: '成功', failed: '失败', ok: '正常', error: '错误',
  approved: '已批准', submitted: '已提交', merged: '已合并', succeeded: '已成功',
  processed: '已处理', resolved: '已解决', sending: '发送中', retry_wait: '等待重试',
  ignored: '已忽略', installed: '已安装', uninstalled: '已卸载', enabled: '已启用',
  transfer: '转移', retain: '保留', feature: '功能', hardware: '硬件', package: '套餐',
  list: '挂牌', fixed: '一口价', queued: '已排队', running: '运行中', previewed: '已预览',
  incremental: '增量', full: '全量', preview: '预览', error: '错误',
  applied: '已应用', not_applied: '未应用', applying: '应用变更中', awaiting_approval: '待审批',
  partial_failed: '部分失败', passed: '已通过', pending_scan: '待扫描', transferred: '已转移',
  transferring: '转移中', restored: '已恢复', restoring: '恢复中', exported: '已导出',
  imported: '已导入', sent: '已发送', unread: '未读', validated: '已校验', cleaned: '已清洗',
  converted: '已转化', closed: '已关闭', won: '已赢单', lost: '已丢单', dead: '已淘汰',
  inactive: '停用', low: '低', medium: '中', high: '高', warning: '警告', critical: '严重',
  readonly: '只读', disable: '禁用', update: '更新', view: '查看', process: '流程',
  move: '调动', reconcile: '核对', direct: '直接', matrix: '矩阵', internal: '内部',
  functional: '职能', business: '业务', team: '团队', department: '部门', headquarters: '总部',
  city: '城市', sales: '销售', pre_sales: '售前', post_sales: '售后', service: '服务',
  support: '支持', management: '管理', manager: '管理者', customer: '客户', system: '系统',
  software: '软件', strong: '强', todo: '待办', discount: '折扣', expiry: '到期',
  export: '导出', import: '导入', migration: '迁移', opportunity: '商机', quote: '报价',
  order: '订单', registration: '报备', crm_entity: 'CRM实体', org_subtree: '组织子树',
  business_assistant: '业务助理', channel_company: '渠道公司', channel_department: '渠道部门',
  partner_admin: '渠道管理员', tech_engineer: '技术工程师',
  created: '已创建', received: '已接收', skipped: '已跳过', paused: '已暂停',
  staff: '员工', auto_certification: '自动证书', 'crm.registration.expiring': '报备即将到期',
  headquarter: '总部', division: '事业部', big_region: '大区', province: '省', country: '国家',
  self: '本人', all: '全部', region: '区域', partner: '渠道',
};

// 外键主词 → 引用表（用于 *_id 列给出指向表）
const FK_TABLE = {
  customer: 'crm.customers', partner: 'channel.partners', region: 'org.regions',
  user: 'iam.users', order: 'crm.orders', quote: 'crm.quotes', opportunity: 'crm.opportunities',
  registration: 'crm.registrations', approval: 'ops.approvals', role: 'iam.roles',
  permission: 'iam.permissions', template: 'message.templates', channel: 'message.channel_accounts',
  handover: 'org.offboarding_handover', staff: 'org.staff_profiles', position: 'org.positions',
  unit: 'org.org_units', role: 'iam.roles', member: 'channel.partner_members',
  category: 'catalog.product_categories', package: 'catalog.product_packages',
  feature: 'catalog.product_features', module: 'catalog.product_modules',
  product: 'catalog.product_features', client: 'integration.open_api_clients',
  connector: 'integration.directory_connectors', batch: 'migration.migration_batches',
  delivery: 'message.deliveries', notification: 'message.notifications',
  schedule: 'message.reminder_schedules', rule: 'message.reminder_rules',
};

function cnRoot(word) {
  return ROOT_CN[word] !== undefined ? ROOT_CN[word] : word;
}
function cn(phrase) {
  if (!phrase) return '';
  return phrase.split('_').filter(Boolean).map(cnRoot).join('');
}

// 后缀模式推断
const FIELD_PATTERNS = [
  { re: /^is_(.+)$/, fn: (m) => `是否${cn(m[1])}` },
  { re: /^has_(.+)$/, fn: (m) => `是否${cn(m[1])}` },
  { re: /^can_(.+)$/, fn: (m) => `是否可${cn(m[1])}` },
  { re: /^parent_(.+)$/, fn: (m) => `上级${cn(m[1])}` },
  { re: /^(.*)_expires_at$/, fn: (m) => `${cn(m[1])}过期时间` },
  { re: /^(.*)_started_at$/, fn: (m) => `${cn(m[1])}开始时间` },
  { re: /^(.*)_started_on$/, fn: (m) => `${cn(m[1])}开始日期` },
  { re: /^(.*)_ended_at$/, fn: (m) => `${cn(m[1])}结束时间` },
  { re: /^(.*)_created_at$/, fn: (m) => `${cn(m[1])}创建时间` },
  { re: /^(.*)_updated_at$/, fn: (m) => `${cn(m[1])}更新时间` },
  { re: /^(.*)_cipher_text$/, fn: (m) => `${cn(m[1])}密文` },
  { re: /^(.*)_ciphertext$/, fn: (m) => `${cn(m[1])}密文` },
  { re: /^(.*)_auth_tag$/, fn: (m) => `${cn(m[1])}认证标签` },
  { re: /^(.*)_nonce$/, fn: (m) => `${cn(m[1])}随机数（防重放）` },
  { re: /^(.*)_deduplication_key$/, fn: (m) => `${cn(m[1])}去重键` },
  { re: /^(.*)_password$/, fn: (m) => `${cn(m[1])}密码` },
  { re: /^(.*)_at$/, fn: (m) => `${cn(m[1])}时间` },
  { re: /^(.*)_on$/, fn: (m) => `${cn(m[1])}日期` },
  { re: /^(.*)_date$/, fn: (m) => `${cn(m[1])}日期` },
  { re: /^(.*)_id$/, fn: (m) => {
      const base = cn(m[1]);
      const t = FK_TABLE[m[1]] ? `（指向 ${FK_TABLE[m[1]]}）` : '';
      return `${base} ID${t}`;
    } },
  { re: /^(.*)_code$/, fn: (m) => `${cn(m[1])}编码` },
  { re: /^(.*)_no$/, fn: (m) => `${cn(m[1])}编号` },
  { re: /^(.*)_name$/, fn: (m) => `${cn(m[1])}名称` },
  { re: /^(.*)_json$/, fn: (m) => `${cn(m[1])}（JSON 数据）` },
  { re: /^(.*)_count$/, fn: (m) => `${cn(m[1])}数量` },
  { re: /^(.*)_quantity$/, fn: (m) => `${cn(m[1])}数量` },
  { re: /^(.*)_amount$/, fn: (m) => `${cn(m[1])}金额` },
  { re: /^(.*)_price$/, fn: (m) => `${cn(m[1])}单价` },
  { re: /^(.*)_rate$/, fn: (m) => `${cn(m[1])}比率` },
  { re: /^(.*)_percentage$/, fn: (m) => `${cn(m[1])}百分比` },
  { re: /^(.*)_discount$/, fn: (m) => `${cn(m[1])}折扣` },
  { re: /^(.*)_phone$/, fn: (m) => `${cn(m[1])}电话` },
  { re: /^(.*)_mobile$/, fn: (m) => `${cn(m[1])}手机号` },
  { re: /^(.*)_email$/, fn: (m) => `${cn(m[1])}邮箱` },
  { re: /^(.*)_hash$/, fn: (m) => `${cn(m[1])}散列值` },
  { re: /^(.*)_text$/, fn: (m) => `${cn(m[1])}文本` },
  { re: /^(.*)_desc$/, fn: (m) => `${cn(m[1])}描述` },
  { re: /^(.*)_description$/, fn: (m) => `${cn(m[1])}描述` },
  { re: /^(.*)_note$/, fn: (m) => `${cn(m[1])}备注` },
  { re: /^(.*)_version$/, fn: (m) => `${cn(m[1])}版本` },
  { re: /^(.*)_type$/, fn: (m) => `${cn(m[1])}类型` },
  { re: /^(.*)_status(_code)?$/, fn: (m) => `${cn(m[1])}状态` },
  { re: /^(.*)_level(_code)?$/, fn: (m) => `${cn(m[1])}级别` },
  { re: /^(.*)_scope(_code)?$/, fn: (m) => `${cn(m[1])}范围` },
  { re: /^(.*)_source(_code)?$/, fn: (m) => `${cn(m[1])}来源` },
  { re: /^(.*)_key$/, fn: (m) => `${cn(m[1])}键` },
  { re: /^(.*)_token$/, fn: (m) => `${cn(m[1])}令牌` },
  { re: /^(.*)_url$/, fn: (m) => `${cn(m[1])}链接地址` },
  { re: /^(.*)_label$/, fn: (m) => `${cn(m[1])}标签` },
  { re: /^(.*)_seq$/, fn: (m) => `${cn(m[1])}序号` },
  { re: /^sort_order$/, fn: () => '排序' },
  { re: /^(.*)_interval$/, fn: (m) => `${cn(m[1])}间隔` },
  { re: /^(.*)_days$/, fn: (m) => `${cn(m[1])}天数` },
  { re: /^(.*)_period$/, fn: (m) => `${cn(m[1])}周期` },
  { re: /^(.*)_priority$/, fn: (m) => `${cn(m[1])}优先级` },
  { re: /^(.*)_title$/, fn: (m) => `${cn(m[1])}标题` },
  { re: /^(.*)_category_code$/, fn: (m) => `${cn(m[1])}类别编码` },
  { re: /^(.*)_category$/, fn: (m) => `${cn(m[1])}类别` },
  { re: /^had_(.+)$/, fn: (m) => `是否曾有${cn(m[1])}` },
  { re: /^workday_only$/, fn: () => '仅工作日' },
  { re: /^(.*)_workday_only$/, fn: (m) => `${cn(m[1])}仅工作日` },
  { re: /^do_not_disturb_(start|end)$/, fn: (m) => (m[1] === 'start' ? '免打扰开始时间' : '免打扰结束时间') },
  { re: /^auth_tag$/, fn: () => '认证标签' },
  { re: /^(.*)_username$/, fn: (m) => `${cn(m[1])}用户名` },
  { re: /^(.*)_summary$/, fn: (m) => `${cn(m[1])}摘要` },
  { re: /^(.*)_snapshot$/, fn: (m) => `${cn(m[1])}快照` },
  { re: /^(.*)_ms$/, fn: (m) => `${cn(m[1])}时长（毫秒）` },
  { re: /^(.*)_from$/, fn: (m) => `${cn(m[1])}起始` },
  { re: /^(.*)_to$/, fn: (m) => `${cn(m[1])}结束` },
  { re: /^(.*)_tags$/, fn: (m) => `${cn(m[1])}标签` },
  { re: /^(.*)_number$/, fn: (m) => `${cn(m[1])}序号` },
  { re: /^(.*)_until$/, fn: (m) => `${cn(m[1])}截止时间` },
  { re: /^(.*)_codes$/, fn: (m) => `${cn(m[1])}编码集合` },
  { re: /^(.*)_action$/, fn: (m) => `${cn(m[1])}动作` },
  { re: /^(.*)_time$/, fn: (m) => `${cn(m[1])}时间` },
  { re: /^(.*)_minutes$/, fn: (m) => `${cn(m[1])}分钟数` },
  { re: /^(.*)_after$/, fn: (m) => `${cn(m[1])}之后` },
  { re: /^(.*)_template$/, fn: (m) => `${cn(m[1])}模板` },
  { re: /^(.*)_enabled$/, fn: (m) => `${cn(m[1])}是否启用` },
  { re: /^(.*)_emitted$/, fn: (m) => `${cn(m[1])}是否已触发` },
  { re: /^(.*)_sha256$/, fn: (m) => `${cn(m[1])} SHA-256 散列` },
  { re: /^(.*)_records$/, fn: (m) => `${cn(m[1])}记录数` },
  { re: /^(.*)_message$/, fn: (m) => `${cn(m[1])}消息` },
  { re: /^(.*)_path$/, fn: (m) => `${cn(m[1])}路径` },
  { re: /^(.*)_role$/, fn: (m) => `${cn(m[1])}角色` },
  { re: /^(.*)_by$/, fn: (m) => `${cn(m[1])}（执行人）` },
  { re: /^(.*)_group$/, fn: (m) => `${cn(m[1])}分组` },
  { re: /^(.*)_table$/, fn: (m) => `${cn(m[1])}表` },
  { re: /^(.*)_size$/, fn: (m) => `${cn(m[1])}大小` },
  { re: /^(.*)_percent$/, fn: (m) => `${cn(m[1])}百分比` },
  { re: /^(.*)_months$/, fn: (m) => `${cn(m[1])}月数` },
  { re: /^(.*)_reason$/, fn: (m) => `${cn(m[1])}原因` },
  { re: /^(.*)_defs$/, fn: (m) => `${cn(m[1])}定义` },
  { re: /^(.*)_value$/, fn: (m) => `${cn(m[1])}值` },
];

function inferByPattern(name) {
  for (const p of FIELD_PATTERNS) {
    const m = name.match(p.re);
    if (m) return p.fn(m);
  }
  // 整词回退：单字段名且有词根翻译（如 username、phone、email、note）
  if (ROOT_CN[name] !== undefined) return ROOT_CN[name];
  // 组合回退：字段名由多个已知词根组成（如 normalized_alias、external_subject）
  if (name.includes('_')) return cn(name);
  return '';
}

// 从 CHECK 约束提取枚举并翻译：CHECK (x IN ('a','b'))
function translateEnum(checkText) {
  if (!checkText) return '';
  const mm = checkText.match(/IN\s*\(\s*((?:'[^']*'\s*,?\s*)+)\)/i);
  if (!mm) return '';
  const items = [...mm[1].matchAll(/'([^']*)'/g)].map((x) => x[1]);
  if (!items.length) return '';
  return items.map((v) => {
    const tr = ENUM_CN[v] !== undefined ? ENUM_CN[v] : (/[\u4e00-\u9fa5]/.test(v) ? '' : v);
    return tr ? `${v}=${tr}` : v;
  }).join(', ');
}

function generateColumnMeaning(table, col) {
  let meaning = '';
  if (col.comment) meaning = col.comment;
  else if (GENERAL_FIELD[col.name] !== undefined) meaning = GENERAL_FIELD[col.name];
  else {
    meaning = inferByPattern(col.name);
    if (!meaning) meaning = `字段 ${col.name}（语义待确认）`;
  }
  const enumNote = translateEnum(col.checks);
  if (enumNote) meaning += `（枚举：${enumNote}）`;
  return meaning;
}

// ---------- 上下文 ----------
function createContext() {
  const tables = new Map();
  return {
    tables,
    getTable(name, srcFile) {
      if (!tables.has(name)) {
        const [schema, table] = name.includes('.') ? name.split('.') : ['public', name];
        tables.set(name, {
          schema,
          name: table,
          fullName: name,
          comment: '',
          columns: [],
          indexes: [],
          constraints: {},
          source: srcFile || '',
        });
      } else if (srcFile && !tables.get(name).source) {
        tables.get(name).source = srcFile;
      }
      return tables.get(name);
    },
  };
}

function 转义Markdown单元格(value) {
  return String(value ?? '')
    .replaceAll('\\', '\\\\')
    .replaceAll('|', '\\|')
    .replaceAll('\r\n', '<br>')
    .replaceAll('\n', '<br>');
}

function 表完整名称(table) {
  return `\`${table.schema}.${table.name}\``;
}

function 构建Markdown表结构({ files, tableList, totalColumns, totalIndexes, totalConstraints }) {
  const lines = [
    '# V3 物理表结构',
    '',
    `> 生成时间：${new Date().toLocaleString('zh-CN', { hour12: false })}`,
    '> 数据来源：`database/migrations` 中全部正向迁移文件；回退迁移文件不参与结构汇总。',
    '> 使用说明：本文反映代码仓库当前目标结构。实际环境以已执行的迁移记录和数据库元数据为准。',
    '',
    '## 1. 结构概览',
    '',
    '| 项目 | 数量 |',
    '| --- | ---: |',
    `| 正向迁移文件 | ${files.length} |`,
    `| Schema | ${new Set(tableList.map((table) => table.schema)).size} |`,
    `| 表 | ${tableList.length} |`,
    `| 字段 | ${totalColumns} |`,
    `| 索引 | ${totalIndexes} |`,
    `| 表级约束 | ${totalConstraints} |`,
    '',
    '## 2. 表清单',
    '',
    '| Schema | 表 | 中文名 | 字段数 | 索引数 | 表级约束数 | 首次建表迁移 |',
    '| --- | --- | --- | ---: | ---: | ---: | --- |',
    ...tableList.map((table) =>
      `| \`${table.schema}\` | ${表完整名称(table)} | ${转义Markdown单元格(TABLE_CN[table.name] || table.comment || '未命名')} | ${table.columns.length} | ${table.indexes.length} | ${Object.keys(table.constraints).length} | \`${table.source}\` |`,
    ),
    '',
    '## 3. 分表明细',
    '',
  ];

  const schemas = [...new Set(tableList.map((table) => table.schema))];
  for (const schema of schemas) {
    lines.push(`### ${schema}`);
    lines.push('');
    for (const table of tableList.filter((item) => item.schema === schema)) {
      const tableName = TABLE_CN[table.name] || table.comment || table.name;
      lines.push(`#### ${表完整名称(table)} ${tableName}`);
      lines.push('');
      if (table.comment) lines.push(`说明：${table.comment}`);
      lines.push(`首次建表迁移：\`${table.source}\``);
      lines.push('');
      lines.push('| 字段 | 类型 | 含义 | 约束 | 默认值 | 引用 | 注释 |');
      lines.push('| --- | --- | --- | --- | --- | --- | --- |');
      for (const column of table.columns) {
        const constraints = [
          column.pk ? '主键' : '',
          column.unique ? '唯一' : '',
          column.notNull ? '非空' : '',
          column.checks ? `检查：${column.checks}` : '',
          column.generated ? `生成：${column.generated}` : '',
        ]
          .filter(Boolean)
          .join('；');
        lines.push(
          `| \`${column.name}\` | \`${转义Markdown单元格(column.type)}\` | ${转义Markdown单元格(generateColumnMeaning(table, column))} | ${转义Markdown单元格(constraints)} | ${转义Markdown单元格(column.default)} | ${转义Markdown单元格(column.references)} | ${转义Markdown单元格(column.comment)} |`,
        );
      }
      if (table.indexes.length > 0) {
        lines.push('');
        lines.push('索引：');
        lines.push('');
        lines.push('| 索引名 | 唯一 | 索引列或表达式 | 条件 | 来源迁移 |');
        lines.push('| --- | --- | --- | --- | --- |');
        for (const index of table.indexes) {
          lines.push(
            `| \`${index.name}\` | ${index.unique ? '是' : '否'} | ${转义Markdown单元格(index.columns)} | ${转义Markdown单元格(index.where)} | \`${index.source}\` |`,
          );
        }
      }
      const constraints = Object.values(table.constraints);
      if (constraints.length > 0) {
        lines.push('');
        lines.push('表级约束：');
        lines.push('');
        lines.push('| 约束名 | 类型 | 定义 | 来源迁移 |');
        lines.push('| --- | --- | --- | --- |');
        for (const constraint of constraints) {
          lines.push(
            `| \`${constraint.name}\` | ${转义Markdown单元格(constraint.type)} | ${转义Markdown单元格(constraint.def)} | \`${constraint.source}\` |`,
          );
        }
      }
      lines.push('');
    }
  }

  lines.push('## 4. 参与汇总的正向迁移');
  lines.push('');
  lines.push(...files.map((file) => `- \`${file}\``));
  return lines.join('\n');
}

// ---------- 主流程 ----------
function main() {
  const outPath = process.argv[2] ? path.resolve(process.argv[2]) : OUT_DEFAULT;
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql') && !f.endsWith('.rollback.sql'))
    .sort();

  const ctx = createContext();
  for (const file of files) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    for (const stmt of splitStatements(sql)) {
      if (/^CREATE\s+TABLE/i.test(stmt)) parseCreateTable(stmt, file, ctx);
      else if (/^COMMENT\s+ON/i.test(stmt)) parseComment(stmt, ctx);
      else if (/^CREATE\s+(UNIQUE\s+)?INDEX/i.test(stmt)) parseIndex(stmt, file, ctx);
      else if (/ALTER\s+TABLE/i.test(stmt)) parseAlterStatements(stmt, file, ctx);
    }
  }

  // 按 schema + 表名排序
  const tableList = [...ctx.tables.values()].sort((a, b) =>
    (a.schema + a.name).localeCompare(b.schema + b.name, 'zh-Hans-CN', { numeric: true })
  );

  // 统计
  const totalColumns = tableList.reduce((s, t) => s + t.columns.length, 0);
  const totalIndexes = tableList.reduce((s, t) => s + t.indexes.length, 0);
  const totalConstraints = tableList.reduce((s, t) => s + Object.keys(t.constraints).length, 0);

  if (path.extname(outPath).toLowerCase() === '.md') {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(
      outPath,
      构建Markdown表结构({ files, tableList, totalColumns, totalIndexes, totalConstraints }),
      'utf8',
    );
    console.log(`输出文件：${outPath}`);
    console.log(`迁移文件：${files.length}`);
    console.log(`表数量：${tableList.length}`);
    console.log(`字段数量：${totalColumns}`);
    console.log(`索引数量：${totalIndexes}`);
    console.log(`表级约束数量：${totalConstraints}`);
    return;
  }

  // ---- Sheet 1 表清单 ----
  const sheetTables = tableList.map((t, i) => ({
    序号: i + 1,
    模式: t.schema,
    表名: t.name,
    表中文名: TABLE_CN[t.name] || '',
    表注释: t.comment,
    字段数: t.columns.length,
    索引数: t.indexes.length,
    表级约束数: Object.keys(t.constraints).length,
    来源迁移文件: t.source,
  }));

  // ---- Sheet 2 字段明细 ----
  let seq = 0;
  const sheetColumns = [];
  for (const t of tableList) {
    for (const c of t.columns) {
      seq++;
      sheetColumns.push({
        序号: seq,
        模式: t.schema,
        表名: t.name,
        字段名: c.name,
        数据类型: c.type,
        字段含义: generateColumnMeaning(t, c),
        主键: c.pk ? '是' : '',
        唯一: c.unique ? '是' : '',
        非空: c.notNull ? '是' : '',
        默认值: c.default,
        引用: c.references,
        其他约束: [c.checks ? `CHECK(${c.checks})` : '', c.generated].filter(Boolean).join(' '),
        字段注释: c.comment,
        来源迁移文件: c.source,
      });
    }
  }

  // ---- Sheet 3 索引 ----
  seq = 0;
  const sheetIndexes = [];
  for (const t of tableList) {
    for (const idx of t.indexes) {
      seq++;
      sheetIndexes.push({
        序号: seq,
        模式: t.schema,
        表名: t.name,
        索引名: idx.name,
        唯一: idx.unique ? '是' : '',
        '索引列/表达式': idx.columns,
        WHERE条件: idx.where,
        来源迁移文件: idx.source,
      });
    }
  }

  // ---- Sheet 4 表级约束 ----
  seq = 0;
  const sheetConstraints = [];
  for (const t of tableList) {
    for (const c of Object.values(t.constraints)) {
      seq++;
      sheetConstraints.push({
        序号: seq,
        模式: t.schema,
        表名: t.name,
        约束名: c.name,
        约束类型: c.type,
        约束定义: c.def,
        来源迁移文件: c.source,
      });
    }
  }

  // ---- Sheet 5 统计说明 ----
  const sheetStats = [
    ['说明', '联软 CRM V3 数据库表结构汇总（来源：database/migrations/*.sql）'],
    ['生成时间', new Date().toLocaleString('zh-CN', { hour12: false })],
    ['迁移文件数', files.length],
    ['表数量', tableList.length],
    ['字段数量（含 ALTER 追加列）', totalColumns],
    ['索引数量', totalIndexes],
    ['表级约束数量', totalConstraints],
    ['覆盖的 schema', [...new Set(tableList.map((t) => t.schema))].join(', ')],
    ['', ''],
    ['字段含义说明', '“字段含义”列由脚本根据表名、字段命名规则、COMMENT 与 CHECK 枚举自动生成；自动推断的含义可能需人工复核。'],
    ['', ''],
    ['参与解析的迁移文件', ''],
    ...files.map((f, i) => [i + 1, f]),
  ];

  // ---- 写 Excel ----
  const wb = XLSX.utils.book_new();
  const hdrTables = ['序号', '模式', '表名', '表中文名', '表注释', '字段数', '索引数', '表级约束数', '来源迁移文件'];
  const hdrCols = ['序号', '模式', '表名', '字段名', '数据类型', '字段含义', '主键', '唯一', '非空', '默认值', '引用', '其他约束', '字段注释', '来源迁移文件'];
  const hdrIdx = ['序号', '模式', '表名', '索引名', '唯一', '索引列/表达式', 'WHERE条件', '来源迁移文件'];
  const hdrCons = ['序号', '模式', '表名', '约束名', '约束类型', '约束定义', '来源迁移文件'];

  const wsTables = XLSX.utils.json_to_sheet(sheetTables, { header: hdrTables });
  const wsCols = XLSX.utils.json_to_sheet(sheetColumns, { header: hdrCols });
  const wsIdx = XLSX.utils.json_to_sheet(sheetIndexes, { header: hdrIdx });
  const wsCons = XLSX.utils.json_to_sheet(sheetConstraints, { header: hdrCons });
  const wsStats = XLSX.utils.aoa_to_sheet(sheetStats);

  setCols(wsTables, [6, 12, 28, 18, 40, 8, 8, 12, 46]);
  setCols(wsCols, [6, 12, 28, 22, 24, 46, 8, 8, 8, 40, 34, 44, 44, 46]);
  setCols(wsIdx, [6, 12, 28, 36, 8, 48, 40, 46]);
  setCols(wsCons, [6, 12, 28, 34, 12, 60, 46]);
  setCols(wsStats, [12, 60, 60]);

  XLSX.utils.book_append_sheet(wb, wsTables, '表清单');
  XLSX.utils.book_append_sheet(wb, wsCols, '字段明细');
  XLSX.utils.book_append_sheet(wb, wsIdx, '索引');
  XLSX.utils.book_append_sheet(wb, wsCons, '表级约束');
  XLSX.utils.book_append_sheet(wb, wsStats, '统计说明');

  XLSX.writeFile(wb, outPath);

  // 控制台摘要
  console.log(`输出文件：${outPath}`);
  console.log(`迁移文件：${files.length}`);
  console.log(`表数量：${tableList.length}`);
  console.log(`字段数量：${totalColumns}`);
  console.log(`索引数量：${totalIndexes}`);
  console.log(`表级约束数量：${totalConstraints}`);
  console.log(`schema：${[...new Set(tableList.map((t) => t.schema))].join(', ')}`);
  const schemas = {};
  for (const t of tableList) schemas[t.schema] = (schemas[t.schema] || 0) + 1;
  console.log('各 schema 表数：', JSON.stringify(schemas));
}

function setCols(ws, widths) {
  ws['!cols'] = widths.map((w) => ({ wch: w }));
}

main();
