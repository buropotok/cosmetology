import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../types';
import { parseConnectCommand, telegramWebhook } from './telegram-account';

afterEach(() => vi.unstubAllGlobals());

describe('Telegram connect command', () => {
  it('accepts plain and bot-qualified commands', () => { expect(parseConnectCommand('/connect 483729')).toBe('483729'); expect(parseConnectCommand('/connect@OurBot 483729')).toBe('483729'); });
  it('rejects arbitrary and malformed messages', () => { expect(parseConnectCommand('hello 483729')).toBeNull(); expect(parseConnectCommand('/connect 1234')).toBeNull(); });
});

function webhookEnv(identities: { telegram_user_id: string; user_id: string }[] = []) {
  const batch = vi.fn(async () => [
    { meta: { changes: identities.length ? 0 : 1 } },
    { meta: { changes: 1 } },
    { meta: { changes: 1 } },
    { meta: { changes: 0 } },
  ]);
  const prepared: { sql: string; values: unknown[] }[] = [];
  const DB = {
    prepare: vi.fn((sql: string) => {
      const entry = { sql, values: [] as unknown[] };
      prepared.push(entry);
      return {
        bind: (...values: unknown[]) => {
          entry.values = values;
          return {
            first: async () => sql.includes('telegram_rate_limits') ? null : sql.includes('telegram_pairings WHERE code_hash') ? { id: 'tgp_1', user_id: 'usr_1' } : null,
            all: async () => ({ results: identities }),
            run: async () => ({ success: true }),
          };
        },
      };
    }),
    batch,
  };
  return { env: { DB, TELEGRAM_BOT_TOKEN: 'token', TELEGRAM_WEBHOOK_SECRET: 'secret', PAIRING_CODE_SECRET: 'pair-secret' } as unknown as Env, batch, prepared };
}
function connectRequest() {
  return new Request('https://worker.example/api/telegram/webhook', {
    method: 'POST',
    headers: { 'x-telegram-bot-api-secret-token': 'secret', 'content-type': 'application/json' },
    body: JSON.stringify({ message: { text: '/connect 483729', from: { id: 77 }, chat: { id: -1001, title: 'Test group', type: 'supergroup' } } }),
  });
}
function telegramFetch() {
  const fetch = vi.fn(async (url: string, _init?: RequestInit) => new Response(JSON.stringify(url.endsWith('/getChatMember') ? { ok: true, result: { status: 'administrator' } } : { ok: true, result: { message_id: 1 } })));
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

describe('/connect identity linking', () => {
  it('links message.from.id to the pairing user after the admin check', async () => { const { env, batch, prepared } = webhookEnv(); const fetch = telegramFetch(); await expect(telegramWebhook(connectRequest(), env)).resolves.toEqual({ ok: true }); expect(fetch.mock.calls[0][0]).toContain('/getChatMember'); expect(batch).toHaveBeenCalledOnce(); expect(prepared.some(({ sql, values }) => sql.includes('INSERT OR IGNORE INTO telegram_identities') && values.slice(0, 2).join(':') === '77:usr_1')).toBe(true); });
  it('does not replace an identity that belongs to another user', async () => { const { env, batch } = webhookEnv([{ telegram_user_id: '77', user_id: 'usr_other' }]); const fetch = telegramFetch(); await expect(telegramWebhook(connectRequest(), env)).resolves.toEqual({ ok: true }); expect(batch).not.toHaveBeenCalled(); const responseBody = fetch.mock.calls.at(-1)?.[1]?.body as FormData; expect(responseBody.get('text')).toContain('уже связан'); });
});
