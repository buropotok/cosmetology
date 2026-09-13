ALTER TABLE media_assets ADD COLUMN content_hash TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_media_assets_user_content_hash
  ON media_assets(user_id, content_hash)
  WHERE content_hash IS NOT NULL;
