PRAGMA foreign_keys = ON;

CREATE TABLE telegram_managed_bot_webhooks (
  webhook_id TEXT PRIMARY KEY,
  telegram_bot_id TEXT NOT NULL UNIQUE,
  secret_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','active')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(telegram_bot_id) REFERENCES telegram_managed_bots(telegram_bot_id) ON DELETE CASCADE
);

CREATE TABLE telegram_managed_bot_group_pairings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  telegram_bot_id TEXT NOT NULL,
  nonce_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','completed','cancelled')),
  expires_at TEXT NOT NULL,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(telegram_bot_id) REFERENCES telegram_managed_bots(telegram_bot_id) ON DELETE CASCADE
);

CREATE INDEX telegram_managed_bot_group_pairings_lookup_idx
  ON telegram_managed_bot_group_pairings(nonce_hash,status,expires_at);
CREATE INDEX telegram_managed_bot_group_pairings_user_idx
  ON telegram_managed_bot_group_pairings(user_id,created_at DESC);

CREATE TABLE telegram_managed_bot_destinations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  telegram_bot_id TEXT NOT NULL,
  telegram_chat_id TEXT NOT NULL,
  chat_type TEXT NOT NULL CHECK(chat_type IN ('group','supergroup')),
  chat_title TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(telegram_bot_id) REFERENCES telegram_managed_bots(telegram_bot_id) ON DELETE CASCADE,
  UNIQUE(telegram_bot_id,telegram_chat_id)
);

CREATE UNIQUE INDEX telegram_managed_bot_destinations_active_bot_idx
  ON telegram_managed_bot_destinations(telegram_bot_id) WHERE status='active';
CREATE INDEX telegram_managed_bot_destinations_user_idx
  ON telegram_managed_bot_destinations(user_id,status,updated_at DESC);
