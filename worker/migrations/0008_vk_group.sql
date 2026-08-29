CREATE TABLE IF NOT EXISTS user_vk_group (
  user_id TEXT PRIMARY KEY,
  group_id INTEGER NOT NULL,
  group_url TEXT NOT NULL,
  screen_name TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
