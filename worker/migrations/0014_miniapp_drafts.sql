CREATE TABLE IF NOT EXISTS miniapp_drafts (
  user_id TEXT PRIMARY KEY,
  text_content TEXT NOT NULL DEFAULT '',
  platform TEXT NOT NULL DEFAULT 'telegram',
  active_photo_index INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS miniapp_draft_images (
  user_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  r2_key TEXT NOT NULL,
  file_name TEXT,
  content_type TEXT,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, position),
  FOREIGN KEY (user_id) REFERENCES miniapp_drafts(user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_miniapp_draft_images_user ON miniapp_draft_images(user_id, position);
