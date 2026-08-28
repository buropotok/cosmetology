PRAGMA defer_foreign_keys = ON;

-- SQLite cannot remove a NOT NULL constraint in place. Preserve rows from
-- cascading children while rebuilding users with an optional Google identity.
CREATE TABLE telegram_connections_backup AS SELECT * FROM telegram_connections;
CREATE TABLE telegram_pairings_backup AS SELECT * FROM telegram_pairings;
CREATE TABLE telegram_identities_backup AS SELECT * FROM telegram_identities;

CREATE TABLE users_new (
  id TEXT PRIMARY KEY,
  google_sub TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO users_new(id,google_sub,created_at,updated_at)
SELECT id,google_sub,created_at,updated_at FROM users;

DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

INSERT INTO telegram_connections SELECT * FROM telegram_connections_backup;
INSERT INTO telegram_pairings SELECT * FROM telegram_pairings_backup;
INSERT INTO telegram_identities SELECT * FROM telegram_identities_backup;

DROP TABLE telegram_connections_backup;
DROP TABLE telegram_pairings_backup;
DROP TABLE telegram_identities_backup;

ALTER TABLE telegram_pairings ADD COLUMN telegram_user_id TEXT
  REFERENCES telegram_identities(telegram_user_id);

PRAGMA defer_foreign_keys = OFF;
