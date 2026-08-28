import { describe, expect, it } from 'vitest';
import { validateTelegramMiniAppInitData } from './telegram-miniapp-auth';

const token = '123456:test-token';
const now = 1_800_000_000;
const encoder = new TextEncoder();
async function sign(values: Record<string, string>) {
  const params = new URLSearchParams(values);
  const data = Object.entries(values).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, value]) => `${key}=${value}`).join('\n');
  const secret = await crypto.subtle.sign('HMAC', await crypto.subtle.importKey('raw', encoder.encode('WebAppData'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']), encoder.encode(token));
  const hash = new Uint8Array(await crypto.subtle.sign('HMAC', await crypto.subtle.importKey('raw', secret, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']), encoder.encode(data)));
  params.set('hash', [...hash].map((byte) => byte.toString(16).padStart(2, '0')).join(''));
  return params.toString();
}
const values = () => ({ auth_date: String(now), query_id: 'AAEAAAE', user: JSON.stringify({ id: 42, first_name: 'Анна', username: 'anna' }) });

describe('Telegram Mini App initData validation', () => {
  it('accepts valid initData', async () => expect((await validateTelegramMiniAppInitData(await sign(values()), token, now)).user.id).toBe(42));
  it('rejects an invalid hash', async () => expect(validateTelegramMiniAppInitData(`${await sign(values())}0`, token, now)).rejects.toMatchObject({ code: 'MINIAPP_AUTH_INVALID' }));
  it('rejects a missing hash', async () => expect(validateTelegramMiniAppInitData(new URLSearchParams(values()).toString(), token, now)).rejects.toMatchObject({ code: 'MINIAPP_AUTH_INVALID' }));
  it('rejects expired auth_date', async () => expect(validateTelegramMiniAppInitData(await sign({ ...values(), auth_date: String(now - 601) }), token, now)).rejects.toMatchObject({ code: 'MINIAPP_AUTH_EXPIRED' }));
  it('rejects a malformed signed user', async () => expect(validateTelegramMiniAppInitData(await sign({ ...values(), user: '{oops' }), token, now)).rejects.toMatchObject({ code: 'MINIAPP_USER_INVALID' }));
  it('rejects a tampered user payload', async () => { const signed = await sign(values()); await expect(validateTelegramMiniAppInitData(signed.replace('%22id%22%3A42', '%22id%22%3A43'), token, now)).rejects.toMatchObject({ code: 'MINIAPP_AUTH_INVALID' }); });
});
