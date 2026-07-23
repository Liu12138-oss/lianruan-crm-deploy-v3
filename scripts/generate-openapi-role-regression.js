const fs = require('fs');
const path = require('path');
const DbLayer = require('../backend/db-layer');

const ROOT = path.join(__dirname, '..');
const DB_PATH = path.join(ROOT, 'backend', 'crm.db');
const OUT_DIR = path.join(ROOT, 'docs', 'openapi-role-regression');
const OUT_JSON = path.join(OUT_DIR, 'role-regression-expected-20260610.json');

const dbLayer = new DbLayer(DB_PATH);
const db = dbLayer.loadAll();
dbLayer.close();

function arr(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return value ? [value] : [];
}

function dedupe(values) {
  return Array.from(new Set(arr(values).flat().map(item => String(item || '').trim()).filter(Boolean)));
}

function byId(list, id) {
  const target = String(id || '').trim();
  if (!target) return null;
  return (Array.isArray(list) ? list : []).find(item => String(item.id || '') === target) || null;
}

function isSamePartnerScope(record, partnerId) {
  return record?.partnerId === partnerId ||
    record?.assignedPartnerId === partnerId ||
    record?.parentPartnerId === partnerId ||
    (Array.isArray(record?.parentPartnerIds) && record.parentPartnerIds.includes(partnerId));
}

function findOpportunity(record) {
  const ids = dedupe([...(Array.isArray(record?.oppIds) ? record.oppIds : []), record?.oppId]);
  if (!ids.length) return null;
  return (db.opportunities || []).find(item => ids.includes(String(item.id || ''))) || null;
}

function findQuote(record) {
  return byId(db.quotes || [], record?.quoteId);
}

