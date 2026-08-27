import { AppError, type Env } from '../types';
import { publishTelegram } from './telegram';
import { validateTelegramMiniAppInitData } from './telegram-miniapp-auth';

export const MINIAPP_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const MINIAPP_TEXT_MAX_LENGTH = 4096;

export async function publishFromMiniApp(request: Request, env: Env, publisher: typeof publishTelegram = publishTelegram) {
  const initData = request.headers.get('authorization')?.match(/^tma\s+(.+)$/i)?.[1] ?? '';
  await validateTelegramMiniAppInitData(initData, env.TELEGRAM_BOT_TOKEN);
  const chatId = env.MINIAPP_TEST_CHAT_ID?.trim();
  if (!chatId) throw new AppError('MINIAPP_DESTINATION_NOT_CONFIGURED', 'Тестовая Telegram-группа не настроена', 503);
  if (!(request.headers.get('content-type') ?? '').toLowerCase().startsWith('multipart/form-data')) throw new AppError('INVALID_CONTENT_TYPE', 'Ожидается multipart/form-data', 415);
  const form = await request.formData().catch(() => { throw new AppError('INVALID_FORM_DATA', 'Не удалось прочитать форму публикации', 400); });
  const rawText = form.get('text');
  const text = typeof rawText === 'string' ? rawText.trim() : '';
  const rawImage = form.get('image');
  const image = rawImage instanceof File && rawImage.size > 0 ? rawImage : undefined;
  if (rawImage !== null && !(rawImage instanceof File)) throw new AppError('INVALID_IMAGE', 'Некорректное изображение', 400);
  if (text.length > MINIAPP_TEXT_MAX_LENGTH) throw new AppError('INVALID_TEXT', `Текст должен быть короче ${MINIAPP_TEXT_MAX_LENGTH + 1} символов`, 400);
  if (!text && !image) throw new AppError('EMPTY_PUBLICATION', 'Добавьте текст или изображение', 400);
  if (image && !image.type.toLowerCase().startsWith('image/')) throw new AppError('INVALID_IMAGE_TYPE', 'Можно выбрать только изображение', 400);
  if (image && image.size > MINIAPP_IMAGE_MAX_BYTES) throw new AppError('IMAGE_TOO_LARGE', 'Изображение должно быть не больше 10 МБ', 400);
  return { ok: true, publication: await publisher(env, text, image, chatId) };
}
