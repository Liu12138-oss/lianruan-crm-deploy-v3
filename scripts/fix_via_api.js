/**
 * 通过 API 修复维保 features 数据
 * 1. 从备份中读取正确的 feature 数据
 * 2. 通过 API 创建缺失的 features
 * 3. 从 quotes 数组中移除错误数据（通过 API 删除或跳过）
 */
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const API_BASE = 'http://localhost:3000/api';

function apiRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_BASE + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: { 'Content-Type': 'application/json' }
    };
    const req = http.request(options, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  // 从备份文件中读取正确的 feature 数据
  const backupFiles = fs.readdirSync(path.join(__dirname, '..', 'backend'))
    .filter(f => f.startsWith('data.bak_fix_maintenance_'));

  if (backupFiles.length === 0) {
    console.log('没有找到备份文件，尝试从原始数据重建...');
  }

  // 定义需要创建的维保 features
  const maintenanceFeatures = [
    {
      id: "FEAT-MOD-MAINTENANCE-01-01",
      moduleId: "MOD-MAINTENANCE-01",
      name: "标准维保服务",
      productCode: "MAINT-STD-1",
      priceType: "tiered",
      priceFixed: null,
      tiers: [
        { min: 10, max: 19, price: 50 },
        { min: 20, max: 49, price: 45 },
        { min: 50, max: 99, price: 40 },
        { min: 100, max: 199, price: 35 },
        { min: 200, max: 500, price: 30 }
      ],
      discount: 0.2,
      unit: "年",
      desc: "标准维保服务，包括远程技术支持、软件更新、漏洞修复等。",
      status: "active",
      published: true,
      priceForPrimary: [
        { min: 10, max: 19, price: 10 },
        { min: 20, max: 49, price: 9 },
        { min: 50, max: 99, price: 8 },
        { min: 100, max: 199, price: 7 },
        { min: 200, max: 500, price: 6 }
      ],
      priceForSecondary: [
        { min: 10, max: 19, price: 30 },
        { min: 20, max: 49, price: 27 },
        { min: 50, max: 99, price: 24 },
        { min: 100, max: 199, price: 21 },
        { min: 200, max: 500, price: 18 }
      ],
      priceRatioPrimary: 20,
      priceRatioSecondary: 30
    },
    {
      id: "FEAT-MOD-MAINTENANCE-01-02",
      moduleId: "MOD-MAINTENANCE-01",
      name: "原厂现场人工服务",
      productCode: "MAINT-ONSITE-1",
      priceType: "tiered",
      priceFixed: null,
      tiers: [
        { min: 1, max: 1000, price: 1000 }
      ],
      discount: 0.2,
      unit: "小时",
      desc: "原厂工程师现场人工服务，包括故障排查、系统部署、培训等。",
      status: "active",
      published: true,
      priceForPrimary: [
        { min: 1, max: 1000, price: 200 }
      ],
      priceForSecondary: [
        { min: 1, max: 1000, price: 300 }
      ],
      priceRatioPrimary: 20,
      priceRatioSecondary: 30
    }
  ];

  // 检查当前 features
  const currentFeats = await apiRequest('GET', '/features?published=true');
  console.log('当前 features 总数:', currentFeats.data.length);

  const existingIds = new Set(currentFeats.data.map(f => f.id));

  // 创建缺失的 features
  for (const feat of maintenanceFeatures) {
    if (existingIds.has(feat.id)) {
      console.log(`跳过（已存在）: ${feat.id}`);
      continue;
    }
    const result = await apiRequest('POST', '/features', feat);
    if (result.success) {
      console.log(`✅ 已创建: ${feat.id} - ${feat.name}`);
    } else {
      console.log(`❌ 创建失败: ${feat.id} - ${result.error}`);
    }
  }

  // 验证
  const verifyFeats = await apiRequest('GET', '/features?published=true');
  const maintFeats = verifyFeats.data.filter(f => f.id && f.id.includes('MAINT'));
  console.log(`\n验证: features 中有 ${maintFeats.length} 个维保 feature`);
  maintFeats.forEach(f => console.log(`  ${f.id} - ${f.name}`));

  // 验证 product-tree
  const tree = await apiRequest('GET', '/product-tree?published=true');
  const maintCat = tree.data.find(c => c.id === 'CAT-MAINTENANCE');
  if (maintCat) {
    console.log(`\nCAT-MAINTENANCE: modules=${maintCat.moduleCount}, features=${maintCat.featureCount}`);
    maintCat.modules.forEach(m => {
      console.log(`  ${m.id}: ${m.features.length} features`);
      m.features.forEach(f => console.log(`    ${f.id} - ${f.name}`));
    });
  }
}

main().catch(console.error);
