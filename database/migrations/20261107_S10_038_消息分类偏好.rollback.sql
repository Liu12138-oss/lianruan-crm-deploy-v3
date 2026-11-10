BEGIN;

DROP TRIGGER IF EXISTS trg_message_category_preference ON message.notifications;
DROP FUNCTION IF EXISTS message.apply_category_preference();
ALTER TABLE message.user_preferences
  DROP CONSTRAINT IF EXISTS user_preferences_category_preferences_object;
ALTER TABLE message.user_preferences
  DROP COLUMN IF EXISTS category_preferences;

COMMIT;
