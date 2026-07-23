#!/usr/bin/env node

/**
 * 迁移脚本：将渠道商的 parentPartnerId 转换为 parentPartnerIds 数组
 * 支持二级渠道商绑定多个一级渠道商
 * 
 * 执行步骤：
 * 1. 备份原数据文件
 * 2. 读取 data.json
 * 3. 为每个渠道商添加 parentPartnerIds 字段
 *    - 如果 parentPartnerId 存在且不为 null，则 parentPartnerIds = [parentPartnerId]
 *    - 否则 parentPartnerIds = []
 * 4. 保存到 data.json
 */

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'backend', 'data.json');
const BACKUP_FILE = path.join(__dirname, '..', 'backend', `data.json.backup.${Date.now()}`);

console.log('开始迁移渠道商上级关系数据...');
console.log(`数据文件: ${DATA_FILE}`);

// 1. 备份原文件
try {
  const data = fs.readFileSync(DATA_FILE, 'utf8');
  fs.writeFileSync(BACKUP_FILE, data, 'utf8');
  console.log(`✅ 备份已创建: ${BACKUP_FILE}`);
} catch (err) {
  console.error('❌ 备份失败:', err.message);
  process.exit(1);
}

// 2. 读取数据
let db;
try {
  const content = fs.readFileSync(DATA_FILE, 'utf8');
  db = JSON.parse(content);
} catch (err) {
  console.error('❌ 读取数据文件失败:', err.message);
  process.exit(1);
}

// 3. 迁移渠道商数据
if (!db.partners || !Array.isArray(db.partners)) {
  console.error('❌ 数据文件中没有 partners 数组');
  process.exit(1);
}

let migratedCount = 0;
const migratedPartners = [];

db.partners.forEach(partner => {
  const originalParentPartnerId = partner.parentPartnerId;
  
  // 初始化 parentPartnerIds 数组
  if (!partner.parentPartnerIds) {
    if (originalParentPartnerId && originalParentPartnerId !== null && originalParentPartnerId !== '') {
      partner.parentPartnerIds = [originalParentPartnerId];
    } else {
      partner.parentPartnerIds = [];
    }
    migratedCount++;
  } else if (!Array.isArray(partner.parentPartnerIds)) {
    // 如果已存在但不是数组，转换为数组
    if (partner.parentPartnerIds && typeof partner.parentPartnerIds === 'string') {
      partner.parentPartnerIds = [partner.parentPartnerIds];
    } else {
      partner.parentPartnerIds = [];
    }
    migratedCount++;
  }
  
  migratedPartners.push({
    id: partner.id,
    name: partner.name,
    partnerLevel: partner.partnerLevel,
    originalParentPartnerId,
    parentPartnerIds: partner.parentPartnerIds
  });
});

// 4. 保存数据
try {
  const newContent = JSON.stringify(db, null, 2);
  fs.writeFileSync(DATA_FILE, newContent, 'utf8');
  console.log(`✅ 数据迁移完成，共更新 ${migratedCount} 个渠道商`);
  
  // 显示迁移结果
  console.log('\n迁移详情:');
  migratedPartners.forEach(p => {
    if (p.parentPartnerIds.length > 0) {
      console.log(`  ${p.id} (${p.name}) - 等级: ${p.partnerLevel || 'none'}`);
      console.log(`    原上级渠道商: ${p.originalParentPartnerId || '无'}`);
      console.log(`    新上级渠道商列表: ${JSON.stringify(p.parentPartnerIds)}`);
    }
  });
  
  console.log('\n✅ 数据文件已更新');
  console.log('⚠️  注意：原 parentPartnerId 字段保留以确保向后兼容');
  console.log('⚠️  新代码应使用 parentPartnerIds 数组字段');
  
} catch (err) {
  console.error('❌ 保存数据文件失败:', err.message);
  console.log('正在恢复备份...');
  try {
    const backupData = fs.readFileSync(BACKUP_FILE, 'utf8');
    fs.writeFileSync(DATA_FILE, backupData, 'utf8');
    console.log('✅ 已恢复备份');
  } catch (restoreErr) {
    console.error('❌ 恢复备份失败:', restoreErr.message);
  }
  process.exit(1);
}