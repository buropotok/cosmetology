CREATE TABLE IF NOT EXISTS user_onboarding_state (
  user_id TEXT PRIMARY KEY,
  initial_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
