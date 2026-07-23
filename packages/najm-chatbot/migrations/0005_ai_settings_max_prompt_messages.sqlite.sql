ALTER TABLE ai_settings ADD COLUMN max_prompt_messages INTEGER DEFAULT 10;
UPDATE ai_settings SET max_stored_messages = 100 WHERE max_stored_messages IS NULL;
UPDATE ai_settings SET max_prompt_messages = 10 WHERE max_prompt_messages IS NULL;
