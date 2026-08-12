-- 阶段9.22：将既有业务数据统一为当前业务编号规则，并保留原编号追溯信息。
-- 商机按历史创建日期全局递增；报价和订单按历史提报登录账号、创建日期递增。

BEGIN;

-- 仅使用已保存的 V2 员工编号或提报账号补齐明确缺失的负责人，无法解析时仍由后续校验中止迁移。
WITH 待补归属 AS (
  SELECT
    q.id,
    u.id AS 负责人编号,
    CASE
      WHEN u.v2_source_id = NULLIF(btrim(q.extra_json->>'assignedStaffId'), '') THEN 'assignedStaffId'
      ELSE 'submittedByUsername'
    END AS 归属来源
  FROM crm.quotes q
  JOIN LATERAL (
    SELECT u.id, u.v2_source_id
    FROM iam.users u
    WHERE u.v2_source_id = NULLIF(btrim(q.extra_json->>'assignedStaffId'), '')
       OR lower(u.username::text) = lower(NULLIF(btrim(q.extra_json->>'submittedByUsername'), ''))
    ORDER BY
      CASE WHEN u.v2_source_id = NULLIF(btrim(q.extra_json->>'assignedStaffId'), '') THEN 0 ELSE 1 END,
      u.id
    LIMIT 1
  ) u ON true
  WHERE q.owner_user_id IS NULL
    AND COALESCE(q.quote_no, '') !~ '^BJ-.+-[0-9]{8}-[0-9]{4}$'
)
UPDATE crm.quotes q
SET
  owner_user_id = 待补归属.负责人编号,
  updated_at = now(),
  extra_json = COALESCE(q.extra_json, '{}'::jsonb) || jsonb_build_object(
    'businessNumberOwnerResolvedBy', 'S9_022:' || 待补归属.归属来源
  )
FROM 待补归属
WHERE q.id = 待补归属.id;

WITH 待补归属 AS (
  SELECT
    o.id,
    u.id AS 负责人编号,
    CASE
      WHEN u.v2_source_id = NULLIF(btrim(o.extra_json->>'assignedStaffId'), '') THEN 'assignedStaffId'
      ELSE 'submittedByUsername'
    END AS 归属来源
  FROM crm.orders o
  JOIN LATERAL (
    SELECT u.id, u.v2_source_id
    FROM iam.users u
    WHERE u.v2_source_id = NULLIF(btrim(o.extra_json->>'assignedStaffId'), '')
       OR lower(u.username::text) = lower(NULLIF(btrim(o.extra_json->>'submittedByUsername'), ''))
    ORDER BY
      CASE WHEN u.v2_source_id = NULLIF(btrim(o.extra_json->>'assignedStaffId'), '') THEN 0 ELSE 1 END,
      u.id
    LIMIT 1
  ) u ON true
  WHERE o.owner_user_id IS NULL
    AND COALESCE(o.order_no, '') !~ '^LS-.+-[0-9]{8}-[0-9]{4}$'
)
UPDATE crm.orders o
SET
  owner_user_id = 待补归属.负责人编号,
  updated_at = now(),
  extra_json = COALESCE(o.extra_json, '{}'::jsonb) || jsonb_build_object(
    'businessNumberOwnerResolvedBy', 'S9_022:' || 待补归属.归属来源
  )
FROM 待补归属
WHERE o.id = 待补归属.id;

DO $$
DECLARE
  v_缺少账号报价数 integer;
  v_缺少账号订单数 integer;
BEGIN
  SELECT COUNT(*)
  INTO v_缺少账号报价数
  FROM crm.quotes q
  LEFT JOIN iam.users u ON u.id = q.owner_user_id
  WHERE COALESCE(q.quote_no, '') !~ '^BJ-.+-[0-9]{8}-[0-9]{4}$'
    AND NULLIF(btrim(u.username::text), '') IS NULL;

  SELECT COUNT(*)
  INTO v_缺少账号订单数
  FROM crm.orders o
  LEFT JOIN iam.users u ON u.id = o.owner_user_id
  WHERE COALESCE(o.order_no, '') !~ '^LS-.+-[0-9]{8}-[0-9]{4}$'
    AND NULLIF(btrim(u.username::text), '') IS NULL;

  IF v_缺少账号报价数 > 0 OR v_缺少账号订单数 > 0 THEN
    RAISE EXCEPTION
      '既有业务编号统一失败：存在缺少提报登录账号的报价 % 条、订单 % 条，请先补齐负责人账号后重试。',
      v_缺少账号报价数,
      v_缺少账号订单数;
  END IF;
END;
$$;

DO $$
DECLARE
  v_商机超限日期数 integer;
  v_报价超限日期账号组数 integer;
  v_订单超限日期账号组数 integer;
