-- S10-016：订单审批可退回至区管、一级或二级渠道商修改后重新提交。

DO $$
DECLARE
  constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'crm.orders'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%status_code%'
  LOOP
    EXECUTE format('ALTER TABLE crm.orders DROP CONSTRAINT IF EXISTS %I', constraint_name);
  END LOOP;
END $$;

ALTER TABLE crm.orders
  ADD CONSTRAINT ck_orders_status_code_v3_order_approval
  CHECK (
    status_code IN (
      'draft', 'pending_primary_confirm', 'primary_confirmed', 'primary_rejected',
      'pending_superadmin_confirm', 'returned_to_region', 'returned_to_primary', 'returned_to_secondary',
      'confirmed', 'rejected', 'cancelled', 'revision_requested', 'replaced',
      'processing', 'shipped', 'completed'
    )
  );

COMMENT ON COLUMN crm.orders.status_code IS
  '订单状态。退回状态表示审批退回目标修改，修改并重新提交后才恢复审批节点。';
