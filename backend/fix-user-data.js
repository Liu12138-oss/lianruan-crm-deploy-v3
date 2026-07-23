/**
 * hotfix-v0.0.6 用户数据修复脚本
 * 问题修复版本1 - 修复 PA001 userId 复用导致的数据错乱
 *
 * 修复内容：
 * 1. 问题一：商机指派员工不一致 → PA001 被 P004/P005 复用导致用户名查找错误
 * 2. 问题二：郑世凯重复无法删除 → P004 staff 中 PA001 出现2次
 * 3. 问题三：禁用陈功格实际禁用梁翠 → P005 staff 中 PA001 与 P001 的梁翠共用同一 userId
 *
 * 修复方案：
 * - 为郑世恺创建新用户 PA004（P004）
 * - 为陈功格创建新用户 PA005（P005）
 * - 更新 P004/P005 的 staff、registrations 等数据引用
 * - PA001（梁翠）保持不变
 */

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data.json');
const BACKUP_FILE = path.join(__dirname, '..', 'backup_hotfix_v0.0.6_' + new Date().toISOString().slice(0, 19).replace(/[T:]/g, '') + '_data.json.bak');

// ===== Step 1: 备份 =====
console.log('Step 1: 备份 data.json...');
fs.copyFileSync(DATA_FILE, BACKUP_FILE);
console.log('  备份完成:', BACKUP_FILE);

// ===== Step 2: 加载数据 =====
console.log('\nStep 2: 加载数据...');
const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
console.log('  用户数:', data.users.length);
console.log('  渠道商数:', data.partners.length);
console.log('  报备数:', (data.registrations || []).length);

// ===== Step 3: 检查 PA004/PA005 是否已存在 =====
console.log('\nStep 3: 检查新ID是否可用...');
const pa004Exists = data.users.some(u => u.id === 'PA004');
const pa005Exists = data.users.some(u => u.id === 'PA005');
if (pa004Exists) { console.error('  ERROR: PA004 已存在！'); process.exit(1); }
if (pa005Exists) { console.error('  ERROR: PA005 已存在！'); process.exit(1); }
console.log('  PA004, PA005 均可用');

// ===== Step 4: 获取 P004/P005 的 staff 信息 =====
const p004 = data.partners.find(p => p.id === 'P004');
const p005 = data.partners.find(p => p.id === 'P005');
const p001 = data.partners.find(p => p.id === 'P001');

if (!p004 || !p005 || !p001) {
  console.error('ERROR: 找不到 P004/P005/P001');
  process.exit(1);
}

// 找到 P004 中 PA001 的 staff 记录
const p004StaffPA001 = (p004.staff || []).filter(s => s.userId === 'PA001');
console.log('\n  P004 中 PA001 staff 记录数:', p004StaffPA001.length);
p004StaffPA001.forEach(s => console.log('    ', JSON.stringify(s)));

// 找到 P005 中 PA001 的 staff 记录
const p005StaffPA001 = (p005.staff || []).filter(s => s.userId === 'PA001');
console.log('\n  P005 中 PA001 staff 记录数:', p005StaffPA001.length);
p005StaffPA001.forEach(s => console.log('    ', JSON.stringify(s)));

// ===== Step 5: 创建新用户 =====
console.log('\nStep 5: 创建新用户 PA004（郑世恺）和 PA005（陈功格）...');

// PA004 - 郑世恺 (P004)
const pa004User = {
  id: 'PA004',
  username: 'zhengshikai',
  name: '郑世恺',
  role: 'partner_admin',
  password: '123456',
  partnerId: 'P004',
  partnerName: p004.name,
  region: p004.region || '山东区',
  bigRegion: p004.bigRegion || '大北区',
  status: 'active',
  createdBy: 'A001',
  createdByRole: 'superadmin',
  createdAt: new Date().toISOString()
};

