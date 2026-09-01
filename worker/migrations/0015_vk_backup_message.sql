CREATE TABLE IF NOT EXISTS vk_backup_messages (
  user_id TEXT PRIMARY KEY,
  telegram_chat_id TEXT NOT NULL,
  message_id INTEGER NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
