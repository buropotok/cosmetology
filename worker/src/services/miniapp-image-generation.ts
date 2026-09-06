import { AppError, type Env } from '../types';
import { validateTelegramMiniAppInitData } from './telegram-miniapp-auth';

const DEFAULT_IMAGE_MODEL = 'gemini-3.1-flash-image';
const MAX_POST_LENGTH = 12000;

const ILLUSTRATION_PROMPT = `Создай изображение для публикации к готовому посту ниже.

Изображение должно визуально передавать тему и содержание поста и подходить для ленты косметологического кабинета.

Требования:
- без текста и надписей;
- без заголовков;
- без инфографики;
- без логотипов и водяных знаков;
- профессиональная современная эстетика;
- аккуратный premium/medical beauty visual style;
- изображение должно хорошо смотреться в VK и Telegram;
- не дублируй текст поста на изображении;
- не добавляй медицинские утверждения, которых нет в исходном посте;
- создай само изображение, а не только текстовое описание изображения.`;

function getMiniAppInitData(req: Request) {
  return req.headers.get('authorization')?.match(/^tma\s+(.+)$/i)?.[1] ?? '';
}

function decodeBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function generateMiniAppImage(req: Request, env: Env) {
  await validateTelegramMiniAppInitData(getMiniAppInitData(req), env.TELEGRAM_BOT_TOKEN);
  const body = await req.json().catch(() => null) as { text?: unknown } | null;
  const text = typeof body?.text === 'string' ? body.text.trim() : '';
  if (!text) throw new AppError('AI_IMAGE_TEXT_REQUIRED', 'Введите текст публикации', 400);
  if (text.length > MAX_POST_LENGTH) throw new AppError('AI_IMAGE_TEXT_TOO_LONG', `Текст не должен превышать ${MAX_POST_LENGTH} символов`, 400);
  if (!env.GEMINI_API_KEY) throw new AppError('AI_NOT_CONFIGURED', 'AI пока не настроен', 503);

  const model = env.AI_IMAGE_MODEL?.trim() || DEFAULT_IMAGE_MODEL;
  const prompt = `${ILLUSTRATION_PROMPT}\n\nГОТОВЫЙ ТЕКСТ ПУБЛИКАЦИИ:\n${text}`;
  const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ['IMAGE'],
        responseFormat: { image: { aspectRatio: '4:5', imageSize: '1K' } },
      },
    }),
  });

  const result = await response.json().catch(() => null) as any;
  if (!response.ok) {
    console.error('Mini App image generation failed', { model, status: response.status, error: result?.error });
    throw new AppError('AI_IMAGE_GENERATION_FAILED', 'Не удалось сгенерировать изображение. Попробуйте ещё раз.', 502);
  }
  const parts = result?.candidates?.[0]?.content?.parts;
  const imagePart = Array.isArray(parts) ? parts.find((part: any) => part?.inlineData?.data) : null;
  const data = imagePart?.inlineData?.data;
  const mimeType = imagePart?.inlineData?.mimeType || 'image/png';
  if (typeof data !== 'string' || !data) throw new AppError('AI_IMAGE_EMPTY', 'Gemini не вернул изображение. Попробуйте ещё раз.', 502);

  return new Response(decodeBase64(data), {
    status: 200,
    headers: {
      'content-type': mimeType,
      'cache-control': 'no-store',
      'content-disposition': 'inline; filename="generated-post-image.png"',
    },
  });
}
