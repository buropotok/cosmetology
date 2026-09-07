CREATE TABLE media_assets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  r2_key TEXT NOT NULL UNIQUE,
  source_type TEXT NOT NULL,
  file_name TEXT,
  content_type TEXT,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_media_assets_user_created
  ON media_assets(user_id, created_at DESC);

CREATE TABLE miniapp_before_after_assets (
  user_id TEXT PRIMARY KEY,
  before_asset_id TEXT,
  after_asset_id TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (before_asset_id) REFERENCES media_assets(id) ON DELETE SET NULL,
  FOREIGN KEY (after_asset_id) REFERENCES media_assets(id) ON DELETE SET NULL
);

CREATE INDEX idx_before_after_before_asset
  ON miniapp_before_after_assets(before_asset_id);

CREATE INDEX idx_before_after_after_asset
  ON miniapp_before_after_assets(after_asset_id);
