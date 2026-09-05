CREATE TABLE IF NOT EXISTS user_onboarding_intent (
  user_id TEXT PRIMARY KEY,
  action TEXT NOT NULL CHECK(action IN ('telegram_preview','telegram_publish')),
  draft_ref TEXT,
  return_screen TEXT NOT NULL DEFAULT 'composer',
  waiting_for TEXT NOT NULL CHECK(waiting_for IN ('telegram_bot','telegram_preview','telegram_group','confirmation')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','completed','cancelled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_onboarding_intent_event (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  event TEXT NOT NULL,
  waiting_for TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_onboarding_intent_event_user_created
ON user_onboarding_intent_event(user_id, created_at DESC);
