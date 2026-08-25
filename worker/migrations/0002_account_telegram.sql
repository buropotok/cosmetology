PRAGMA foreign_keys = ON;
CREATE TABLE users (id TEXT PRIMARY KEY,google_sub TEXT NOT NULL UNIQUE,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE telegram_connections (id TEXT PRIMARY KEY,user_id TEXT NOT NULL UNIQUE,chat_id TEXT NOT NULL,chat_title TEXT,chat_type TEXT NOT NULL CHECK(chat_type IN ('group','supergroup')),status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')),connected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE);
CREATE TABLE telegram_pairings (id TEXT PRIMARY KEY,user_id TEXT NOT NULL,code_hash TEXT NOT NULL UNIQUE,status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','used','cancelled')),expires_at TEXT NOT NULL,used_at TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE);
CREATE INDEX telegram_pairings_user_idx ON telegram_pairings(user_id,created_at DESC);
CREATE INDEX telegram_pairings_status_idx ON telegram_pairings(code_hash,status,expires_at);
CREATE TABLE telegram_rate_limits (rate_key TEXT PRIMARY KEY,window_start INTEGER NOT NULL,attempts INTEGER NOT NULL);
ALTER TABLE posts ADD COLUMN user_id TEXT REFERENCES users(id);
CREATE INDEX posts_user_idx ON posts(user_id,published_at DESC);
