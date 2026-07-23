const fs = require('fs');
const path = require('path');

const DEFAULT_LEDGER_CANDIDATES = [
  process.env.CUSTOMER_LEDGER_PATH || '',
  path.join(__dirname, 'customer-ledger.csv'),
  'F:\\WXWork\\1688857843259241\\Cache\\File\\2026-06\\既往客户信息台账.csv'
].filter(Boolean);

const LEDGER_ENABLED = (process.env.CUSTOMER_LEDGER_ENABLED || 'true') === 'true';

let cache = {
  filePath: '',
  mtimeMs: 0,
  loadedAt: 0,
  rows: [],
  error: ''
};

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeCompanyName(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[()（）\[\]【】\s\-_,.，。\/\\]/g, '')
    .replace(/有限责任公司|股份有限公司|有限公司|集团股份|集团公司|集团/g, '');
}

function looksLikeDateTime(value) {
  return /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}$/.test(normalizeText(value));
}

function looksLikeCreditCode(value) {
  return /^[0-9A-Z]{15,20}$/i.test(normalizeText(value));
}

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
      continue;
    }
    current += ch;
  }

  result.push(current);
  return result.map(item => normalizeText(item.replace(/^\uFEFF/, '')));
}

function parseLedgerRow(fields) {
  if (!Array.isArray(fields) || fields.length < 2) return null;

  const customerId = normalizeText(fields[0]);
  const customer = normalizeText(fields[1]);
  if (!customerId || !customer) return null;

  let cursor = fields.length - 1;
  const departmentId = normalizeText(fields[cursor] || '');
  cursor--;
  const ownerId = normalizeText(fields[cursor] || '');
  cursor--;
  const updatedAt = normalizeText(fields[cursor] || '');
  cursor--;
  const createdAt = normalizeText(fields[cursor] || '');
  cursor--;

  if (!looksLikeDateTime(createdAt) || !looksLikeDateTime(updatedAt)) {
    return null;
  }

  const status = cursor >= 0 ? normalizeText(fields[cursor] || '') : '';
  cursor--;
  const employeeScale = cursor >= 0 ? normalizeText(fields[cursor] || '') : '';

  const industry = normalizeText(fields[2] || '');
  const region = normalizeText(fields[3] || '');
  let creditCode = normalizeText(fields[4] || '');
  if (!looksLikeCreditCode(creditCode)) {
    creditCode = '';
  }

  const displayRegion = region.replace(/^中国\s*/, '').trim();

  return {
    customerId,
    customer,
    industry,
    region,
    city: displayRegion || region,
    address: region,
    creditCode,
    employeeScale,
    status,
    createdAt,
    updatedAt,
    ownerId,
    departmentId,
    source: 'ledger'
  };
}

function findLedgerFile() {
  return DEFAULT_LEDGER_CANDIDATES.find(item => item && fs.existsSync(item)) || '';
}

function loadLedgerRows() {
  if (!LEDGER_ENABLED) {
    return [];
  }

  const filePath = findLedgerFile();
  if (!filePath) {
    cache = { ...cache, filePath: '', rows: [], error: 'file_not_found' };
    return [];
  }

  try {
    const stat = fs.statSync(filePath);
    if (cache.filePath === filePath && cache.mtimeMs === stat.mtimeMs && cache.rows.length) {
      return cache.rows;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/).filter(Boolean);
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
      const parsed = parseLedgerRow(parseCsvLine(lines[i]));
      if (parsed) rows.push(parsed);
    }

    cache = {
      filePath,
      mtimeMs: stat.mtimeMs,
      loadedAt: Date.now(),
      rows,
      error: ''
    };

    return rows;
  } catch (err) {
    cache = {
      filePath,
      mtimeMs: 0,
      loadedAt: Date.now(),
      rows: [],
      error: err.message
    };
    console.error('[customer-ledger] load failed:', err.message);
    return [];
  }
}

function searchCustomerLedger(keyword, limit = 10) {
  const text = normalizeText(keyword);
  if (text.length < 2) return [];

  const normalizedKeyword = normalizeCompanyName(text);
  const rows = loadLedgerRows();
  const scored = [];
  const seen = new Set();

  for (const row of rows) {
    const name = row.customer;
    const normalizedName = normalizeCompanyName(name);
    const region = normalizeText(row.region);
    const creditCode = normalizeText(row.creditCode);

    const matched =
      name.includes(text) ||
      normalizedName.includes(normalizedKeyword) ||
      region.includes(text) ||
      (creditCode && creditCode.includes(text));

    if (!matched) continue;

    const uniqueKey = normalizedName || name;
    if (seen.has(uniqueKey)) continue;
    seen.add(uniqueKey);

    let score = 0;
    if (name === text) score += 120;
    if (name.startsWith(text)) score += 80;
    if (normalizedName === normalizedKeyword) score += 120;
    if (normalizedName.startsWith(normalizedKeyword)) score += 70;
    if (normalizedName.includes(normalizedKeyword)) score += 40;
    if (creditCode && creditCode === text) score += 100;
    if (region && region.includes(text)) score += 10;

    scored.push({
      ...row,
      name: row.customer,
      legalPerson: '',
      companyStatus: row.status,
      _score: score
    });
  }

  return scored
    .sort((a, b) => b._score - a._score || String(b.updatedAt).localeCompare(String(a.updatedAt)))
    .slice(0, limit)
    .map(({ _score, ...item }) => item);
}

function getCustomerLedgerStatus() {
  return {
    enabled: LEDGER_ENABLED,
    filePath: cache.filePath || findLedgerFile() || '',
    loadedAt: cache.loadedAt,
    count: Array.isArray(cache.rows) ? cache.rows.length : 0,
    error: cache.error || ''
  };
}

module.exports = {
  searchCustomerLedger,
  getCustomerLedgerStatus,
  normalizeCompanyName
};
