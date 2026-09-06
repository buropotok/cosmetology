import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText, jsonSchema, Output } from 'ai';
import discoverySchema from '../schemas/discovery_schema.json';
import postDocumentSchema from '../schemas/post_document_schema.json';
import type { PostDocument } from '../../../shared/post-document';
import { isPostDocument } from '../../../shared/post-document';
import { AppError, type Env } from '../types';
import { validateTelegramMiniAppInitData } from './telegram-miniapp-auth';

const DEFAULT_MODEL = 'gemini-2.5-flash';
const MAX_MESSAGE_LENGTH = 12000;

const POST_DOCUMENT_SYSTEM_PROMPT = `Ты преобразуешь уже подготовленную публикацию для косметологического кабинета в формат PostDocument.

Сохраняй фактическое содержание исходной публикации. Не проводи новый поиск и не добавляй новые факты.
Используй структуру документа осмысленно:
- heading — заголовок публикации.
- paragraph — основной текст. Пиши короткими читаемыми абзацами.
- bold — выделяй внутри текста только ключевые слова, выводы и важные утверждения. Не выделяй большие фрагменты без необходимости.
- quote — отдельный важный тезис или формулировка, которую полезно визуально отделить от основного текста.
- details — дополнительное подробное пояснение, которое не обязательно видеть сразу. title — короткое название раскрываемого блока.
- bullet_list и ordered_list — только для настоящих перечислений и последовательностей.
- italic, underline, strikethrough и spoiler используй только когда это действительно оправдано смыслом.
- link — только для существующей реальной http/https ссылки. Для mark type=link обязательно указывай href. Для остальных marks href не указывай.
- buttons — CTA-кнопки. Создавай кнопку только если в исходной публикации есть реальный http/https URL. Не придумывай URL.

Служебные пояснения интерфейса вроде «в Telegram будет кнопкой» или «в Telegram текст будет раскрываемым» не включай в публикацию: выражай их смысл структурой PostDocument.`;

function getMiniAppInitData(req: Request) {
  return req.headers.get('authorization')?.match(/^tma\s+(.+)$/i)?.[1] ?? '';
}

function serializeAiError(error: unknown): unknown {
  if (error instanceof Error) {
    const details: Record<string, unknown> = { name: error.name, message: error.message, stack: error.stack };
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

const postDocumentOutputSchema = jsonSchema<PostDocument>(postDocumentSchema as any, {
  validate(value) {
    return isPostDocument(value) ? { success: true, value } : { success: false, error: new Error('Invalid PostDocument response') };
  },
});

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
  const prompt = mode === 'discovery' ? `${message}\n\nВерни только JSON, строго соответствующий этой JSON Schema. Не используй Markdown или code fences. id вариантов должны идти строго idea_1 ... idea_5.\n\n${JSON.stringify(discoverySchema)}` : message;

  try {
    if (mode === 'discovery') {
      const result = await generateText({ model: google(model), tools: { google_search: google.tools.googleSearch({}) }, prompt });
      const text = result.text.trim();
      if (!text) throw new Error('Gemini returned an empty response');
      return { discovery: parseDiscovery(text) };
    }

    const grounded = await generateText({
      model: google(model),
      tools: { google_search: google.tools.googleSearch({}) },
      prompt,
    });
    const groundedText = grounded.text.trim();
    if (!groundedText) throw new Error('Gemini returned an empty grounded response');

    const structured = await generateText({
      model: google(model),
      output: Output.object({ schema: postDocumentOutputSchema, name: 'PostDocument', description: 'Готовая публикация в каноническом формате PostDocument' }),
      system: POST_DOCUMENT_SYSTEM_PROMPT,
      prompt: `Преобразуй следующую готовую публикацию в PostDocument, сохранив её содержание:\n\n${groundedText}`,
    });
    if (!structured.output || !isPostDocument(structured.output)) throw new Error('Gemini returned an invalid PostDocument');
    return { text: JSON.stringify(structured.output, null, 2) };
  } catch (error) {
    console.error('Mini App AI generation failed', { provider: 'google', model, mode, error: serializeAiError(error) });
    throw new AppError('AI_GENERATION_FAILED', 'Не удалось получить ответ AI. Попробуйте ещё раз.', 502);
  }
}