function firstValue(records, field) {
  for (const record of records.filter(Boolean)) {
    const value = record?.[field];
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return '';
}

function partnerIdsFrom(records) {
  return dedupe(records.flatMap(record => [
    record?.partnerId,
    record?.assignedPartnerId,
    record?.parentPartnerId,
    ...(Array.isArray(record?.parentPartnerIds) ? record.parentPartnerIds : []),
  ]));
}

function userIdsFrom(records) {
  return dedupe(records.flatMap(record => [record?.ownerId, record?.assignedStaffId, record?.createdBy]));
}

function regionFrom(records) {
  const direct = firstValue(records, 'region');
  if (direct) return direct;
  for (const id of partnerIdsFrom(records)) {
    const partner = byId(db.partners || [], id);
    if (partner?.region) return partner.region;
  }
  for (const id of userIdsFrom(records)) {
    const user = byId(db.users || [], id);
    if (user?.region) return user.region;
  }
  return '';
}

function bigRegionFrom(records) {
  const direct = firstValue(records, 'bigRegion');
  if (direct) return direct;
  for (const id of partnerIdsFrom(records)) {
    const partner = byId(db.partners || [], id);
    if (partner?.bigRegion) return partner.bigRegion;
  }
  for (const id of userIdsFrom(records)) {
    const user = byId(db.users || [], id);
    if (user?.bigRegion) return user.bigRegion;
  }
  return '';
}

function normalizeQuote(record) {
  const opportunity = findOpportunity(record);
  const lineage = [record, opportunity].filter(Boolean);
  const assignedStaffId = record.assignedStaffId || record.ownerId || record.createdBy ||
    opportunity?.assignedStaffId || opportunity?.ownerId || opportunity?.createdBy || '';
  return {
    ...record,
    partnerId: record.partnerId || record.assignedPartnerId || opportunity?.partnerId || opportunity?.assignedPartnerId || '',
    assignedPartnerId: record.assignedPartnerId || record.partnerId || opportunity?.assignedPartnerId || opportunity?.partnerId || '',
    parentPartnerId: record.parentPartnerId || opportunity?.parentPartnerId || '',
    parentPartnerIds: dedupe([
      ...(Array.isArray(record.parentPartnerIds) ? record.parentPartnerIds : []),
      ...(Array.isArray(opportunity?.parentPartnerIds) ? opportunity.parentPartnerIds : []),
      record.parentPartnerId,
      opportunity?.parentPartnerId,
    ]),
    assignedStaffId,
    ownerId: record.ownerId || assignedStaffId || opportunity?.ownerId || opportunity?.assignedStaffId || opportunity?.createdBy || '',
    region: regionFrom(lineage),
    bigRegion: bigRegionFrom(lineage),
  };
}

function normalizeOrder(record) {
  const quote = findQuote(record);
  const opportunity = findOpportunity(record) || (quote ? findOpportunity(quote) : null);
  const lineage = [record, quote, opportunity].filter(Boolean);
  const assignedStaffId = record.assignedStaffId || record.ownerId || record.createdBy ||
    quote?.assignedStaffId || quote?.ownerId || quote?.createdBy ||
    opportunity?.assignedStaffId || opportunity?.ownerId || opportunity?.createdBy || '';
  return {
    ...record,
    partnerId: record.partnerId || record.assignedPartnerId || quote?.partnerId || quote?.assignedPartnerId ||
      opportunity?.partnerId || opportunity?.assignedPartnerId || '',
    assignedPartnerId: record.assignedPartnerId || record.partnerId || quote?.assignedPartnerId || quote?.partnerId ||
      opportunity?.assignedPartnerId || opportunity?.partnerId || '',
    parentPartnerId: record.parentPartnerId || quote?.parentPartnerId || opportunity?.parentPartnerId || '',
    parentPartnerIds: dedupe([
      ...(Array.isArray(record.parentPartnerIds) ? record.parentPartnerIds : []),
      ...(Array.isArray(quote?.parentPartnerIds) ? quote.parentPartnerIds : []),
      ...(Array.isArray(opportunity?.parentPartnerIds) ? opportunity.parentPartnerIds : []),
      record.parentPartnerId,
      quote?.parentPartnerId,
      opportunity?.parentPartnerId,
    ]),
    assignedStaffId,
    ownerId: record.ownerId || assignedStaffId || quote?.ownerId || quote?.assignedStaffId || quote?.createdBy ||
      opportunity?.ownerId || opportunity?.assignedStaffId || opportunity?.createdBy || '',
    region: regionFrom(lineage),
    bigRegion: bigRegionFrom(lineage),
  };
}

function visibleUsers(user) {
  if (user.role === 'superadmin') return db.users || [];
  if (user.role === 'admin') return (db.users || []).filter(item => item.region === user.region || !item.region);
  if (user.role === 'partner_admin') return (db.users || []).filter(item => item.partnerId === user.partnerId);
  return (db.users || []).filter(item => item.id === user.id);
}

function visiblePartners(user) {
  if (user.role === 'superadmin') return db.partners || [];
  if (user.role === 'admin') return (db.partners || []).filter(item => (item.status === 'active' && item.region === user.region) || (item.status === 'pending' && item.createdBy === user.id));
  if (user.role === 'partner_admin') return (db.partners || []).filter(item => item.id === user.partnerId || item.parentPartnerId === user.partnerId || (Array.isArray(item.parentPartnerIds) && item.parentPartnerIds.includes(user.partnerId)));
  return (db.partners || []).filter(item => item.id === user.partnerId);
}

function visibleBusiness(user, resource) {
  const list = db[resource] || [];
  const normalize = resource === 'quotes' ? normalizeQuote : resource === 'orders' ? normalizeOrder : item => item;
  const normalized = list.map(normalize);
  if (user.role === 'superadmin') return normalized;
  if (user.role === 'admin') return normalized.filter(item => item.region === user.region);
  if (user.role === 'partner_admin') return normalized.filter(item => isSamePartnerScope(item, user.partnerId));
  return normalized.filter(item => item.createdBy === user.id || item.ownerId === user.id || item.assignedStaffId === user.id);
}

function customerKey(item) {
  return String(item.customerId || item.creditCode || item.customer || item.customerName || item.name || '').trim().toLowerCase();
}

function visibleCustomers(user) {
  const items = [
    ...visibleBusiness(user, 'registrations'),
    ...visibleBusiness(user, 'opportunities'),
    ...visibleBusiness(user, 'quotes'),
    ...visibleBusiness(user, 'orders'),
  ];
  return dedupe(items.map(customerKey)).filter(Boolean);
}

function scope(user) {
  if (user.role === 'superadmin') {
    return {
      scopeType: 'all',
      isFullAccess: true,
      regions: [],
      bigRegions: [],
      partnerIds: visiblePartners(user).map(item => item.id),
      userIds: visibleUsers(user).map(item => item.id),
      expectedRule: '全量可见',
    };
  }
  if (user.role === 'admin') {
    return {
      scopeType: 'region',
      isFullAccess: false,
      regions: dedupe([user.region]),
      bigRegions: dedupe([user.bigRegion]),
      partnerIds: visiblePartners(user).map(item => item.id),
      userIds: visibleUsers(user).map(item => item.id),
      expectedRule: `仅可见区域=${user.region} 的数据；报价/订单使用标准化后的 region`,
    };
  }
  if (user.role === 'partner_admin') {
    return {
      scopeType: 'partner',
      isFullAccess: false,
      regions: dedupe([user.region]),
      bigRegions: dedupe([user.bigRegion]),
      partnerIds: visiblePartners(user).map(item => item.id),
      userIds: visibleUsers(user).map(item => item.id),
      expectedRule: `仅可见渠道=${user.partnerId} 及下级渠道链路数据`,
    };
  }
  return {
    scopeType: 'user',
    isFullAccess: false,
    regions: dedupe([user.region]),
    bigRegions: dedupe([user.bigRegion]),
    partnerIds: dedupe([user.partnerId]),
    userIds: dedupe([user.id]),
    expectedRule: `仅可见本人=${user.id} 创建、负责或分配的数据`,
  };
}

const testUsers = ['liulonghai', 'admin_sd', 'liangcui', 'shangxichao']
  .map(username => (db.users || []).find(item => item.username === username))
  .filter(Boolean);

const result = testUsers.map(user => {
  const scopeInfo = scope(user);
  const resources = {
    users: visibleUsers(user),
    partners: visiblePartners(user),
    customers: visibleCustomers(user),
    registrations: visibleBusiness(user, 'registrations'),
    opportunities: visibleBusiness(user, 'opportunities'),
    quotes: visibleBusiness(user, 'quotes'),
    orders: visibleBusiness(user, 'orders'),
  };
  const counts = {};
  const sampleIds = {};
  for (const [key, value] of Object.entries(resources)) {
    counts[key] = value.length;
    sampleIds[key] = key === 'customers' ? value.slice(0, 3) : value.slice(0, 3).map(item => item.id);
  }
  return {
    generatedAt: new Date().toISOString(),
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      region: user.region || '',
      bigRegion: user.bigRegion || '',
      partnerId: user.partnerId || '',
      partnerName: user.partnerName || '',
    },
    scope: scopeInfo,
    counts,
    sampleIds,
  };
});

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT_JSON, JSON.stringify(result, null, 2), 'utf8');

for (const item of result) {
  console.log([
    item.user.username,
    item.user.role,
    item.scope.scopeType,
    `users=${item.counts.users}`,
    `partners=${item.counts.partners}`,
    `customers=${item.counts.customers}`,
    `registrations=${item.counts.registrations}`,
    `opportunities=${item.counts.opportunities}`,
    `quotes=${item.counts.quotes}`,
    `orders=${item.counts.orders}`,
  ].join(' | '));
}
