import { describe, expect, it } from 'vitest';
import type { Env } from './types';
import worker from './entry';

function makeEnv(history: Record<string, string> = {}) {
  const LOGS = {
    get: async (key: string) => Object.prototype.hasOwnProperty.call(history, key)
      ? { body: history[key], text: async () => history[key] }
      : null,
  } as unknown as R2Bucket;
  return { LOGS } as Env;
}

const ctx = {} as ExecutionContext;

describe('public topic history route', () => {
  it('returns stored per-user TXT history through the Worker route', async () => {
    const response = await worker.fetch(
      new Request('https://worker.example/api/ai/topic-history/user-1.txt'),
      makeEnv({ 'topic-history/user-1.txt': 'TITLE: Первая тема\nTEXT: Описание\n' }),
      ctx,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8');
    expect(await response.text()).toContain('TITLE: Первая тема');
  });

  it('returns a valid empty history document when the user has no history', async () => {
    const response = await worker.fetch(
      new Request('https://worker.example/api/ai/topic-history/user-2.txt'),
      makeEnv(),
      ctx,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8');
    expect(await response.text()).toContain('ИСТОРИЯ РАНЕЕ ВЫБРАННЫХ ПОЛЬЗОВАТЕЛЕМ ТЕМ');
  });

  it('returns 400 for a malformed user id', async () => {
    const response = await worker.fetch(
      new Request('https://worker.example/api/ai/topic-history/%2E%2E.txt'),
      makeEnv(),
      ctx,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'TOPIC_HISTORY_USER_ID_INVALID' },
    });
  });
});
