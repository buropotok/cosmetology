import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError, type Env } from '../types';
import { isPostDocument } from '../../../shared/post-document';

const mocks = vi.hoisted(() => ({
  resolveMiniAppAiUser: vi.fn(),
  setAiGenerationStatus: vi.fn(),
}));

vi.mock('./ai-generation-status', () => ({
  resolveMiniAppAiUser: mocks.resolveMiniAppAiUser,
  setAiGenerationStatus: mocks.setAiGenerationStatus,
}));

import { generateMiniAppAiReply } from './miniapp-ai';

const originalFetch = globalThis.fetch;

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    OPENAI_API_KEY: 'test-openai-key',
    AI_TEXT_MODEL: undefined,
    ...overrides,
  } as Env;
}

function makeRequest(body: Record<string, unknown>, signal?: AbortSignal) {
  return new Request('https://example.test/api/miniapp/ai/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
}

function openAiText(text: string) {
  return new Response(JSON.stringify({
    output: [{ type: 'message', content: [{ type: 'output_text', text }] }],
  }), { status: 200, headers: { 'content-type': 'application/json' } });
}

const discovery = JSON.stringify({
  schemaVersion: 1,
  ideas: Array.from({ length: 5 }, (_, index) => ({
    id: `idea_${index + 1}`,
    title: `Идея ${index + 1}`,
    text: `Текст ${index + 1}`,
  })),
});

beforeEach(() => {
  vi.restoreAllMocks();
  globalThis.fetch = originalFetch;
  mocks.resolveMiniAppAiUser.mockReset().mockResolvedValue({ userId: 'user-1' });
  mocks.setAiGenerationStatus.mockReset().mockResolvedValue(undefined);
});

describe('Mini App OpenAI text generation', () => {
  it('fails before provider calls when OPENAI_API_KEY is missing', async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as typeof fetch;

    await expect(generateMiniAppAiReply(makeRequest({ message: 'Тест' }), makeEnv({ OPENAI_API_KEY: '' })))
      .rejects.toMatchObject<AppError>({ code: 'AI_NOT_CONFIGURED', status: 503 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses OpenAI Responses with web_search for discovery and preserves the discovery contract', async () => {
    const fetchMock = vi.fn().mockResolvedValue(openAiText(discovery));
    globalThis.fetch = fetchMock as typeof fetch;
    const env = makeEnv();

    const result = await generateMiniAppAiReply(makeRequest({ message: 'Найди темы', mode: 'discovery' }), env);

    expect(result).toEqual({ discovery: JSON.parse(discovery) });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.openai.com/v1/responses');
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe('gpt-5.6-luna');
    expect(body.tools).toEqual([{ type: 'web_search' }]);
    expect(mocks.setAiGenerationStatus).toHaveBeenLastCalledWith(env, 'user-1', 'general', 'succeeded');
  });

  it('uses web_search only for grounding, then formats with the PostMarkdown system prompt', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(openAiText('Подготовленная публикация без ссылок.'))
      .mockResolvedValueOnce(openAiText('# Заголовок\n\nКороткий текст публикации.'));
    globalThis.fetch = fetchMock as typeof fetch;
    const env = makeEnv();

    const result = await generateMiniAppAiReply(makeRequest({ message: 'Подготовь публикацию' }), env);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstBody = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    const secondBody = JSON.parse(String((fetchMock.mock.calls[1][1] as RequestInit).body));
    expect(firstBody.tools).toEqual([{ type: 'web_search' }]);
    expect(secondBody.tools).toBeUndefined();
    expect(secondBody.instructions).toContain('Ты преобразуешь уже подготовленную публикацию');
    expect(secondBody.input).toContain('Подготовленная публикация без ссылок.');

    expect('text' in result).toBe(true);
    if (!('text' in result)) throw new Error('Expected text result');
    const document = JSON.parse(result.text);
    expect(isPostDocument(document)).toBe(true);
    expect(mocks.setAiGenerationStatus).toHaveBeenLastCalledWith(env, 'user-1', 'general', 'succeeded');
  });

  it('maps OpenAI HTTP failures to AI_GENERATION_FAILED and persists failed status', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: 'denied' } }), {
      status: 403,
      headers: { 'content-type': 'application/json' },
    }));
    globalThis.fetch = fetchMock as typeof fetch;
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(generateMiniAppAiReply(makeRequest({ message: 'Тест' }), makeEnv()))
      .rejects.toMatchObject<AppError>({ code: 'AI_GENERATION_FAILED', status: 502 });
    expect(mocks.setAiGenerationStatus).toHaveBeenCalledWith(expect.anything(), 'user-1', 'general', 'failed', 'AI_GENERATION_FAILED');
  });

  it.each([
    ['empty output', JSON.stringify({ output: [] })],
    ['malformed JSON', 'not-json'],
  ])('turns %s into a controlled generation failure', async (_name, payload) => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(payload, { status: 200 })) as typeof fetch;
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(generateMiniAppAiReply(makeRequest({ message: 'Тест' }), makeEnv()))
      .rejects.toMatchObject<AppError>({ code: 'AI_GENERATION_FAILED', status: 502 });
  });
});
