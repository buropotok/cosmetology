PRAGMA foreign_keys = ON;

CREATE TABLE vk_onboarding_handoffs (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  vk_user_id TEXT,
  group_id INTEGER,
  group_name TEXT,
  screen_name TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX vk_onboarding_handoffs_user_idx ON vk_onboarding_handoffs(user_id, created_at DESC);
CREATE INDEX vk_onboarding_handoffs_expires_idx ON vk_onboarding_handoffs(expires_at);
