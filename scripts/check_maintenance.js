const http = require('http');

function get(path) {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:3000/api' + path, r => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => resolve(JSON.parse(d)));
    }).on('error', reject);
  });
}

async function main() {
  const tree = await get('/product-tree?published=true');
  const feats = await get('/features?published=true');
  
  // 检查维保相关 features
  const maintFeats = feats.data.filter(f => f.moduleId && f.moduleId.includes('MAINT'));
  console.log('=== 维保相关 features (from /api/features) ===');
  maintFeats.forEach(f => {
    console.log(`  ${f.id} | moduleId: ${f.moduleId} | status: ${f.status} | published: ${f.published}`);
  });
  
  // 检查模块
  const maintModules = tree.data.find(c => c.id === 'CAT-MAINTENANCE');
  if (maintModules) {
    console.log('\n=== CAT-MAINTENANCE modules ===');
    maintModules.modules.forEach(m => {
      console.log(`  Module: ${m.id} | features count: ${m.features.length}`);
      m.features.forEach(f => console.log(`    Feature: ${f.id}`));
    });
  }
  
  // 直接从 db.features 检查
  console.log('\n=== 所有 features 中 moduleId 包含 MAINT 的 ===');
  feats.data.filter(f => f.id && f.id.includes('MAINT')).forEach(f => {
    console.log(`  ${f.id} | moduleId: ${f.moduleId}`);
  });
}

main().catch(console.error);
