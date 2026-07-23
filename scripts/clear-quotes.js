/**
 * 清空报价管理历史数据
 * 使用方法: node clear-quotes.js [--dry-run]
 *   --dry-run  只显示数量，不实际删除
 * 不带参数    执行实际清空（操作前会先自动备份）
 */

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../backend/data.json');

// 解析命令行参数
const isDryRun = process.argv.includes('--dry-run');

function run() {
  // 读取数据
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  const db = JSON.parse(raw);

  const count = db.quotes.length;
  console.log(`\n报价管理数据: 共 ${count} 条`);
  console.log(`模式: ${isDryRun ? '🔍 预检（仅查看，不删除）' : '⚠️  即将执行清空！'}\n`);

  if (isDryRun) {
    if (count === 0) {
      console.log('✅ 无数据，无需清理。');
    } else {
      console.log('示例数据预览（前3条）：');
      db.quotes.slice(0, 3).forEach((q, i) => {
        console.log(`  [${i + 1}] ${q.id} | ${q.customer} | 金额 ${q.total} | 状态 ${q.status} | 创建 ${q.createdAt}`);
      });
      if (count > 3) console.log(`  ... 还有 ${count - 3} 条`);
    }
    return;
  }

  // 实际执行：先备份
  const backupPath = DATA_FILE + `.backup_quotes_${Date.now()}.json`;
  fs.writeFileSync(backupPath, raw);
  console.log(`✅ 备份已保存: ${path.basename(backupPath)}`);

  // 清空
  db.quotes = [];

  // 写回
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf8');
  console.log(`✅ 清空完成，data.json 已更新。`);
}

run();