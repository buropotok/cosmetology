PRAGMA foreign_keys = ON;

-- Legacy shared-bot group pairing was replaced by per-user managed bots.
DROP TABLE IF EXISTS telegram_connections;
DROP TABLE IF EXISTS telegram_pairings;
DROP TABLE IF EXISTS telegram_rate_limits;
