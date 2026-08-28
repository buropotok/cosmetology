import { AppError, type Env } from '../types';

export interface MiniAppAccount {
  userId: string;
  chatId: string | null;
  chatTitle: string | null;
  chatType: string | null;
}

export async function resolveTelegramIdentity(
  env: Env,
  telegramUserId: string,
): Promise<MiniAppAccount | null> {
  const row = await env.DB.prepare(
    `SELECT ti.user_id,tc.chat_id,tc.chat_title,tc.chat_type
     FROM telegram_identities ti
     LEFT JOIN telegram_connections tc
       ON tc.user_id=ti.user_id AND tc.status='active'
     WHERE ti.telegram_user_id=?`,
  )
    .bind(telegramUserId)
    .first<{
      user_id: string;
      chat_id: string | null;
      chat_title: string | null;
      chat_type: string | null;
    }>();

  return row
    ? {
        userId: row.user_id,
        chatId: row.chat_id,
        chatTitle: row.chat_title,
        chatType: row.chat_type,
      }
    : null;
}

export async function completeTelegramLink(
  env: Env,
  input: {
    pairingId: string;
    userId: string;
    telegramUserId: string;
    chatId: string;
    chatTitle: string | null;
    chatType: 'group' | 'supergroup';
  },
) {
  const identity = await env.DB.prepare(
    'SELECT telegram_user_id,user_id FROM telegram_identities WHERE telegram_user_id=? OR user_id=?',
  )
    .bind(input.telegramUserId, input.userId)
    .all<{ telegram_user_id: string; user_id: string }>();

  if (
    identity.results.some(
      (row) =>
        row.telegram_user_id !== input.telegramUserId ||
        row.user_id !== input.userId,
    )
  ) {
    throw new AppError(
      'TELEGRAM_IDENTITY_CONFLICT',
      'Этот Telegram-аккаунт или аккаунт расширения уже связан с другим пользователем',
      409,
    );
  }

  const results = await env.DB.batch([
    env.DB.prepare(
      `INSERT OR IGNORE INTO telegram_identities(telegram_user_id,user_id)
       SELECT ?,? WHERE EXISTS (
         SELECT 1 FROM telegram_pairings
         WHERE id=? AND user_id=? AND status='pending' AND expires_at>CURRENT_TIMESTAMP
       )`,
    ).bind(input.telegramUserId, input.userId, input.pairingId, input.userId),
    env.DB.prepare(
      `INSERT INTO telegram_connections(id,user_id,chat_id,chat_title,chat_type,status)
       SELECT ?,?,?,?,?, 'active'
       WHERE EXISTS (
         SELECT 1 FROM telegram_identities
         WHERE telegram_user_id=? AND user_id=?
       ) AND EXISTS (
         SELECT 1 FROM telegram_pairings
         WHERE id=? AND user_id=? AND status='pending' AND expires_at>CURRENT_TIMESTAMP
       )
       ON CONFLICT(user_id) DO UPDATE SET
         chat_id=excluded.chat_id,
         chat_title=excluded.chat_title,
         chat_type=excluded.chat_type,
         status='active',
         connected_at=CURRENT_TIMESTAMP,
         updated_at=CURRENT_TIMESTAMP`,
    ).bind(
      `tgc_${crypto.randomUUID().replaceAll('-', '')}`,
      input.userId,
      input.chatId,
      input.chatTitle,
      input.chatType,
      input.telegramUserId,
      input.userId,
      input.pairingId,
      input.userId,
    ),
    env.DB.prepare(
      `UPDATE telegram_pairings SET status='used',used_at=CURRENT_TIMESTAMP
       WHERE id=? AND status='pending' AND expires_at>CURRENT_TIMESTAMP
         AND EXISTS (
           SELECT 1 FROM telegram_identities
           WHERE telegram_user_id=? AND user_id=?
         )`,
    ).bind(input.pairingId, input.telegramUserId, input.userId),
    env.DB.prepare(
      `UPDATE telegram_pairings SET status='cancelled'
       WHERE user_id=? AND id<>? AND status='pending'
         AND EXISTS (
           SELECT 1 FROM telegram_identities
           WHERE telegram_user_id=? AND user_id=?
         )`,
    ).bind(input.userId, input.pairingId, input.telegramUserId, input.userId),
  ]);

  if ((results[2].meta.changes ?? 0) !== 1) {
    throw new AppError(
      'TELEGRAM_LINK_FAILED',
      'Не удалось завершить подключение. Создайте новый код',
      409,
    );
  }
}
