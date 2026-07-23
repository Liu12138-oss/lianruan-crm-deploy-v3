/**
 * 渠道商等级设置API测试脚本
 * 直接测试后端API功能是否正常
 */

const http = require('http');

// API 基础配置
const API_HOST = 'localhost';
const API_PORT = 3000;

// 测试数据
const testData = {
  test1: {
    description: '测试1: 设置二级渠道商绑定单个一级渠道商',
    partnerId: 'P014', // 广州二级渠道商
    requestBody: {
      partnerLevel: 'secondary',
      parentPartnerIds: ['P013'], // 广州分级一级渠道商
      operatedBy: 'A007', // 广州区管理员
      operatedByRole: 'admin'
    }
  },
  test2: {
    description: '测试2: 设置二级渠道商绑定多个一级渠道商',
    partnerId: 'P014',
    requestBody: {
      partnerLevel: 'secondary',
      parentPartnerIds: ['P013', 'P012'], // 绑定两个一级渠道商
      operatedBy: 'A007',
      operatedByRole: 'admin'
    }
  },
  test3: {
    description: '测试3: 设置二级渠道商但不指定上级渠道商（应该失败）',
    partnerId: 'P014',
    requestBody: {
      partnerLevel: 'secondary',
      parentPartnerIds: [],
      operatedBy: 'A007',
      operatedByRole: 'admin'
    }
  }
};

// 发送 HTTP 请求
function makeRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: API_HOST,
      port: API_PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve({ status: res.statusCode, data: result });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

// 运行测试
async function runTests() {
  console.log('=== 渠道商等级设置API测试 ===\n');
  console.log('注意: 请确保后端服务正在运行 (node server.js)\n');

  for (const [testKey, test] of Object.entries(testData)) {
    console.log(`${test.description}`);
    console.log(`请求参数:`, JSON.stringify(test.requestBody, null, 2));
    
    try {
      const result = await makeRequest(
        'PUT',
        `/api/partners/${test.partnerId}/level`,
        test.requestBody
      );
      
      console.log(`响应状态: ${result.status}`);
      console.log(`响应数据:`, JSON.stringify(result.data, null, 2));
      
      if (result.status === 200 && result.data.success) {
        console.log('✓ 测试通过\n');
      } else {
        console.log('✗ 测试失败\n');
      }
    } catch (error) {
      console.log(`✗ 请求失败: ${error.message}`);
      console.log('请确保后端服务正在运行: cd backend && node server.js\n');
    }
    
    console.log('---\n');
  }

  console.log('=== 测试完成 ===');
}

// 执行测试
runTests().catch(console.error);
