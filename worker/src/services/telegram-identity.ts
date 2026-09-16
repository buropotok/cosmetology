import { AppError, type Env } from '../types';

export interface MiniAppAccount {
  userId: string;
}

export interface TelegramIdentityProfile {
  firstName: string;
  lastName?: string;
  username?: string;
  photoUrl?: string;
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

async function syncTelegramIdentityProfile(
  env: Env,
  telegramUserId: string,
  profile: TelegramIdentityProfile,
) {
  const firstName = profile.firstName;
  const lastName = profile.lastName ?? null;
  const username = profile.username ?? null;
  const photoUrl = profile.photoUrl ?? null;
  await env.DB.prepare(
    `UPDATE telegram_identities
     SET first_name=?,last_name=?,username=?,photo_url=?,updated_at=CURRENT_TIMESTAMP
     WHERE telegram_user_id=? AND (
       first_name IS NOT ? OR last_name IS NOT ? OR username IS NOT ? OR photo_url IS NOT ?
     )`,
  )
    .bind(firstName, lastName, username, photoUrl, telegramUserId, firstName, lastName, username, photoUrl)
    .run();
}

export async function resolveOrCreateTelegramIdentity(
  env: Env,
  telegramUserId: string,
  profile?: TelegramIdentityProfile,
): Promise<MiniAppAccount> {
  const existing = await resolveTelegramIdentity(env, telegramUserId);
  if (existing) {
    if (profile) await syncTelegramIdentityProfile(env, telegramUserId, profile);
    return existing;
  }

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
  if (profile) await syncTelegramIdentityProfile(env, telegramUserId, profile);
  return account;
}
