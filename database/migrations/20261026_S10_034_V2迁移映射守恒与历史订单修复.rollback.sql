-- S10.34 回退：仅删除本迁移从原始快照恢复的订单及其级联明细、状态历史。
-- 校验结果和批次状态由下一次正向迁移重新计算，不在回退中伪造通过。

BEGIN;

DELETE FROM crm.orders
WHERE extra_json->>'restoredBy' = 'S10_034';

DELETE FROM migration.validation_results
WHERE check_code = 'S8_4_MAPPING_TARGETS';

COMMIT;
