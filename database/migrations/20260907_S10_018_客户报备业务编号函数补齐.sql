-- 阶段10.18：补齐客户报备业务编号函数。
-- 某些历史环境在 S9.23 之后补执行 S9.20～S9.22，旧迁移重新定义函数并覆盖了 registration 支持。

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
