/**
 * 修复脚本：将错误放在 quotes 数组中的维保 features 移到 features 数组
 * 问题：FEAT-MOD-MAINTENANCE-01-01 和 FEAT-MOD-MAINTENANCE-01-02 被错误插入到 quotes 数组中
 */
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'backend', 'data.json');

// 备份
const BACKUP_FILE = DATA_FILE.replace('.json', `.bak_fix_maintenance_${Date.now()}.json`);
fs.copyFileSync(DATA_FILE, BACKUP_FILE);
console.log('备份已创建:', BACKUP_FILE);

// 读取数据
const db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

// 检查 quotes 数组中是否有被错误放入的 features
const misplacedFeatures = db.quotes.filter(q => q.id && q.id.startsWith('FEAT-MOD-MAINTENANCE'));
console.log(`\n在 quotes 数组中发现 ${misplacedFeatures.length} 个错误放置的 features:`);
misplacedFeatures.forEach(f => console.log(`  - ${f.id}: ${f.name}`));

if (misplacedFeatures.length === 0) {
  console.log('无需修复。');
  process.exit(0);
}

// 从 quotes 数组中移除
db.quotes = db.quotes.filter(q => !(q.id && q.id.startsWith('FEAT-MOD-MAINTENANCE')));
console.log(`\n已从 quotes 数组中移除 ${misplacedFeatures.length} 个条目`);

// 添加到 features 数组
misplacedFeatures.forEach(f => {
  // 检查是否已存在于 features 数组中
  const exists = db.features.some(existing => existing.id === f.id);
  if (!exists) {
    db.features.push(f);
    console.log(`已添加到 features 数组: ${f.id} (${f.name})`);
  } else {
    console.log(`跳过（已存在）: ${f.id}`);
  }
});

// 保存
fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf8');
console.log(`\n数据已保存到 ${DATA_FILE}`);

// 验证
const verify = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
const quotesMisplaced = verify.quotes.filter(q => q.id && q.id.startsWith('FEAT-MOD-MAINTENANCE'));
const featuresCorrect = verify.features.filter(f => f.id && f.id.startsWith('FEAT-MOD-MAINTENANCE'));
console.log(`\n验证结果:`);
console.log(`  quotes 数组中的错误条目: ${quotesMisplaced.length}`);
console.log(`  features 数组中的正确条目: ${featuresCorrect.length}`);
console.log(`  ${quotesMisplaced.length === 0 && featuresCorrect.length > 0 ? '✅ 修复成功！' : '❌ 修复失败！'}`);
