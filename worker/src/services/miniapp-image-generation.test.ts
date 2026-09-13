import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../types';
import { generateMiniAppImage } from './miniapp-image-generation';

const token = '123456:test-token';
const encoder = new TextEncoder();

async function signInitData() {
  const values = {
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: 'AAEAAAE',
    user: JSON.stringify({ id: 42, first_name: 'Анна' }),
  };
  const params = new URLSearchParams(values);
  const data = Object.entries(values)
    .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secret = await crypto.subtle.sign(
    'HMAC',
    await crypto.subtle.importKey('raw', encoder.encode('WebAppData'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']),
    encoder.encode(token),
  );
  const hash = new Uint8Array(await crypto.subtle.sign(
    'HMAC',
    await crypto.subtle.importKey('raw', secret, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']),
    encoder.encode(data),
  ));
  params.set('hash', [...hash].map((byte) => byte.toString(16).padStart(2, '0')).join(''));
  return params.toString();
}

function env(openAiKey = 'test-openai-key') {
  return {
    TELEGRAM_BOT_TOKEN: token,
    OPENAI_API_KEY: openAiKey,
  } as Env;
}

async function request() {
  return new Request('https://example.test/api/miniapp/image-generation', {
    method: 'POST',
    headers: {
      authorization: `tma ${await signInitData()}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ text: 'Пост о профессиональном уходе за кожей' }),
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('Mini App image generation provider contract', () => {
  it('sends an authenticated OpenAI image request and returns the generated PNG', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ b64_json: 'AQID' }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await generateMiniAppImage(await request(), env());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.openai.com/v1/images/generations');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ authorization: 'Bearer test-openai-key', 'content-type': 'application/json' });
    expect(JSON.parse(String(init.body))).toMatchObject({
      model: 'gpt-image-2',
      size: '1024x1536',
      quality: 'medium',
      output_format: 'png',
      n: 1,
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
    expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([1, 2, 3]);
  });

  it('rejects provider failures with the local generation error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: 'provider failed' } }), { status: 500 })));
    await expect(generateMiniAppImage(await request(), env())).rejects.toMatchObject({ code: 'AI_IMAGE_GENERATION_FAILED', status: 502 });
  });

  it('rejects successful provider responses without image data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [] }), { status: 200 })));
    await expect(generateMiniAppImage(await request(), env())).rejects.toMatchObject({ code: 'AI_IMAGE_EMPTY', status: 502 });
  });

  it('fails before calling OpenAI when the server key is missing', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(generateMiniAppImage(await request(), env(''))).rejects.toMatchObject({ code: 'AI_NOT_CONFIGURED', status: 503 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
