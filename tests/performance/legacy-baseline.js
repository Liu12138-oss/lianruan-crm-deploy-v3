#!/usr/bin/env node

const {
  当前时间,
  写文本,
  请求,
  启动临时后端,
  停止临时后端,
} = require('../legacy-contract/阶段0测试工具');

const 场景 = [
  { name: '渠道列表', path: '/api/partners?page=1&pageSize=20&operatorRole=superadmin' },
  { name: '报备列表', path: '/api/registrations?page=1&pageSize=20&operatorRole=superadmin' },
  { name: '商机列表', path: '/api/opportunities?page=1&pageSize=20&operatorRole=superadmin' },
  { name: '报价列表', path: '/api/quotes?page=1&pageSize=20&operatorRole=superadmin' },
  { name: '订单列表', path: '/api/orders?page=1&pageSize=20&operatorRole=superadmin' },
  { name: '产品树', path: '/api/product-tree?published=true' },
  { name: '报价预览依赖', path: '/api/features?published=true' },
];

async function 执行一组(基础地址, 并发数) {
  const 结果 = [];
  for (const 用例 of 场景) {
    const 开始 = Date.now();
    const 执行集合 = Array.from({ length: 并发数 }, () => 请求(基础地址, 用例));
    const 返回集合 = await Promise.all(执行集合);
    const 耗时集合 = 返回集合.map((项) => 项.durationMs).sort((a, b) => a - b);
    const 成功数 = 返回集合.filter((项) => 项.ok).length;
    const 百分位 = (比例) => {
      if (!耗时集合.length) return 0;
      const 下标 = Math.min(耗时集合.length - 1, Math.ceil(耗时集合.length * 比例) - 1);
      return 耗时集合[下标];
    };
    结果.push({
      场景: 用例.name,
      路径: 用例.path,
      并发: 并发数,
      请求数: 返回集合.length,
      成功数,
      错误数: 返回集合.length - 成功数,
      总耗时毫秒: Date.now() - 开始,
      最小毫秒: 耗时集合[0] || 0,
      平均毫秒: Math.round(耗时集合.reduce((和, 值) => 和 + 值, 0) / (耗时集合.length || 1)),
      P95毫秒: 百分位(0.95),
      最大毫秒: 耗时集合[耗时集合.length - 1] || 0,
    });
  }
  return 结果;
}

async function 主函数() {
  const 后端 = await 启动临时后端();
  if (!后端.ok) {
    写文本('docs/baseline/现有系统性能与资源基线.md', [
      '# 现有系统性能与资源基线',
      '',
      `执行时间：${当前时间()}`,
      '',
      `环境不可测：${后端.reason}`,
      '',
      '```text',
      后端.日志 || '无输出',
      '```',
      '',
    ].join('\n'));
    停止临时后端(后端.进程);
    console.error(`性能基线无法执行：${后端.reason}`);
    process.exit(1);
  }

  const 全部结果 = [];
  const 资源开始 = process.memoryUsage();
  try {
    for (const 并发 of [1, 20, 100]) {
      全部结果.push(...await 执行一组(后端.基础地址, 并发));
    }
  } finally {
    停止临时后端(后端.进程);
  }
  const 资源结束 = process.memoryUsage();
  const 失败数 = 全部结果.reduce((合计, 项) => 合计 + 项.错误数, 0);

  写文本('docs/baseline/现有系统性能与资源基线.md', [
    '# 现有系统性能与资源基线',
    '',
    `执行时间：${当前时间()}`,
    '',
    '## 执行环境',
    '',
    `- 临时后端地址：${后端.基础地址}`,
    '- 数据库：复制样本库到 `tmp/stage0-runtime` 后执行',
    `- Node版本：${process.version}`,
    `- 平台：${process.platform} ${process.arch}`,
    `- 测试进程内存变化：${Math.round((资源结束.rss - 资源开始.rss) / 1024 / 1024)} MB`,
    '',
    '## 结果',
    '',
    '| 场景 | 并发 | 请求数 | 成功数 | 错误数 | 总耗时毫秒 | 最小 | 平均 | P95 | 最大 |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...全部结果.map((项) => `| ${项.场景} | ${项.并发} | ${项.请求数} | ${项.成功数} | ${项.错误数} | ${项.总耗时毫秒} | ${项.最小毫秒} | ${项.平均毫秒} | ${项.P95毫秒} | ${项.最大毫秒} |`),
    '',
    `结论：${失败数 ? `未通过，存在 ${失败数} 个错误响应或连接失败。` : '通过，轻量性能基线执行完成。'}`,
    '',
    '说明：阶段0性能基线只用于新旧比较，不代表V3目标容量。',
    '',
  ].join('\n'));

  if (失败数) {
    console.error('性能基线存在失败项，详见 docs/baseline/现有系统性能与资源基线.md');
    process.exit(1);
  }
  console.log(`性能基线通过：${全部结果.length} 个场景批次已执行。`);
}

主函数().catch((错误) => {
  console.error(错误);
  process.exit(1);
});
