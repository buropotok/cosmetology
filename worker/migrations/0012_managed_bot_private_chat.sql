CREATE TABLE IF NOT EXISTS telegram_managed_bot_private_chats (
  user_id TEXT NOT NULL,
  telegram_bot_id TEXT NOT NULL,
  telegram_chat_id TEXT NOT NULL,
  telegram_user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, telegram_bot_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (telegram_bot_id) REFERENCES telegram_managed_bots(telegram_bot_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_managed_bot_private_chat_bot
  ON telegram_managed_bot_private_chats(telegram_bot_id, status);
