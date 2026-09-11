import { AppError } from '../types';

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';

type OpenAIResponse = {
  output_text?: unknown;
  output?: Array<{
    type?: unknown;
    content?: Array<{ type?: unknown; text?: unknown }>;
  }>;
  error?: { message?: unknown } | null;
};

function extractOutputText(payload: OpenAIResponse) {
  if (typeof payload.output_text === 'string' && payload.output_text.trim()) return payload.output_text;
  const parts: string[] = [];
  for (const item of payload.output || []) {
    if (item?.type !== 'message') continue;
    for (const content of item.content || []) {
      if (content?.type === 'output_text' && typeof content.text === 'string') parts.push(content.text);
    }
  }
  return parts.join('\n').trim();
}

export async function askOpenAIWithWebSearch(apiKey: string, model: string, prompt: string, signal: AbortSignal) {
  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: 'POST',
    signal,
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: prompt,
      tools: [{ type: 'web_search' }],
      tool_choice: 'auto',
    }),
  });

  let payload: OpenAIResponse | null = null;
  try { payload = await response.json() as OpenAIResponse; } catch {}
  if (!response.ok) {
    const detail = typeof payload?.error?.message === 'string' ? payload.error.message : `OpenAI HTTP ${response.status}`;
    throw new AppError('AI_IMAGE_SEARCH_FAILED', detail, 502);
  }
  if (!payload) throw new AppError('AI_IMAGE_SEARCH_FAILED', 'OpenAI вернул некорректный ответ', 502);
  const text = extractOutputText(payload);
  if (!text) throw new AppError('AI_IMAGE_SEARCH_FAILED', 'OpenAI не вернул текстовый результат поиска', 502);
  return text;
}
