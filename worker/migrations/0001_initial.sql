PRAGMA foreign_keys = ON;
CREATE TABLE posts (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 idempotency_key TEXT NOT NULL UNIQUE,
 title TEXT, topic TEXT, summary TEXT, content_type TEXT,
 text TEXT NOT NULL CHECK(length(trim(text)) > 0), image_key TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, published_at TEXT
);
CREATE TABLE publications (
 id INTEGER PRIMARY KEY AUTOINCREMENT, post_id INTEGER NOT NULL,
 platform TEXT NOT NULL CHECK(platform IN ('vk','telegram')),
 status TEXT NOT NULL CHECK(status IN ('pending','published','failed')),
 external_post_id TEXT, external_url TEXT, error_message TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, published_at TEXT,
 FOREIGN KEY(post_id) REFERENCES posts(id) ON DELETE CASCADE,
 UNIQUE(post_id, platform)
);
CREATE INDEX posts_published_idx ON posts(published_at DESC);
CREATE INDEX publications_post_idx ON publications(post_id);
