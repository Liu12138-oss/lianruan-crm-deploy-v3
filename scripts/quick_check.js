const fs = require('fs');
const path = require('path');
const db = JSON.parse(fs.readFileSync(path.join(__dirname, '../backend/data.json'), 'utf8'));
const inQ = db.quotes.filter(q => q.id && q.id.includes('MAINT'));
const inF = db.features.filter(f => f.id && f.id.includes('MAINT'));
console.log('quotes中MAINT:', inQ.length, '个');
console.log('features中MAINT:', inF.length, '个');
if (inF.length) inF.forEach(f => console.log('  ' + f.id + ' - ' + f.name));
