import {afterEach, describe, expect, it, vi} from 'vitest';
import worker from './index';
import type {Env} from './types';

const env = {
  VK_ACCESS_TOKEN: 'worker-community-token',
  ALLOWED_EXTENSION_ORIGIN: 'chrome-extension://existing-extension'
} as Env;
const debugUrl = 'https://worker.example/api/debug/vk-auth-test';
const githubOrigin = 'https://buropotok.github.io';

function debugRequest(body: unknown, origin = githubOrigin) {
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

describe('VK ID auth diagnostic endpoint', () => {
  it('requires a user access_token', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);

    const response = await worker.fetch(debugRequest({group_id: 240907364}), env);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({error: {code: 'INVALID_REQUEST', message: 'Поле access_token обязательно'}});
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([0, -1, 1.5, 'not-a-number'])('rejects invalid group_id %j', async (groupId) => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);

    const response = await worker.fetch(debugRequest({access_token: 'vk-id-user-token', group_id: groupId}), env);

    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('uses the supplied user token and positive group_id, and sanitizes a successful response', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({
      response: {upload_url: 'https://upload.vk.test/private', album_id: 12, user_id: 34}
    }));
    vi.stubGlobal('fetch', fetch);
    const infoLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const response = await worker.fetch(debugRequest({access_token: 'vk-id-user-token', group_id: 240907364}), env);
    const result = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe('https://api.vk.com/method/photos.getWallUploadServer');
    const requestBody = fetch.mock.calls[0][1]?.body as URLSearchParams;
    expect(requestBody.get('access_token')).toBe('vk-id-user-token');
    expect(requestBody.get('access_token')).not.toBe(env.VK_ACCESS_TOKEN);
    expect(requestBody.get('group_id')).toBe('240907364');
    expect(Number(requestBody.get('group_id'))).toBeGreaterThan(0);
    expect(requestBody.get('v')).toBe('5.199');
    expect(result).toEqual({
      ok: true,
      method: 'photos.getWallUploadServer',
      result: {upload_url_present: true, album_id: 12, user_id: 34}
    });
    expect(JSON.stringify(result)).not.toContain('upload.vk.test');
    expect(JSON.stringify(result)).not.toContain('vk-id-user-token');
    expect(infoLog.mock.calls.flat().map(String).join(' ')).not.toContain('vk-id-user-token');
    expect(infoLog.mock.calls.flat().map(String).join(' ')).not.toContain(env.VK_ACCESS_TOKEN);
  });

  it('returns only a sanitized VK error and never logs the token', async () => {
    const userToken = 'vk-id-sensitive-token';
    const fetch = vi.fn().mockResolvedValue(Response.json({
      error: {
        error_code: 27,
        error_msg: `Access denied for ${userToken}`,
        request_params: [{key: 'access_token', value: userToken}]
      }
    }));
    vi.stubGlobal('fetch', fetch);
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const response = await worker.fetch(debugRequest({access_token: userToken, group_id: 240907364}), env);
    const result = await response.json();
    const serialized = JSON.stringify(result);
    const logs = errorLog.mock.calls.flat().map(String).join(' ');

    expect(response.status).toBe(200);
    expect(result).toEqual({
      ok: false,
      method: 'photos.getWallUploadServer',
      vk_error: {error_code: 27, error_msg: 'Access denied for [REDACTED]'}
    });
    expect(serialized).not.toContain('request_params');
    expect(serialized).not.toContain(userToken);
    expect(logs).not.toContain(userToken);
    expect(logs).not.toContain('access_token');
  });

  it('returns a safe transport error when VK cannot be reached', async () => {
    const userToken = 'vk-id-sensitive-token';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError(`Failed for ${userToken}`)));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const response = await worker.fetch(debugRequest({access_token: userToken, group_id: 240907364}), env);
    const result = await response.json();

    expect(response.status).toBe(502);
    expect(result).toEqual({
      ok: false,
      method: 'photos.getWallUploadServer',
      transport_error: {http_status: null, message: 'Failed for [REDACTED]'}
    });
  });

  it('allows the GitHub Pages origin only on the diagnostic route', async () => {
    const allowed = await worker.fetch(new Request(debugUrl, {method: 'OPTIONS', headers: {origin: githubOrigin}}), env);
    const denied = await worker.fetch(new Request('https://worker.example/api/publish', {method: 'OPTIONS', headers: {origin: githubOrigin}}), env);

    expect(allowed.status).toBe(204);
    expect(allowed.headers.get('access-control-allow-origin')).toBe(githubOrigin);
    expect(allowed.headers.get('access-control-allow-methods')).toContain('POST');
    expect(denied.status).toBe(403);
  });

  it('preserves CORS for the configured Chrome extension origin', async () => {
    const response = await worker.fetch(new Request('https://worker.example/api/publish', {
      method: 'OPTIONS',
      headers: {origin: env.ALLOWED_EXTENSION_ORIGIN}
    }), env);

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe(env.ALLOWED_EXTENSION_ORIGIN);
  });
});
