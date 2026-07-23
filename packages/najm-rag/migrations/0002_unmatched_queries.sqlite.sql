CREATE TABLE IF NOT EXISTS chatbot_unmatched_queries (
  id TEXT PRIMARY KEY,
  query TEXT NOT NULL,
  normalized TEXT NOT NULL UNIQUE,
  score TEXT NOT NULL,
  threshold TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'router',
  occurrence_count INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
