ALTER TABLE media_assets ADD COLUMN content_hash TEXT;
ALTER TABLE media_assets ADD COLUMN thumbnail_id TEXT;

CREATE UNIQUE INDEX idx_media_assets_user_content_hash
  ON media_assets(user_id, content_hash)
  WHERE content_hash IS NOT NULL;

CREATE UNIQUE INDEX idx_media_assets_user_thumbnail
  ON media_assets(user_id, thumbnail_id)
  WHERE thumbnail_id IS NOT NULL;
