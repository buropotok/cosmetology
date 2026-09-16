import { describe, expect, it } from 'vitest';
import { resolveOrCreateTelegramIdentity } from './telegram-identity';

describe('Telegram identity profile', () => {
  it('refreshes the stored profile for an existing Telegram identity', async () => {
    const writes: Array<{ sql: string; values: unknown[] }> = [];
    const DB = {
      prepare(sql: string) {
        return {
          bind(...values: unknown[]) {
            return {
              first: async () => sql.includes('SELECT user_id') ? { user_id: 'usr_existing' } : null,
              run: async () => {
                writes.push({ sql, values });
                return { meta: { changes: 1 } };
              },
            };
          },
        };
      },
    };

    await expect(resolveOrCreateTelegramIdentity({ DB } as any, '42', {
      firstName: 'Анна',
      lastName: 'Смирнова',
      username: 'anna',
      photoUrl: 'https://example.com/avatar.jpg',
    })).resolves.toEqual({ userId: 'usr_existing' });

    expect(writes).toHaveLength(1);
    expect(writes[0].sql).toContain('UPDATE telegram_identities');
    expect(writes[0].values.slice(0, 5)).toEqual([
      'Анна',
      'Смирнова',
      'anna',
      'https://example.com/avatar.jpg',
      '42',
    ]);
  });
});
