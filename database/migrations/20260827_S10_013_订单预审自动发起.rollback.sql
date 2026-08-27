-- S10-013 安全回退：只允许从未写入订单预审请求、调用、建群或区域映射时撤销。

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM integration.order_preapproval_requests)
     OR EXISTS (SELECT 1 FROM integration.order_preapproval_invocations)
     OR EXISTS (SELECT 1 FROM integration.order_preapproval_groups)
     OR EXISTS (SELECT 1 FROM integration.order_preapproval_region_mappings) THEN
    RAISE EXCEPTION 'S10-013_ROLLBACK_BLOCKED: 已存在订单预审请求、调用、建群或区域映射事实，禁止回退后丢失追溯信息；请关闭连接器并保留数据。';
  END IF;
END $$;

DROP TABLE IF EXISTS integration.order_preapproval_groups;
DROP TABLE IF EXISTS integration.order_preapproval_invocations;
DROP TABLE IF EXISTS integration.order_preapproval_requests;
DROP TABLE IF EXISTS integration.order_preapproval_region_mappings;
DROP TABLE IF EXISTS integration.order_preapproval_templates;
