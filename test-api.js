const https = require('https');

const AppCode = '6785eb7b1e65481f9876cd97403bb2cc';
const keyword = '联软科技';

// Body用x-www-form-urlencoded，但数字不加引号
const postData = `keyword=${encodeURIComponent(keyword)}&pageNum=1&pageSize=10`;

const options = {
  hostname: 'kzgsmhv1.market.alicloudapi.com',
  path: '/api/company_search/query',
  method: 'POST',
  headers: {
    'Authorization': `APPCODE ${AppCode}`,
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(postData),
    'User-Agent': 'Mozilla/5.0'
  }
};

console.log('Body:', postData);
console.log('---');

const req = https.request(options, (res) => {
  console.log('状态码:', res.statusCode);
  console.log('x-ca-error:', res.headers['x-ca-error-message'] || '无');
  
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log('响应:', body.substring(0, 3000));
    try {
      const json = JSON.parse(body);
      console.log('\n成功! 共', json.data?.length || 0, '条结果');
    } catch(e) {}
  });
});

req.on('error', e => console.error('请求错误:', e.message));
req.write(postData);
req.end();
