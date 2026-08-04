import fs from "node:fs";
import path from "node:path";

const sourcePath = "/Users/liu/Downloads/customser_back.sql";
const outputPath = path.resolve(
  "database/migrations/20260803_S9_015_KB_003_导入既往客户.sql",
);

const columns = [
  "legacy_id",
  "name",
  "category",
  "legacy_source",
  "industry",
  "staff_size",
  "note",
  "created_at",
  "updated_at",
  "organization_id",
  "user_id",
  "parent_id",
  "path",
  "status",
  "department_id",
  "name_pinyin",
  "revisit_at",
  "real_revisit_at",
  "revisit_remind_at",
  "company_name",
  "qixinbao_id",
  "cio_pid",
  "creator_id",
  "before_user_id",
  "before_department_id",
  "flow_into_at",
  "status_updated_at",
  "customer_common_setting_id",
  "before_customer_common_setting_id",
  "approve_status",
  "approve_deny_type",
  "step",
  "submit_applying_at",
  "finish_approve_at",
  "pending_step",
  "industry_category",
  "custom_field_template_id",
  "channel_code",
];

function main() {
  const sql = fs.readFileSync(sourcePath, "utf8");
  const marker = "INSERT INTO `customers` VALUES ";
  const start = sql.indexOf(marker);
  if (start < 0) throw new Error("未找到 customers 数据插入语句。");
  const bodyStart = start + marker.length;
  const bodyEnd = sql.indexOf(";\nUNLOCK TABLES", bodyStart);
  if (bodyEnd < 0) throw new Error("未找到 customers 数据结束位置。");
  const rows = parseRows(sql.slice(bodyStart, bodyEnd));
  const payloadLines = rows
    .map((row) => toPayload(row))
    .filter((payload) => payload.name || payload.company_name)
    .map((payload) => escapeCopyText(JSON.stringify(payload)));

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, buildMigration(payloadLines), "utf8");
  console.log(`已生成既往客户迁移：${outputPath}，客户数：${payloadLines.length}`);
}

function parseRows(input) {
  const rows = [];
  let index = 0;
  while (index < input.length) {
    skipSpaces();
    if (input[index] !== "(") {
      index += 1;
      continue;
    }
    index += 1;
    const row = [];
    while (index < input.length) {
      skipSpaces();
      row.push(parseValue());
      skipSpaces();
      if (input[index] === ",") {
        index += 1;
        continue;
      }
      if (input[index] === ")") {
        index += 1;
        rows.push(row);
        break;
      }
      throw new Error(`无法解析第 ${rows.length + 1} 行附近：${input.slice(index, index + 40)}`);
    }
  }
  return rows;

  function skipSpaces() {
    while (/\s/.test(input[index] || "")) index += 1;
  }

  function parseValue() {
    const char = input[index];
    if (input.startsWith("NULL", index)) {
      index += 4;
      return null;
    }
    if (char === "'") return parseString();
    const start = index;
    while (index < input.length && input[index] !== "," && input[index] !== ")") index += 1;
    const raw = input.slice(start, index).trim();
    if (!raw) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : raw;
  }

  function parseString() {
    index += 1;
    let value = "";
    while (index < input.length) {
      const char = input[index];
      if (char === "\\") {
        const next = input[index + 1] || "";
        value += next === "n" ? "\n" : next === "r" ? "\r" : next === "t" ? "\t" : next;
        index += 2;
        continue;
      }
      if (char === "'") {
        index += 1;
        return value;
      }
      value += char;
      index += 1;
    }
    throw new Error("字符串未正常结束。");
  }
}

function toPayload(row) {
  return columns.reduce((result, key, index) => {
    const value = row[index];
    if (value !== null && value !== "") result[key] = value;
    return result;
  }, {});
}

function escapeCopyText(value) {
  return value.replace(/\\/g, "\\\\");
}

function buildMigration(payloadLines) {
  return [
    "-- V3 缺陷修复 KB-20260803-003：导入既往已知客户。",
    "-- 来源文件：/Users/liu/Downloads/customser_back.sql。",
    "-- 说明：使用客户名称归一去重写入 crm.customers，重复执行不会产生重复客户。",
    "",
    "BEGIN;",
    "",
    "CREATE TEMP TABLE v3_kb003_known_customers_payload (payload jsonb NOT NULL) ON COMMIT DROP;",
    "",
    "COPY v3_kb003_known_customers_payload (payload) FROM STDIN;",
    ...payloadLines,
    "\\.",
    "",
    "WITH prepared AS (",
    "  SELECT",
    "    payload,",
    "    COALESCE(NULLIF(payload->>'company_name', ''), NULLIF(payload->>'name', '')) AS customer_name,",
    "    NULLIF(payload->>'created_at', '')::timestamptz AS created_at,",
    "    NULLIF(payload->>'updated_at', '')::timestamptz AS updated_at",
    "  FROM v3_kb003_known_customers_payload",
    "), cleaned AS (",
    "  SELECT DISTINCT ON (lower(regexp_replace(customer_name, '\\\\s+', '', 'g')))",
    "    customer_name,",
    "    lower(regexp_replace(customer_name, '\\\\s+', '', 'g')) AS normalized_name,",
    "    COALESCE(created_at, now()) AS created_at,",
    "    COALESCE(updated_at, created_at, now()) AS updated_at,",
    "    jsonb_strip_nulls(",
    "      payload || jsonb_build_object(",
    "        'knownCustomer', true,",
    "        'knownCustomerSource', 'customser_back.sql',",
    "        'legacyCustomerId', payload->>'legacy_id',",
    "        'customer', customer_name,",
    "        'customerName', customer_name,",
    "        'industry', COALESCE(payload->>'industry', payload->>'industry_category', ''),",
    "        'source', COALESCE(payload->>'legacy_source', 'known_customer_import')",
    "      )",
    "    ) AS extra_json",
    "  FROM prepared",
    "  WHERE customer_name IS NOT NULL AND btrim(customer_name) <> ''",
    "  ORDER BY lower(regexp_replace(customer_name, '\\\\s+', '', 'g')), updated_at DESC NULLS LAST",
    ")",
    "INSERT INTO crm.customers (customer_name, normalized_name, credit_code, status_code, created_at, updated_at, extra_json)",
    "SELECT customer_name, normalized_name, NULL, 'active', created_at, updated_at, extra_json",
    "FROM cleaned",
    "ON CONFLICT (normalized_name) WHERE status_code <> 'merged'",
    "DO UPDATE SET",
    "  customer_name = EXCLUDED.customer_name,",
    "  updated_at = GREATEST(crm.customers.updated_at, EXCLUDED.updated_at),",
    "  extra_json = crm.customers.extra_json || EXCLUDED.extra_json;",
    "",
    "COMMIT;",
    "",
  ].join("\n");
}

main();
