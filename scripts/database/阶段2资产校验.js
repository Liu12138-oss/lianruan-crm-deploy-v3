#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const 项目根目录 = path.resolve(__dirname, '../..');
const 必需文件 = [
  'docs/database/V3逻辑数据模型.md',
  'docs/database/V3实体关系图.md',
  'docs/database/V3物理表结构.md',
  'docs/database/V3物理表结构.xlsx',
  'docs/database/阶段2验收与风险清单.md',
  'docs/migration/SQLite实体到PostgreSQL映射.md',
  'docs/migration/V2迁移批次设计.md',
  'docs/migration/V2数据质量异常处理模板.md',
  'docs/migration/V2导出操作手册.md',
  'database/mapping/v2-entity-mapping.yaml',
  'database/mapping/status-role-region-mapping.yaml',
  'database/mapping/data-quality-rules.yaml',
  'database/migrations/20260723_S2_001_基础扩展与迁移框架.sql',
  'database/migrations/20260723_S2_002_账号组织渠道.sql',
  'database/migrations/20260723_S2_003_产品价格工作量.sql',
  'database/migrations/20260723_S2_004_业务主链路.sql',
  'database/migrations/20260723_S2_005_审计开放接口任务.sql',
  'database/migrations/20260723_S2_006_迁移暂存与校验.sql',
];

const 必需实体 = [
  'users','partners','registrations','opportunities','notifications','quotes','orders','channelTargets','channelVisits','pendingApprovals','categories','modules','features','hardwareProducts','packages','products','partnerProfiles','partnerProfileProducts','openApiClients','implementationWorkloadClassifications','implementationWorkloadMappings','implementationWorkloadRules','implementationDeliveryWorkloadRules'
];

const 必需表 = [
  'iam.users','iam.password_credentials','iam.roles','iam.permissions','org.regions','channel.partners','channel.partner_relations','catalog.product_categories','catalog.product_features','catalog.hardware_products','catalog.product_packages','catalog.workload_rules','crm.customers','crm.registrations','crm.opportunities','crm.quotes','crm.orders','ops.notifications','ops.approvals','ops.import_export_tasks','ops.idempotency_keys','integration.open_api_clients','audit.audit_logs','migration.v2_raw_records','migration.v2_record_mappings','migration.migration_errors','migration.validation_results'
];

function 读取(相对路径) {
  return fs.readFileSync(path.join(项目根目录, 相对路径), 'utf8');
}

const 错误 = [];
for (const 文件 of 必需文件) {
  const 绝对路径 = path.join(项目根目录, 文件);
  if (!fs.existsSync(绝对路径)) 错误.push(`缺少阶段2资产文件：${文件}`);
}

const 映射文本 = 读取('database/mapping/v2-entity-mapping.yaml');
for (const 实体 of 必需实体) {
  if (!映射文本.includes(`${实体}:`)) 错误.push(`V2实体未覆盖迁移映射：${实体}`);
}

const SQL目录 = path.join(项目根目录, 'database/migrations');
const SQL文本 = fs.readdirSync(SQL目录)
  .filter((文件) => 文件.endsWith('.sql'))
  .sort()
  .map((文件) => fs.readFileSync(path.join(SQL目录, 文件), 'utf8'))
  .join('\n');

for (const 表名 of 必需表) {
  const [schema, table] = 表名.split('.');
  const 表达式 = new RegExp(`CREATE TABLE IF NOT EXISTS\\s+${schema}\\.${table}\\s*\\(`, 'i');
  if (!表达式.test(SQL文本)) 错误.push(`迁移SQL未发现核心表：${表名}`);
}

const 异常模板 = 读取('docs/migration/V2数据质量异常处理模板.md');
if (!异常模板.includes('疑似明文密码') || !异常模板.includes('70')) {
  错误.push('70项疑似明文密码异常未形成明确处理模板');
}

if (SQL文本.includes('DROP DATABASE') || SQL文本.includes('DROP SCHEMA') || SQL文本.includes('TRUNCATE')) {
  错误.push('迁移SQL包含阶段2禁止的破坏性语句');
}

if (错误.length) {
  console.error('阶段2资产校验未通过：');
  for (const 项 of 错误) console.error(`- ${项}`);
  process.exit(1);
}

console.log(`阶段2资产校验通过：${必需文件.length}个文件、${必需实体.length}个V2实体、${必需表.length}个核心表已覆盖。`);
