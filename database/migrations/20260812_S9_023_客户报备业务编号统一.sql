-- 阶段9.23：将客户报备统一为当前业务编号规则，并修复历史兼容编号覆盖正式编号的问题。
-- 无法映射真实账号的历史报备仅使用 legacy-V2员工编号参与编号，不回填或伪造真实账号归属。

BEGIN;

ALTER TABLE crm.business_number_counters
  DROP CONSTRAINT IF EXISTS business_number_counters_document_type_check;

ALTER TABLE crm.business_number_counters
  ADD CONSTRAINT business_number_counters_document_type_check
  CHECK (document_type IN ('registration', 'quote', 'order', 'opportunity'));

DO $$
DECLARE
  v_缺少编号来源数 integer;
  v_超限日期账号组数 integer;
BEGIN
  SELECT COUNT(*)
  INTO v_缺少编号来源数
  FROM crm.registrations r
  LEFT JOIN iam.users u ON u.id = r.owner_user_id
  WHERE COALESCE(r.registration_no, '') !~ '^BB-.+-[0-9]{8}-[0-9]{4}$'
    AND COALESCE(
      NULLIF(btrim(u.username::text), ''),
      NULLIF(btrim(r.extra_json->>'submittedByUsername'), ''),
      NULLIF(btrim(r.extra_json->>'assignedStaffId'), '')
    ) IS NULL;

  IF v_缺少编号来源数 > 0 THEN
    RAISE EXCEPTION
      '客户报备编号统一失败：存在 % 条历史报备缺少负责人账号和 V2 员工编号，无法安全生成编号。',
      v_缺少编号来源数;
  END IF;

  WITH 合规编号 AS (
    SELECT
      lower(substring(registration_no FROM '^BB-(.+)-[0-9]{8}-[0-9]{4}$')) AS 提报账号,
      substring(registration_no FROM '^BB-.+-([0-9]{8})-[0-9]{4}$') AS 业务日期,
      substring(registration_no FROM '([0-9]{4})$')::integer AS 流水
    FROM crm.registrations
    WHERE registration_no ~ '^BB-.+-[0-9]{8}-[0-9]{4}$'
  ),
  待重编记录 AS (
    SELECT
      lower(COALESCE(
        NULLIF(btrim(u.username::text), ''),
        NULLIF(btrim(r.extra_json->>'submittedByUsername'), ''),
        'legacy-' || NULLIF(btrim(r.extra_json->>'assignedStaffId'), '')
      )) AS 提报账号,
      (r.created_at AT TIME ZONE 'Asia/Shanghai')::date AS 业务日期
    FROM crm.registrations r
    LEFT JOIN iam.users u ON u.id = r.owner_user_id
    WHERE COALESCE(r.registration_no, '') !~ '^BB-.+-[0-9]{8}-[0-9]{4}$'
  ),
  日期账号汇总 AS (
    SELECT
      待重编记录.提报账号,
      待重编记录.业务日期,
      COUNT(*) AS 待编数量,
      COALESCE(MAX(合规编号.流水), 0) AS 已有最大流水
    FROM 待重编记录
    LEFT JOIN 合规编号
      ON 合规编号.提报账号 = 待重编记录.提报账号
      AND 合规编号.业务日期 = to_char(待重编记录.业务日期, 'YYYYMMDD')
    GROUP BY 待重编记录.提报账号, 待重编记录.业务日期
  )
  SELECT COUNT(*)
  INTO v_超限日期账号组数
  FROM 日期账号汇总
  WHERE 待编数量 + 已有最大流水 > 9999;

  IF v_超限日期账号组数 > 0 THEN
    RAISE EXCEPTION
      '客户报备编号统一失败：存在 % 个日期账号组超过四位日流水上限。',
      v_超限日期账号组数;
  END IF;
END;
$$;

WITH 合规最大流水 AS (
  SELECT
    lower(substring(registration_no FROM '^BB-(.+)-[0-9]{8}-[0-9]{4}$')) AS 提报账号,
    substring(registration_no FROM '^BB-.+-([0-9]{8})-[0-9]{4}$') AS 业务日期,
    MAX(substring(registration_no FROM '([0-9]{4})$')::integer) AS 已有最大流水
  FROM crm.registrations
  WHERE registration_no ~ '^BB-.+-[0-9]{8}-[0-9]{4}$'
  GROUP BY
    lower(substring(registration_no FROM '^BB-(.+)-[0-9]{8}-[0-9]{4}$')),
    substring(registration_no FROM '^BB-.+-([0-9]{8})-[0-9]{4}$')
),
待重编记录 AS (
  SELECT
    r.id,
    r.registration_no AS 原编号,
    COALESCE(
      NULLIF(btrim(u.username::text), ''),
      NULLIF(btrim(r.extra_json->>'submittedByUsername'), ''),
      'legacy-' || NULLIF(btrim(r.extra_json->>'assignedStaffId'), '')
    ) AS 提报账号原文,
    lower(COALESCE(
      NULLIF(btrim(u.username::text), ''),
      NULLIF(btrim(r.extra_json->>'submittedByUsername'), ''),
      'legacy-' || NULLIF(btrim(r.extra_json->>'assignedStaffId'), '')
    )) AS 提报账号,
    (r.created_at AT TIME ZONE 'Asia/Shanghai')::date AS 业务日期,
    ROW_NUMBER() OVER (
      PARTITION BY lower(COALESCE(
        NULLIF(btrim(u.username::text), ''),
        NULLIF(btrim(r.extra_json->>'submittedByUsername'), ''),
        'legacy-' || NULLIF(btrim(r.extra_json->>'assignedStaffId'), '')
      )), (r.created_at AT TIME ZONE 'Asia/Shanghai')::date
      ORDER BY r.created_at, r.id
    ) AS 排序流水
  FROM crm.registrations r
  LEFT JOIN iam.users u ON u.id = r.owner_user_id
  WHERE COALESCE(r.registration_no, '') !~ '^BB-.+-[0-9]{8}-[0-9]{4}$'
),
目标编号 AS (
  SELECT
    待重编记录.id,
    待重编记录.原编号,
    待重编记录.提报账号原文,
    'BB-' || 待重编记录.提报账号原文 || '-' || to_char(待重编记录.业务日期, 'YYYYMMDD') || '-' ||
      lpad((COALESCE(合规最大流水.已有最大流水, 0) + 待重编记录.排序流水)::text, 4, '0') AS 新编号
  FROM 待重编记录
  LEFT JOIN 合规最大流水
    ON 合规最大流水.提报账号 = 待重编记录.提报账号
    AND 合规最大流水.业务日期 = to_char(待重编记录.业务日期, 'YYYYMMDD')
)
UPDATE crm.registrations r
SET
  registration_no = 目标编号.新编号,
  updated_at = now(),
  extra_json = COALESCE(r.extra_json, '{}'::jsonb) || jsonb_build_object(
    'legacyBusinessNumber', COALESCE(NULLIF(r.extra_json->>'legacyBusinessNumber', ''), 目标编号.原编号),
    'businessNumberNormalizedBy', 'S9_023',
    'businessNumberSubmitterUsername', 目标编号.提报账号原文
  )
