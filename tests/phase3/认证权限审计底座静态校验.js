#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const 项目根目录 = path.resolve(__dirname, '../..');

function 读取文本(相对路径) {
  return fs.readFileSync(path.join(项目根目录, 相对路径), 'utf8');
}

function 读取JSON(相对路径) {
  return JSON.parse(读取文本(相对路径));
}

function 断言(条件, 消息) {
  if (!条件) {
    console.error(`阶段3静态校验失败：${消息}`);
    process.exit(1);
  }
}

function 文件存在(相对路径) {
  return fs.existsSync(path.join(项目根目录, 相对路径));
}

function 包含全部(文本, 片段集合, 文件名) {
  for (const 片段 of 片段集合) {
    断言(文本.includes(片段), `${文件名} 缺少“${片段}”`);
  }
}

function 取得差异文件() {
  const 输出 = childProcess.execSync('git -c core.quotePath=false status --short --untracked-files=all', {
    cwd: 项目根目录,
    encoding: 'utf8',
  }).trimEnd();
  if (!输出) return [];
  return 输出.split(/\r?\n/)
    .map((行) => 行.slice(3).trim())
    .map((文件) => 文件.includes(' -> ') ? 文件.split(' -> ').pop() : 文件)
    .filter(Boolean);
}

function 取得当前分支() {
  return childProcess.execSync('git branch --show-current', {
    cwd: 项目根目录,
    encoding: 'utf8',
  }).trim();
}

const 必需文件 = [
  'docs/stage-records/阶段3-认证权限审计底座落地方案.md',
  'docs/stage-records/阶段3-角色权限矩阵落地版.md',
  'docs/stage-records/阶段3-审计事件与敏感操作清单.md',
  'tests/phase3/阶段3权限审计规则样例.json',
];

for (const 文件 of 必需文件) {
  断言(文件存在(文件), `未找到交付文件 ${文件}`);
}

const 落地方案 = 读取文本('docs/stage-records/阶段3-认证权限审计底座落地方案.md');
const 权限矩阵 = 读取文本('docs/stage-records/阶段3-角色权限矩阵落地版.md');
const 审计清单 = 读取文本('docs/stage-records/阶段3-审计事件与敏感操作清单.md');
const 规则样例 = 读取JSON('tests/phase3/阶段3权限审计规则样例.json');

包含全部(落地方案, [
  '服务端会话',
  '本地应急管理员',
  '双人保管',
  '来源地址白名单',
  '全量审计',
  '默认关闭',
  '总部',
  '区域',
  '大区',
  '一级渠道',
  '二级渠道',
  '本人范围',
], '阶段3落地方案');

包含全部(权限矩阵, [
  'superadmin',
  'admin',
  'partner_admin',
  'staff',
  '历史角色待确认',
  'identity.user.read',
  'crm.registration.approve',
  'crm.quote.confirm',
  'audit.event.export',
], '阶段3角色权限矩阵');

包含全部(审计清单, [
  '审计事件模型',
  '敏感操作清单',
  '审计保留建议',
  '应急管理员',
  '审计不可用策略',
  '密码、令牌、密钥、完整 Cookie',
], '阶段3审计清单');

const 必需角色 = ['superadmin', 'admin', 'partner_admin', 'staff'];
const 角色代码集合 = new Set((规则样例.常规角色 || []).map((角色) => 角色.代码));
for (const 角色 of 必需角色) {
  断言(角色代码集合.has(角色), `规则样例缺少角色 ${角色}`);
  断言(规则样例.角色权限绑定 && 规则样例.角色权限绑定[角色], `规则样例缺少 ${角色} 权限绑定`);
  断言(Array.isArray(规则样例.角色权限绑定[角色].权限), `${角色} 权限绑定不是数组`);
}

断言(规则样例.角色权限绑定.superadmin.授权方式 === '显式授权', '超级管理员必须使用显式授权');
断言(规则样例.角色权限绑定.superadmin.权限.includes('audit.event.export'), '超级管理员缺少审计导出权限');
断言(!规则样例.角色权限绑定.staff.权限.includes('audit.event.export'), '员工不应具备审计导出权限');

const 历史角色集合 = 规则样例.历史角色待确认 || [];
断言(历史角色集合.length >= 2, '历史角色待确认清单不完整');
for (const 历史角色 of 历史角色集合) {
  断言(历史角色.默认授权 === false, `历史角色 ${历史角色.代码} 不应默认授权`);
}

const 必需范围 = ['总部', '区域', '大区', '一级渠道', '二级渠道', '本人范围'];
const 范围名称集合 = new Set((规则样例.数据范围规则 || []).map((范围) => 范围.名称));
for (const 范围 of 必需范围) {
  断言(范围名称集合.has(范围), `数据范围规则缺少 ${范围}`);
}

const 应急 = 规则样例.本地应急管理员机制 || {};
断言(应急.默认启用 === false, '本地应急管理员必须默认关闭');
断言(应急.复用普通超级管理员 === false, '本地应急管理员不得复用普通超级管理员');
断言(应急.双人保管 && 应急.双人保管.启用 === true, '本地应急管理员必须启用双人保管');
断言(应急.来源地址白名单 && 应急.来源地址白名单.必须配置 === true, '本地应急管理员必须配置来源地址白名单');
断言(应急.全量审计 === true, '本地应急管理员必须全量审计');

const 必填审计字段 = [
  'event_id',
  'request_id',
  'actor_user_id',
  'source_ip',
  'permission_code',
  'data_scope_snapshot',
  'result',
  'risk_level',
];
const 审计字段集合 = new Set(规则样例.审计事件必填字段 || []);
for (const 字段 of 必填审计字段) {
  断言(审计字段集合.has(字段), `审计事件必填字段缺少 ${字段}`);
}

const 高风险事件 = (规则样例.审计事件集合 || []).filter((事件) => ['高风险', '最高风险'].includes(事件.风险等级));
断言(高风险事件.length >= 5, '高风险审计事件样例不足');
for (const 事件 of 高风险事件) {
  断言(['阻断', '拒绝或延迟'].includes(事件.审计不可用策略), `高风险事件 ${事件.代码} 的审计不可用策略不合规`);
}

const 允许变更前缀 = [
  'docs/stage-records/阶段3-',
  'tests/phase3/',
];
const 当前分支 = 取得当前分支();
const 强制检查变更范围 = 当前分支 === 'phase/3-auth-permission' || process.env.PHASE3_ENFORCE_SCOPE === '1';
if (强制检查变更范围) {
  const 差异文件 = 取得差异文件();
  const 非预期变更 = 差异文件.filter((文件) => !允许变更前缀.some((前缀) => 文件.startsWith(前缀)));
  断言(非预期变更.length === 0, `发现阶段3范围外变更：${非预期变更.join('、')}`);
}

console.log('阶段3认证权限审计底座静态校验通过。');
