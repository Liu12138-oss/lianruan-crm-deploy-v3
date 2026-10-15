\echo '===== 修复前 ====='
select '订单数' as 项, count(*)::text as 值 from crm.orders
union all select '报价 converted', count(*)::text from crm.quotes where status_code='converted'
union all select '商机 stage/status 不一致', count(*)::text from crm.opportunities where (stage_code='won')<>(status_code='won')
union all select '账号状态字段不一致', count(*)::text from iam.users where coalesce(extra_json->>'status','')<>status_code;

BEGIN;

-- D-9(a) 补录 V2 迁移缺失的订单（V2 原始记录 ORD-1780908400434，原状态 cancelled）
INSERT INTO crm.orders (
  id, v2_source_id, order_no, quote_id, customer_id, partner_id, owner_user_id,
  status_code, total_amount, created_at, updated_at, row_version, revision_no, extra_json
) VALUES (
  '351846df-7295-50d7-da0a-c72bedecd227',
  'ORD-1780908400434',
  'LS-liangwanqi-20260608-0001',
  'a0cf0b8f-be67-a844-d347-478f90ba661b',
  'f0b0879d-14a4-aa18-ab4a-913c6be46982',
  '6a7eab15-952d-49ec-c898-9d6c49597817',
  'acbfa8e4-74dc-3b7e-7c6f-d750c7d94290',
  'cancelled', 0.00,
  '2026-06-08 16:46:40.434+08', '2026-06-08 16:53:17.326+08', 1, 1,
  '{"id":"ORD-1780908400434","uuid":"351846df-7295-50d7-da0a-c72bedecd227","oppId":"OPP-1780908364991","regId":"REG-2026-950281","quoteId":"QT-1780908381521","customer":"山东碧海机械科技有限公司","status":"cancelled","region":"山东区","partnerId":"P025","partnerName":"临沂普悦天诚信息科技有限公司","contacts":"舒珩 15192888211","deliveryAddr":"山东省临沂市","createdBy":"A022","createdByName":"梁婉琦","createdAt":"2026-06-08T08:46:40.434Z","updatedAt":"2026-06-08T08:53:17.326Z","repairedBy":"ui-consistency-r17","repairedFrom":"migration.v2_raw_records"}'::jsonb
);

-- D-9(b) 商机阶段与状态对齐（stage_code=won 时 status_code 应为 won）
UPDATE crm.opportunities
SET status_code = 'won', row_version = row_version + 1
WHERE opportunity_no = 'SJ-20260820-0005' AND status_code <> 'won';

-- D-9(c) 账号状态历史字段对齐（以正式 status_code 为准）
UPDATE iam.users
SET extra_json = jsonb_set(extra_json, '{status}', to_jsonb(status_code::text), true),
    row_version = row_version + 1
WHERE COALESCE(extra_json->>'status','') <> status_code;

COMMIT;

\echo '===== 修复后 ====='
select '订单数' as 项, count(*)::text as 值 from crm.orders
union all select '报价 converted', count(*)::text from crm.quotes where status_code='converted'
union all select '商机 stage/status 不一致', count(*)::text from crm.opportunities where (stage_code='won')<>(status_code='won')
union all select '账号状态字段不一致', count(*)::text from iam.users where coalesce(extra_json->>'status','')<>status_code;
\echo '===== 补录订单校验 ====='
select o.order_no, o.status_code, q.quote_no, q.status_code as 报价状态 from crm.orders o join crm.quotes q on q.id=o.quote_id where o.v2_source_id='ORD-1780908400434';
