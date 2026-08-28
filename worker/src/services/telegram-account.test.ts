import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../types';
import { parseConnectCommand, telegramWebhook } from './telegram-account';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('Telegram connect command', () => {
  it('accepts plain and bot-qualified commands', () => { expect(parseConnectCommand('/connect 483729')).toBe('483729'); expect(parseConnectCommand('/connect@OurBot 483729')).toBe('483729'); });
  it('rejects arbitrary and malformed messages', () => { expect(parseConnectCommand('hello 483729')).toBeNull(); expect(parseConnectCommand('/connect 1234')).toBeNull(); });
});

type Pairing = { id: string; user_id: string; telegram_user_id: string | null } | null;
function webhookEnv(options: { pairing?: Pairing; identities?: { telegram_user_id: string; user_id: string }[] } = {}) {
  const pairing = options.pairing === undefined ? { id: 'tgp_1', user_id: 'usr_1', telegram_user_id: '77' } : options.pairing;
  const identities = options.identities ?? [{ telegram_user_id: '77', user_id: 'usr_1' }];
  const batch = vi.fn(async () => [
    { meta: { changes: 0 } },
    { meta: { changes: 1 } },
    { meta: { changes: 1 } },
    { meta: { changes: 0 } },
  ]);
  const prepared: { sql: string; values: unknown[] }[] = [];
  const DB = {
    prepare: vi.fn((sql: string) => {
      const entry = { sql, values: [] as unknown[] };
      prepared.push(entry);
      return { bind: (...values: unknown[]) => { entry.values = values; return {
        first: async () => sql.includes('telegram_rate_limits') ? null : sql.includes('telegram_pairings WHERE code_hash') ? pairing : null,
        all: async () => ({ results: identities }),
        run: async () => ({ success: true }),
      }; } };
    }),
    batch,
  };
  return { env: { DB, TELEGRAM_BOT_TOKEN: 'token', TELEGRAM_WEBHOOK_SECRET: 'secret', PAIRING_CODE_SECRET: 'pair-secret' } as unknown as Env, batch, prepared };
}
function connectRequest(fromId = 77) {
  return new Request('https://worker.example/api/telegram/webhook', {
    method: 'POST',
    headers: { 'x-telegram-bot-api-secret-token': 'secret', 'content-type': 'application/json' },
    body: JSON.stringify({ message: { text: '/connect 483729', from: { id: fromId }, chat: { id: -1001, title: 'Test group', type: 'supergroup' } } }),
  });
}
function telegramFetch(memberStatus = 'administrator') {
  const fetch = vi.fn(async (url: string, _init?: RequestInit) => new Response(JSON.stringify(url.endsWith('/getChatMember') ? { ok: true, result: { status: memberStatus } } : { ok: true, result: { message_id: 1 } })));
  vi.stubGlobal('fetch', fetch);
  return fetch;
}
function sentText(fetch: ReturnType<typeof telegramFetch>) {
  return (fetch.mock.calls.at(-1)?.[1]?.body as FormData).get('text');
}

describe('/connect Telegram-owned pairing', () => {
  it('connects the group when sender owns the code and is administrator', async () => { const { env, batch } = webhookEnv(); const fetch = telegramFetch(); await expect(telegramWebhook(connectRequest(), env)).resolves.toEqual({ ok: true }); expect(fetch.mock.calls[0][0]).toContain('/getChatMember'); expect(batch).toHaveBeenCalledOnce(); expect(sentText(fetch)).toContain('Группа подключена'); });
  it('is idempotent for an already linked identity', async () => { const { env, batch } = webhookEnv(); telegramFetch('creator'); await telegramWebhook(connectRequest(), env); expect(batch).toHaveBeenCalledOnce(); });
  it('rejects a sender who does not own the pairing code before admin lookup', async () => { const { env, batch } = webhookEnv(); const fetch = telegramFetch(); await telegramWebhook(connectRequest(88), env); expect(batch).not.toHaveBeenCalled(); expect(fetch.mock.calls.some(([url]) => url.endsWith('/getChatMember'))).toBe(false); expect(sentText(fetch)).toContain('другим Telegram-пользователем'); });
  it('rejects a non-admin owner', async () => { const { env, batch } = webhookEnv(); const fetch = telegramFetch('member'); await telegramWebhook(connectRequest(), env); expect(batch).not.toHaveBeenCalled(); expect(sentText(fetch)).toContain('только администратор'); });
  it('rejects expired or used codes', async () => { const { env, batch } = webhookEnv({ pairing: null }); const fetch = telegramFetch(); await telegramWebhook(connectRequest(), env); expect(batch).not.toHaveBeenCalled(); expect(sentText(fetch)).toContain('недействителен или истёк'); });
  it('preserves legacy Extension pairing without a Telegram owner', async () => { const { env, batch } = webhookEnv({ pairing: { id: 'tgp_1', user_id: 'usr_google', telegram_user_id: null }, identities: [] }); telegramFetch(); await telegramWebhook(connectRequest(), env); expect(batch).toHaveBeenCalledOnce(); });
});

