import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../types';
import { isPostDocument } from '../../../shared/post-document';

const mocks = vi.hoisted(() => ({ resolveMiniAppAiUser: vi.fn(), setAiGenerationStatus: vi.fn() }));
vi.mock('./ai-generation-status', () => ({ resolveMiniAppAiUser: mocks.resolveMiniAppAiUser, setAiGenerationStatus: mocks.setAiGenerationStatus }));
import { generateMiniAppAiReply } from './miniapp-ai';

const originalFetch = globalThis.fetch;
function makeEnv(configured = true): Env {
  return new Proxy({} as Env, {
    get(_target, property) {
      if (property === 'AI_TEXT_MODEL') return undefined;
      return configured ? 'x' : undefined;
    },
  });
}
function makeRequest(body: Record<string, unknown>) {
  return new Request('https://example.test/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
}
function responseText(text: string, annotations?: Array<Record<string, unknown>>) {
  return new Response(JSON.stringify({ output: [{ type: 'message', content: [{ type: 'output_text', text, annotations }] }] }), { status: 200 });
}
const discovery = JSON.stringify({ schemaVersion: 1, ideas: Array.from({ length: 5 }, (_, i) => ({ id: `idea_${i + 1}`, title: `Идея ${i + 1}`, text: `Текст ${i + 1}` })) });

beforeEach(() => {
  vi.restoreAllMocks();
  globalThis.fetch = originalFetch;
  mocks.resolveMiniAppAiUser.mockReset().mockResolvedValue({ userId: 'user-1' });
  mocks.setAiGenerationStatus.mockReset().mockResolvedValue(undefined);
});

describe('Mini App text generation runtime', () => {
  it('returns AI_NOT_CONFIGURED without a provider call when credentials are absent', async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as typeof fetch;
    await expect(generateMiniAppAiReply(makeRequest({ message: 'Тест' }), makeEnv(false)))
      .rejects.toMatchObject({ code: 'AI_NOT_CONFIGURED', status: 503 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses the default model and web_search for discovery', async () => {
    const fetchMock = vi.fn().mockResolvedValue(responseText(discovery));
    globalThis.fetch = fetchMock as typeof fetch;
    const result = await generateMiniAppAiReply(makeRequest({ message: 'Найди темы', mode: 'discovery' }), makeEnv());
    expect(result).toEqual({ discovery: JSON.parse(discovery) });
    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(body.model).toBe('gpt-5.6-luna');
    expect(body.tools).toEqual([{ type: 'web_search' }]);
  });

  it('grounds first and formats with PostMarkdown in a second call', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(responseText('Подготовленная публикация.')).mockResolvedValueOnce(responseText('# Заголовок\n\nТекст.'));
    globalThis.fetch = fetchMock as typeof fetch;
    const result = await generateMiniAppAiReply(makeRequest({ message: 'Подготовь публикацию' }), makeEnv());
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const first = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    const second = JSON.parse(String((fetchMock.mock.calls[1][1] as RequestInit).body));
    expect(first.tools).toEqual([{ type: 'web_search' }]);
    expect(second.tools).toBeUndefined();
    expect(second.instructions).toContain('Ты преобразуешь уже подготовленную публикацию');
    if (!('text' in result) || typeof result.text !== 'string') throw new Error('Expected text result');
    expect(isPostDocument(JSON.parse(result.text))).toBe(true);
  });

  it('passes citation URLs from grounding into the formatting input', async () => {
    const url = 'https://docs.example.test/research';
    const fetchMock = vi.fn().mockResolvedValueOnce(responseText('Публикация.', [{ type: 'url_citation', url, title: 'Исследование' }])).mockResolvedValueOnce(responseText('# Заголовок\n\nТекст.'));
    globalThis.fetch = fetchMock as typeof fetch;
    await generateMiniAppAiReply(makeRequest({ message: 'Подготовь публикацию' }), makeEnv());
    const second = JSON.parse(String((fetchMock.mock.calls[1][1] as RequestInit).body));
    expect(second.input).toContain('Источники:');
    expect(second.input).toContain(`[Исследование](${url})`);
  });

  it('maps provider HTTP errors to controlled failure and persists failed status', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: 'denied' } }), { status: 403 })) as typeof fetch;
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(generateMiniAppAiReply(makeRequest({ message: 'Тест' }), makeEnv()))
      .rejects.toMatchObject({ code: 'AI_GENERATION_FAILED', status: 502 });
    expect(mocks.setAiGenerationStatus).toHaveBeenCalledWith(expect.anything(), 'user-1', 'general', 'failed', 'AI_GENERATION_FAILED');
  });

  it.each([['empty output', JSON.stringify({ output: [] })], ['malformed response', 'not-json']])('handles %s as a controlled failure', async (_name, payload) => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(payload, { status: 200 })) as typeof fetch;
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(generateMiniAppAiReply(makeRequest({ message: 'Тест' }), makeEnv()))
      .rejects.toMatchObject({ code: 'AI_GENERATION_FAILED', status: 502 });
  });
});
