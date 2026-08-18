import {afterEach, describe, expect, it, vi} from 'vitest';
import {publishVK} from './vk';
import type {Env} from '../types';

const env = {
  VK_ACCESS_TOKEN: 'super-secret-vk-token',
  VK_GROUP_ID: '123'
} as Env;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('VK publishing', () => {
  it('uses the wall photo pipeline and posts its attachment', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(Response.json({response: {upload_url: 'https://upload.example.test/photo'}}))
      .mockResolvedValueOnce(Response.json({server: 7, photo: 'photo-payload', hash: 'upload-hash'}))
      .mockResolvedValueOnce(Response.json({response: [{owner_id: -123, id: 456}]}))
      .mockResolvedValueOnce(Response.json({response: 789}));
    vi.stubGlobal('fetch', fetch);

    const result = await publishVK(env, 'Post', new File(['image'], 'photo.jpg', {type: 'image/jpeg'}));

    expect(result.external_id).toBe('789');
    expect(fetch).toHaveBeenCalledTimes(4);
    expect(fetch.mock.calls[0][0]).toBe('https://api.vk.com/method/photos.getWallUploadServer');
    const uploadForm = fetch.mock.calls[1][1]?.body as FormData;
    expect(uploadForm.get('photo')).toBeInstanceOf(File);
    expect(fetch.mock.calls[2][0]).toBe('https://api.vk.com/method/photos.saveWallPhoto');
    const wallBody = fetch.mock.calls[3][1]?.body as URLSearchParams;
    expect(wallBody.get('owner_id')).toBe('-123');
    expect(wallBody.get('from_group')).toBe('1');
    expect(wallBody.get('attachments')).toBe('photo-123_456');
  });

  it('logs the failing VK method, code, and message without logging secrets', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({
      error: {
        error_code: 27,
        error_msg: 'Group authorization failed',
        request_params: [{key: 'access_token', value: env.VK_ACCESS_TOKEN}]
      }
    })));
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(publishVK(env, 'Post', new File(['image'], 'photo.jpg', {type: 'image/jpeg'}))).rejects.toThrow('код 27');

    const output = error.mock.calls.flat().map(String).join(' ');
    expect(output).toContain('[VK] photos.getWallUploadServer failed');
    expect(output).toContain('27');
    expect(output).toContain('Group authorization failed');
    expect(output).not.toContain(env.VK_ACCESS_TOKEN);
    expect(output).not.toContain('access_token');
  });

  it('keeps text-only publishing on the direct wall.post path', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({response: 321}));
    vi.stubGlobal('fetch', fetch);

    await publishVK(env, 'Text only');

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe('https://api.vk.com/method/wall.post');
  });
});
