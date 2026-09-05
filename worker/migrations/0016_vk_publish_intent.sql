PRAGMA foreign_keys=OFF;

CREATE TABLE user_onboarding_intent_new (
  user_id TEXT PRIMARY KEY,
  action TEXT NOT NULL CHECK(action IN ('telegram_preview','telegram_publish','publish_vk')),
  draft_ref TEXT,
  return_screen TEXT NOT NULL DEFAULT 'composer',
  waiting_for TEXT NOT NULL CHECK(waiting_for IN ('telegram_bot','telegram_preview','telegram_group','confirmation','vk_vpn')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','completed','cancelled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL
);

INSERT INTO user_onboarding_intent_new
  (user_id, action, draft_ref, return_screen, waiting_for, status, created_at, updated_at, expires_at)
SELECT user_id, action, draft_ref, return_screen, waiting_for, status, created_at, updated_at, expires_at
FROM user_onboarding_intent;

DROP TABLE user_onboarding_intent;
ALTER TABLE user_onboarding_intent_new RENAME TO user_onboarding_intent;

PRAGMA foreign_keys=ON;
