#!/usr/bin/env node

const {
  当前时间,
  写文本,
  请求,
  启动临时后端,
  停止临时后端,
} = require('./阶段0测试工具');

const 用例 = [
  { name: '登录-超级管理员样本', method: 'POST', path: '/api/auth/login', body: { username: 'admin', password: '123456' } },
  { name: '通知列表', method: 'GET', path: '/api/notifications' },
  { name: '报备列表', method: 'GET', path: '/api/registrations?page=1&pageSize=10&operatorRole=superadmin' },
  { name: '商机列表', method: 'GET', path: '/api/opportunities?page=1&pageSize=10&operatorRole=superadmin' },
  { name: '报价列表', method: 'GET', path: '/api/quotes?page=1&pageSize=10&operatorRole=superadmin' },
  { name: '订单列表', method: 'GET', path: '/api/orders?page=1&pageSize=10&operatorRole=superadmin' },
  { name: '渠道列表', method: 'GET', path: '/api/partners?page=1&pageSize=10&operatorRole=superadmin' },
  { name: '用户列表', method: 'GET', path: '/api/users?page=1&pageSize=10&operatorRole=superadmin' },
  { name: '产品树', method: 'GET', path: '/api/product-tree?published=true' },
  { name: '产品统计', method: 'GET', path: '/api/products/stats' },
  { name: '工作量分类', method: 'GET', path: '/api/workload/classifications' },
  { name: '移动端二期功能标记', method: 'GET', path: '/api/mobile/v2/feature-flags' },
  { name: '开放接口文档', method: 'GET', path: '/api/open-api/docs?operatorRole=superadmin' },
];

async function 主函数() {
  const 后端 = await 启动临时后端();
  if (!后端.ok) {
    写文本('docs/baseline/现有系统回归结果.md', [
      '# 现有系统回归结果',
      '',
      `执行时间：${当前时间()}`,
      '',
      '## 结论',
      '',
      `环境不可测：${后端.reason}`,
      '',
      '## 后端输出',
      '',
      '```text',
      后端.日志 || '无输出',
      '```',
      '',
    ].join('\n'));
    停止临时后端(后端.进程);
    console.error(`接口冒烟无法执行：${后端.reason}`);
    process.exit(1);
  }

  const 结果 = [];
  try {
    for (const 项 of 用例) {
      结果.push(await 请求(后端.基础地址, 项));
    }
  } finally {
    停止临时后端(后端.进程);
  }

  const 失败 = 结果.filter((项) => !项.ok);
  写文本('docs/baseline/现有系统回归结果.md', [
    '# 现有系统回归结果',
    '',
    `执行时间：${当前时间()}`,
    '',
    '## 执行环境',
    '',
    `- 临时后端地址：${后端.基础地址}`,
    '- 数据库：复制 `backend/crm.db` 和 `backend/audit.db` 到 `tmp/stage0-runtime` 后执行',
    '- 说明：阶段0冒烟只判断接口是否可达且未出现5xx，不把既有4xx直接算作改造回归。',
    '',
    '## 接口冒烟',
    '',
    '| 用例 | 方法 | 路径 | 状态码 | 耗时毫秒 | 响应大小 | success字段 | 信息 |',
    '| --- | --- | --- | ---: | ---: | ---: | --- | --- |',
    ...结果.map((项) => `| ${项.name} | ${项.method} | ${项.path} | ${项.status} | ${项.durationMs} | ${项.bodySize} | ${项.successField} | ${String(项.message || '').replace(/\|/g, ' ')} |`),
    '',
    `结论：${失败.length ? `未通过，发现 ${失败.length} 个不可用用例。` : '通过，核心接口冒烟未发现5xx或连接失败。'}`,
    '',
  ].join('\n'));

  if (失败.length) {
    console.error('接口冒烟存在失败项，详见 docs/baseline/现有系统回归结果.md');
    process.exit(1);
  }
  console.log(`接口冒烟通过：${结果.length} 个核心用例已执行。`);
}

主函数().catch((错误) => {
  console.error(错误);
  process.exit(1);
});
