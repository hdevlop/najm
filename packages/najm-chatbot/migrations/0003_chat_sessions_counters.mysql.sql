ALTER TABLE chat_sessions ADD COLUMN message_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE chat_sessions ADD COLUMN last_message_at TIMESTAMP;
UPDATE chat_sessions
SET
  message_count = COALESCE(JSON_LENGTH(messages), 0),
  last_message_at = COALESCE(updated_at, created_at)
WHERE message_count = 0 OR last_message_at IS NULL;
CREATE INDEX chat_sessions_user_recent_idx ON chat_sessions(user_id, last_message_at DESC);
