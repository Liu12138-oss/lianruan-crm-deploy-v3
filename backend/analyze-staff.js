const fs = require('fs');
const data = JSON.parse(fs.readFileSync('./data.json', 'utf8'));

// Build user lookup
const userMap = {};
data.users.forEach(u => { userMap[u.id] = u; });

// 1. Check PA001 across all partners
console.log('=== PA001 in all partners staff ===');
data.partners.forEach(p => {
  const matching = (p.staff || []).filter(s => s.userId === 'PA001');
  if (matching.length > 0) {
    console.log('Partner:', p.id, p.name);
    matching.forEach(s => console.log('  staff:', JSON.stringify(s)));
  }
});

// 2. All staff userIds that don't exist in users or point to wrong partner
console.log('\n=== Staff userId inconsistencies ===');
data.partners.forEach(p => {
  (p.staff || []).forEach(s => {
    const user = userMap[s.userId];
    if (!user) {
      console.log('NOT FOUND: Partner', p.id, p.name, '| staff userId:', s.userId, '| staff name:', s.name);
    } else if (user.partnerId && user.partnerId !== p.id) {
      console.log('WRONG PARTNER: Partner', p.id, p.name, '| staff userId:', s.userId, '| staff name:', s.name, '| user belongs to:', user.partnerId);
    }
  });
});

// 3. Opportunities with assignedStaffId issues (check registrations too)
console.log('\n=== Opportunities/Registrations staff assignment check ===');
const opps = data.opportunities || [];
opps.forEach(opp => {
  if (opp.assignedStaffId) {
    const user = userMap[opp.assignedStaffId];
    if (!user) {
      console.log('OPP', opp.id, '| assignedStaffId:', opp.assignedStaffId, '| NOT FOUND IN USERS');
    } else {
      console.log('OPP', opp.id, '| assignedStaffId:', opp.assignedStaffId, '| user name:', user.name, '| user partnerId:', user.partnerId, '| opp partnerId:', opp.partnerId);
    }
  }
});

// Check registrations too since the data has registrations
console.log('\n=== Registrations staff assignment check (PA001 entries) ===');
data.registrations.forEach(reg => {
  if (reg.assignedStaffId === 'PA001') {
    const user = userMap[reg.assignedStaffId];
    console.log('REG', reg.id, '| assignedStaffId:', reg.assignedStaffId, '| assignedStaffName:', reg.assignedStaffName, '| user name:', user ? user.name : 'N/A', '| user partnerId:', user ? user.partnerId : 'N/A', '| reg partnerId:', reg.partnerId, '| reg partnerName:', reg.partnerName);
  }
});

// 4. All partners staff lists
console.log('\n=== All partners with staff ===');
data.partners.forEach(p => {
  if (p.staff && p.staff.length > 0) {
    console.log('\nPartner:', p.id, p.name);
    p.staff.forEach(s => {
      const user = userMap[s.userId];
      const match = user ? (user.name === s.name ? 'MATCH' : 'MISMATCH: user=' + user.name) : 'NOT_FOUND';
      console.log('  userId:', s.userId, '| name:', s.name, '| role:', s.role, '| status:', s.status || 'N/A', '| check:', match);
    });
  }
});

// 5. Duplicate staff id within same partner
console.log('\n=== Duplicate staff.id within same partner ===');
data.partners.forEach(p => {
  if (p.staff && p.staff.length > 0) {
    const idMap = {};
    p.staff.forEach(s => {
      if (idMap[s.id]) {
        console.log('DUPLICATE ID: Partner', p.id, p.name, '| staff id:', s.id, '| userId1:', idMap[s.id], '| userId2:', s.userId);
      } else {
        idMap[s.id] = s.userId;
      }
    });
  }
});
