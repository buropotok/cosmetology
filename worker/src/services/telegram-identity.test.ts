import { describe, expect, it, vi } from 'vitest';
import type { Env } from '../types';
import { completeTelegramLink, resolveOrCreateTelegramIdentity, resolveTelegramIdentity } from './telegram-identity';

type AccountRow = { user_id: string; chat_id: string | null; chat_title: string | null; chat_type: string | null };
function nativeAccountEnv(initial: AccountRow | null, raceWinner?: AccountRow) {
  let row = initial;
  const statements: { sql: string; values: unknown[] }[] = [];
  const batch = vi.fn(async (items: unknown[]) => {
    if (!row) row = raceWinner ?? { user_id: 'usr_created', chat_id: null, chat_title: null, chat_type: null };
    return items.map(() => ({ meta: { changes: 1 } }));
  });
  const DB = {
    prepare: vi.fn((sql: string) => {
      const statement = { sql, values: [] as unknown[] };
      statements.push(statement);
      return { bind: (...values: unknown[]) => { statement.values = values; return { first: async () => row }; } };
    }),
    batch,
  };
  return { env: { DB } as unknown as Env, batch, statements };
}

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
      return { bind: (...values: unknown[]) => { statement.values = values; return { all: async () => ({ results: identities }) }; } };
    }),
    batch,
  };
  return { env: { DB } as unknown as Env, batch, statements };
}
const input = { pairingId: 'tgp_1', userId: 'usr_1', telegramUserId: '77', chatId: '-1001', chatTitle: 'Test', chatType: 'supergroup' as const };

describe('Telegram-native account resolution', () => {
  it('creates a Google-free internal user and Telegram identity on first login', async () => { const { env, batch, statements } = nativeAccountEnv(null); await expect(resolveOrCreateTelegramIdentity(env, '77')).resolves.toMatchObject({ userId: 'usr_created', chatId: null }); expect(batch).toHaveBeenCalledOnce(); expect(statements.some(({ sql, values }) => sql.includes('INSERT INTO users') && values[1] === '77')).toBe(true); expect(statements.some(({ sql }) => sql.includes('INSERT OR IGNORE INTO telegram_identities'))).toBe(true); });
  it('returns the same existing user without duplicate writes', async () => { const existing = { user_id: 'usr_1', chat_id: null, chat_title: null, chat_type: null }; const { env, batch } = nativeAccountEnv(existing); await expect(resolveOrCreateTelegramIdentity(env, '77')).resolves.toMatchObject({ userId: 'usr_1' }); await expect(resolveOrCreateTelegramIdentity(env, '77')).resolves.toMatchObject({ userId: 'usr_1' }); expect(batch).not.toHaveBeenCalled(); });
  it('resolves the race winner after concurrent first login', async () => { const winner = { user_id: 'usr_winner', chat_id: null, chat_title: null, chat_type: null }; const { env } = nativeAccountEnv(null, winner); await expect(resolveOrCreateTelegramIdentity(env, '77')).resolves.toMatchObject({ userId: 'usr_winner' }); });
  it('resolves an existing active connection', async () => { const row = { user_id: 'usr_1', chat_id: '-1001', chat_title: 'Test', chat_type: 'group' }; const { env } = nativeAccountEnv(row); await expect(resolveTelegramIdentity(env, '77')).resolves.toEqual({ userId: 'usr_1', chatId: '-1001', chatTitle: 'Test', chatType: 'group' }); });
});

describe('Telegram identity linking', () => {
  it('atomically links a new identity, connection and pairing', async () => { const { env, batch, statements } = linkEnv(); await expect(completeTelegramLink(env, input)).resolves.toBeUndefined(); expect(batch).toHaveBeenCalledOnce(); expect(statements.some((statement) => statement.sql.includes('telegram_identities') && statement.values.includes('77'))).toBe(true); });
  it('is idempotent for the same Telegram and internal user', async () => { const { env, batch } = linkEnv([{ telegram_user_id: '77', user_id: 'usr_1' }]); await expect(completeTelegramLink(env, input)).resolves.toBeUndefined(); expect(batch).toHaveBeenCalledOnce(); });
  it('rejects a Telegram identity linked to another user without writing', async () => { const { env, batch } = linkEnv([{ telegram_user_id: '77', user_id: 'usr_other' }]); await expect(completeTelegramLink(env, input)).rejects.toMatchObject({ code: 'TELEGRAM_IDENTITY_CONFLICT' }); expect(batch).not.toHaveBeenCalled(); });
  it('rejects an internal user linked to another Telegram identity without writing', async () => { const { env, batch } = linkEnv([{ telegram_user_id: '88', user_id: 'usr_1' }]); await expect(completeTelegramLink(env, input)).rejects.toMatchObject({ code: 'TELEGRAM_IDENTITY_CONFLICT' }); expect(batch).not.toHaveBeenCalled(); });
  it('reports a pairing race without accepting the link', async () => { const { env } = linkEnv([], 0); await expect(completeTelegramLink(env, input)).rejects.toMatchObject({ code: 'TELEGRAM_LINK_FAILED' }); });
});
