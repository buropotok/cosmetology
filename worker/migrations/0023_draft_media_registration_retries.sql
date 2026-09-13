CREATE TABLE IF NOT EXISTS draft_media_registration_retries (
  user_id TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  file_name TEXT,
  content_type TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, r2_key)
);

CREATE INDEX IF NOT EXISTS idx_draft_media_registration_retries_user
  ON draft_media_registration_retries(user_id, created_at);
