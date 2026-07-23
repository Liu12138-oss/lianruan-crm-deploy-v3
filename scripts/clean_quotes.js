const http = require('http');

function apiDelete(path) {
  return new Promise((resolve, reject) => {
    const url = new URL('http://localhost:3000/api' + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'DELETE',
    };
    const req = http.request(options, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { resolve({ success: false, raw: data, status: res.statusCode }); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  // 删除 quotes 数组中错误的 feature 条目
  const ids = [
    'FEAT-MOD-MAINTENANCE-01-01',
    'FEAT-MOD-MAINTENANCE-01-02'
  ];
  
  for (const id of ids) {
    const result = await apiDelete('/quotes/' + id);
    console.log(`删除 quotes/${id}: ${result.success ? '✅ 成功' : '❌ ' + JSON.stringify(result)}`);
  }
  
  // 等待服务器自动保存
  console.log('\n等待 35 秒让服务器自动保存...');
  await new Promise(r => setTimeout(r, 35000));
  
  // 验证
  const fs = require('fs');
  const path = require('path');
  const db = JSON.parse(fs.readFileSync(path.join(__dirname, '../backend/data.json'), 'utf8'));
  const inQ = db.quotes.filter(q => q.id && q.id.includes('MAINT'));
  const inF = db.features.filter(f => f.id && f.id.includes('MAINT'));
  console.log(`\n最终验证:`);
  console.log(`  quotes 中: ${inQ.length} 个`);
  console.log(`  features 中: ${inF.length} 个`);
  console.log(`  ${inQ.length === 0 && inF.length === 2 ? '✅ 完全修复！' : '❌ 仍有问题'}`);
}

main().catch(console.error);