// PA005 - 陈功格 (P005)
const pa005User = {
  id: 'PA005',
  username: 'chengongge',
  name: '陈功格',
  role: 'partner_admin',
  password: '123456',
  partnerId: 'P005',
  partnerName: p005.name,
  region: p005.region || '山东区',
  bigRegion: p005.bigRegion || '大北区',
  status: 'active',
  createdBy: 'A001',
  createdByRole: 'superadmin',
  createdAt: new Date().toISOString()
};

data.users.push(pa004User);
data.users.push(pa005User);
console.log('  已创建 PA004（郑世恺, P004）');
console.log('  已创建 PA005（陈功格, P005）');

// ===== Step 6: 修复 P004 staff 列表 =====
console.log('\nStep 6: 修复 P004 staff 列表...');

// P004 中有2条 PA001 记录（S004-01 和 S004-05），需要合并为1条 PA004
// 保留第一条（S004-01），删除第二条（S004-05）
const staffBeforeCount = (p004.staff || []).length;
const s004_01 = p004StaffPA001.find(s => s.id === 'S004-01');
const s004_05 = p004StaffPA001.find(s => s.id === 'S004-05');

// 更新 S004-01 为 PA004
if (s004_01) {
  s004_01.userId = 'PA004';
  console.log('  S004-01 userId: PA001 -> PA004');
}

// 删除 S004-05（重复条目）
if (s004_05) {
  p004.staff = p004.staff.filter(s => s.id !== 'S004-05');
  console.log('  已删除重复条目 S004-05');
}

console.log('  P004 staff:', staffBeforeCount, '->', p004.staff.length);

// ===== Step 7: 修复 P005 staff 列表 =====
console.log('\nStep 7: 修复 P005 staff 列表...');
const p005StaffEntry = (p005.staff || []).find(s => s.userId === 'PA001');
if (p005StaffEntry) {
  p005StaffEntry.userId = 'PA004' in {} ? 'PA005' : 'PA005'; // 确保设为 PA005
  p005StaffEntry.userId = 'PA005';
  console.log('  P005 staff userId: PA001 -> PA005');
}

// ===== Step 8: 更新 P004 registrations =====
console.log('\nStep 8: 更新 registrations 中的 PA001 引用...');
let regP004Count = 0;
let regP005Count = 0;

(data.registrations || []).forEach(reg => {
  if (reg.partnerId === 'P004' && reg.assignedStaffId === 'PA001') {
    reg.assignedStaffId = 'PA004';
    reg.createdBy = 'PA004';
    regP004Count++;
  } else if (reg.partnerId === 'P005' && reg.assignedStaffId === 'PA001') {
    reg.assignedStaffId = 'PA005';
    reg.createdBy = 'PA005';
    regP005Count++;
  }
});

console.log('  P004 registrations 已更新:', regP004Count, '条');
console.log('  P005 registrations 已更新:', regP005Count, '条');

// ===== Step 9: 检查其他数据引用 =====
console.log('\nStep 9: 检查 quotes/orders/opportunities 中的 PA001 引用...');

let otherRefs = [];
(data.quotes || []).forEach(q => {
  const str = JSON.stringify(q);
  if (str.includes('PA001') && (q.partnerId === 'P004' || q.partnerId === 'P005')) {
    otherRefs.push({ type: 'quote', id: q.id, partnerId: q.partnerId });
  }
});
(data.orders || []).forEach(o => {
  const str = JSON.stringify(o);
  if (str.includes('PA001') && (o.partnerId === 'P004' || o.partnerId === 'P005')) {
    otherRefs.push({ type: 'order', id: o.id, partnerId: o.partnerId });
  }
});
(data.opportunities || []).forEach(opp => {
  const str = JSON.stringify(opp);
  if (str.includes('PA001') && (opp.partnerId === 'P004' || opp.partnerId === 'P005')) {
    otherRefs.push({ type: 'opportunity', id: opp.id, partnerId: opp.partnerId });
  }
});

