/**
 * 渠道商等级功能数据迁移脚本
 * 用于将现有数据迁移到新的数据模型
 */

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data.json');

// 读取数据
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      return data;
    }
  } catch (err) {
    console.error('加载数据失败:', err.message);
  }
  return null;
}

// 保存数据
function saveData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    console.log('✅ 数据保存成功');
  } catch (err) {
    console.error('保存数据失败:', err.message);
  }
}

// 迁移渠道商等级字段
function migratePartnerLevel(db) {
  console.log('\n📦 开始迁移渠道商等级字段...');
  
  let count = 0;
  db.partners.forEach(partner => {
    // 添加渠道商等级字段
    if (partner.partnerLevel === undefined) {
      partner.partnerLevel = 'none'; // 默认无等级
      count++;
    }
    
    // 添加上级渠道商ID
    if (partner.parentPartnerId === undefined) {
      partner.parentPartnerId = null;
    }
    
    // 添加等级设置人
    if (partner.partnerLevelSetBy === undefined) {
      partner.partnerLevelSetBy = null;
    }
    
    // 添加等级设置时间
    if (partner.partnerLevelSetAt === undefined) {
      partner.partnerLevelSetAt = null;
    }
  });
  
  console.log(`✅ 已迁移 ${count} 个渠道商记录`);
  return db;
}

// 迁移产品价格字段(分级报价)
function migrateFeaturePrices(db) {
  console.log('\n📦 开始迁移产品价格字段...');
  
  let count = 0;
  db.features.forEach(feature => {
    // 一级渠道商价格(默认价格)
    if (feature.priceForPrimary === undefined) {
      if (feature.priceType === 'tiered' && feature.tiers) {
        feature.priceForPrimary = JSON.parse(JSON.stringify(feature.tiers));
      } else if (feature.priceFixed !== undefined) {
        feature.priceForPrimary = feature.priceFixed;
      }
      count++;
    }
    
    // 二级渠道商价格(比一级高10%)
    if (feature.priceForSecondary === undefined) {
      if (feature.priceType === 'tiered' && feature.tiers) {
        feature.priceForSecondary = feature.tiers.map(t => ({
          min: t.min,
          max: t.max,
          price: Math.ceil(t.price * 1.1) // 加价10%
        }));
      } else if (feature.priceFixed !== undefined) {
        feature.priceForSecondary = Math.ceil(feature.priceFixed * 1.1);
      }
      count++;
    }
  });
  
  console.log(`✅ 已迁移 ${count} 个价格记录`);
  return db;
}

// 验证数据完整性
function validateData(db) {
  console.log('\n🔍 验证数据完整性...');
  
  let errors = [];
  
  // 检查渠道商数据
  db.partners.forEach(partner => {
    if (!partner.partnerLevel) {
      errors.push(`渠道商 ${partner.id} 缺少 partnerLevel 字段`);
    }
    
    if (partner.partnerLevel === 'secondary' && !partner.parentPartnerId) {
      errors.push(`二级渠道商 ${partner.id} 缺少 parentPartnerId 字段`);
    }
  });
  
  // 检查产品价格
  db.features.forEach(feature => {
    if (feature.priceForPrimary === undefined) {
      errors.push(`产品 ${feature.id} 缺少 priceForPrimary 字段`);
    }
    
    if (feature.priceForSecondary === undefined) {
      errors.push(`产品 ${feature.id} 缺少 priceForSecondary 字段`);
    }
  });
  
  if (errors.length > 0) {
    console.log('❌ 发现数据问题:');
    errors.forEach(err => console.log(`  - ${err}`));
    return false;
  }
  
  console.log('✅ 数据完整性验证通过');
  return true;
}

// 主迁移函数
function migrate() {
  console.log('🚀 开始数据迁移...\n');
  
  // 1. 加载数据
  const db = loadData();
  if (!db) {
    console.log('❌ 无法加载数据文件');
    return;
  }
  
  console.log('✅ 数据文件加载成功');
  console.log(`  - 渠道商数量: ${db.partners?.length || 0}`);
  console.log(`  - 用户数量: ${db.users?.length || 0}`);
  console.log(`  - 产品功能数量: ${db.features?.length || 0}`);
  
  // 2. 备份数据
  const backupFile = DATA_FILE.replace('.json', `.backup-${Date.now()}.json`);
  try {
    fs.copyFileSync(DATA_FILE, backupFile);
    console.log(`\n✅ 已创建备份文件: ${path.basename(backupFile)}`);
  } catch (err) {
    console.log('⚠️ 创建备份失败:', err.message);
  }
  
  // 3. 执行迁移
  let migratedDb = migratePartnerLevel(db);
  migratedDb = migrateFeaturePrices(migratedDb);
  
  // 4. 验证数据
  if (!validateData(migratedDb)) {
    console.log('\n❌ 数据验证失败，请检查迁移脚本');
    return;
  }
  
  // 5. 保存数据
  saveData(migratedDb);
  
  console.log('\n✨ 数据迁移完成！\n');
  
  // 6. 打印迁移摘要
  console.log('📊 迁移摘要:');
  console.log(`  - 渠道商记录: ${migratedDb.partners.length}`);
  console.log(`  - 一级渠道商: ${migratedDb.partners.filter(p => p.partnerLevel === 'primary').length}`);
  console.log(`  - 二级渠道商: ${migratedDb.partners.filter(p => p.partnerLevel === 'secondary').length}`);
  console.log(`  - 无等级渠道商: ${migratedDb.partners.filter(p => p.partnerLevel === 'none').length}`);
  console.log(`  - 产品价格记录: ${migratedDb.features.length}`);
}

// 执行迁移
migrate();
