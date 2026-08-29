import { AppError, type Env } from '../types';

export interface MiniAppAccount {
  userId: string;
}

export async function resolveTelegramIdentity(
  env: Env,
  telegramUserId: string,
): Promise<MiniAppAccount | null> {
  const row = await env.DB.prepare(
    `SELECT user_id
     FROM telegram_identities
     WHERE telegram_user_id=?`,
  )
    .bind(telegramUserId)
    .first<{ user_id: string }>();

  return row ? { userId: row.user_id } : null;
}

export async function resolveOrCreateTelegramIdentity(
  env: Env,
  telegramUserId: string,
): Promise<MiniAppAccount> {
  const existing = await resolveTelegramIdentity(env, telegramUserId);
  if (existing) return existing;

  const candidateUserId = `usr_${crypto.randomUUID().replaceAll('-', '')}`;
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO users(id,google_sub)
       SELECT ?,NULL WHERE NOT EXISTS (
         SELECT 1 FROM telegram_identities WHERE telegram_user_id=?
       )`,
    ).bind(candidateUserId, telegramUserId),
    env.DB.prepare(
      `INSERT OR IGNORE INTO telegram_identities(telegram_user_id,user_id)
       SELECT ?,? WHERE EXISTS (SELECT 1 FROM users WHERE id=?)`,
    ).bind(telegramUserId, candidateUserId, candidateUserId),
  ]);

  const account = await resolveTelegramIdentity(env, telegramUserId);
  if (!account) {
    throw new AppError(
      'MINIAPP_ACCOUNT_UNAVAILABLE',
      'Не удалось создать Telegram-аккаунт',
      500,
    );
  }
  return account;
}
