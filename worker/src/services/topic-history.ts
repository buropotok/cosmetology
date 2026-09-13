import type { Env } from '../types';

const PREFIX = 'topic-history';
const HEADER = `COSMETOLOGY SELECTED TOPIC HISTORY\n\nPurpose:\nThis document lists topics previously selected by this user.\nDo not propose topics that substantially duplicate these topics or angles.\n`;

export type SelectedIdea = { title: string; text: string };

function key(userId: string) { return `${PREFIX}/${userId}.txt`; }

export function topicHistoryUrl(origin: string, userId: string) {
  return `${origin}/api/ai/topic-history/${encodeURIComponent(userId)}.txt`;
}

export function parseSelectedIdea(value: unknown): SelectedIdea | null {
  if (value === undefined || value === null) return null;
  if (!value || typeof value !== 'object') throw new Error('Invalid selected idea');
  const raw = value as Record<string, unknown>;
  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  const text = typeof raw.text === 'string' ? raw.text.trim() : '';
  if (!title || !text || title.length > 500 || text.length > 4000) throw new Error('Invalid selected idea');
  return { title, text };
}

export async function appendSelectedTopic(env: Env, userId: string, idea: SelectedIdea) {
  const objectKey = key(userId);
  const previous = await env.LOGS.get(objectKey);
  const existing = previous ? await previous.text() : HEADER;
  const separator = existing.endsWith('\n') ? '' : '\n';
  const entry = `\n---\n\nSELECTED_AT: ${new Date().toISOString()}\nTITLE: ${idea.title}\nTEXT:\n${idea.text}\n`;
  await env.LOGS.put(objectKey, `${existing}${separator}${entry}`, { httpMetadata: { contentType: 'text/plain; charset=utf-8' } });
}

export async function getTopicHistory(env: Env, userId: string) {
  const object = await env.LOGS.get(key(userId));
  return object ? object.text() : HEADER;
}
