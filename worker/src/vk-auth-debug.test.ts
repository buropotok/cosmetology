import {afterEach, describe, expect, it, vi} from 'vitest';
import worker from './index';
import type {Env} from './types';

const env = {
  VK_ACCESS_TOKEN: 'worker-community-token',
  VK_ID_SERVICE_TOKEN: 'confidential-service-token',
  PUBLISH_API_TOKEN: 'publisher-token',
  ALLOWED_EXTENSION_ORIGIN: 'chrome-extension://existing-extension'
} as Env;
const debugUrl = 'https://worker.example/api/debug/vk-auth-test';
const origin = 'https://buropotok.github.io';
const authorization = {
  code: 'authorization-code-secret',
  device_id: 'device-id-secret',
  code_verifier: 'A'.repeat(64),
  state: 'B'.repeat(43),
  group_id: 240907364
};

function request(body: unknown) {
  return new Request(debugUrl, {
    method: 'POST',
    headers: {'content-type': 'application/json', origin},
    body: JSON.stringify(body)
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('backend VK ID authorization diagnostic', () => {
  it('returns a safe configuration error before VK ID when the service token is missing', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const response = await worker.fetch(request(authorization), {...env, VK_ID_SERVICE_TOKEN: ''});
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      ok: false,
      stage: 'configuration',
      error: {code: 'missing_service_token', message: 'VK ID service token is not configured'}
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    ['code', {...authorization, code: ''}],
    ['device_id', {...authorization, device_id: ''}],
    ['code_verifier', {...authorization, code_verifier: 'short'}],
    ['state', {...authorization, state: 'short'}],
    ['group_id', {...authorization, group_id: 0}]
  ])('requires valid %s', async (_field, body) => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const response = await worker.fetch(request(body), env);
    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('exchanges the code with PKCE and uses only the returned access token for VK API', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(Response.json({
        access_token: 'backend-user-token',
        refresh_token: 'refresh-secret',
        id_token: 'id-secret',
        state: authorization.state
      }))
      .mockResolvedValueOnce(Response.json({
        response: {upload_url: 'https://upload.vk.test/private', album_id: 12, user_id: 34}
      }));
    vi.stubGlobal('fetch', fetch);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const response = await worker.fetch(request(authorization), env);
    const result = await response.json();

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[0][0]).toBe('https://id.vk.ru/oauth2/auth');
    const exchange = fetch.mock.calls[0][1];
    expect(exchange?.headers).toEqual({'content-type': 'application/x-www-form-urlencoded'});
    const exchangeBody = exchange?.body as URLSearchParams;
    expect(exchangeBody.get('grant_type')).toBe('authorization_code');
    expect(exchangeBody.get('code_verifier')).toBe(authorization.code_verifier);
    expect(exchangeBody.get('redirect_uri')).toBe('https://buropotok.github.io/cosmetology/auth/');
    expect(exchangeBody.get('code')).toBe(authorization.code);
    expect(exchangeBody.get('client_id')).toBe('54726533');
    expect(exchangeBody.get('device_id')).toBe(authorization.device_id);
    expect(exchangeBody.get('state')).toBe(authorization.state);
    expect(exchangeBody.get('service_token')).toBe(env.VK_ID_SERVICE_TOKEN);
    expect(exchangeBody.has('ip')).toBe(false);
    expect(fetch.mock.calls[1][0]).toBe('https://api.vk.com/method/photos.getWallUploadServer');
    const vkBody = fetch.mock.calls[1][1]?.body as URLSearchParams;
    expect(vkBody.get('access_token')).toBe('backend-user-token');
    expect(vkBody.get('access_token')).not.toBe(env.VK_ACCESS_TOKEN);
    expect(vkBody.get('group_id')).toBe('240907364');
    expect(result).toEqual({
      ok: true,
      exchange: 'backend',
      method: 'photos.getWallUploadServer',
      result: {upload_url_present: true, album_id: 12, user_id: 34}
    });
    const clientAndLogs = JSON.stringify(result) + log.mock.calls.flat().map(String).join(' ');
    for (const secret of ['backend-user-token', 'refresh-secret', 'id-secret', authorization.code, authorization.code_verifier, env.VK_ID_SERVICE_TOKEN]) {
      expect(clientAndLogs).not.toContain(secret);
    }
    expect(JSON.stringify(result)).not.toContain('upload.vk.test');
  });

  it('returns a distinct, sanitized token exchange error and does not call VK API', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({
      error: 'invalid_grant',
      error_description: `Invalid ${authorization.code_verifier} ${env.VK_ID_SERVICE_TOKEN}`
    }, {status: 400}));
    vi.stubGlobal('fetch', fetch);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const response = await worker.fetch(request(authorization), env);
    const result = await response.json();

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      ok: false,
      stage: 'token_exchange',
      error: {code: 'invalid_grant', message: 'Invalid [REDACTED] [REDACTED]'}
    });
    const clientAndLogs = JSON.stringify(result) + error.mock.calls.flat().map(String).join(' ');
    expect(clientAndLogs).not.toContain(authorization.code);
    expect(clientAndLogs).not.toContain(authorization.code_verifier);
    expect(clientAndLogs).not.toContain(env.VK_ID_SERVICE_TOKEN);
  });

  it('stops when the token response state does not match', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({access_token: 'token', state: 'wrong-state'}));
    vi.stubGlobal('fetch', fetch);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const response = await worker.fetch(request(authorization), env);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(await response.json()).toEqual({
      ok: false,
      stage: 'token_exchange',
      error: {code: 'state_mismatch', message: 'VK ID returned an unexpected state'}
    });
  });

  it('separates a VK API error from token exchange errors and omits request_params', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(Response.json({access_token: 'backend-user-token', state: authorization.state}))
      .mockResolvedValueOnce(Response.json({error: {
        error_code: 5,
        error_msg: 'User authorization failed',
        request_params: [{key: 'access_token', value: 'backend-user-token'}]
      }}));
    vi.stubGlobal('fetch', fetch);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const response = await worker.fetch(request(authorization), env);
    const result = await response.json();

    expect(result).toEqual({
      ok: false,
      stage: 'vk_api',
      method: 'photos.getWallUploadServer',
      vk_error: {error_code: 5, error_msg: 'User authorization failed'}
    });
    expect(JSON.stringify(result)).not.toContain('request_params');
    expect(JSON.stringify(result)).not.toContain('backend-user-token');
  });

  it('keeps diagnostic CORS and the production publish authentication behavior', async () => {
    const preflight = await worker.fetch(new Request(debugUrl, {method: 'OPTIONS', headers: {origin}}), env);
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('access-control-allow-origin')).toBe(origin);

    const extensionPreflight = await worker.fetch(new Request('https://worker.example/api/publish', {
      method: 'OPTIONS', headers: {origin: env.ALLOWED_EXTENSION_ORIGIN}
    }), env);
    expect(extensionPreflight.status).toBe(204);
    expect(extensionPreflight.headers.get('access-control-allow-origin')).toBe(env.ALLOWED_EXTENSION_ORIGIN);

    const publish = await worker.fetch(new Request('https://worker.example/api/publish', {method: 'POST'}), env);
    expect(publish.status).toBe(401);
    expect((await publish.json() as {error: {code: string}}).error.code).toBe('UNAUTHORIZED');
  });
});
