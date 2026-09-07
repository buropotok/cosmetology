CREATE TABLE IF NOT EXISTS miniapp_before_after_images (
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('before','after','watermark')),
  r2_key TEXT NOT NULL,
  file_name TEXT,
  content_type TEXT,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, role),
  FOREIGN KEY (user_id) REFERENCES miniapp_drafts(user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_miniapp_before_after_images_user
  ON miniapp_before_after_images(user_id, role);
