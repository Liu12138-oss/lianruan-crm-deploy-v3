const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Database = require('../backend/node_modules/better-sqlite3');

const ROOT_DIR = path.join(__dirname, '..');
const SOURCE_DB = path.join(ROOT_DIR, 'backend', 'crm.db');
const OUT_DIR = path.join(ROOT_DIR, 'deliverables', 'aiagent-openapi-snapshot');
const TS = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
const SNAPSHOT_DB = path.join(OUT_DIR, `crm_openapi_aiagent_sanitized_${TS}.db`);
const LATEST_DB = path.join(OUT_DIR, 'crm_openapi_aiagent_sanitized_latest.db');

const SNAPSHOT_ENTITIES = [
  'users',
  'partners',
  'registrations',
  'opportunities',
  'quotes',
  'orders',
  'categories',
  'modules',
  'features',
  'hardwareProducts',
  'packages',
  'products',
  'implementationWorkloadClassifications',
  'implementationWorkloadMappings',
  'implementationWorkloadRules',
];

const CORE_BUSINESS_ENTITIES = [
  'users',
  'partners',
  'registrations',
  'opportunities',
  'quotes',
  'orders',
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function readEntityRows(db, entityName) {
  return db.prepare('SELECT id, data_json FROM entities WHERE entity_name = ? ORDER BY rowid')
    .all(entityName)
    .map(row => ({ id: row.id, data: JSON.parse(row.data_json) }));
}

function pad(num, len = 3) {
  return String(num).padStart(len, '0');
}

function pseudoPhone(index) {
  return `1380000${pad(index, 4)}`;
}

function pseudoEmail(prefix, index) {
  return `${prefix}${pad(index)}@example.invalid`;
}

function pseudoCreditCode(index) {
  return `91370000000000${pad(index, 4)}`;
}

function makeMaps(source) {
  const maps = {
    users: new Map(),
    usernames: new Map(),
    partners: new Map(),
    customers: new Map(),
  };

  (source.users || []).forEach((row, index) => {
    const id = row.data.id || row.id;
    maps.users.set(id, `用户${pad(index + 1)}`);
    maps.usernames.set(id, `user_${String(id || index + 1).toLowerCase().replace(/[^a-z0-9]+/g, '_')}`);
  });

  (source.partners || []).forEach((row, index) => {
    const id = row.data.id || row.id;
    maps.partners.set(id, `渠道商${pad(index + 1)}`);
  });

  const customerNames = [];
  ['registrations', 'opportunities', 'quotes', 'orders'].forEach(entity => {
    (source[entity] || []).forEach(row => {
      const value = row.data.customer || row.data.customerName;
      if (value && !customerNames.includes(value)) customerNames.push(value);
    });
  });
  customerNames.forEach((name, index) => maps.customers.set(name, `客户${pad(index + 1)}`));

  return maps;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sanitizeNameByUserId(value, maps) {
  if (!value) return '';
  for (const [userId, name] of maps.users.entries()) {
    if (String(value) === String(userId) || String(value) === String(name)) return name;
  }
  return '用户';
}

function sanitizeStaffArray(staff, maps) {
  if (!Array.isArray(staff)) return [];
  return staff.map((item, index) => {
    const userId = item.userId || item.id || `staff-${index + 1}`;
    return {
      ...item,
      username: `staff_${pad(index + 1)}`,
      name: maps.users.get(userId) || `员工${pad(index + 1)}`,
      phone: pseudoPhone(index + 1),
      email: pseudoEmail('staff', index + 1),
    };
  });
}

function sanitizeByCommonKeys(obj, index, maps) {
  const item = clone(obj);
  const replacements = {
    phone: pseudoPhone(index),
    mobile: pseudoPhone(index),
    tel: pseudoPhone(index),
    email: pseudoEmail('contact', index),
    address: '脱敏地址',
    deliveryAddr: '脱敏交付地址',
    contacts: `脱敏联系人 ${pseudoPhone(index)}`,
    contact: `联系人${pad(index)}`,
    creditCode: pseudoCreditCode(index),
    password: '***',
    token: undefined,
    accessToken: undefined,
    appSecret: undefined,
    appSecretHash: undefined,
    secret: undefined,
  };

  Object.entries(replacements).forEach(([key, value]) => {
    if (Object.prototype.hasOwnProperty.call(item, key)) {
      if (value === undefined) delete item[key];
      else item[key] = value;
    }
  });

  if (item.createdByName) item.createdByName = maps.users.get(item.createdBy) || sanitizeNameByUserId(item.createdByName, maps);
  if (item.assignedStaffName) item.assignedStaffName = maps.users.get(item.assignedStaffId) || sanitizeNameByUserId(item.assignedStaffName, maps);
  if (item.ownerName) item.ownerName = maps.users.get(item.ownerId) || sanitizeNameByUserId(item.ownerName, maps);
  if (item.owner) item.owner = maps.users.get(item.ownerId || item.assignedStaffId || item.createdBy) || '用户';
  if (item.partnerName) item.partnerName = maps.partners.get(item.partnerId) || item.partnerName;
  if (item.assignedPartnerName) item.assignedPartnerName = maps.partners.get(item.assignedPartnerId || item.partnerId) || item.assignedPartnerName;
  if (item.customer) item.customer = maps.customers.get(item.customer) || `客户${pad(index)}`;
  if (item.customerName) item.customerName = maps.customers.get(item.customerName) || item.customer || `客户${pad(index)}`;

  return item;
}

function deepSanitize(value, index, maps) {
  if (Array.isArray(value)) {
    return value.map(item => deepSanitize(item, index, maps));
  }
  if (!value || typeof value !== 'object') return value;

  const item = {};
  Object.entries(value).forEach(([key, raw]) => {
    const normalizedKey = String(key || '').toLowerCase();
    if (
      normalizedKey.includes('password') ||
      normalizedKey.includes('token') ||
      normalizedKey.includes('secret') ||
      normalizedKey.includes('privatekey') ||
      normalizedKey.includes('authorization') ||
      normalizedKey === 'salt'
    ) {
      return;
    }

    if (['phone', 'mobile', 'tel'].includes(normalizedKey)) {
      item[key] = pseudoPhone(index);
      return;
    }
    if (normalizedKey === 'email') {
      item[key] = pseudoEmail('contact', index);
      return;
    }
    if (normalizedKey.includes('creditcode')) {
      item[key] = pseudoCreditCode(index);
      return;
    }
    if (normalizedKey.includes('address') || normalizedKey.includes('deliveryaddr')) {
      item[key] = '脱敏地址';
      return;
    }
    if (normalizedKey === 'contacts') {
      item[key] = `脱敏联系人 ${pseudoPhone(index)}`;
      return;
    }
    if (normalizedKey === 'contact') {
      item[key] = `联系人${pad(index)}`;
      return;
    }
    if (
      [
        'operatorname',
        'lastoperatorname',
        'primaryconfirmedbyname',
        'approvedbyname',
        'updatedbyname',
        'reviewedbyname',
      ].includes(normalizedKey)
    ) {
      item[key] = '用户';
      return;
    }

    item[key] = deepSanitize(raw, index, maps);
  });

  if (item.operatorId && value.operatorName) item.operatorName = maps.users.get(item.operatorId) || '用户';
  if (item.lastOperatorId && value.lastOperatorName) item.lastOperatorName = maps.users.get(item.lastOperatorId) || '用户';
  if (item.primaryConfirmedBy && value.primaryConfirmedByName) item.primaryConfirmedByName = maps.users.get(item.primaryConfirmedBy) || '用户';
  return item;
}

function sanitizeEntity(entityName, row, index, maps) {
  const item = sanitizeByCommonKeys(row.data, index, maps);

  if (entityName === 'users') {
    const userId = item.id || row.id;
    item.username = maps.usernames.get(userId) || `user_${pad(index)}`;
    item.name = maps.users.get(userId) || `用户${pad(index)}`;
    delete item.password;
    item.avatar = item.name.slice(0, 1);
    delete item.token;
    delete item.authToken;
    return item;
  }

  if (entityName === 'partners') {
    item.name = maps.partners.get(item.id || row.id) || `渠道商${pad(index)}`;
    item.shortName = item.name;
    item.contact = `渠道联系人${pad(index)}`;
    item.phone = pseudoPhone(index);
    item.email = pseudoEmail('partner', index);
    item.staff = sanitizeStaffArray(item.staff, maps);
    return item;
  }

  if (entityName === 'registrations') {
    item.customer = maps.customers.get(row.data.customer) || `客户${pad(index)}`;
    item.creditCode = pseudoCreditCode(index);
    item.contact = `客户联系人${pad(index)}`;
    item.phone = pseudoPhone(index);
    item.address = '脱敏客户地址';
    return item;
  }

  if (entityName === 'opportunities') {
    item.customer = maps.customers.get(row.data.customer) || `客户${pad(index)}`;
    item.name = `${item.customer}项目${pad(index)}`;
    item.contact = `客户联系人${pad(index)}`;
    item.phone = pseudoPhone(index);
    item.remark = item.remark ? '已脱敏商机备注' : '';
    return item;
  }

  if (entityName === 'quotes') {
    const customer = maps.customers.get(row.data.customer || row.data.customerName) || `客户${pad(index)}`;
    item.customer = customer;
    item.customerName = customer;
    return item;
  }

  if (entityName === 'orders') {
    const customer = maps.customers.get(row.data.customer || row.data.customerName) || `客户${pad(index)}`;
    item.customer = customer;
    item.customerName = customer;
    item.deliveryAddr = '脱敏交付地址';
    item.contacts = `脱敏联系人 ${pseudoPhone(index)}`;
    return item;
  }

  return item;
}

function collectSourceData(sourceDb) {
  const data = {};
  SNAPSHOT_ENTITIES.forEach(entity => {
    data[entity] = readEntityRows(sourceDb, entity);
  });
  return data;
}

function writeSnapshotDb(sourceData, maps) {
  if (fs.existsSync(SNAPSHOT_DB)) fs.rmSync(SNAPSHOT_DB, { force: true });
  const db = new Database(SNAPSHOT_DB);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS entities (
      entity_name  TEXT    NOT NULL,
      id           TEXT    NOT NULL,
      data_json    TEXT    NOT NULL,
      updated_at   TEXT    DEFAULT (datetime('now')),
      PRIMARY KEY (entity_name, id)
    );
    CREATE INDEX IF NOT EXISTS idx_entities_name ON entities(entity_name);
    CREATE TABLE IF NOT EXISTS schema_version (
      version     INTEGER PRIMARY KEY,
      applied_at  TEXT    DEFAULT (datetime('now')),
      description TEXT
    );
  `);

  const insert = db.prepare(`
    INSERT INTO entities (entity_name, id, data_json, updated_at)
    VALUES (?, ?, ?, datetime('now'))
  `);
  const tx = db.transaction(() => {
    db.prepare('INSERT INTO schema_version (version, description) VALUES (?, ?)').run(
      1,
      'AI-agent OpenAPI sanitized snapshot'
    );
    SNAPSHOT_ENTITIES.forEach(entity => {
      (sourceData[entity] || []).forEach((row, index) => {
        const sanitized = deepSanitize(sanitizeEntity(entity, row, index + 1, maps), index + 1, maps);
        insert.run(entity, String(sanitized.id || row.id), JSON.stringify(sanitized));
      });
    });
  });
  tx();
  const counts = db.prepare('SELECT entity_name, COUNT(*) AS count FROM entities GROUP BY entity_name ORDER BY entity_name').all();
  const journalMode = db.pragma('journal_mode', { simple: true });
  db.pragma('wal_checkpoint(TRUNCATE)');
  db.close();
  fs.copyFileSync(SNAPSHOT_DB, LATEST_DB);
  [SNAPSHOT_DB, LATEST_DB].forEach(file => {
    ['-wal', '-shm'].forEach(ext => {
      const sidecar = `${file}${ext}`;
      if (fs.existsSync(sidecar)) fs.rmSync(sidecar, { force: true });
    });
  });
  return { counts, journalMode };
}

function getSourceCounts(sourceDb) {
  return sourceDb.prepare('SELECT entity_name, COUNT(*) AS count FROM entities GROUP BY entity_name ORDER BY entity_name').all();
}

function getCoreDdl(sourceDb) {
  const rows = sourceDb.prepare(`
    SELECT type, name, sql
    FROM sqlite_master
    WHERE sql IS NOT NULL AND type IN ('table', 'index')
    ORDER BY type, name
  `).all();
  return rows.map(row => `${row.sql};`).join('\n\n') + '\n';
}

function collectFieldDictionary(sourceData) {
  const result = {};
  SNAPSHOT_ENTITIES.forEach(entity => {
    const stats = new Map();
    (sourceData[entity] || []).forEach(row => {
      Object.entries(row.data || {}).forEach(([key, value]) => {
        const current = stats.get(key) || { field: key, types: new Set(), examples: [] };
        const type = Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value;
        current.types.add(type);
        if (current.examples.length < 3 && value !== undefined && value !== null && value !== '') {
          current.examples.push(value);
        }
        stats.set(key, current);
      });
    });
    result[entity] = Array.from(stats.values()).map(item => ({
      field: item.field,
      types: Array.from(item.types).join('|'),
      examples: item.examples.map(value => {
        if (typeof value === 'object') return JSON.stringify(value).slice(0, 120);
        return String(value).slice(0, 120);
      }),
    }));
  });
  return result;
}

function collectEnums(sourceData) {
  const enumFields = {
    users: ['role', 'status'],
    partners: ['level', 'partnerLevel', 'status', 'techServiceType'],
    registrations: ['status', 'industry', 'region', 'bigRegion'],
    opportunities: ['stage', 'status', 'region', 'bigRegion'],
    quotes: ['status', 'quoteMode', 'region', 'bigRegion'],
    orders: ['status', 'region', 'bigRegion'],
    categories: ['type', 'status'],
    modules: ['status'],
    features: ['priceType', 'status', 'unit'],
    hardwareProducts: ['status', 'unit'],
    packages: ['status'],
  };
  const result = {};
  Object.entries(enumFields).forEach(([entity, fields]) => {
    result[entity] = {};
    fields.forEach(field => {
      const values = new Set();
      (sourceData[entity] || []).forEach(row => {
        const value = row.data?.[field];
        if (value !== undefined && value !== null && value !== '') values.add(String(value));
      });
      result[entity][field] = Array.from(values).sort((a, b) => a.localeCompare(b, 'zh-CN'));
    });
  });
  return result;
}

function collectSamples(snapshotDbPath) {
  const db = new Database(snapshotDbPath, { readonly: true });
  const samples = {};
  SNAPSHOT_ENTITIES.forEach(entity => {
    samples[entity] = db.prepare('SELECT data_json FROM entities WHERE entity_name = ? ORDER BY rowid LIMIT 3')
      .all(entity)
      .map(row => JSON.parse(row.data_json));
  });
  db.close();
  return samples;
}

function writeJson(fileName, value) {
  fs.writeFileSync(path.join(OUT_DIR, fileName), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeText(fileName, value) {
  fs.writeFileSync(path.join(OUT_DIR, fileName), value, 'utf8');
}

function markdownTable(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map(row => `| ${row.map(cell => String(cell ?? '').replace(/\|/g, '\\|').replace(/\n/g, '<br>')).join(' | ')} |`),
  ].join('\n');
}

function generateDocs({ sourceCounts, snapshotCounts, fieldDictionary, enums, hash, fileSize, journalMode }) {
  const sourceCountMap = Object.fromEntries(sourceCounts.map(row => [row.entity_name, row.count]));
  const snapshotCountMap = Object.fromEntries(snapshotCounts.map(row => [row.entity_name, row.count]));

  writeText('00-交付清单.md', `# AI-agent OpenAPI 脱敏快照交付清单

生成时间：${new Date().toISOString()}

## 文件

${markdownTable(['文件', '说明'], [
  [path.basename(SNAPSHOT_DB), '本次脱敏 SQLite 测试库'],
  [path.basename(LATEST_DB), '指向最新快照内容的固定文件名副本'],
  ['01-core-ddl.sql', 'SQLite 物理表建表语句'],
  ['02-table-relationships.md', '物理表与业务实体关系说明'],
  ['03-field-dictionary.md', '字段字典'],
  ['04-status-enums.md', '状态枚举和值域'],
  ['05-snapshot-generation-and-verification.md', '快照生成、WAL、hash、记录数校验方式'],
  ['sample-data.json', '每类实体最多 3 条脱敏样例数据'],
  ['record-counts.json', '源库与脱敏快照记录数'],
  ['snapshot-manifest.json', '快照元数据与 SHA256'],
  ['generate-aiagent-openapi-snapshot.js', '快照生成脚本副本'],
])}

## 本次快照校验

- SQLite 快照：\`${path.basename(SNAPSHOT_DB)}\`
- SHA256：\`${hash}\`
- 文件大小：${fileSize} bytes
- journal_mode：\`${journalMode}\`
`);

  writeText('02-table-relationships.md', `# 表关系说明

## 物理模型

当前 CRM 使用通用实体表保存业务对象，不是传统“一类业务一张表”的模型。

- \`entities.entity_name\`：业务实体类型，例如 \`partners\`、\`registrations\`、\`opportunities\`。
- \`entities.id\`：业务实体主键。
- \`entities.data_json\`：业务实体完整 JSON。
- \`schema_version\`：SQLite schema 版本记录。

## 业务实体关系

${markdownTable(['来源实体', '目标实体', '关联字段', '说明'], [
  ['users', 'partners', 'users.partnerId = partners.id', '渠道管理员/员工归属渠道'],
  ['partners', 'partners', 'partners.parentPartnerId / parentPartnerIds -> partners.id', '一级/二级渠道层级关系'],
  ['registrations', 'users', 'createdBy / assignedStaffId -> users.id', '报备创建人与指派员工'],
  ['registrations', 'partners', 'partnerId / assignedPartnerId -> partners.id', '报备所属渠道'],
  ['opportunities', 'registrations', 'opportunities.regId = registrations.id', '商机关联客户报备'],
  ['opportunities', 'users', 'createdBy / ownerId / assignedStaffId -> users.id', '商机创建、负责人、指派员工'],
  ['opportunities', 'partners', 'partnerId / assignedPartnerId -> partners.id', '商机所属渠道'],
  ['quotes', 'opportunities', 'quotes.oppId 或 quotes.oppIds 包含 opportunities.id', '报价关联商机'],
  ['quotes', 'registrations', 'quotes.regId = registrations.id', '报价关联报备'],
  ['quotes', 'partners/users', 'partnerId / assignedStaffId / createdBy', '报价所属渠道与人员'],
  ['orders', 'quotes', 'orders.quoteId = quotes.id', '订单来源报价'],
  ['orders', 'opportunities', 'orders.oppId = opportunities.id', '订单关联商机'],
  ['orders', 'registrations', 'orders.regId = registrations.id', '订单关联报备'],
  ['modules', 'categories', 'modules.categoryId = categories.id', '产品模块归属产品大类'],
  ['features', 'modules', 'features.moduleId = modules.id', '功能项归属模块'],
  ['packages', 'features/modules/hardwareProducts', 'featureIds / moduleIds / hardwareIds', '套餐包含功能、模块、硬件'],
])}

## AI-agent 权限关系

OpenAPI client 绑定 CRM 用户后，外部可见数据按绑定用户裁剪：

- \`superadmin\`：全量。
- \`admin\`：同 \`region\` 数据。
- \`partner_admin\`：同渠道、下级渠道或相关渠道数据。
- \`staff\`：本人创建、负责或指派的数据。
`);

  const fieldSections = Object.entries(fieldDictionary).map(([entity, fields]) => {
    return `## ${entity}\n\n${markdownTable(['字段', '类型', '样例（脱敏前字段形态）'], fields.map(item => [item.field, item.types, item.examples.join('<br>')]))}`;
  }).join('\n\n');
  writeText('03-field-dictionary.md', `# 字段字典

说明：业务实体存放在 \`entities.data_json\` 中，本字典按实体类型列出 JSON 字段、推断类型和样例形态。样例仅用于字段理解，真实交付库已脱敏。

${fieldSections}
`);

  const enumSections = Object.entries(enums).map(([entity, fields]) => {
    return `## ${entity}\n\n${markdownTable(['字段', '枚举值'], Object.entries(fields).map(([field, values]) => [field, values.join(', ')]))}`;
  }).join('\n\n');
  writeText('04-status-enums.md', `# 状态枚举和值域

以下值域从当前源库扫描得到，包含状态、阶段、区域、大区、角色等 AI-agent 常用分析维度。

${enumSections}
`);

  writeText('05-snapshot-generation-and-verification.md', `# 快照生成、WAL、删除规则与校验方式

## 快照生成方式

在项目根目录运行：

\`\`\`powershell
node scripts/generate-aiagent-openapi-snapshot.js
\`\`\`

脚本会：

1. 只读打开 \`backend/crm.db\`。
2. 读取核心 OpenAPI 分析实体：\`${SNAPSHOT_ENTITIES.join('`, `')}\`。
3. 对用户、渠道、客户、联系人、手机号、邮箱、地址、统一社会信用代码、密码、token、secret 等字段做脱敏或移除。
4. 保留主键与外键式引用字段，保证 AI-agent 可以验证跨对象关系。
5. 生成脱敏 SQLite、样例数据、字段字典、枚举、hash 和记录数。

## 是否 WAL 模式

源库当前 \`PRAGMA journal_mode\` 为 \`wal\`。本次脱敏快照也执行了：

\`\`\`sql
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
\`\`\`

写入完成后执行 \`PRAGMA wal_checkpoint(TRUNCATE)\`，便于以单个 \`.db\` 文件交付。

## 删除/失效数据规则

当前 SQLite 持久化层采用“内存对象同步到通用实体表”的策略：

1. 业务删除：后端从内存数组移除对应实体后调用 \`saveData()\`。
2. \`DbLayer.syncToDb()\` 对每类实体 upsert 当前内存记录，并删除 SQLite 中存在但内存中已不存在的记录。
3. 状态失效：多数业务不是物理删除，而是通过 \`status\` 表示，例如 \`disabled\`、\`inactive\`、\`rejected\`、\`cancelled\`、\`expired\`。
4. OpenAPI client 失效：\`status=disabled\` 或 \`expiresAt\` 早于当前时间；token 存于进程内存，默认 2 小时，重启后需重新换 token。
5. 报备有效期：\`expireAt\` 表示有效截止时间，是否可用由业务逻辑和状态共同决定。

## Hash 校验

PowerShell：

\`\`\`powershell
Get-FileHash deliverables\\aiagent-openapi-snapshot\\${path.basename(SNAPSHOT_DB)} -Algorithm SHA256
\`\`\`

Node.js：

\`\`\`powershell
node -e "const fs=require('fs'),crypto=require('crypto'); const f='deliverables/aiagent-openapi-snapshot/${path.basename(SNAPSHOT_DB)}'; console.log(crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'))"
\`\`\`

本次 SHA256：

\`\`\`text
${hash}
\`\`\`

## 记录数校验

PowerShell / Node.js：

\`\`\`powershell
node -e "const Database=require('./backend/node_modules/better-sqlite3'); const db=new Database('./deliverables/aiagent-openapi-snapshot/${path.basename(SNAPSHOT_DB)}',{readonly:true}); console.log(db.prepare('select entity_name,count(*) count from entities group by entity_name order by entity_name').all()); db.close();"
\`\`\`

本次源库与快照记录数：

${markdownTable(['实体', '源库记录数', '快照记录数'], SNAPSHOT_ENTITIES.map(entity => [entity, sourceCountMap[entity] || 0, snapshotCountMap[entity] || 0]))}
`);
}

function main() {
  ensureDir(OUT_DIR);
  const sourceDb = new Database(SOURCE_DB, { readonly: true });
  const sourceJournalMode = sourceDb.pragma('journal_mode', { simple: true });
  const sourceCounts = getSourceCounts(sourceDb);
  const sourceData = collectSourceData(sourceDb);
  const ddl = getCoreDdl(sourceDb);
  sourceDb.close();

  const maps = makeMaps(sourceData);
  const snapshot = writeSnapshotDb(sourceData, maps);
  const hash = sha256File(SNAPSHOT_DB);
  const latestHash = sha256File(LATEST_DB);
  const fileSize = fs.statSync(SNAPSHOT_DB).size;
  const fieldDictionary = collectFieldDictionary(sourceData);
  const enums = collectEnums(sourceData);
  const samples = collectSamples(SNAPSHOT_DB);

  writeText('01-core-ddl.sql', ddl);
  writeJson('sample-data.json', samples);
  writeJson('record-counts.json', { sourceCounts, snapshotCounts: snapshot.counts });
  writeJson('snapshot-manifest.json', {
    generatedAt: new Date().toISOString(),
    sourceDb: path.relative(ROOT_DIR, SOURCE_DB),
    snapshotDb: path.basename(SNAPSHOT_DB),
    latestDb: path.basename(LATEST_DB),
    sourceJournalMode,
    snapshotJournalMode: snapshot.journalMode,
    sha256: hash,
    latestSha256: latestHash,
    fileSize,
    entities: SNAPSHOT_ENTITIES,
    coreBusinessEntities: CORE_BUSINESS_ENTITIES,
    sanitization: {
      preserveIds: true,
      removeSecrets: true,
      pseudonymizeUsersPartnersCustomers: true,
      pseudonymizeContactInfo: true,
    },
  });

  generateDocs({
    sourceCounts,
    snapshotCounts: snapshot.counts,
    fieldDictionary,
    enums,
    hash,
    fileSize,
    journalMode: snapshot.journalMode,
  });

  console.log(JSON.stringify({
    outDir: OUT_DIR,
    snapshotDb: SNAPSHOT_DB,
    latestDb: LATEST_DB,
    sha256: hash,
    latestSha256: latestHash,
    fileSize,
    sourceJournalMode,
    snapshotJournalMode: snapshot.journalMode,
    counts: snapshot.counts,
  }, null, 2));
}

main();
