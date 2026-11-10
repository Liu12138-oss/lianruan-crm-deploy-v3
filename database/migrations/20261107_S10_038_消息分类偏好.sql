-- ============================================================
-- S10-038 消息个人偏好按业务分类保存
-- 仅扩展 message.user_preferences；不改变既有全局渠道开关语义。
-- ============================================================

BEGIN;

ALTER TABLE message.user_preferences
  ADD COLUMN IF NOT EXISTS category_preferences jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE message.user_preferences
  DROP CONSTRAINT IF EXISTS user_preferences_category_preferences_object;
ALTER TABLE message.user_preferences
  ADD CONSTRAINT user_preferences_category_preferences_object
  CHECK (jsonb_typeof(category_preferences) = 'object');

CREATE OR REPLACE FUNCTION message.apply_category_preference()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  分类偏好 jsonb;
  站内开关 boolean;
BEGIN
  SELECT category_preferences
    INTO 分类偏好
    FROM message.user_preferences
   WHERE user_id = NEW.recipient_user_id;

  IF 分类偏好 IS NOT NULL AND 分类偏好 ? NEW.category_code THEN
    站内开关 := COALESCE(
      (分类偏好 -> NEW.category_code ->> 'inAppEnabled')::boolean,
      true
    );
    IF NOT 站内开关 THEN
      NEW.status_code := 'archived';
      NEW.archived_at := COALESCE(NEW.archived_at, now());
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_message_category_preference ON message.notifications;
CREATE TRIGGER trg_message_category_preference
  BEFORE INSERT ON message.notifications
  FOR EACH ROW
  EXECUTE FUNCTION message.apply_category_preference();

COMMIT;
