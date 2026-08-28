import { describe, expect, it, vi } from 'vitest';
import type { Env } from '../types';
import { createMiniAppPairing, getMiniAppStatus, publishFromMiniApp } from './miniapp';

const token = '123456:test-token';
const encoder = new TextEncoder();
async function initData() {
  const values = { auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify({ id: 42, first_name: 'Анна', username: 'anna' }) };
  const params = new URLSearchParams(values);
  const data = Object.entries(values).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, value]) => `${key}=${value}`).join('\n');
  const secret = await crypto.subtle.sign('HMAC', await crypto.subtle.importKey('raw', encoder.encode('WebAppData'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']), encoder.encode(token));
  const hash = new Uint8Array(await crypto.subtle.sign('HMAC', await crypto.subtle.importKey('raw', secret, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']), encoder.encode(data)));
  params.set('hash', [...hash].map((byte) => byte.toString(16).padStart(2, '0')).join(''));
  return params.toString();
}
type AccountRow = { user_id: string; chat_id: string | null; chat_title: string | null; chat_type: string | null };
function env(initial: AccountRow | null) {
  let account = initial;
  const statements: { sql: string; values: unknown[] }[] = [];
  const batch = vi.fn(async (items: unknown[]) => {
    account ??= { user_id: 'usr_created', chat_id: null, chat_title: null, chat_type: null };
    return items.map(() => ({ meta: { changes: 1 } }));
  });
  const DB = {
    prepare: vi.fn((sql: string) => {
      const statement = { sql, values: [] as unknown[] };
      statements.push(statement);
      return { bind: (...values: unknown[]) => { statement.values = values; return { first: async () => account, run: async () => ({ success: true }) }; } };
    }),
    batch,
  };
  return { value: { TELEGRAM_BOT_TOKEN: token, PAIRING_CODE_SECRET: 'pair-secret', DB } as unknown as Env, statements, batch };
}
async function request(form = new FormData(), authorization?: string, path = '/api/miniapp/publish', method = 'POST') {
  return new Request(`https://app.example${path}`, { method, headers: authorization ? { authorization: `tma ${authorization}` } : {}, ...(method === 'POST' && path.endsWith('/publish') ? { body: form } : {}) });
}
const connected = { user_id: 'usr_1', chat_id: '-100123', chat_title: 'Cosmetology_test', chat_type: 'supergroup' };
const disconnected = { ...connected, chat_id: null, chat_title: null, chat_type: null };
const publisher = vi.fn(async () => ({ external_id: '1', url: undefined, delivery_mode: 'text' as const }));

describe('Telegram-native Mini App account and publishing', () => {
  it('rejects missing initData', async () => expect(publishFromMiniApp(await request(), env(connected).value, publisher)).rejects.toMatchObject({ code: 'MINIAPP_AUTH_REQUIRED' }));
  it('rejects invalid initData', async () => expect(publishFromMiniApp(await request(new FormData(), 'invalid'), env(connected).value, publisher)).rejects.toMatchObject({ code: 'MINIAPP_AUTH_INVALID' }));
  it('creates an internal account on first /me and returns accountReady', async () => { const testEnv = env(null); const result = await getMiniAppStatus(await request(new FormData(), await initData(), '/api/miniapp/me', 'GET'), testEnv.value); expect(result).toMatchObject({ accountReady: true, connection: { connected: false } }); expect(testEnv.batch).toHaveBeenCalledOnce(); });
  it('creates a Telegram-owned pairing without Google auth', async () => { const testEnv = env(disconnected); const result = await createMiniAppPairing(await request(new FormData(), await initData(), '/api/miniapp/telegram/pairing'), testEnv.value); expect(result.command).toMatch(/^\/connect \d{6}$/); const insert = testEnv.statements.find(({ sql }) => sql.includes('INSERT INTO telegram_pairings'))!; expect(insert.values[1]).toBe('usr_1'); expect(insert.values[4]).toBe('42'); });
  it('rejects an account without an active group', async () => { const form = new FormData(); form.set('text', 'test'); await expect(publishFromMiniApp(await request(form, await initData()), env(disconnected).value, publisher)).rejects.toMatchObject({ code: 'TELEGRAM_NOT_CONNECTED', status: 409 }); });
  it('rejects missing text and image', async () => expect(publishFromMiniApp(await request(new FormData(), await initData()), env(connected).value, publisher)).rejects.toMatchObject({ code: 'EMPTY_PUBLICATION' }));
  it('rejects invalid image type', async () => { const form = new FormData(); form.set('image', new File(['nope'], 'file.txt', { type: 'text/plain' })); await expect(publishFromMiniApp(await request(form, await initData()), env(connected).value, publisher)).rejects.toMatchObject({ code: 'INVALID_IMAGE_TYPE' }); });
  it('publishes only to the database-resolved group', async () => { const form = new FormData(); form.set('text', '  test  '); form.set('chat_id', '-100999'); await expect(publishFromMiniApp(await request(form, await initData()), env(connected).value, publisher)).resolves.toMatchObject({ ok: true }); expect(publisher).toHaveBeenLastCalledWith(expect.anything(), 'test', undefined, '-100123'); });
  it('returns connected chatTitle without exposing chat_id', async () => { const result = await getMiniAppStatus(await request(new FormData(), await initData(), '/api/miniapp/me', 'GET'), env(connected).value); expect(result).toEqual({ telegramUser: { id: '42', firstName: 'Анна', username: 'anna' }, accountReady: true, connection: { connected: true, chatTitle: 'Cosmetology_test', chatType: 'supergroup' } }); expect(JSON.stringify(result)).not.toContain('-100123'); });
});
