const fs = require('fs');
const path = require('path');
const DbLayer = require('../backend/db-layer');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'docs', 'p3-p5-aiagent-assets');
const OUT_JSON = path.join(OUT_DIR, 'p3-p5-assets-20260610.json');
const DB_PATH = path.join(ROOT, 'backend', 'crm.db');

const dbLayer = new DbLayer(DB_PATH);
const db = dbLayer.loadAll();
dbLayer.close();

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function str(value) {
  return String(value ?? '').trim();
}

function amount(record) {
  const value = record?.amount ?? record?.totalAmount ?? record?.total ?? record?.orderAmount ?? record?.quoteAmount ?? record?.dealAmount ?? record?.contractAmount ?? 0;
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function byId(list, id) {
  const target = str(id);
  if (!target) return null;
  return arr(list).find(item => str(item.id) === target) || null;
}

function customerKey(record) {
  return str(record?.creditCode || record?.customerId || record?.customer || record?.customerName || record?.name).toLowerCase();
}

function sameCustomer(a, b) {
  const ak = customerKey(a);
  const bk = customerKey(b);
  return ak && bk && ak === bk;
}

function findRegistrationFor(order, opportunity) {
  return byId(db.registrations, order?.regId) ||
    byId(db.registrations, opportunity?.regId) ||
    arr(db.registrations).find(item => sameCustomer(item, order) || sameCustomer(item, opportunity)) ||
    null;
}

function findOpportunityFor(order, quote) {
  return byId(db.opportunities, order?.oppId) ||
    byId(db.opportunities, quote?.oppId) ||
    arr(db.opportunities).find(item => arr(quote?.oppIds).map(str).includes(str(item.id))) ||
    arr(db.opportunities).find(item => sameCustomer(item, order) || sameCustomer(item, quote)) ||
    null;
}

function findQuoteFor(order) {
  return byId(db.quotes, order?.quoteId) ||
    arr(db.quotes).find(item => sameCustomer(item, order)) ||
    null;
}

function summarizeRecord(record, fields) {
  if (!record) return null;
  const result = {};
  for (const field of fields) {
    result[field] = record[field] ?? '';
  }
  return result;
}

function buildFunnelChains() {
  return arr(db.orders).map(order => {
    const quote = findQuoteFor(order);
    const opportunity = findOpportunityFor(order, quote);
    const registration = findRegistrationFor(order, opportunity);
    const hasDirectIds = Boolean(order.regId && order.oppId && order.quoteId);
    return {
      customer: order.customer || quote?.customer || opportunity?.customer || registration?.customer || '',
      region: order.region || quote?.region || opportunity?.region || registration?.region || '',
      partnerId: order.partnerId || quote?.partnerId || opportunity?.partnerId || registration?.partnerId || '',
      partnerName: order.partnerName || quote?.partnerName || opportunity?.partnerName || registration?.partnerName || '',
      matchRule: hasDirectIds ? 'direct_id_chain' : 'direct_id_and_same_customer_fallback',
      registration: summarizeRecord(registration, ['id', 'customer', 'status', 'partnerId', 'partnerName', 'assignedStaffId', 'assignedStaffName', 'createdAt', 'approvedAt']),
      opportunity: summarizeRecord(opportunity, ['id', 'name', 'customer', 'stage', 'amount', 'partnerId', 'partnerName', 'assignedStaffId', 'assignedStaffName', 'createdAt', 'updatedAt']),
      quote: summarizeRecord(quote, ['id', 'customer', 'oppId', 'status', 'total', 'amount', 'partnerId', 'partnerName', 'assignedStaffId', 'assignedStaffName', 'createdAt', 'updatedAt']),
      order: summarizeRecord(order, ['id', 'customer', 'quoteId', 'oppId', 'status', 'total', 'amount', 'partnerId', 'partnerName', 'assignedStaffId', 'assignedStaffName', 'createdAt', 'updatedAt']),
    };
  });
}

function groupBy(items, field) {
  const map = new Map();
  for (const item of items) {
    const key = str(item[field]) || '未设置';
    map.set(key, (map.get(key) || 0) + 1);
  }
  return Array.from(map.entries()).map(([key, count]) => ({ key, count }));
}

function sumBy(items, field) {
  const map = new Map();
  for (const item of items) {
    const key = str(item[field]) || '未设置';
    map.set(key, (map.get(key) || 0) + amount(item));
  }
  return Array.from(map.entries()).map(([key, totalAmount]) => ({ key, totalAmount }));
}

function buildReconciliationExport() {
  const registrations = arr(db.registrations);
  const opportunities = arr(db.opportunities);
  const quotes = arr(db.quotes);
  const orders = arr(db.orders);
  return {
    generatedAt: new Date().toISOString(),
    dataSource: 'backend/crm.db entities snapshot',
    totals: {
      users: arr(db.users).length,
      partners: arr(db.partners).length,
      registrations: registrations.length,
      opportunities: opportunities.length,
      quotes: quotes.length,
      orders: orders.length,
      opportunityAmount: opportunities.reduce((sum, item) => sum + amount(item), 0),
      quoteAmount: quotes.reduce((sum, item) => sum + amount(item), 0),
      orderAmount: orders.reduce((sum, item) => sum + amount(item), 0),
    },
    byRegion: {
      registrations: groupBy(registrations, 'region'),
      opportunities: groupBy(opportunities, 'region'),
      quotes: groupBy(quotes, 'region'),
      orders: groupBy(orders, 'region'),
      orderAmount: sumBy(orders, 'region'),
    },
    byPartner: {
      registrations: groupBy(registrations, 'partnerId'),
      opportunities: groupBy(opportunities, 'partnerId'),
      quotes: groupBy(quotes, 'partnerId'),
      orders: groupBy(orders, 'partnerId'),
      orderAmount: sumBy(orders, 'partnerId'),
    },
    statusDistribution: {
      registrations: groupBy(registrations, 'status'),
      opportunities: groupBy(opportunities, 'stage'),
      quotes: groupBy(quotes, 'status'),
      orders: groupBy(orders, 'status'),
      partners: groupBy(arr(db.partners), 'status'),
      users: groupBy(arr(db.users), 'status'),
    },
  };
}

function dictionaryItems(values, labels = {}) {
  return Array.from(new Set(values.map(str).filter(Boolean))).map((value, index) => ({
    value,
    label: labels[value] || value,
    sort: index + 1,
    enabled: true,
  }));
}

function buildDictionaries() {
  const all = [
    ...arr(db.users),
    ...arr(db.partners),
    ...arr(db.registrations),
    ...arr(db.opportunities),
    ...arr(db.quotes),
    ...arr(db.orders),
  ];
  return {
    roles: dictionaryItems(['superadmin', 'admin', 'partner_admin', 'staff'], {
      superadmin: '超级管理员',
      admin: '区域管理员',
      partner_admin: '渠道管理员',
      staff: '员工',
    }),
    registrationStatuses: dictionaryItems(['pending', 'approved', 'rejected', ...arr(db.registrations).map(item => item.status)], {
      pending: '待审批',
      approved: '已通过',
      rejected: '已驳回',
    }),
    opportunityStages: dictionaryItems(['contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost', ...arr(db.opportunities).map(item => item.stage)], {
      contacted: '已接触',
      qualified: '已确认',
      proposal: '方案/报价中',
      negotiation: '商务谈判',
      won: '已成交',
      lost: '已失单',
    }),
    quoteStatuses: dictionaryItems(['draft', 'submitted', 'approved', 'rejected', ...arr(db.quotes).map(item => item.status)], {
      draft: '草稿',
      submitted: '已提交',
      approved: '已通过',
      rejected: '已驳回',
      converted: '已转订单',
    }),
    orderStatuses: dictionaryItems(['pending', 'confirmed', 'rejected', 'completed', ...arr(db.orders).map(item => item.status)], {
      pending: '待处理',
      confirmed: '已确认',
      rejected: '已驳回',
      completed: '已完成',
      processing: '处理中',
    }),
    partnerLevels: dictionaryItems(['none', 'primary', 'secondary', ...arr(db.partners).map(item => item.partnerLevel)], {
      none: '未设置',
      primary: '一级渠道',
      secondary: '二级渠道',
    }),
    partnerStatuses: dictionaryItems(['active', 'pending', 'disabled', ...arr(db.partners).map(item => item.status)], {
      active: '已激活',
      pending: '待审批',
      disabled: '禁用',
    }),
    userStatuses: dictionaryItems(['active', 'pending', 'disabled', 'inactive', ...arr(db.users).map(item => item.status)], {
      active: '正常可用',
      pending: '待审批',
      disabled: '禁用',
      inactive: '未激活/停用',
    }),
    regions: dictionaryItems(all.map(item => item.region)),
    bigRegions: dictionaryItems(all.map(item => item.bigRegion)),
  };
}

const assets = {
  generatedAt: new Date().toISOString(),
  note: '只读导出，用于 AI-agent P3-P5 语义回归、漏斗链路、CRM 对账和字典中文化；不含密钥、Token、密码。',
  funnelChains: buildFunnelChains(),
  reconciliation: buildReconciliationExport(),
  dictionaries: buildDictionaries(),
};

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT_JSON, JSON.stringify(assets, null, 2), 'utf8');

console.log(`generated: ${OUT_JSON}`);
console.log(`funnelChains=${assets.funnelChains.length}`);
console.log(`orders=${assets.reconciliation.totals.orders}, orderAmount=${assets.reconciliation.totals.orderAmount}`);
