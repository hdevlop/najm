CREATE TABLE IF NOT EXISTS chatbot_unmatched_queries (
  id text PRIMARY KEY,
  query text NOT NULL,
  normalized text NOT NULL UNIQUE,
  score text NOT NULL,
  threshold text NOT NULL,
  source text NOT NULL DEFAULT 'router',
  occurrence_count integer NOT NULL DEFAULT 1,
  created_at timestamp DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp DEFAULT CURRENT_TIMESTAMP
);
