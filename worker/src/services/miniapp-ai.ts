import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import { AppError, type Env } from '../types';
import { validateTelegramMiniAppInitData } from './telegram-miniapp-auth';

const DEFAULT_MODEL = 'gemini-2.5-flash';
const MAX_MESSAGE_LENGTH = 4000;

function getMiniAppInitData(req: Request) {
  return req.headers.get('authorization')?.match(/^tma\s+(.+)$/i)?.[1] ?? '';
}

export async function generateMiniAppAiReply(req: Request, env: Env) {
  await validateTelegramMiniAppInitData(getMiniAppInitData(req), env.TELEGRAM_BOT_TOKEN);

  const body = await req.json().catch(() => null) as { message?: unknown } | null;
  const message = typeof body?.message === 'string' ? body.message.trim() : '';

  if (!message) throw new AppError('AI_MESSAGE_REQUIRED', 'Введите сообщение для AI', 400);
  if (message.length > MAX_MESSAGE_LENGTH) throw new AppError('AI_MESSAGE_TOO_LONG', `Сообщение не должно превышать ${MAX_MESSAGE_LENGTH} символов`, 400);
  if (!env.GEMINI_API_KEY) throw new AppError('AI_NOT_CONFIGURED', 'AI пока не настроен', 503);

  const google = createGoogleGenerativeAI({ apiKey: env.GEMINI_API_KEY });

  try {
    const result = await generateText({
      model: google(env.AI_TEXT_MODEL?.trim() || DEFAULT_MODEL),
      prompt: message,
    });
    const text = result.text.trim();
    if (!text) throw new Error('Gemini returned an empty response');
    return { text };
  } catch (error) {
    console.error('Mini App AI generation failed', error);
    throw new AppError('AI_GENERATION_FAILED', 'Не удалось получить ответ AI. Попробуйте ещё раз.', 502);
  }
}
