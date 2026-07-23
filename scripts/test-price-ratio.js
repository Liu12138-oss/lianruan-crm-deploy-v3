/**
 * 价格比例功能测试脚本
 * 
 * 测试场景：
 * 1. 设置阶梯价格产品的价格比例
 * 2. 设置固定价格产品的价格比例
 * 3. 验证价格计算准确性
 * 4. 验证边界值处理
 */

const API_BASE = 'http://localhost:3000/api';

console.log('🧪 价格比例功能测试\n');

// 辅助函数：API请求
async function apiRequest(method, path, body = null) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  const res = await fetch(`${API_BASE}${path}`, options);
  return await res.json();
}

// 测试用例
async function runTests() {
  let passCount = 0;
  let failCount = 0;
  
  try {
    // ========== 测试1：获取产品列表 ==========
    console.log('📋 测试1：获取产品列表');
    const featuresRes = await apiRequest('GET', '/features');
    if (!featuresRes.success) {
      throw new Error('获取产品列表失败');
    }
    
    const features = featuresRes.data;
    console.log(`✅ 找到 ${features.length} 个产品\n`);
    
    // 选择一个阶梯价格产品进行测试
    const tieredFeature = features.find(f => f.priceType === 'tiered');
    if (!tieredFeature) {
      throw new Error('未找到阶梯价格产品');
    }
    
    console.log(`📦 选择测试产品: ${tieredFeature.name} (ID: ${tieredFeature.id})\n`);
    
    // ========== 测试2：设置价格比例 ==========
    console.log('📋 测试2：设置价格比例');
    const updateRes = await apiRequest('PUT', `/features/${tieredFeature.id}`, {
      priceRatioPrimary: 1.0,   // 100%
      priceRatioSecondary: 1.1  // 110%
    });
    
    if (!updateRes.success) {
      throw new Error('设置价格比例失败: ' + (updateRes.error || '未知错误'));
    }
    
    console.log('✅ 价格比例设置成功');
    console.log(`   一级渠道商比例: ${updateRes.data.priceRatioPrimary * 100}%`);
    console.log(`   二级渠道商比例: ${updateRes.data.priceRatioSecondary * 100}%\n`);
    
    // ========== 测试3：验证价格计算 ==========
    console.log('📋 测试3：验证价格计算');
    const updatedFeature = updateRes.data;
    
    if (updatedFeature.priceType === 'tiered') {
      // 验证阶梯价格
      const baseTiers = updatedFeature.tiers;
      const primaryTiers = updatedFeature.priceForPrimary;
      const secondaryTiers = updatedFeature.priceForSecondary;
      
      for (let i = 0; i < baseTiers.length; i++) {
        const basePrice = baseTiers[i].price;
        const expectedPrimaryPrice = Math.round(basePrice * 1.0);
        const expectedSecondaryPrice = Math.round(basePrice * 1.1);
        
        const actualPrimaryPrice = primaryTiers[i].price;
        const actualSecondaryPrice = secondaryTiers[i].price;
        
        if (actualPrimaryPrice !== expectedPrimaryPrice) {
          console.log(`❌ 一级渠道商价格计算错误: 预期 ${expectedPrimaryPrice}, 实际 ${actualPrimaryPrice}`);
          failCount++;
        } else if (actualSecondaryPrice !== expectedSecondaryPrice) {
          console.log(`❌ 二级渠道商价格计算错误: 预期 ${expectedSecondaryPrice}, 实际 ${actualSecondaryPrice}`);
          failCount++;
        } else {
          console.log(`✅ 阶梯 ${i + 1}: 基础¥${basePrice} → 一级¥${actualPrimaryPrice} → 二级¥${actualSecondaryPrice}`);
          passCount++;
        }
      }
    }
    console.log('');
    
    // ========== 测试4：测试边界值 ==========
    console.log('📋 测试4：测试边界值');
    
    // 测试0%
    const test0Res = await apiRequest('PUT', `/features/${tieredFeature.id}`, {
      priceRatioPrimary: 0
    });
    if (test0Res.success && test0Res.data.priceRatioPrimary === 0) {
      console.log('✅ 0% 比例处理正确');
      passCount++;
    } else {
      console.log('❌ 0% 比例处理失败');
      failCount++;
    }
    
    // 测试200%
    const test200Res = await apiRequest('PUT', `/features/${tieredFeature.id}`, {
      priceRatioPrimary: 2.0
    });
    if (test200Res.success && test200Res.data.priceRatioPrimary === 2.0) {
      console.log('✅ 200% 比例处理正确');
      passCount++;
    } else {
      console.log('❌ 200% 比例处理失败');
      failCount++;
    }
    
    // 测试超出范围（应被限制在0-2之间）
    const testExceedRes = await apiRequest('PUT', `/features/${tieredFeature.id}`, {
      priceRatioPrimary: 3.0  // 300%，应被限制为200%
    });
    if (testExceedRes.success && testExceedRes.data.priceRatioPrimary === 2.0) {
      console.log('✅ 超出范围比例自动限制正确');
      passCount++;
    } else {
      console.log('❌ 超出范围比例处理失败');
      failCount++;
    }
    console.log('');
    
    // ========== 测试5：测试固定价格产品 ==========
    console.log('📋 测试5：测试固定价格产品');
    const fixedFeature = features.find(f => f.priceType === 'fixed');
    
    if (fixedFeature) {
      const fixedUpdateRes = await apiRequest('PUT', `/features/${fixedFeature.id}`, {
        priceRatioPrimary: 0.9,
        priceRatioSecondary: 1.0
      });
      
      if (fixedUpdateRes.success) {
        const basePrice = fixedFeature.priceFixed || 0;
        const expectedPrimary = Math.round(basePrice * 0.9);
        const expectedSecondary = Math.round(basePrice * 1.0);
        
        if (fixedUpdateRes.data.priceForPrimary === expectedPrimary && 
            fixedUpdateRes.data.priceForSecondary === expectedSecondary) {
          console.log('✅ 固定价格计算正确');
          console.log(`   基础¥${basePrice} → 一级¥${expectedPrimary} → 二级¥${expectedSecondary}`);
          passCount++;
        } else {
          console.log('❌ 固定价格计算错误');
          failCount++;
        }
      }
    } else {
      console.log('⏭️  未找到固定价格产品，跳过此测试');
    }
    console.log('');
    
    // ========== 恢复原始价格比例 ==========
    console.log('📋 恢复测试产品的原始价格比例');
    await apiRequest('PUT', `/features/${tieredFeature.id}`, {
      priceRatioPrimary: 1.0,
      priceRatioSecondary: 1.1
    });
    console.log('✅ 已恢复\n');
    
    // ========== 输出测试结果 ==========
    console.log('📊 测试结果:');
    console.log(`   ✅ 通过: ${passCount}`);
    console.log(`   ❌ 失败: ${failCount}`);
    console.log(`   成功率: ${Math.round(passCount / (passCount + failCount) * 100)}%\n`);
    
    if (failCount === 0) {
      console.log('🎉 所有测试通过！\n');
      process.exit(0);
    } else {
      console.log('⚠️  部分测试失败，请检查\n');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ 测试执行失败:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// 运行测试
runTests();
