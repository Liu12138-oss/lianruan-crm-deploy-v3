/**
 * 修复价格比例数据
 * 
 * 问题：之前保存的价格比例格式不正确，需要重新计算
 * 
 * 执行步骤：
 * 1. 备份当前数据
 * 2. 重新计算所有产品的渠道商价格
 * 3. 保存修复后的数据
 */

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../backend/data.json');
const BACKUP_FILE = path.join(__dirname, '../backend/data.json.backup_before_fix');

console.log('🔧 价格比例数据修复脚本\n');
console.log('=' .repeat(60));

// 读取数据
let data;
try {
  const content = fs.readFileSync(DATA_FILE, 'utf8');
  data = JSON.parse(content);
  console.log('✅ 数据文件读取成功');
} catch (err) {
  console.error('❌ 读取数据文件失败:', err.message);
  process.exit(1);
}

// 备份
try {
  fs.copyFileSync(DATA_FILE, BACKUP_FILE);
  console.log('✅ 数据已备份到:', BACKUP_FILE);
} catch (err) {
  console.error('❌ 备份失败:', err.message);
  process.exit(1);
}

console.log('\n📊 修复统计：\n');

let fixedCount = 0;
let skippedCount = 0;

// 修复每个产品的价格比例
data.features.forEach((feat, index) => {
  const oldPrimary = feat.priceRatioPrimary;
  const oldSecondary = feat.priceRatioSecondary;
  
  // 设置默认比例（如果未定义）
  let ratioPrimary = 1.0;  // 默认100%
  let ratioSecondary = 1.1;  // 默认110%
  
  // 检查是否有旧的比例值
  if (oldPrimary !== undefined && oldSecondary !== undefined) {
    // 判断格式：如果大于2，说明是百分比格式；如果小于等于2，说明是小数格式
    ratioPrimary = oldPrimary > 2 ? oldPrimary / 100 : oldPrimary;
    ratioSecondary = oldSecondary > 2 ? oldSecondary / 100 : oldSecondary;
  }
  
  // 限制范围在0-2之间
  ratioPrimary = Math.max(0, Math.min(2, ratioPrimary));
  ratioSecondary = Math.max(0, Math.min(2, ratioSecondary));
  
  // 计算渠道商价格
  if (feat.priceType === 'tiered' && feat.tiers) {
    // 阶梯价格
    feat.priceForPrimary = feat.tiers.map(tier => ({
      min: tier.min,
      max: tier.max,
      price: Math.round(tier.price * ratioPrimary)
    }));
    
    feat.priceForSecondary = feat.tiers.map(tier => ({
      min: tier.min,
      max: tier.max,
      price: Math.round(tier.price * ratioSecondary)
    }));
  } else if (feat.priceType === 'fixed') {
    // 固定价格
    feat.priceForPrimary = Math.round((feat.priceFixed || 0) * ratioPrimary);
    feat.priceForSecondary = Math.round((feat.priceFixed || 0) * ratioSecondary);
  }
  
  // 保存为百分比形式
  feat.priceRatioPrimary = Math.round(ratioPrimary * 100);
  feat.priceRatioSecondary = Math.round(ratioSecondary * 100);
  feat.priceRatioUpdatedAt = new Date().toISOString();
  
  fixedCount++;
  console.log(`✅ [${index + 1}] ${feat.name}`);
  console.log(`   比例: ${feat.priceRatioPrimary}% / ${feat.priceRatioSecondary}%`);
  if (feat.priceType === 'tiered' && feat.tiers && feat.tiers.length > 0) {
    console.log(`   基础价格: ¥${feat.tiers[0].price}/端点`);
    console.log(`   一级价格: ¥${feat.priceForPrimary[0].price}/端点`);
    console.log(`   二级价格: ¥${feat.priceForSecondary[0].price}/端点`);
  } else if (feat.priceType === 'fixed') {
    console.log(`   基础价格: ¥${feat.priceFixed}`);
    console.log(`   一级价格: ¥${feat.priceForPrimary}`);
    console.log(`   二级价格: ¥${feat.priceForSecondary}`);
  }
  console.log('');
});

// 保存修复后的数据
try {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  console.log('=' .repeat(60));
  console.log('\n✅ 数据修复完成！');
  console.log(`📊 修复统计:`);
  console.log(`   - 转换格式: ${fixedCount} 个产品`);
  console.log(`   - 重新计算: ${skippedCount} 个产品`);
  console.log(`   - 总计: ${fixedCount + skippedCount} 个产品`);
  console.log(`\n💾 备份文件: ${BACKUP_FILE}`);
  console.log('\n⚠️  请重启后端服务使修改生效！');
} catch (err) {
  console.error('❌ 保存数据失败:', err.message);
  console.log('⚠️  可以从备份文件恢复:', BACKUP_FILE);
  process.exit(1);
}
