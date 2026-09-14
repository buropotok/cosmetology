import { describe, expect, it } from 'vitest';
import type { Env } from '../types';
import { appendTopicHistory, emptyTopicHistory, getTopicHistory, parseSelectedIdea, topicHistoryKey } from './topic-history';

function storage() {
  const values = new Map<string, string>();
  const bucket = {
    get: async (key: string) => values.has(key) ? { text: async () => values.get(key)!, body: values.get(key)! } : null,
    put: async (key: string, value: string) => { values.set(key, value); },
  } as unknown as R2Bucket;
  return { values, env: { LOGS: bucket } as Env };
}

describe('topic history', () => {
  it('accepts missing or valid selectedIdea and trims its fields', () => {
    expect(parseSelectedIdea(undefined)).toBeUndefined();
    expect(parseSelectedIdea({ title: ' Тема ', text: ' Текст ' })).toEqual({ title: 'Тема', text: 'Текст' });
  });

  it.each([
    [{ title: '', text: 'text' }],
    [{ title: 'title', text: ' ' }],
    [{ title: 'x'.repeat(501), text: 'text' }],
    [{ title: 'title', text: 'x'.repeat(4001) }],
  ])('rejects invalid selectedIdea %#', value => {
    expect(() => parseSelectedIdea(value)).toThrow(expect.objectContaining({ status: 400 }));
  });

  it('isolates users and writes timestamp, title, and text', async () => {
    const { env, values } = storage();
    await appendTopicHistory(env, 'user-1', { title: 'Первая', text: 'Описание' }, new Date('2026-09-14T12:00:00Z'));
    await appendTopicHistory(env, 'user-2', { title: 'Вторая', text: 'Другое' }, new Date('2026-09-14T13:00:00Z'));
    expect([...values.keys()]).toEqual([topicHistoryKey('user-1'), topicHistoryKey('user-2')]);
    expect(values.get(topicHistoryKey('user-1'))).toContain('SELECTED_AT: 2026-09-14T12:00:00.000Z\nTITLE: Первая\nTEXT: Описание');
  });

  it('returns stored personal history and a valid empty document', async () => {
    const { env } = storage();
    await appendTopicHistory(env, 'user-1', { title: 'Тема', text: 'Текст' });
    const stored = await getTopicHistory(env, 'user-1');
    expect(stored.headers.get('content-type')).toBe('text/plain; charset=utf-8');
    expect(await stored.text()).toContain('TITLE: Тема');
    const empty = await getTopicHistory(env, 'user-2');
    expect(empty.status).toBe(200);
    expect(await empty.text()).toBe(emptyTopicHistory());
  });

  it('rejects malformed public user ids', async () => {
    const { env } = storage();
    await expect(getTopicHistory(env, '../user')).rejects.toMatchObject({ status: 400 });
  });
});
