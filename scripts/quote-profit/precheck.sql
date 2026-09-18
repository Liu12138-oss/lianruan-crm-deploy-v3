-- 微盾＋硬件收益核算上线前只读预检。
-- 本脚本只执行查询，不创建、修改或删除任何数据库对象和业务数据。

\pset pager off
\pset null '[空值]'

\echo '=== 数据库与迁移基线 ==='
SELECT current_database() AS 数据库, current_user AS 数据库用户, now() AS 检查时间;
SELECT to_regclass('catalog.product_categories') AS 产品分类表,
       to_regclass('catalog.hardware_products') AS 硬件产品表,
       to_regclass('crm.quote_items') AS 报价明细表,
       to_regclass('crm.orders') AS 订单表,
       to_regclass('ops.outbox_events') AS 发件箱表,
       to_regclass('audit.audit_logs') AS 审计表;

\echo '=== 产品分类稳定编码 ==='
SELECT id::text AS 编号, category_code AS 分类编码, v2_source_id AS 旧编号,
       category_name AS 分类名称, product_type_code AS 产品类型, status_code AS 状态
FROM catalog.product_categories
ORDER BY category_code NULLS LAST, id;

\echo '=== 微盾硬件型号匹配 ==='
WITH 目标(Excel型号, 数据库型号) AS (
  VALUES
    ('LV-7050A', 'LV-7050-A'), ('LV-7050', 'LV-7050'),
    ('准入-N1', '准入-N1'), ('准入-N2', '准入-N2'), ('准入-N3', '准入-N3'),
    ('UNACC-1050', 'UNACC-1050'), ('UNACC-1100', 'UNACC-1100'),
    ('安渡-X2', '安渡-X2'), ('安渡-X3', '安渡-X3'), ('安渡-X3-hc', '安渡-X3-hc'),
    ('P1', 'P1'), ('P2', 'P2'), ('P3', 'P3')
)
SELECT 目标.Excel型号,
       count(硬件.id) AS 匹配数量,
       string_agg(COALESCE(硬件.hardware_code, 硬件.v2_source_id, 硬件.id::text), ', ' ORDER BY 硬件.id) AS 稳定编号
FROM 目标
LEFT JOIN catalog.hardware_products 硬件
  ON 硬件.hardware_code = 目标.数据库型号
  OR 硬件.v2_source_id = 目标.数据库型号
GROUP BY 目标.Excel型号, 目标.数据库型号
ORDER BY 目标.Excel型号;

\echo '=== 报价明细结构统计 ==='
SELECT product_ref_type AS 产品引用类型,
       count(*) AS 明细数,
       count(*) FILTER (WHERE product_ref_id IS NULL) AS 缺少引用编号,
       count(*) FILTER (WHERE product_ref_type = 'hardware' AND quantity <> trunc(quantity)) AS 非整数硬件数量
FROM crm.quote_items
GROUP BY product_ref_type
ORDER BY product_ref_type;

SELECT count(*) AS 报价数,
       count(*) FILTER (WHERE opportunity_id IS NULL) AS 缺少商机,
       count(*) FILTER (WHERE partner_id IS NULL) AS 缺少渠道商,
       count(*) FILTER (WHERE owner_user_id IS NULL) AS 缺少负责人
FROM crm.quotes;

\echo '=== 报价区域来源统计 ==='
SELECT count(*) AS 报价总数,
       count(*) FILTER (WHERE q.extra_json->>'regionId' IS NOT NULL AND q.extra_json->>'regionId' <> '') AS 报价扩展区域数,
       count(*) FILTER (WHERE o.region_id IS NOT NULL) AS 商机区域数,
       count(*) FILTER (WHERE p.region_id IS NOT NULL) AS 渠道商区域数,
       count(*) FILTER (WHERE o.region_id IS NOT NULL AND p.region_id IS NOT NULL AND o.region_id <> p.region_id) AS 商机渠道区域冲突数,
       count(*) FILTER (WHERE o.region_id IS NULL AND p.region_id IS NULL) AS 商机渠道均无区域数
FROM crm.quotes q
LEFT JOIN crm.opportunities o ON o.id = q.opportunity_id
LEFT JOIN channel.partners p ON p.id = q.partner_id;

\echo '=== 订单确认与发件箱事件统计 ==='
SELECT status_code AS 订单状态, count(*) AS 数量
FROM crm.orders
GROUP BY status_code
ORDER BY status_code;

SELECT event_type AS 事件类型, count(*) AS 数量,
       min(created_at) AS 最早时间, max(created_at) AS 最近时间
FROM ops.outbox_events
WHERE event_type IN ('crm.order.confirmed', 'crm.quote.profit.freeze.requested')
GROUP BY event_type
ORDER BY event_type;

\echo '=== 审计表分区可写性检查（只读取对象定义） ==='
SELECT c.relkind AS 对象类型, n.nspname AS 模式, c.relname AS 对象名
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE (n.nspname, c.relname) IN (('audit', 'audit_logs'), ('audit', 'audit_logs_default'))
ORDER BY n.nspname, c.relname;
