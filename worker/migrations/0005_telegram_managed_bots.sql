PRAGMA foreign_keys = ON;

CREATE TABLE telegram_managed_bots (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  telegram_owner_user_id TEXT NOT NULL,
  telegram_bot_id TEXT NOT NULL UNIQUE,
  username TEXT,
  display_name TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX telegram_managed_bots_owner_idx
  ON telegram_managed_bots(telegram_owner_user_id,created_at DESC);
