CREATE TABLE IF NOT EXISTS miniapp_sessions (
  telegram_user_id TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_miniapp_sessions_expiry ON miniapp_sessions(expires_at);
