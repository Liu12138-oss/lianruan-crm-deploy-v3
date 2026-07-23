const fs = require('fs');
const data = JSON.parse(fs.readFileSync('./data.json', 'utf8'));

const targetId = 'PA001';

// Check all top-level arrays for PA001 references
const keys = ['users', 'partners', 'opportunities', 'quotes', 'orders', 'registrations', 'pendingApprovals', 'customers'];

keys.forEach(key => {
  if (!data[key] || !Array.isArray(data[key])) return;

  const matches = [];
  data[key].forEach((item, idx) => {
    const str = JSON.stringify(item);
    if (str.includes(targetId)) {
      // Find which field contains PA001
      const fields = [];
      for (const [k, v] of Object.entries(item)) {
        if (v === targetId || (typeof v === 'string' && v.includes(targetId))) {
          fields.push(k + '=' + v);
        } else if (Array.isArray(v)) {
          const arrMatches = v.filter(x => JSON.stringify(x).includes(targetId));
          if (arrMatches.length > 0) fields.push(k + '=[' + arrMatches.length + ' items with PA001]');
        }
      }
      const idField = item.id || item.name || idx;
      matches.push({ id: idField, fields: fields });
    }
  });

  if (matches.length > 0) {
    console.log(`\n=== ${key} (${matches.length} matches) ===`);
    matches.forEach(m => console.log(`  ${JSON.stringify(m.id)}: ${m.fields.join(', ')}`));
  }
});

// Specifically check P004 and P005 registrations
console.log('\n=== P004 registrations with PA001 ===');
if (data.registrations) {
  data.registrations.filter(r => r.partnerId === 'P004' && JSON.stringify(r).includes('PA001')).forEach(r => {
    console.log(`  ${r.id}: assignedStaffId=${r.assignedStaffId}, assignedStaffName=${r.assignedStaffName}, partnerName=${r.partnerName}`);
  });
}

console.log('\n=== P005 registrations with PA001 ===');
if (data.registrations) {
  data.registrations.filter(r => r.partnerId === 'P005' && JSON.stringify(r).includes('PA001')).forEach(r => {
    console.log(`  ${r.id}: assignedStaffId=${r.assignedStaffId}, assignedStaffName=${r.assignedStaffName}, partnerName=${r.partnerName}`);
  });
}

// Check quotes and orders
console.log('\n=== Quotes with PA001 ===');
if (data.quotes) {
  data.quotes.filter(q => JSON.stringify(q).includes('PA001')).forEach(q => {
    console.log(`  ${q.id}: createdBy=${q.createdBy}, partnerId=${q.partnerId}, partnerName=${q.partnerName}`);
  });
}

console.log('\n=== Orders with PA001 ===');
if (data.orders) {
  data.orders.filter(o => JSON.stringify(o).includes('PA001')).forEach(o => {
    console.log(`  ${o.id}: createdBy=${o.createdBy}, partnerId=${o.partnerId}`);
  });
}

// Check PA001 user details
console.log('\n=== PA001 user record ===');
const pa001 = data.users.find(u => u.id === 'PA001');
console.log(JSON.stringify(pa001, null, 2));
