-- 阶段9.26：兼容已使用客户报备编号规则的 V3 数据库，并拒绝未知业务编号类型。
-- 本迁移替代对已发布 S9.21 迁移的修改，避免破坏既有数据库迁移摘要。

DO $$
DECLARE
  v_未知业务类型 text;
BEGIN
  SELECT string_agg(DISTINCT document_type, ', ' ORDER BY document_type)
  INTO v_未知业务类型
  FROM crm.business_number_counters
  WHERE document_type NOT IN ('registration', 'quote', 'order', 'opportunity');

  IF v_未知业务类型 IS NOT NULL THEN
    RAISE EXCEPTION '业务编号计数器包含不支持的类型：%。请先核对来源数据，禁止删除后继续迁移。', v_未知业务类型;
  END IF;
END;
$$;

ALTER TABLE crm.business_number_counters
  DROP CONSTRAINT IF EXISTS business_number_counters_document_type_check;

ALTER TABLE crm.business_number_counters
  ADD CONSTRAINT business_number_counters_document_type_check
  CHECK (document_type IN ('registration', 'quote', 'order', 'opportunity'));

COMMENT ON TABLE crm.business_number_counters
  IS '客户报备、报价、订单按提报账号递增，商机按自然日全局递增的业务编号计数器。';
