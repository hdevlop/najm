ALTER TABLE chatbot_tool_semantics
  ADD COLUMN IF NOT EXISTS source_file text;

CREATE INDEX IF NOT EXISTS semantics_tool_lang_idx
  ON chatbot_tool_semantics(tool_name, lang);