FROM 目标编号
WHERE r.id = 目标编号.id;

INSERT INTO crm.business_number_counters (document_type, submitter_username, business_date, current_value)
SELECT
  'registration',
  lower(substring(registration_no FROM '^BB-(.+)-[0-9]{8}-[0-9]{4}$')),
  to_date(substring(registration_no FROM '^BB-.+-([0-9]{8})-[0-9]{4}$'), 'YYYYMMDD'),
  MAX(substring(registration_no FROM '([0-9]{4})$')::integer)
FROM crm.registrations
WHERE registration_no ~ '^BB-.+-[0-9]{8}-[0-9]{4}$'
GROUP BY
  lower(substring(registration_no FROM '^BB-(.+)-[0-9]{8}-[0-9]{4}$')),
  substring(registration_no FROM '^BB-.+-([0-9]{8})-[0-9]{4}$')
ON CONFLICT (document_type, submitter_username, business_date)
DO UPDATE SET current_value = GREATEST(crm.business_number_counters.current_value, EXCLUDED.current_value);

CREATE OR REPLACE FUNCTION crm.next_business_number(
  p_document_type text,
  p_submitter_username text
)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_document_type text := btrim(COALESCE(p_document_type, ''));
  v_submitter_username text := btrim(COALESCE(p_submitter_username, ''));
  v_counter_username text;
  v_business_date date := (now() AT TIME ZONE 'Asia/Shanghai')::date;
  v_current_value integer;
  v_prefix text;
  v_business_number text;
  v_已占用 boolean;
BEGIN
  IF v_document_type NOT IN ('registration', 'quote', 'order', 'opportunity') THEN
    RAISE EXCEPTION '不支持的业务编号类型：%', v_document_type;
  END IF;

  IF v_document_type IN ('registration', 'quote', 'order') AND v_submitter_username = '' THEN
    RAISE EXCEPTION '生成业务编号时缺少提报账号。';
  END IF;

  v_counter_username := CASE
    WHEN v_document_type = 'opportunity' THEN 'global'
    ELSE lower(v_submitter_username)
  END;
  v_prefix := CASE v_document_type
    WHEN 'registration' THEN 'BB'
    WHEN 'quote' THEN 'BJ'
    WHEN 'order' THEN 'LS'
    ELSE 'SJ'
  END;

  LOOP
    INSERT INTO crm.business_number_counters (
      document_type, submitter_username, business_date, current_value
    )
    VALUES (v_document_type, v_counter_username, v_business_date, 1)
    ON CONFLICT (document_type, submitter_username, business_date)
    DO UPDATE SET current_value = crm.business_number_counters.current_value + 1
    RETURNING current_value INTO v_current_value;

    IF v_current_value > 9999 THEN
      RAISE EXCEPTION '业务编号日流水已超过四位上限：类型 %，账号 %，日期 %。',
        v_document_type,
        v_counter_username,
        to_char(v_business_date, 'YYYYMMDD');
    END IF;

    v_business_number := CASE
      WHEN v_document_type = 'opportunity'
        THEN v_prefix || '-' || to_char(v_business_date, 'YYYYMMDD') || '-' || lpad(v_current_value::text, 4, '0')
      ELSE v_prefix || '-' || v_submitter_username || '-' || to_char(v_business_date, 'YYYYMMDD') || '-' || lpad(v_current_value::text, 4, '0')
    END;

    v_已占用 := CASE v_document_type
      WHEN 'registration' THEN EXISTS (
        SELECT 1 FROM crm.registrations WHERE registration_no = v_business_number
      )
      WHEN 'opportunity' THEN EXISTS (
        SELECT 1 FROM crm.opportunities WHERE opportunity_no = v_business_number
      )
      WHEN 'quote' THEN EXISTS (
        SELECT 1 FROM crm.quotes WHERE quote_no = v_business_number
      )
      ELSE EXISTS (
        SELECT 1 FROM crm.orders WHERE order_no = v_business_number
      )
    END;

    IF NOT v_已占用 THEN
      RETURN v_business_number;
    END IF;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION crm.next_business_number(text, text)
  IS '生成报备、报价、订单或商机业务编号；报备、报价、订单按提报账号递增，商机按自然日全局递增。';

COMMIT;
