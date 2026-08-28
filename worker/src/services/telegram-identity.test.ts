import { describe, expect, it, vi } from 'vitest';
import type { Env } from '../types';
import { completeTelegramLink, resolveTelegramIdentity } from './telegram-identity';

function linkEnv(identities: { telegram_user_id: string; user_id: string }[] = [], usedChanges = 1) {
  const statements: { sql: string; values: unknown[] }[] = [];
  const batch = vi.fn(async () => [
    { meta: { changes: identities.length ? 0 : 1 } },
    { meta: { changes: 1 } },
    { meta: { changes: usedChanges } },
    { meta: { changes: 0 } },
  ]);
  const DB = {
    prepare: vi.fn((sql: string) => {
      const statement = { sql, values: [] as unknown[] };
      statements.push(statement);
      return {
        bind: (...values: unknown[]) => {
          statement.values = values;
          return { all: async () => ({ results: identities }) };
        },
      };
    }),
    batch,
  };
  return { env: { DB } as unknown as Env, batch, statements };
}
const input = { pairingId: 'tgp_1', userId: 'usr_1', telegramUserId: '77', chatId: '-1001', chatTitle: 'Test', chatType: 'supergroup' as const };

describe('Telegram identity linking', () => {
  it('atomically links a new identity, connection and pairing', async () => { const { env, batch, statements } = linkEnv(); await expect(completeTelegramLink(env, input)).resolves.toBeUndefined(); expect(batch).toHaveBeenCalledOnce(); expect(statements.some((statement) => statement.sql.includes('telegram_identities') && statement.values.includes('77'))).toBe(true); });
  it('is idempotent for the same Telegram and internal user', async () => { const { env, batch } = linkEnv([{ telegram_user_id: '77', user_id: 'usr_1' }]); await expect(completeTelegramLink(env, input)).resolves.toBeUndefined(); expect(batch).toHaveBeenCalledOnce(); });
  it('rejects a Telegram identity linked to another user without writing', async () => { const { env, batch } = linkEnv([{ telegram_user_id: '77', user_id: 'usr_other' }]); await expect(completeTelegramLink(env, input)).rejects.toMatchObject({ code: 'TELEGRAM_IDENTITY_CONFLICT' }); expect(batch).not.toHaveBeenCalled(); });
  it('rejects an internal user linked to another Telegram identity without writing', async () => { const { env, batch } = linkEnv([{ telegram_user_id: '88', user_id: 'usr_1' }]); await expect(completeTelegramLink(env, input)).rejects.toMatchObject({ code: 'TELEGRAM_IDENTITY_CONFLICT' }); expect(batch).not.toHaveBeenCalled(); });
  it('reports a pairing race without accepting the link', async () => { const { env } = linkEnv([], 0); await expect(completeTelegramLink(env, input)).rejects.toMatchObject({ code: 'TELEGRAM_LINK_FAILED' }); });
});

describe('Telegram identity resolution', () => {
  it('returns the linked active connection', async () => { const DB = { prepare: () => ({ bind: () => ({ first: async () => ({ user_id: 'usr_1', chat_id: '-1001', chat_title: 'Test', chat_type: 'group' }) }) }) }; await expect(resolveTelegramIdentity({ DB } as unknown as Env, '77')).resolves.toEqual({ userId: 'usr_1', chatId: '-1001', chatTitle: 'Test', chatType: 'group' }); });
  it('returns null for an unlinked identity', async () => { const DB = { prepare: () => ({ bind: () => ({ first: async () => null }) }) }; await expect(resolveTelegramIdentity({ DB } as unknown as Env, '77')).resolves.toBeNull(); });
});
