/**
 * 渠道商等级功能诊断脚本
 * 用于检测和修复二级渠道商设置问题
 */

const fs = require('fs');
const path = require('path');

// 读取数据文件
const dataPath = path.join(__dirname, '../backend/data.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

console.log('=== 渠道商等级功能诊断 ===\n');

// 1. 检查所有渠道商的等级数据
console.log('1. 渠道商等级分布:');
const levelCounts = { primary: 0, secondary: 0, none: 0, undefined: 0 };
data.partners.forEach(p => {
  const level = p.partnerLevel || 'undefined';
  levelCounts[level] = (levelCounts[level] || 0) + 1;
});
console.log('   - 一级渠道商:', levelCounts.primary);
console.log('   - 二级渠道商:', levelCounts.secondary);
console.log('   - 无等级:', levelCounts.none);
console.log('   - 未设置:', levelCounts.undefined);

// 2. 检查二级渠道商的绑定关系
console.log('\n2. 二级渠道商绑定关系检查:');
const secondaryPartners = data.partners.filter(p => p.partnerLevel === 'secondary');
if (secondaryPartners.length === 0) {
  console.log('   ✓ 当前没有二级渠道商');
} else {
  secondaryPartners.forEach(p => {
    const parentIds = p.parentPartnerIds || (p.parentPartnerId ? [p.parentPartnerId] : []);
    if (parentIds.length === 0) {
      console.log(`   ✗ ${p.name} (${p.id}): 未绑定一级渠道商`);
    } else {
      const parents = parentIds.map(id => {
        const parent = data.partners.find(pp => pp.id === id);
        return parent ? parent.name : '不存在';
      });
      console.log(`   ✓ ${p.name} (${p.id}): 绑定 ${parents.join(', ')}`);
    }
  });
}

// 3. 检查每个区域的一级渠道商数量
console.log('\n3. 各区域一级渠道商分布:');
const regionPrimaryCount = {};
data.partners.forEach(p => {
  if (p.partnerLevel === 'primary') {
    regionPrimaryCount[p.region] = (regionPrimaryCount[p.region] || 0) + 1;
  }
});
Object.entries(regionPrimaryCount).forEach(([region, count]) => {
  console.log(`   ${region}: ${count} 个`);
});

// 4. 模拟区域管理员视角
console.log('\n4. 模拟区域管理员视角（以广州区为例）:');
const guangzhouAdmin = data.users.find(u => u.username === 'admin_gz');
if (guangzhouAdmin) {
  console.log(`   区域管理员: ${guangzhouAdmin.name} (${guangzhouAdmin.region})`);
  
  const visiblePartners = data.partners.filter(p => {
    return (p.status === 'active' && p.region === guangzhouAdmin.region) ||
           (p.status === 'pending' && p.createdBy === guangzhouAdmin.id);
  });
  
  const primaryPartners = visiblePartners.filter(p => p.partnerLevel === 'primary');
  
  console.log(`   可见渠道商总数: ${visiblePartners.length}`);
  console.log(`   可见一级渠道商: ${primaryPartners.length}`);
  
  if (primaryPartners.length > 0) {
    console.log('   一级渠道商列表:');
    primaryPartners.forEach(p => {
      console.log(`     - ${p.name} (${p.id})`);
    });
  } else {
    console.log('   ✗ 警告：该区域没有一级渠道商，无法设置二级渠道商！');
  }
}

// 5. 检查数据完整性
console.log('\n5. 数据完整性检查:');
let hasIssue = false;
data.partners.forEach(p => {
  if (p.partnerLevel === 'secondary') {
    const hasParentIds = p.parentPartnerIds && Array.isArray(p.parentPartnerIds) && p.parentPartnerIds.length > 0;
    const hasParentId = p.parentPartnerId && p.parentPartnerId !== null;
    
    if (!hasParentIds && !hasParentId) {
      console.log(`   ✗ ${p.name} (${p.id}): 二级渠道商缺少上级渠道商绑定`);
      hasIssue = true;
    } else {
      // 验证上级渠道商是否存在且为一级
      const parentIds = hasParentIds ? p.parentPartnerIds : [p.parentPartnerId];
      parentIds.forEach(pid => {
        const parent = data.partners.find(pp => pp.id === pid);
        if (!parent) {
          console.log(`   ✗ ${p.name} (${p.id}): 上级渠道商 ${pid} 不存在`);
          hasIssue = true;
        } else if (parent.partnerLevel !== 'primary') {
          console.log(`   ✗ ${p.name} (${p.id}): 上级渠道商 ${parent.name} 不是一级渠道商`);
          hasIssue = true;
        } else if (parent.region !== p.region) {
          console.log(`   ✗ ${p.name} (${p.id}): 与上级渠道商 ${parent.name} 区域不一致`);
          hasIssue = true;
        }
      });
    }
  }
});

if (!hasIssue) {
  console.log('   ✓ 所有二级渠道商数据完整');
}

console.log('\n=== 诊断完成 ===');
