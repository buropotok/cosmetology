import { describe, expect, it, vi } from 'vitest';
import type { Env } from '../types';
import { publishFromMiniApp } from './miniapp';

const token = '123456:test-token';
const encoder = new TextEncoder();
async function initData() {
  const params = new URLSearchParams({ auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify({ id: 42, first_name: 'Анна' }) });
  const values = { auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify({ id: 42, first_name: 'Анна' }) };
  const data = Object.entries(values).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, value]) => `${key}=${value}`).join('\n');
  const secret = await crypto.subtle.sign('HMAC', await crypto.subtle.importKey('raw', encoder.encode('WebAppData'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']), encoder.encode(token));
  const hash = new Uint8Array(await crypto.subtle.sign('HMAC', await crypto.subtle.importKey('raw', secret, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']), encoder.encode(data)));
  params.set('hash', [...hash].map((byte) => byte.toString(16).padStart(2, '0')).join(''));
  return params.toString();
}
const env = (overrides: Partial<Env> = {}) => ({ TELEGRAM_BOT_TOKEN: token, MINIAPP_TEST_CHAT_ID: '-100123', ...overrides }) as Env;
async function request(form = new FormData(), authorization?: string) { return new Request('https://app.example/api/miniapp/publish', { method: 'POST', headers: authorization ? { authorization: `tma ${authorization}` } : {}, body: form }); }
const publisher = vi.fn(async () => ({ external_id: '1', url: 'https://t.me/c/1/1', delivery_mode: 'text' as const }));

describe('Mini App publish API validation', () => {
  it('rejects missing initData', async () => expect(publishFromMiniApp(await request(), env(), publisher)).rejects.toMatchObject({ code: 'MINIAPP_AUTH_REQUIRED' }));
  it('rejects invalid initData', async () => expect(publishFromMiniApp(await request(new FormData(), 'invalid'), env(), publisher)).rejects.toMatchObject({ code: 'MINIAPP_AUTH_INVALID' }));
  it('rejects missing text and image', async () => expect(publishFromMiniApp(await request(new FormData(), await initData()), env(), publisher)).rejects.toMatchObject({ code: 'EMPTY_PUBLICATION' }));
  it('rejects invalid image type', async () => { const form = new FormData(); form.set('image', new File(['nope'], 'file.txt', { type: 'text/plain' })); await expect(publishFromMiniApp(await request(form, await initData()), env(), publisher)).rejects.toMatchObject({ code: 'INVALID_IMAGE_TYPE' }); });
  it('rejects a missing destination', async () => { const form = new FormData(); form.set('text', 'test'); await expect(publishFromMiniApp(await request(form, await initData()), env({ MINIAPP_TEST_CHAT_ID: '' }), publisher)).rejects.toMatchObject({ code: 'MINIAPP_DESTINATION_NOT_CONFIGURED' }); });
  it('publishes trimmed text without calling Telegram in validation tests', async () => { const form = new FormData(); form.set('text', '  test  '); await expect(publishFromMiniApp(await request(form, await initData()), env(), publisher)).resolves.toMatchObject({ ok: true }); expect(publisher).toHaveBeenLastCalledWith(expect.anything(), 'test', undefined, '-100123'); });
});
