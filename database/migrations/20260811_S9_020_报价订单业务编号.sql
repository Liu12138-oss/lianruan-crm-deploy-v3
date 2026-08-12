-- 阶段9.20：报价和订单的可读业务编号。
-- 历史报价、订单编号保持不变；本迁移只为后续新建记录分配编号。

CREATE TABLE IF NOT EXISTS crm.business_number_counters (
  document_type text NOT NULL CHECK (document_type IN ('quote', 'order')),
  submitter_username text NOT NULL,
  business_date date NOT NULL,
  current_value integer NOT NULL CHECK (current_value > 0),
  PRIMARY KEY (document_type, submitter_username, business_date)
);

COMMENT ON TABLE crm.business_number_counters IS '报价和订单按提报账号、自然日递增的业务编号计数器。';

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
BEGIN
  IF v_document_type NOT IN ('quote', 'order') THEN
    RAISE EXCEPTION '不支持的业务编号类型：%', v_document_type;
  END IF;

  IF v_submitter_username = '' THEN
    RAISE EXCEPTION '生成业务编号时缺少提报账号。';
  END IF;

  v_counter_username := lower(v_submitter_username);
  v_prefix := CASE v_document_type WHEN 'quote' THEN 'BJ' ELSE 'LS' END;

  INSERT INTO crm.business_number_counters (
    document_type, submitter_username, business_date, current_value
  )
  VALUES (v_document_type, v_counter_username, v_business_date, 1)
  ON CONFLICT (document_type, submitter_username, business_date)
  DO UPDATE SET current_value = crm.business_number_counters.current_value + 1
  RETURNING current_value INTO v_current_value;

  RETURN v_prefix || '-' || v_submitter_username || '-' || to_char(v_business_date, 'YYYYMMDD') || '-' || lpad(v_current_value::text, 4, '0');
END;
$$;

COMMENT ON FUNCTION crm.next_business_number(text, text)
  IS '生成报价或订单业务编号：类型-提报登录账号-中国标准时间日期-四位日流水。';
