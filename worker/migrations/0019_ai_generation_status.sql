CREATE TABLE IF NOT EXISTS miniapp_ai_generation_status (
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'general',
  status TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT,
  error_code TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, kind)
);
