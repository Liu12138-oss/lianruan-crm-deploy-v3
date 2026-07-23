const fs = require('fs');
const dataFile = '/home/liulonghai/lianruan-crm-deploy-v2.2.0/backend/data.json';
const dryRun = false;

console.log('  数据文件:', dataFile);
console.log('  干跑模式:', dryRun);

const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
let changes = [];

// ===== 检查P001是否存在 =====
console.log('\n  检查P001渠道商...');
const p001 = data.partners.find(p => p.id === 'P001');
if (!p001) {
  console.log('  ⚠️  P001渠道商不存在，跳过迁移');
  process.exit(0);
}
console.log('  P001: ' + p001.name);

// ===== 检查P001 staff中是否有重复ID =====
console.log('\n  分析P001 staff数据...');
const staffIds = {};
const duplicates = [];
(p001.staff || []).forEach(s => {
  if (staffIds[s.id]) {
    duplicates.push({ id: s.id, first: staffIds[s.id], second: s.name });
  } else {
    staffIds[s.id] = s.name;
  }
});

if (duplicates.length === 0) {
  console.log('  ✅ P001 staff 中无重复ID，无需修复');
  
  // 检查是否已经修复过（S001-01是否存在且为PA001）
  const s001_01 = (p001.staff || []).find(s => s.id === 'S001-01');
  if (s001_01 && s001_01.userId === 'PA001') {
    console.log('  ✅ 梁翠(PA001)的staff ID已是S001-01，数据正常');
  }
  process.exit(0);
}

console.log('  发现 ' + duplicates.length + ' 个重复staff ID:');
duplicates.forEach(d => {
  console.log('    - ' + d.id + ': ' + d.first + ' 和 ' + d.second);
});

// ===== 修复：将PA001的重复staff ID从S001-08改为S001-01 =====
console.log('\n  执行修复...');

// 找到PA001的staff记录（id=S001-08）
const liangcuiStaff = (p001.staff || []).find(s => s.userId === 'PA001');
if (liangcuiStaff && liangcuiStaff.id === 'S001-08') {
  const oldId = liangcuiStaff.id;
  if (!dryRun) liangcuiStaff.id = 'S001-01';
  changes.push('P001 梁翠(PA001) staff ID: ' + oldId + ' → S001-01');
  console.log('  P001 梁翠(PA001): staff ID ' + oldId + ' → S001-01');
} else if (liangcuiStaff && liangcuiStaff.id === 'S001-01') {
  console.log('  ✅ 梁翠(PA001)的staff ID已是S001-01，无需修改');
} else {
  console.log('  ⚠️  未找到PA001的staff记录或ID非预期，跳过');
}

// 同时检查其他渠道商是否有类似问题
console.log('\n  检查其他渠道商是否有staff ID重复...');
let otherIssues = 0;
data.partners.forEach(p => {
  if (p.id === 'P001') return;
  const ids = {};
  (p.staff || []).forEach(s => {
    if (ids[s.id]) {
      console.log('  ⚠️  ' + p.id + '(' + p.name + '): staff ID重复 ' + s.id);
      otherIssues++;
    } else {
      ids[s.id] = s.name;
    }
  });
});
if (otherIssues === 0) {
  console.log('  ✅ 其他渠道商无staff ID重复');
}

// ===== 验证 =====
console.log('\n  验证修复结果...');
const p001After = data.partners.find(p => p.id === 'P001');
const afterIds = {};
let afterDupes = false;
(p001After.staff || []).forEach(s => {
  if (afterIds[s.id]) {
    console.log('  ❌ 仍有重复staff ID: ' + s.id);
    afterDupes = true;
  } else {
    afterIds[s.id] = s.name;
  }
});
if (!afterDupes) {
  console.log('  ✅ P001 staff ID无重复');
}

const liangcuiAfter = (p001After.staff || []).find(s => s.userId === 'PA001');
if (liangcuiAfter && liangcuiAfter.id === 'S001-01') {
  console.log('  ✅ 梁翠(PA001) staff ID = S001-01');
} else {
  console.log('  ❌ 梁翠(PA001) staff ID异常');
  afterDupes = true;
}

const wangningAfter = (p001After.staff || []).find(s => s.userId === 'S007');
if (wangningAfter && wangningAfter.id === 'S001-08') {
  console.log('  ✅ 王宁(S007) staff ID = S001-08（未受影响）');
} else {
  console.log('  ❌ 王宁(S007) staff ID异常');
  afterDupes = true;
}

// ===== 保存 =====
if (dryRun) {
  console.log('\n⚠️  干跑模式，未保存任何修改');
} else if (!afterDupes) {
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2), 'utf8');
  console.log('\n✅ 数据已保存到: ' + dataFile);
} else {
  console.log('\n❌ 验证未通过，未保存修改');
  process.exit(1);
}

console.log('\n══════════════════════════════════════');
console.log('修复摘要:');
changes.forEach(c => console.log('  • ' + c));
if (changes.length === 0) console.log('  • 无修改（数据已正常）');
console.log('══════════════════════════════════════');
