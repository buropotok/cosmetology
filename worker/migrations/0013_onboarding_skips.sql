CREATE TABLE IF NOT EXISTS user_onboarding_skip (
  user_id TEXT NOT NULL,
  step TEXT NOT NULL CHECK (step IN ('telegram_bot','telegram_group','telegram_preview','vk_group')),
  skipped_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, step)
);

CREATE INDEX IF NOT EXISTS idx_user_onboarding_skip_user ON user_onboarding_skip(user_id);
