/**
 * 产品价格比例数据迁移脚本
 * 
 * 功能：
 * 1. 为所有现有产品添加默认价格比例
 * 2. 基于现有的 priceForPrimary 和 priceForSecondary 反向计算比例
 * 3. 确保数据完整性
 * 
 * 执行方式：
 * node migrate-price-ratio.js
 */

const fs = require('fs');
const path = require('path');

// 数据文件路径
const dataPath = path.join(__dirname, '..', 'backend', 'data.json');

console.log('🔄 开始产品价格比例数据迁移...\n');

try {
  // 读取数据
  console.log('📂 读取数据文件...');
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  
  if (!data.features) {
    console.log('❌ 未找到 features 数据');
    process.exit(1);
  }
  
  console.log(`✅ 找到 ${data.features.length} 个产品\n`);
  
  let migratedCount = 0;
  let skippedCount = 0;
  
  // 迁移每个产品
  data.features.forEach((feature, index) => {
    const oldFeature = { ...feature };
    
    // 检查是否已有价格比例
    if (feature.priceRatioPrimary !== undefined && feature.priceRatioSecondary !== undefined) {
      console.log(`⏭️  [${index + 1}] ${feature.name} - 已有价格比例，跳过`);
      skippedCount++;
      return;
    }
    
    // 设置默认价格比例
    if (feature.priceType === 'tiered' && feature.tiers && feature.tiers.length > 0) {
      // 阶梯价格：根据第一个阶梯计算比例
      const basePrice = feature.tiers[0].price;
      
      if (feature.priceForPrimary && feature.priceForPrimary.length > 0) {
        const primaryPrice = feature.priceForPrimary[0].price;
        feature.priceRatioPrimary = Math.round((primaryPrice / basePrice) * 100) / 100;
      } else {
        feature.priceRatioPrimary = 1.0;
      }
      
      if (feature.priceForSecondary && feature.priceForSecondary.length > 0) {
        const secondaryPrice = feature.priceForSecondary[0].price;
        feature.priceRatioSecondary = Math.round((secondaryPrice / basePrice) * 100) / 100;
      } else {
        feature.priceRatioSecondary = 1.1;
      }
    } else if (feature.priceType === 'fixed') {
      // 固定价格：根据固定价格计算比例
      const basePrice = feature.priceFixed || 0;
      
      if (feature.priceForPrimary !== undefined && basePrice > 0) {
        feature.priceRatioPrimary = Math.round((feature.priceForPrimary / basePrice) * 100) / 100;
      } else {
        feature.priceRatioPrimary = 1.0;
      }
      
      if (feature.priceForSecondary !== undefined && basePrice > 0) {
        feature.priceRatioSecondary = Math.round((feature.priceForSecondary / basePrice) * 100) / 100;
      } else {
        feature.priceRatioSecondary = 1.1;
      }
    } else {
      // 其他情况：使用默认值
      feature.priceRatioPrimary = 1.0;
      feature.priceRatioSecondary = 1.1;
    }
    
    // 确保比例在合理范围内
    feature.priceRatioPrimary = Math.max(0, Math.min(2, feature.priceRatioPrimary));
    feature.priceRatioSecondary = Math.max(0, Math.min(2, feature.priceRatioSecondary));
    
    // 记录迁移时间
    feature.priceRatioUpdatedAt = new Date().toISOString();
    
    console.log(`✅ [${index + 1}] ${feature.name}`);
    console.log(`   基础价格类型: ${feature.priceType}`);
    console.log(`   一级渠道商比例: ${feature.priceRatioPrimary * 100}%`);
    console.log(`   二级渠道商比例: ${feature.priceRatioSecondary * 100}%`);
    
    migratedCount++;
  });
  
  // 备份原数据
  const backupPath = path.join(__dirname, '..', 'backend', `data-backup-${Date.now()}.json`);
  console.log(`\n💾 备份原数据到: ${backupPath}`);
  const originalData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  fs.writeFileSync(backupPath, JSON.stringify(originalData, null, 2));
  
  // 保存新数据
  console.log('💾 保存迁移后的数据...');
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
  
  // 输出统计
  console.log('\n📊 迁移统计:');
  console.log(`   总产品数: ${data.features.length}`);
  console.log(`   已迁移: ${migratedCount}`);
  console.log(`   已跳过: ${skippedCount}`);
  console.log('\n✅ 迁移完成！');
  
} catch (error) {
  console.error('\n❌ 迁移失败:', error);
  console.error(error.stack);
  process.exit(1);
}
