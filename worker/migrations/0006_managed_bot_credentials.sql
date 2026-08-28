ALTER TABLE telegram_managed_bots ADD COLUMN token_ciphertext TEXT;
ALTER TABLE telegram_managed_bots ADD COLUMN token_iv TEXT;
ALTER TABLE telegram_managed_bots ADD COLUMN token_key_version INTEGER NOT NULL DEFAULT 1;