BEGIN
  WITH 合规编号 AS (
    SELECT
      substring(opportunity_no FROM '^SJ-([0-9]{8})-[0-9]{4}$') AS 业务日期,
      substring(opportunity_no FROM '([0-9]{4})$')::integer AS 流水
    FROM crm.opportunities
    WHERE opportunity_no ~ '^SJ-[0-9]{8}-[0-9]{4}$'
  ),
  待重编记录 AS (
    SELECT (created_at AT TIME ZONE 'Asia/Shanghai')::date AS 业务日期
    FROM crm.opportunities
    WHERE COALESCE(opportunity_no, '') !~ '^SJ-[0-9]{8}-[0-9]{4}$'
  ),
  日期汇总 AS (
    SELECT
      待重编记录.业务日期,
      COUNT(*) AS 待编数量,
      COALESCE(MAX(合规编号.流水), 0) AS 已有最大流水
    FROM 待重编记录
    LEFT JOIN 合规编号 ON 合规编号.业务日期 = to_char(待重编记录.业务日期, 'YYYYMMDD')
    GROUP BY 待重编记录.业务日期
  )
  SELECT COUNT(*)
  INTO v_商机超限日期数
  FROM 日期汇总
  WHERE 待编数量 + 已有最大流水 > 9999;

  WITH 合规编号 AS (
    SELECT
      lower(u.username::text) AS 提报账号,
      substring(q.quote_no FROM '^BJ-.+-([0-9]{8})-[0-9]{4}$') AS 业务日期,
      substring(q.quote_no FROM '([0-9]{4})$')::integer AS 流水
    FROM crm.quotes q
    JOIN iam.users u ON u.id = q.owner_user_id
    WHERE q.quote_no ~ '^BJ-.+-[0-9]{8}-[0-9]{4}$'
  ),
  待重编记录 AS (
    SELECT
      lower(u.username::text) AS 提报账号,
      (q.created_at AT TIME ZONE 'Asia/Shanghai')::date AS 业务日期
    FROM crm.quotes q
    JOIN iam.users u ON u.id = q.owner_user_id
    WHERE COALESCE(q.quote_no, '') !~ '^BJ-.+-[0-9]{8}-[0-9]{4}$'
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
  INTO v_报价超限日期账号组数
  FROM 日期账号汇总
  WHERE 待编数量 + 已有最大流水 > 9999;

  WITH 合规编号 AS (
    SELECT
      lower(u.username::text) AS 提报账号,
      substring(o.order_no FROM '^LS-.+-([0-9]{8})-[0-9]{4}$') AS 业务日期,
      substring(o.order_no FROM '([0-9]{4})$')::integer AS 流水
    FROM crm.orders o
    JOIN iam.users u ON u.id = o.owner_user_id
    WHERE o.order_no ~ '^LS-.+-[0-9]{8}-[0-9]{4}$'
  ),
  待重编记录 AS (
    SELECT
      lower(u.username::text) AS 提报账号,
      (o.created_at AT TIME ZONE 'Asia/Shanghai')::date AS 业务日期
    FROM crm.orders o
    JOIN iam.users u ON u.id = o.owner_user_id
    WHERE COALESCE(o.order_no, '') !~ '^LS-.+-[0-9]{8}-[0-9]{4}$'
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
  INTO v_订单超限日期账号组数
  FROM 日期账号汇总
  WHERE 待编数量 + 已有最大流水 > 9999;

  IF v_商机超限日期数 > 0 OR v_报价超限日期账号组数 > 0 OR v_订单超限日期账号组数 > 0 THEN
    RAISE EXCEPTION
      '既有业务编号统一失败：商机超出四位日流水的日期 % 个、报价超出四位日流水的日期账号组 % 个、订单超出四位日流水的日期账号组 % 个。',
      v_商机超限日期数,
      v_报价超限日期账号组数,
      v_订单超限日期账号组数;
  END IF;
END;
$$;

WITH 合规最大流水 AS (
  SELECT
    substring(opportunity_no FROM '^SJ-([0-9]{8})-[0-9]{4}$') AS 业务日期,
    MAX(substring(opportunity_no FROM '([0-9]{4})$')::integer) AS 已有最大流水
  FROM crm.opportunities
  WHERE opportunity_no ~ '^SJ-[0-9]{8}-[0-9]{4}$'
  GROUP BY 业务日期
),
待重编记录 AS (
  SELECT
    o.id,
    o.opportunity_no AS 原编号,
    (o.created_at AT TIME ZONE 'Asia/Shanghai')::date AS 业务日期,
    ROW_NUMBER() OVER (
      PARTITION BY (o.created_at AT TIME ZONE 'Asia/Shanghai')::date
      ORDER BY o.created_at, o.id
    ) AS 排序流水
  FROM crm.opportunities o
  WHERE COALESCE(o.opportunity_no, '') !~ '^SJ-[0-9]{8}-[0-9]{4}$'
),
目标编号 AS (
  SELECT
    待重编记录.id,
    待重编记录.原编号,
    'SJ-' || to_char(待重编记录.业务日期, 'YYYYMMDD') || '-' ||
      lpad((COALESCE(合规最大流水.已有最大流水, 0) + 待重编记录.排序流水)::text, 4, '0') AS 新编号
  FROM 待重编记录
  LEFT JOIN 合规最大流水 ON 合规最大流水.业务日期 = to_char(待重编记录.业务日期, 'YYYYMMDD')
)
UPDATE crm.opportunities o
SET
  opportunity_no = 目标编号.新编号,
  updated_at = now(),
  extra_json = COALESCE(o.extra_json, '{}'::jsonb) || jsonb_build_object(
    'legacyBusinessNumber', COALESCE(NULLIF(o.extra_json->>'legacyBusinessNumber', ''), 目标编号.原编号),
    'businessNumberNormalizedBy', 'S9_022'
  )
FROM 目标编号
WHERE o.id = 目标编号.id;

WITH 合规最大流水 AS (
  SELECT
    lower(u.username::text) AS 提报账号,
    substring(q.quote_no FROM '^BJ-.+-([0-9]{8})-[0-9]{4}$') AS 业务日期,
    MAX(substring(q.quote_no FROM '([0-9]{4})$')::integer) AS 已有最大流水
  FROM crm.quotes q
  JOIN iam.users u ON u.id = q.owner_user_id
  WHERE q.quote_no ~ '^BJ-.+-[0-9]{8}-[0-9]{4}$'
  GROUP BY lower(u.username::text), substring(q.quote_no FROM '^BJ-.+-([0-9]{8})-[0-9]{4}$')
),
待重编记录 AS (
  SELECT
    q.id,
    q.quote_no AS 原编号,
    u.username::text AS 提报账号原文,
    lower(u.username::text) AS 提报账号,
    (q.created_at AT TIME ZONE 'Asia/Shanghai')::date AS 业务日期,
    ROW_NUMBER() OVER (
      PARTITION BY lower(u.username::text), (q.created_at AT TIME ZONE 'Asia/Shanghai')::date
      ORDER BY q.created_at, q.id
    ) AS 排序流水
  FROM crm.quotes q
  JOIN iam.users u ON u.id = q.owner_user_id
  WHERE COALESCE(q.quote_no, '') !~ '^BJ-.+-[0-9]{8}-[0-9]{4}$'
),
目标编号 AS (
  SELECT
    待重编记录.id,
    待重编记录.原编号,
    'BJ-' || 待重编记录.提报账号原文 || '-' || to_char(待重编记录.业务日期, 'YYYYMMDD') || '-' ||
      lpad((COALESCE(合规最大流水.已有最大流水, 0) + 待重编记录.排序流水)::text, 4, '0') AS 新编号
  FROM 待重编记录
  LEFT JOIN 合规最大流水
    ON 合规最大流水.提报账号 = 待重编记录.提报账号
    AND 合规最大流水.业务日期 = to_char(待重编记录.业务日期, 'YYYYMMDD')
)
UPDATE crm.quotes q
SET
  quote_no = 目标编号.新编号,
  updated_at = now(),
  extra_json = COALESCE(q.extra_json, '{}'::jsonb) || jsonb_build_object(
    'legacyBusinessNumber', COALESCE(NULLIF(q.extra_json->>'legacyBusinessNumber', ''), 目标编号.原编号),
    'businessNumberNormalizedBy', 'S9_022'
  )
FROM 目标编号
WHERE q.id = 目标编号.id;

WITH 合规最大流水 AS (
  SELECT
    lower(u.username::text) AS 提报账号,
    substring(o.order_no FROM '^LS-.+-([0-9]{8})-[0-9]{4}$') AS 业务日期,
    MAX(substring(o.order_no FROM '([0-9]{4})$')::integer) AS 已有最大流水
  FROM crm.orders o
  JOIN iam.users u ON u.id = o.owner_user_id
  WHERE o.order_no ~ '^LS-.+-[0-9]{8}-[0-9]{4}$'
  GROUP BY lower(u.username::text), substring(o.order_no FROM '^LS-.+-([0-9]{8})-[0-9]{4}$')
),
待重编记录 AS (
  SELECT
    o.id,
    o.order_no AS 原编号,
    u.username::text AS 提报账号原文,
    lower(u.username::text) AS 提报账号,
    (o.created_at AT TIME ZONE 'Asia/Shanghai')::date AS 业务日期,
    ROW_NUMBER() OVER (
      PARTITION BY lower(u.username::text), (o.created_at AT TIME ZONE 'Asia/Shanghai')::date
      ORDER BY o.created_at, o.id
    ) AS 排序流水
  FROM crm.orders o
  JOIN iam.users u ON u.id = o.owner_user_id
  WHERE COALESCE(o.order_no, '') !~ '^LS-.+-[0-9]{8}-[0-9]{4}$'
),
目标编号 AS (
  SELECT
    待重编记录.id,
    待重编记录.原编号,
    'LS-' || 待重编记录.提报账号原文 || '-' || to_char(待重编记录.业务日期, 'YYYYMMDD') || '-' ||
      lpad((COALESCE(合规最大流水.已有最大流水, 0) + 待重编记录.排序流水)::text, 4, '0') AS 新编号
  FROM 待重编记录
  LEFT JOIN 合规最大流水
    ON 合规最大流水.提报账号 = 待重编记录.提报账号
    AND 合规最大流水.业务日期 = to_char(待重编记录.业务日期, 'YYYYMMDD')
)
UPDATE crm.orders o
SET
  order_no = 目标编号.新编号,
  updated_at = now(),
  extra_json = COALESCE(o.extra_json, '{}'::jsonb) || jsonb_build_object(
    'legacyBusinessNumber', COALESCE(NULLIF(o.extra_json->>'legacyBusinessNumber', ''), 目标编号.原编号),
    'businessNumberNormalizedBy', 'S9_022'
  )
FROM 目标编号
WHERE o.id = 目标编号.id;

INSERT INTO crm.business_number_counters (document_type, submitter_username, business_date, current_value)
SELECT
  'opportunity',
  'global',
  to_date(substring(opportunity_no FROM '^SJ-([0-9]{8})-[0-9]{4}$'), 'YYYYMMDD'),
  MAX(substring(opportunity_no FROM '([0-9]{4})$')::integer)
FROM crm.opportunities
WHERE opportunity_no ~ '^SJ-[0-9]{8}-[0-9]{4}$'
GROUP BY substring(opportunity_no FROM '^SJ-([0-9]{8})-[0-9]{4}$')
ON CONFLICT (document_type, submitter_username, business_date)
DO UPDATE SET current_value = GREATEST(crm.business_number_counters.current_value, EXCLUDED.current_value);

INSERT INTO crm.business_number_counters (document_type, submitter_username, business_date, current_value)
SELECT
  'quote',
  lower(u.username::text),
  to_date(substring(q.quote_no FROM '^BJ-.+-([0-9]{8})-[0-9]{4}$'), 'YYYYMMDD'),
  MAX(substring(q.quote_no FROM '([0-9]{4})$')::integer)
FROM crm.quotes q
JOIN iam.users u ON u.id = q.owner_user_id
WHERE q.quote_no ~ '^BJ-.+-[0-9]{8}-[0-9]{4}$'
GROUP BY lower(u.username::text), substring(q.quote_no FROM '^BJ-.+-([0-9]{8})-[0-9]{4}$')
ON CONFLICT (document_type, submitter_username, business_date)
DO UPDATE SET current_value = GREATEST(crm.business_number_counters.current_value, EXCLUDED.current_value);

INSERT INTO crm.business_number_counters (document_type, submitter_username, business_date, current_value)
SELECT
  'order',
  lower(u.username::text),
  to_date(substring(o.order_no FROM '^LS-.+-([0-9]{8})-[0-9]{4}$'), 'YYYYMMDD'),
  MAX(substring(o.order_no FROM '([0-9]{4})$')::integer)
FROM crm.orders o
JOIN iam.users u ON u.id = o.owner_user_id
WHERE o.order_no ~ '^LS-.+-[0-9]{8}-[0-9]{4}$'
GROUP BY lower(u.username::text), substring(o.order_no FROM '^LS-.+-([0-9]{8})-[0-9]{4}$')
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
  IF v_document_type NOT IN ('quote', 'order', 'opportunity') THEN
    RAISE EXCEPTION '不支持的业务编号类型：%', v_document_type;
  END IF;

  IF v_document_type IN ('quote', 'order') AND v_submitter_username = '' THEN
    RAISE EXCEPTION '生成业务编号时缺少提报账号。';
  END IF;

  v_counter_username := CASE
    WHEN v_document_type = 'opportunity' THEN 'global'
    ELSE lower(v_submitter_username)
  END;
  v_prefix := CASE v_document_type
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
  IS '生成报价、订单或商机业务编号；既有数据已按同一规则统一，日流水最多四位。';

COMMIT;
