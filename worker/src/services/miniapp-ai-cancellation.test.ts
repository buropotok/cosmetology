import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

const mocks = vi.hoisted(() => ({
  resolveMiniAppAiUser: vi.fn(),
  setAiGenerationStatus: vi.fn(),
}));

vi.mock('./ai-generation-status', () => ({
  resolveMiniAppAiUser: mocks.resolveMiniAppAiUser,
  setAiGenerationStatus: mocks.setAiGenerationStatus,
}));

import { generateMiniAppAiReply } from './miniapp-ai';
import type { Env } from '../types';

function makeEnv(): Env {
  return { OPENAI_API_KEY: 'test-key' } as Env;
}

describe('Mini App AI request cancellation', () => {
  it('forwards an abortable request signal to OpenAI and records cancellation', async () => {
    mocks.resolveMiniAppAiUser.mockResolvedValue({ userId: 'user-1' });
    mocks.setAiGenerationStatus.mockResolvedValue(undefined);
    const controller = new AbortController();
    let fetchSignalWasForwarded = false;
    let fetchSignalWasAborted = false;
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const signal = init?.signal;
      expect(signal).toBeDefined();
      if (!signal) throw new Error('Expected request signal');
      fetchSignalWasForwarded = true;
      expect(signal.aborted).toBe(false);
      controller.abort();
      fetchSignalWasAborted = signal.aborted;
      expect(fetchSignalWasAborted).toBe(true);
      throw new DOMException('Aborted', 'AbortError');
    });
    vi.stubGlobal('fetch', fetchMock);

    const request = new Request('https://example.test/api/miniapp/ai/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'Подготовь публикацию' }),
      signal: controller.signal,
    });

    try {
      await expect(generateMiniAppAiReply(request, makeEnv())).resolves.toEqual({ cancelled: true });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchSignalWasForwarded).toBe(true);
      expect(fetchSignalWasAborted).toBe(true);
      expect(mocks.setAiGenerationStatus).toHaveBeenCalledWith(
        expect.anything(),
        'user-1',
        'general',
        'failed',
        'AI_GENERATION_CANCELLED',
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('enables Cloudflare incoming request cancellation', () => {
    const wrangler = readFileSync(new URL('../../wrangler.jsonc', import.meta.url), 'utf8');
    const config = JSON.parse(wrangler) as { compatibility_flags?: string[] };
    expect(config.compatibility_flags).toContain('enable_request_signal');
  });
});