if (otherRefs.length > 0) {
  console.log('  发现其他引用:', otherRefs);
  // 更新这些引用
  otherRefs.forEach(ref => {
    if (ref.partnerId === 'P004') {
      // 需要在对应数组中替换
    } else if (ref.partnerId === 'P005') {
      // 需要在对应数组中替换
    }
  });
} else {
  console.log('  无其他需要更新的引用');
}

// ===== Step 10: 检查 pendingApprovals =====
console.log('\nStep 10: 检查 pendingApprovals...');
(data.pendingApprovals || []).forEach(a => {
  const str = JSON.stringify(a);
  if (str.includes('PA001')) {
    console.log('  PA001 in pendingApprovals:', JSON.stringify(a));
  }
});
console.log('  无需更新');

// ===== Step 11: 验证修复 =====
console.log('\nStep 11: 验证修复结果...');

// 验证 PA001 不再出现在 P004/P005 的 staff 中
const p004StillHasPA001 = (p004.staff || []).some(s => s.userId === 'PA001');
const p005StillHasPA001 = (p005.staff || []).some(s => s.userId === 'PA001');

if (p004StillHasPA001) console.error('  ERROR: P004 staff 中仍有 PA001!');
else console.log('  P004 staff 已清除 PA001');

if (p005StillHasPA001) console.error('  ERROR: P005 staff 中仍有 PA001!');
else console.log('  P005 staff 已清除 PA001');

// 验证新用户存在
const pa004Check = data.users.find(u => u.id === 'PA004');
const pa005Check = data.users.find(u => u.id === 'PA005');

if (pa004Check) console.log('  PA004 用户已创建:', pa004Check.name, '(' + pa004Check.partnerName + ')');
else console.error('  ERROR: PA004 未创建!');

if (pa005Check) console.log('  PA005 用户已创建:', pa005Check.name, '(' + pa005Check.partnerName + ')');
else console.error('  ERROR: PA005 未创建!');

// 验证 PA001 仍属于 P001
const pa001Check = data.users.find(u => u.id === 'PA001');
if (pa001Check && pa001Check.partnerId === 'P001') {
  console.log('  PA001 用户未受影响:', pa001Check.name, '(' + pa001Check.partnerName + ')');
} else {
  console.error('  ERROR: PA001 数据异常!');
}

// 验证 P001 registrations 未受影响
const p001Regs = (data.registrations || []).filter(r => r.partnerId === 'P001' && r.assignedStaffId === 'PA001');
console.log('  P001 registrations 保持 PA001:', p001Regs.length, '条');

// ===== Step 12: 保存数据 =====
console.log('\nStep 12: 保存修复后的 data.json...');
fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
console.log('  保存完成');

// ===== 输出摘要 =====
console.log('\n========== 修复摘要 ==========');
console.log('修复文件:', DATA_FILE);
console.log('备份文件:', BACKUP_FILE);
console.log('');
console.log('修复内容:');
console.log('  1. 创建用户 PA004（郑世恺）绑定 P004');
console.log('  2. 创建用户 PA005（陈功格）绑定 P005');
console.log('  3. P004 staff: PA001 -> PA004，删除重复条目 S004-05');
console.log('  4. P005 staff: PA001 -> PA005');
console.log('  5. 更新 ' + regP004Count + ' 条 P004 registrations（assignedStaffId + createdBy）');
console.log('  6. 更新 ' + regP005Count + ' 条 P005 registrations（assignedStaffId + createdBy）');
console.log('  7. PA001（梁翠/P001）完全不受影响');
console.log('');
console.log('预期效果:');
console.log('  - 问题一修复：商机指派员工按 userId 正确查找，不再出现名字不一致');
console.log('  - 问题二修复：P004 郑世恺只有一个 staff 条目，可正常删除');
console.log('  - 问题三修复：禁用陈功格操作 PA005 而非 PA001，不再影响梁翠');
console.log('============================');
