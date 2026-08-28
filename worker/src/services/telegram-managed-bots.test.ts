import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../types';
import { createManagedBotLink, getManagedBotCredential, getManagerBotDiagnostic, handleManagedBotUpdate, requestManagedBotCreation, type ManagedBotTelegramApi } from './telegram-managed-bots';
import { decryptManagedBotToken, encryptManagedBotToken } from './managed-bot-crypto';

const token = '123456:manager-secret';
const managedToken = '987654:managed-secret';
const encoder = new TextEncoder();
async function initData() {
  const values = { auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify({ id: 42, first_name: 'Анна' }) };
  const params = new URLSearchParams(values);
  const data = Object.entries(values).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, value]) => `${key}=${value}`).join('\n');
  const secret = await crypto.subtle.sign('HMAC', await crypto.subtle.importKey('raw', encoder.encode('WebAppData'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']), encoder.encode(token));
  const hash = new Uint8Array(await crypto.subtle.sign('HMAC', await crypto.subtle.importKey('raw', secret, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']), encoder.encode(data)));
  params.set('hash', [...hash].map((byte) => byte.toString(16).padStart(2, '0')).join(''));
  return params.toString();
}
function testEnv() {
  const writes: { sql: string; values: unknown[] }[] = [];
  const DB = { prepare: vi.fn((sql: string) => ({ bind: (...values: unknown[]) => ({ run: async () => { writes.push({ sql, values }); return { success: true }; } }) })) };
  const encryptionKey = btoa(String.fromCharCode(...new Uint8Array(32).fill(7)));
  return { env: { DB, TELEGRAM_BOT_TOKEN: token, MANAGED_BOT_ENCRYPTION_KEY: encryptionKey } as unknown as Env, writes };
}
function api(): ManagedBotTelegramApi {
  return {
    getManagerMe: vi.fn(async () => ({ id: 1, username: 'cosmo_sofa_bot', first_name: 'Cosmo', can_manage_bots: true })),
    getManagedToken: vi.fn(async () => managedToken),
    getManagedMe: vi.fn(async () => ({ id: 9001, username: 'created_bot', first_name: 'Created' })),
  };
}
const managedUpdate = { managed_bot: { user: { id: 42 }, bot: { id: 9001, username: 'created_bot', first_name: 'Created' } } };

afterEach(() => vi.restoreAllMocks());

describe('Telegram Managed Bots PoC', () => {
  it('reports Manager Bot management capability without secrets', async () => { const result = await getManagerBotDiagnostic(testEnv().env, api()); expect(result).toEqual({ ok: true, username: 'cosmo_sofa_bot', canManageBots: true }); expect(JSON.stringify(result)).not.toContain(token); });
  it('creates an authenticated native newbot deep link with a random suffix', async () => { const request = new Request('https://worker/api/miniapp/debug/managed-bot/create-link', { method: 'POST', headers: { authorization: `tma ${await initData()}` } }); const result = await createManagedBotLink(request, testEnv().env); expect(result.suggestedUsername).toMatch(/^cosmo_sofa_[a-z0-9]{6}_bot$/); expect(result.url).toBe(`https://t.me/newbot/cosmo_sofa_bot/${result.suggestedUsername}?name=Cosmo%20Sofa%20Test`); });
  it('requires valid TMA auth for the reply-keyboard request', async () => { const request = new Request('https://worker/api/miniapp/debug/managed-bot/request', { method: 'POST' }); await expect(requestManagedBotCreation(request, testEnv().env, vi.fn())).rejects.toMatchObject({ code: 'MINIAPP_AUTH_REQUIRED' }); });
  it('sends the request to the verified Telegram user with signed int32 metadata', async () => { const init = await initData(); const request = new Request('https://worker/api/miniapp/debug/managed-bot/request', { method: 'POST', headers: { authorization: `tma ${init}` } }); const send = vi.fn(async () => ({})); const log = vi.spyOn(console, 'log').mockImplementation(() => undefined); const result = await requestManagedBotCreation(request, testEnv().env, send); expect(send).toHaveBeenCalledWith(expect.anything(), '42', result.requestId, 'Cosmo Sofa Test', result.suggestedUsername); expect(Number.isInteger(result.requestId)).toBe(true); expect(result.requestId).toBeGreaterThanOrEqual(-2147483648); expect(result.requestId).toBeLessThanOrEqual(2147483647); expect(result.suggestedUsername).toMatch(/^cosmo_sofa_[a-z0-9]{6}_bot$/); expect(log).toHaveBeenCalledWith({ event: 'telegram_managed_bot_request_sent', telegramUserId: '42', requestId: result.requestId, suggestedUsername: result.suggestedUsername }); const logged = JSON.stringify(log.mock.calls); expect(logged).not.toContain(token); expect(logged).not.toContain(init); });
  it('verifies and encrypts a ManagedBotUpdated token before persistence', async () => { const telegram = api(); const { env, writes } = testEnv(); const log = vi.spyOn(console, 'log').mockImplementation(() => undefined); await expect(handleManagedBotUpdate(managedUpdate, env, telegram)).resolves.toBe(true); expect(telegram.getManagedToken).toHaveBeenCalledWith(env, '9001'); expect(telegram.getManagedMe).toHaveBeenCalledWith(managedToken); expect(log).toHaveBeenCalledWith({ event: 'telegram_managed_bot_token_received', managedBotId: '9001', tokenType: 'string', tokenLength: managedToken.length, tokenHasColon: true }); expect(writes[0].values).toContain('9001'); expect(writes[0].values).toContain(1); expect(writes[0].values).not.toContain(managedToken); await expect(decryptManagedBotToken('9001', { ciphertext: writes[0].values[6] as string, iv: writes[0].values[7] as string, keyVersion: writes[0].values[8] as number }, env)).resolves.toBe(managedToken); expect(log).toHaveBeenCalledWith({ event: 'telegram_managed_bot_credential_stored', managedBotId: '9001', keyVersion: 1 }); expect(log).toHaveBeenCalledWith({ event: 'telegram_managed_bot_token_verified', managedBotId: '9001', managedBotUsername: 'created_bot', verified: true }); const serialized = JSON.stringify({ logs: log.mock.calls, writes }); expect(serialized).not.toContain(token); expect(serialized).not.toContain(managedToken); });
  it('does not persist when getMe fails or identifies a different bot', async () => { const failed = api(); vi.mocked(failed.getManagedMe).mockRejectedValueOnce(new Error('verification failed')); const first = testEnv(); vi.spyOn(console, 'log').mockImplementation(() => undefined); await expect(handleManagedBotUpdate(managedUpdate, first.env, failed)).rejects.toThrow('verification failed'); expect(first.writes).toHaveLength(0); const mismatch = api(); vi.mocked(mismatch.getManagedMe).mockResolvedValueOnce({ id: 9002, username: 'other', first_name: 'Other' }); const second = testEnv(); await expect(handleManagedBotUpdate(managedUpdate, second.env, mismatch)).rejects.toMatchObject({ code: 'MANAGED_BOT_TOKEN_INVALID' }); expect(second.writes).toHaveLength(0); });
  it('uses an idempotent telegram_bot_id upsert for repeated updates', async () => { const telegram = api(); const { env, writes } = testEnv(); vi.spyOn(console, 'log').mockImplementation(() => undefined); await handleManagedBotUpdate(managedUpdate, env, telegram); await handleManagedBotUpdate(managedUpdate, env, telegram); expect(writes).toHaveLength(2); expect(writes.every(({ sql }) => sql.includes('ON CONFLICT(telegram_bot_id) DO UPDATE'))).toBe(true); expect(writes.every(({ values }) => values.includes('9001'))).toBe(true); });
  it('replaces the encrypted credential when Telegram later returns a new verified token', async () => { const telegram = api(); const replacement = '987654:replacement-secret'; vi.mocked(telegram.getManagedToken).mockResolvedValueOnce(managedToken).mockResolvedValueOnce(replacement); const { env, writes } = testEnv(); vi.spyOn(console, 'log').mockImplementation(() => undefined); await handleManagedBotUpdate(managedUpdate, env, telegram); await handleManagedBotUpdate(managedUpdate, env, telegram); expect(writes).toHaveLength(2); expect(writes[0].values[6]).not.toBe(writes[1].values[6]); expect(JSON.stringify(writes)).not.toContain(managedToken); expect(JSON.stringify(writes)).not.toContain(replacement); });
  it('recognizes managed_bot_created service messages without fetching a token', async () => { const telegram = api(); const { env, writes } = testEnv(); const log = vi.spyOn(console, 'log').mockImplementation(() => undefined); const update = { message: { from: { id: 42 }, managed_bot_created: { bot: { id: 9001, username: 'created_bot', first_name: 'Created' } } } }; await expect(handleManagedBotUpdate(update, env, telegram)).resolves.toBe(true); expect(telegram.getManagedToken).not.toHaveBeenCalled(); expect(writes).toHaveLength(1); expect(log).toHaveBeenCalledWith({ event: 'telegram_managed_bot_created_message', telegramUserId: '42', managedBotId: '9001', managedBotUsername: 'created_bot' }); });
  it('retrieves only a complete active encrypted credential and handles legacy rows', async () => {
    const { env } = testEnv();
    const encrypted = await encryptManagedBotToken('9001', managedToken, env);
    let row: { telegram_bot_id: string; username: string | null; status: string; token_ciphertext: string | null; token_iv: string | null; token_key_version: number } = { telegram_bot_id: '9001', username: 'created_bot', status: 'active', token_ciphertext: encrypted.ciphertext, token_iv: encrypted.iv, token_key_version: 1 };
    const first = vi.fn(async () => row);
    env.DB = { prepare: vi.fn(() => ({ bind: () => ({ first }) })) } as unknown as D1Database;
    await expect(getManagedBotCredential(env, '9001')).resolves.toEqual({ botId: '9001', token: managedToken, username: 'created_bot' });
    row = { telegram_bot_id: '9001', username: null, status: 'active', token_ciphertext: null, token_iv: null, token_key_version: 1 };
    await expect(getManagedBotCredential(env, '9001')).rejects.toMatchObject({ code: 'MANAGED_BOT_CREDENTIAL_MISSING', status: 409 });
  });
  it('handles malformed managed_bot updates safely without API or DB writes', async () => { const telegram = api(); const { env, writes } = testEnv(); const log = vi.spyOn(console, 'log').mockImplementation(() => undefined); await expect(handleManagedBotUpdate({ managed_bot: { user: {}, bot: {} } }, env, telegram)).resolves.toBe(true); expect(telegram.getManagedToken).not.toHaveBeenCalled(); expect(writes).toHaveLength(0); expect(log).toHaveBeenCalledWith({ event: 'telegram_managed_bot_invalid' }); expect(JSON.stringify(log.mock.calls)).not.toContain(token); });
});
