import { describe, expect, it, vi } from 'vitest';
import type { Env } from '../types';
import { getMiniAppStatus, publishFromMiniApp } from './miniapp';

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
type AccountRow = { user_id: string; chat_id: string | null; chat_title: string | null; chat_type: string | null } | null;
const env = (row: AccountRow) => ({
  TELEGRAM_BOT_TOKEN: token,
  DB: { prepare: vi.fn(() => ({ bind: vi.fn(() => ({ first: vi.fn(async () => row) })) })) },
}) as unknown as Env;
async function request(form = new FormData(), authorization?: string, path = '/api/miniapp/publish', method = 'POST') {
  return new Request(`https://app.example${path}`, { method, headers: authorization ? { authorization: `tma ${authorization}` } : {}, ...(method === 'POST' ? { body: form } : {}) });
}
const connected = { user_id: 'usr_1', chat_id: '-100123', chat_title: 'Cosmetology_test', chat_type: 'supergroup' };
const publisher = vi.fn(async () => ({ external_id: '1', url: undefined, delivery_mode: 'text' as const }));

describe('Mini App account and publish API', () => {
  it('rejects missing initData', async () => expect(publishFromMiniApp(await request(), env(connected), publisher)).rejects.toMatchObject({ code: 'MINIAPP_AUTH_REQUIRED' }));
  it('rejects invalid initData', async () => expect(publishFromMiniApp(await request(new FormData(), 'invalid'), env(connected), publisher)).rejects.toMatchObject({ code: 'MINIAPP_AUTH_INVALID' }));
  it('rejects an unlinked Telegram identity', async () => { const form = new FormData(); form.set('text', 'test'); await expect(publishFromMiniApp(await request(form, await initData()), env(null), publisher)).rejects.toMatchObject({ code: 'MINIAPP_IDENTITY_NOT_LINKED', status: 403 }); });
  it('rejects a linked identity without an active group', async () => { const form = new FormData(); form.set('text', 'test'); await expect(publishFromMiniApp(await request(form, await initData()), env({ ...connected, chat_id: null, chat_title: null, chat_type: null }), publisher)).rejects.toMatchObject({ code: 'TELEGRAM_NOT_CONNECTED', status: 409 }); });
  it('rejects missing text and image', async () => expect(publishFromMiniApp(await request(new FormData(), await initData()), env(connected), publisher)).rejects.toMatchObject({ code: 'EMPTY_PUBLICATION' }));
  it('rejects invalid image type', async () => { const form = new FormData(); form.set('image', new File(['nope'], 'file.txt', { type: 'text/plain' })); await expect(publishFromMiniApp(await request(form, await initData()), env(connected), publisher)).rejects.toMatchObject({ code: 'INVALID_IMAGE_TYPE' }); });
  it('publishes to the database-resolved group and ignores client destinations', async () => { const form = new FormData(); form.set('text', '  test  '); form.set('chat_id', '-100999'); await expect(publishFromMiniApp(await request(form, await initData()), env(connected), publisher)).resolves.toMatchObject({ ok: true }); expect(publisher).toHaveBeenLastCalledWith(expect.anything(), 'test', undefined, '-100123'); });
  it('returns linked group status without exposing chat_id', async () => { const result = await getMiniAppStatus(await request(new FormData(), await initData(), '/api/miniapp/me', 'GET'), env(connected)); expect(result).toEqual({ telegramUser: { id: '42', firstName: 'Анна', username: 'anna' }, linked: true, connection: { connected: true, chatTitle: 'Cosmetology_test', chatType: 'supergroup' } }); expect(JSON.stringify(result)).not.toContain('-100123'); });
  it('returns an explicit unlinked status', async () => expect(getMiniAppStatus(await request(new FormData(), await initData(), '/api/miniapp/me', 'GET'), env(null))).resolves.toMatchObject({ linked: false, connection: { connected: false } }));
});
