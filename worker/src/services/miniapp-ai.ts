import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import discoverySchema from '../schemas/discovery_schema.json';
import { AppError, type Env } from '../types';
import { validateTelegramMiniAppInitData } from './telegram-miniapp-auth';

const DEFAULT_MODEL = 'gemini-2.5-flash';
const MAX_MESSAGE_LENGTH = 12000;

function getMiniAppInitData(req: Request) {
  return req.headers.get('authorization')?.match(/^tma\s+(.+)$/i)?.[1] ?? '';
}

function serializeAiError(error: unknown): unknown {
  if (error instanceof Error) {
    const details: Record<string, unknown> = {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
    for (const key of Object.getOwnPropertyNames(error)) {
      if (key === 'name' || key === 'message' || key === 'stack') continue;
      const value = (error as unknown as Record<string, unknown>)[key];
      details[key] = value instanceof Error ? serializeAiError(value) : value;
    }
    return details;
  }
  return error;
}

function parseDiscovery(text: string) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const value = JSON.parse(cleaned) as { schemaVersion?: unknown; ideas?: unknown };
  if (value.schemaVersion !== 1 || !Array.isArray(value.ideas) || value.ideas.length !== 5) throw new Error('Invalid discovery response');
  const ids = new Set<string>();
  value.ideas.forEach((raw, index) => {
    if (!raw || typeof raw !== 'object') throw new Error('Invalid discovery idea');
    const idea = raw as Record<string, unknown>;
    const expectedId = `idea_${index + 1}`;
    if (idea.id !== expectedId || ids.has(expectedId) || typeof idea.title !== 'string' || !idea.title.trim() || typeof idea.text !== 'string' || !idea.text.trim()) throw new Error('Invalid discovery idea');
    ids.add(expectedId);
    if (idea.date !== undefined && (typeof idea.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(idea.date))) throw new Error('Invalid discovery date');
    if (idea.source !== undefined) {
      if (!idea.source || typeof idea.source !== 'object') throw new Error('Invalid discovery source');
      const source = idea.source as Record<string, unknown>;
      if (typeof source.name !== 'string' || !source.name.trim() || typeof source.url !== 'string' || !source.url.trim()) throw new Error('Invalid discovery source');
    }
  });
  return value;
}

export async function generateMiniAppAiReply(req: Request, env: Env) {
  await validateTelegramMiniAppInitData(getMiniAppInitData(req), env.TELEGRAM_BOT_TOKEN);

  const body = await req.json().catch(() => null) as { message?: unknown; mode?: unknown } | null;
  const message = typeof body?.message === 'string' ? body.message.trim() : '';
  const mode = body?.mode === 'discovery' ? 'discovery' : 'text';

  if (!message) throw new AppError('AI_MESSAGE_REQUIRED', 'Введите сообщение для AI', 400);
  if (message.length > MAX_MESSAGE_LENGTH) throw new AppError('AI_MESSAGE_TOO_LONG', `Сообщение не должно превышать ${MAX_MESSAGE_LENGTH} символов`, 400);
  if (!env.GEMINI_API_KEY) throw new AppError('AI_NOT_CONFIGURED', 'AI пока не настроен', 503);

  const model = env.AI_TEXT_MODEL?.trim() || DEFAULT_MODEL;
  const google = createGoogleGenerativeAI({ apiKey: env.GEMINI_API_KEY });
  const prompt = mode === 'discovery'
    ? `${message}\n\nВерни только JSON, строго соответствующий этой JSON Schema. Не используй Markdown или code fences. id вариантов должны идти строго idea_1 ... idea_5.\n\n${JSON.stringify(discoverySchema)}`
    : message;

  try {
    const result = await generateText({
      model: google(model),
      tools: { google_search: google.tools.googleSearch({}) },
      prompt,
    });
    const text = result.text.trim();
    if (!text) throw new Error('Gemini returned an empty response');
    return mode === 'discovery' ? { discovery: parseDiscovery(text) } : { text };
  } catch (error) {
    console.error('Mini App AI generation failed', {
      provider: 'google',
      model,
      mode,
      error: serializeAiError(error),
    });
    throw new AppError('AI_GENERATION_FAILED', 'Не удалось получить ответ AI. Попробуйте ещё раз.', 502);
  }
}
