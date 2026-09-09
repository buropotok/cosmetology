import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import discoverySchema from '../schemas/discovery_schema.json';
import { isPostDocument } from '../../../shared/post-document';
import { parsePostMarkdown } from '../../../shared/post-markdown';
import { AppError, type Env } from '../types';
import { resolveMiniAppAiUser, setAiGenerationStatus, type AiGenerationKind } from './ai-generation-status';
import { sanitizePostDocumentLinks } from './link-validator';

const DEFAULT_MODEL = 'gemini-2.5-flash';
const MAX_MESSAGE_LENGTH = 12000;

const POST_MARKDOWN_SYSTEM_PROMPT = `Ты преобразуешь уже подготовленную публикацию для косметологического кабинета в компактный PostMarkdown.

Сохраняй фактическое содержание исходной публикации. Не проводи новый поиск и не добавляй новые факты.
Готовая публикация должна содержать не более 200 слов.
Верни только сам PostMarkdown: без JSON, schemaVersion, служебных пояснений и code fences.

Разрешённый формат:
- # Заголовок — heading. Используй только один уровень заголовка: #.
- Обычный текст, разделённый пустыми строками — paragraph. Пиши короткими читаемыми абзацами.
- > Текст — quote.
- - Пункт — bullet list.
- 1. Пункт — ordered list.
- Вложенный список допустим максимум на один уровень; используй тот же тип списка и отступ в два пробела.
- **текст** — bold. Выделяй только ключевые слова, выводы и важные утверждения.
- *текст* — italic.
- ~~текст~~ — strikethrough.
- ||текст|| — spoiler.
- Inline-ссылка использует обычный Markdown-формат [текст](URL). Используй только существующий реальный http/https URL из исходной публикации; не придумывай URL и не используй example.com, example.org или example.net.

Дополнительный раскрываемый блок:
:::details Короткий заголовок
Текст, списки, цитаты или заголовок внутри блока.
:::
Не вкладывай details внутрь details.

CTA-кнопки, если они нужны, записывай только в самом конце публикации, каждая на отдельной строке, в формате [[Название кнопки]](URL).
После первой кнопки разрешены только другие кнопки. Создавай кнопку только если реальный http/https URL уже присутствует в исходной публикации. Не придумывай URL.

Если в исходной публикации есть источники, сохрани их как обычные ссылки и расположи в самом конце публикации.

Не используй underline в AI-разметке. Он остаётся доступен пользователю в редакторе.
Служебные пояснения интерфейса вроде «в Telegram будет кнопкой» или «в Telegram текст будет раскрываемым» не включай в публикацию: выражай их смысл самой разметкой.`;

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

function generationKind(message: string): AiGenerationKind {
  return /актуальн(?:ые|ых) новост|\bновост(?:и|ей)\b/i.test(message) ? 'news' : 'general';
}

export async function generateMiniAppAiReply(req: Request, env: Env) {
  const { userId } = await resolveMiniAppAiUser(req, env);
  const body = await req.json().catch(() => null) as { message?: unknown; mode?: unknown } | null;
  const message = typeof body?.message === 'string' ? body.message.trim() : '';
  const mode = body?.mode === 'discovery' ? 'discovery' : 'text';
  if (!message) throw new AppError('AI_MESSAGE_REQUIRED', 'Введите сообщение для AI', 400);
  if (message.length > MAX_MESSAGE_LENGTH) throw new AppError('AI_MESSAGE_TOO_LONG', `Сообщение не должно превышать ${MAX_MESSAGE_LENGTH} символов`, 400);
  if (!env.GEMINI_API_KEY) throw new AppError('AI_NOT_CONFIGURED', 'AI пока не настроен', 503);

  const kind = generationKind(message);
  await setAiGenerationStatus(env, userId, kind, 'queued');
  const model = env.AI_TEXT_MODEL?.trim() || DEFAULT_MODEL;
  const google = createGoogleGenerativeAI({ apiKey: env.GEMINI_API_KEY });
  const prompt = mode === 'discovery' ? `${message}\n\nВерни только JSON, строго соответствующий этой JSON Schema. Не используй Markdown или code fences. id вариантов должны идти строго idea_1 ... idea_5.\n\n${JSON.stringify(discoverySchema)}` : message;

  try {
    await setAiGenerationStatus(env, userId, kind, 'running');
    if (mode === 'discovery') {
      const result = await generateText({ model: google(model), tools: { google_search: google.tools.googleSearch({}) }, abortSignal: req.signal, prompt });
      const text = result.text.trim();
      if (!text) throw new Error('Gemini returned an empty response');
      if (req.signal.aborted) throw new Error('AI request aborted');
      await setAiGenerationStatus(env, userId, kind, 'succeeded');
      return { discovery: parseDiscovery(text) };
    }

    const grounded = await generateText({
      model: google(model),
      tools: { google_search: google.tools.googleSearch({}) },
      abortSignal: req.signal,
      prompt,
    });
    const groundedText = grounded.text.trim();
    if (!groundedText) throw new Error('Gemini returned an empty grounded response');
    if (req.signal.aborted) throw new Error('AI request aborted');

    const formatted = await generateText({
      model: google(model),
      system: POST_MARKDOWN_SYSTEM_PROMPT,
      abortSignal: req.signal,
      prompt: `Преобразуй следующую готовую публикацию в PostMarkdown, сохранив её содержание и сократив при необходимости до 200 слов максимум:\n\n${groundedText}`,
    });
    const markdown = formatted.text.trim();
    if (!markdown) throw new Error('Gemini returned an empty PostMarkdown response');
    if (req.signal.aborted) throw new Error('AI request aborted');
    const document = await sanitizePostDocumentLinks(parsePostMarkdown(markdown));
    if (!isPostDocument(document)) throw new Error('Gemini returned invalid PostMarkdown');
    await setAiGenerationStatus(env, userId, kind, 'succeeded');
    return { text: JSON.stringify(document, null, 2) };
  } catch (error) {
    const cancelled = req.signal.aborted;
    await setAiGenerationStatus(env, userId, kind, 'failed', cancelled ? 'AI_GENERATION_CANCELLED' : 'AI_GENERATION_FAILED').catch(statusError => console.error('Failed to persist AI generation failure', statusError));
    if (cancelled) return { cancelled: true };
    console.error('Mini App AI generation failed', { provider: 'google', model, mode, error: serializeAiError(error) });
    throw new AppError('AI_GENERATION_FAILED', 'Не удалось получить ответ AI. Попробуйте ещё раз.', 502);
  }
}
