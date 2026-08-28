import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../types';
import {
  configureManagedBotWebhook,
  createManagedBotGroupLink,
  managedBotWebhook,
} from './managed-bot-onboarding';

const managerToken = '123456:test-token';
const encoder = new TextEncoder();

async function signedInitData() {
  const values = { auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify({ id: 42, first_name: 'Анна' }) };
  const params = new URLSearchParams(values);
  const data = Object.entries(values).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join('\n');
  const secret = await crypto.subtle.sign('HMAC', await crypto.subtle.importKey('raw', encoder.encode('WebAppData'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']), encoder.encode(managerToken));
  const hash = new Uint8Array(await crypto.subtle.sign('HMAC', await crypto.subtle.importKey('raw', secret, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']), encoder.encode(data)));
  params.set('hash', [...hash].map((byte) => byte.toString(16).padStart(2, '0')).join(''));
  return params.toString();
}

async function hash(value: string) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)))].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

afterEach(() => vi.restoreAllMocks());

describe('Managed Bot webhook setup', () => {
  it('stores only a secret hash and configures a dedicated webhook idempotently', async () => {
    const writes: { sql: string; values: unknown[] }[] = [];
    let active = false;
    const DB = { prepare: vi.fn((sql: string) => ({ bind: (...values: unknown[]) => ({ first: async () => active ? { webhook_id: 'existing', status: 'active' } : null, run: async () => { writes.push({ sql, values }); if (sql.startsWith('UPDATE telegram_managed_bot_webhooks')) active = true; return { success: true }; } }) })) };
    const env = { DB, MINIAPP_URL: 'https://worker.example/' } as unknown as Env;
    const setWebhook = vi.fn(async (_token: string, _url: string, _secret: string) => true);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const token = '9001:managed-secret';
    const webhookId = await configureManagedBotWebhook(env, '9001', token, setWebhook);
    expect(webhookId).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(setWebhook).toHaveBeenCalledWith(token, `https://worker.example/api/telegram/managed/${webhookId}`, expect.stringMatching(/^[A-Za-z0-9_-]{43}$/));
    const serialized = JSON.stringify({ writes, logs: log.mock.calls });
    expect(serialized).not.toContain(token);
    const secret = vi.mocked(setWebhook).mock.calls[0][2];
    expect(serialized).not.toContain(secret);
    await expect(configureManagedBotWebhook(env, '9001', token, setWebhook)).resolves.toBe('existing');
    expect(setWebhook).toHaveBeenCalledTimes(1);
  });
});

describe('Managed Bot group link', () => {
  function groupEnv(owned = true) {
    const batches: unknown[][] = [];
    const DB = {
      prepare: vi.fn((sql: string) => ({ bind: (..._values: unknown[]) => ({
        first: async () => sql.includes('FROM telegram_identities')
          ? { user_id: 'usr_1', chat_id: null, chat_title: null, chat_type: null }
          : sql.includes('FROM telegram_managed_bots') && owned
            ? { telegram_bot_id: '9001', username: 'personal_bot' }
            : null,
      }) })),
      batch: vi.fn(async (items: unknown[]) => { batches.push(items); return items.map(() => ({ meta: { changes: 1 } })); }),
    };
    return { env: { DB, TELEGRAM_BOT_TOKEN: managerToken } as unknown as Env, batches };
  }

  it('requires valid TMA auth and tenant-scopes the requested managed bot', async () => {
    await expect(createManagedBotGroupLink(new Request('https://worker/api/miniapp/telegram/managed-bot/group-link', { method: 'POST' }), groupEnv().env)).rejects.toMatchObject({ code: 'MINIAPP_AUTH_REQUIRED' });
    const initData = await signedInitData();
    const request = new Request('https://worker/api/miniapp/telegram/managed-bot/group-link', { method: 'POST', headers: { authorization: `tma ${initData}`, 'content-type': 'application/json' }, body: JSON.stringify({ managedBotId: 'other-bot' }) });
    await expect(createManagedBotGroupLink(request, groupEnv(false).env)).rejects.toMatchObject({ code: 'MANAGED_BOT_NOT_READY', status: 404 });
  });

  it('creates a random expiring one-time startgroup link for the owned bot', async () => {
    const initData = await signedInitData();
    const request = new Request('https://worker/api/miniapp/telegram/managed-bot/group-link', { method: 'POST', headers: { authorization: `tma ${initData}`, 'content-type': 'application/json' }, body: JSON.stringify({ managedBotId: '9001' }) });
    const { env, batches } = groupEnv();
    const result = await createManagedBotGroupLink(request, env);
    expect(result.url).toMatch(/^https:\/\/t\.me\/personal_bot\?startgroup=[A-Za-z0-9_-]{32}$/);
    expect(Date.parse(result.expiresAt)).toBeGreaterThan(Date.now());
    expect(batches).toHaveLength(1);
    expect(JSON.stringify(batches)).not.toContain(result.url.split('startgroup=')[1]);
  });
});

describe('Managed Bot incoming webhook', () => {
  async function webhookEnv(options: { botId?: string; pairing?: boolean } = {}) {
    const botId = options.botId ?? '9001';
    let pairingAvailable = options.pairing ?? true;
    const batches: unknown[][] = [];
    const runs: { sql: string; values: unknown[] }[] = [];
    const queries: { sql: string; values: unknown[] }[] = [];
    const secret = 'webhook-secret';
    const DB = {
      prepare: vi.fn((sql: string) => ({ bind: (...values: unknown[]) => ({
        first: async () => {
          queries.push({ sql, values });
          return sql.includes('telegram_managed_bot_webhooks')
            ? { telegram_bot_id: botId, secret_hash: await hash(secret) }
            : sql.includes('telegram_managed_bot_group_pairings') && pairingAvailable
              ? (pairingAvailable = false, { id: 'pair_1', user_id: 'usr_1', telegram_bot_id: botId })
              : null;
        },
        run: async () => { runs.push({ sql, values }); return { success: true }; },
      }) })),
      batch: vi.fn(async (items: unknown[]) => { batches.push(items); return items.map(() => ({ meta: { changes: 1 } })); }),
    };
    return { env: { DB } as unknown as Env, secret, batches, runs, queries };
  }

  function updateRequest(secret: string, body: unknown) {
    return new Request('https://worker/api/telegram/managed/opaque', { method: 'POST', headers: { 'x-telegram-bot-api-secret-token': secret, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  }

  it('rejects invalid webhook authentication before processing', async () => {
    const test = await webhookEnv();
    await expect(managedBotWebhook(updateRequest('wrong', {}), test.env, 'opaque')).rejects.toMatchObject({ code: 'MANAGED_BOT_WEBHOOK_UNAUTHORIZED', status: 401 });
    expect(test.batches).toHaveLength(0);
  });

  it('correlates a valid group /start once and rejects replay or wrong bot', async () => {
    const test = await webhookEnv();
    const body = { message: { text: '/start random_nonce_123456', from: { id: 42 }, chat: { id: -1001, type: 'supergroup', title: 'Salon' } } };
    await expect(managedBotWebhook(updateRequest(test.secret, body), test.env, 'opaque')).resolves.toEqual({ ok: true });
    expect(test.batches).toHaveLength(1);
    await managedBotWebhook(updateRequest(test.secret, body), test.env, 'opaque');
    expect(test.batches).toHaveLength(1);
    const wrong = await webhookEnv({ botId: '9002', pairing: false });
    await managedBotWebhook(updateRequest(wrong.secret, body), wrong.env, 'opaque');
    expect(wrong.batches).toHaveLength(0);
    expect(wrong.queries.some(({ sql, values }) => sql.includes('telegram_managed_bot_group_pairings') && values.includes('9002'))).toBe(true);
  });

  it('rejects an expired pairing and marks a removed destination inactive', async () => {
    const expired = await webhookEnv({ pairing: false });
    await managedBotWebhook(updateRequest(expired.secret, { message: { text: '/start random_nonce_123456', from: { id: 42 }, chat: { id: -1001, type: 'group' } } }), expired.env, 'opaque');
    expect(expired.batches).toHaveLength(0);
    await managedBotWebhook(updateRequest(expired.secret, { my_chat_member: { chat: { id: -1001, type: 'supergroup' }, new_chat_member: { user: { id: 9001 }, status: 'kicked' } } }), expired.env, 'opaque');
    expect(expired.runs.some(({ sql, values }) => sql.includes('telegram_managed_bot_destinations') && values.includes('-1001'))).toBe(true);
  });
});