describe('/start diagnostics', () => {
  it('logs the safe update and successful Mini App button delivery', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const fetch = telegramFetch();
    const request = new Request('https://worker.example/api/telegram/webhook', {
      method: 'POST',
      headers: { 'x-telegram-bot-api-secret-token': 'secret', 'content-type': 'application/json' },
      body: JSON.stringify({ update_id: 123, message: { text: '/start', from: { id: 77, username: 'not-logged' }, chat: { id: 77, type: 'private' } } }),
    });
    const { env } = webhookEnv();
    env.MINIAPP_URL = 'https://worker.example/';
    await expect(telegramWebhook(request, env)).resolves.toEqual({ ok: true });
    expect(log).toHaveBeenNthCalledWith(1, { event: 'telegram_webhook_update', updateId: 123, chatId: '77', chatType: 'private', fromId: '77', text: '/start' });
    expect(log).toHaveBeenNthCalledWith(2, { event: 'telegram_start', chatId: '77', miniAppConfigured: true });
    expect(log).toHaveBeenNthCalledWith(3, { event: 'telegram_start_sent', chatId: '77' });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('does not expose a pairing code in the general webhook diagnostic', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { env } = webhookEnv({ pairing: null });
    telegramFetch();
    await telegramWebhook(connectRequest(), env);
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ event: 'telegram_webhook_update', text: '/connect [REDACTED]' }));
    expect(JSON.stringify(log.mock.calls)).not.toContain('483729');
  });
});

describe('Managed Bot webhook integration', () => {
  it('handles managed_bot before message commands and never logs its token', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { env, prepared } = webhookEnv();
    const managedToken = 'managed:secret-token';
    const fetch = vi.fn(async (url: string, _init?: RequestInit) => {
      if (url.endsWith('/getManagedBotToken')) return new Response(JSON.stringify({ ok: true, result: managedToken }));
      if (url.includes(`/bot${managedToken}/getMe`)) return new Response(JSON.stringify({ ok: true, result: { id: 9001, username: 'created_bot', first_name: 'Created' } }));
      throw new Error(`Unexpected Telegram call: ${url}`);
    });
    vi.stubGlobal('fetch', fetch);
    const request = new Request('https://worker.example/api/telegram/webhook', {
      method: 'POST',
      headers: { 'x-telegram-bot-api-secret-token': 'secret', 'content-type': 'application/json' },
      body: JSON.stringify({ update_id: 500, managed_bot: { user: { id: 77 }, bot: { id: 9001, username: 'created_bot', first_name: 'Created' } } }),
    });
    await expect(telegramWebhook(request, env)).resolves.toEqual({ ok: true });
    expect(fetch.mock.calls[0][0]).toContain('/getManagedBotToken');
    expect((fetch.mock.calls[0][1]?.body as FormData).get('user_id')).toBe('9001');
    expect(fetch.mock.calls[1][0]).toContain(`/bot${managedToken}/getMe`);
    expect(prepared.some(({ sql }) => sql.includes('INSERT INTO telegram_managed_bots'))).toBe(true);
    expect(JSON.stringify(log.mock.calls)).not.toContain(managedToken);
  });
});
