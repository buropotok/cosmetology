PRAGMA foreign_keys = ON;

CREATE TABLE vk_handoffs (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  group_id INTEGER NOT NULL,
  text TEXT NOT NULL DEFAULT '',
  image_key TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX vk_handoffs_expires_idx ON vk_handoffs(expires_at);
CREATE INDEX vk_handoffs_user_idx ON vk_handoffs(user_id, created_at DESC);
