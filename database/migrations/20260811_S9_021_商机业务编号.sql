-- 阶段9.21：商机使用独立、可读且不关联登录账号的业务编号。
-- 历史商机编号保持不变；新商机按中国标准时间自然日全局递增。

ALTER TABLE crm.business_number_counters
  DROP CONSTRAINT IF EXISTS business_number_counters_document_type_check;

ALTER TABLE crm.business_number_counters
  ADD CONSTRAINT business_number_counters_document_type_check
  -- 生产环境可能已存在历史客户报备计数器；先保留该类型，后续 S9.26 统一收口。
  CHECK (document_type IN ('registration', 'quote', 'order', 'opportunity'));

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

    v_business_number := CASE
      WHEN v_document_type = 'opportunity'
        THEN v_prefix || '-' || to_char(v_business_date, 'YYYYMMDD') || '-' || lpad(v_current_value::text, 4, '0')
      ELSE v_prefix || '-' || v_submitter_username || '-' || to_char(v_business_date, 'YYYYMMDD') || '-' || lpad(v_current_value::text, 4, '0')
    END;

    -- 兼容既有导入数据：若历史商机已占用同一编号，跳过后继续取下一号。
    IF v_document_type <> 'opportunity'
       OR NOT EXISTS (SELECT 1 FROM crm.opportunities WHERE opportunity_no = v_business_number) THEN
      RETURN v_business_number;
    END IF;
  END LOOP;
END;
$$;

COMMENT ON TABLE crm.business_number_counters IS '报价、订单按提报账号递增，商机按自然日全局递增的业务编号计数器。';
COMMENT ON FUNCTION crm.next_business_number(text, text)
  IS '生成报价、订单或商机业务编号；商机格式为SJ-日期-四位日流水，不关联登录账号。';
