const fs = require('fs');
const data = JSON.parse(fs.readFileSync('./data.json', 'utf8'));

// 1. 查找重复用户名
const nameCount = {};
data.users.forEach(u => {
  if (!nameCount[u.name]) nameCount[u.name] = [];
  nameCount[u.name].push({ id: u.id, name: u.name, partnerId: u.partnerId, role: u.role, status: u.status, phone: u.phone });
});

console.log('=== 重复用户名 ===');
Object.entries(nameCount).filter(([k,v]) => v.length > 1).forEach(([name, users]) => {
  console.log(name + ': ' + users.length + '个');
  users.forEach(u => console.log('  ID:', u.id, '| partnerId:', u.partnerId, '| role:', u.role, '| status:', u.status, '| phone:', u.phone));
});

// 2. 查找陈功格和梁翠
console.log('\n=== 陈功格 ===');
data.users.filter(u => u.name.includes('陈功格')).forEach(u => console.log('  ID:', u.id, '| partnerId:', u.partnerId, '| role:', u.role, '| status:', u.status));

console.log('\n=== 梁翠 ===');
data.users.filter(u => u.name.includes('梁翠')).forEach(u => console.log('  ID:', u.id, '| partnerId:', u.partnerId, '| role:', u.role, '| status:', u.status));

// 3. 查找郑世凯
console.log('\n=== 郑世凯 ===');
data.users.filter(u => u.name.includes('郑世凯')).forEach(u => console.log('  ID:', u.id, '| partnerId:', u.partnerId, '| role:', u.role, '| status:', u.status, '| phone:', u.phone));

// 4. 检查ID是否重复
console.log('\n=== ID重复检查 ===');
const idCount = {};
data.users.forEach(u => {
  if (!idCount[u.id]) idCount[u.id] = [];
  idCount[u.id].push(u.name);
});
Object.entries(idCount).filter(([k,v]) => v.length > 1).forEach(([id, names]) => {
  console.log('重复ID:', id, '->', names.join(', '));
});

// 5. 总用户数
console.log('\n总用户数:', data.users.length);
