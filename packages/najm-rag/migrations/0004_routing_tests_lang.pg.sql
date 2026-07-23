ALTER TABLE chatbot_routing_tests
  ADD COLUMN IF NOT EXISTS lang text NOT NULL DEFAULT 'und';

CREATE INDEX IF NOT EXISTS routing_tests_lang_idx
  ON chatbot_routing_tests(lang);
