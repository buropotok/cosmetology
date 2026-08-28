import { AppError, type Env } from '../types';
import { publishTelegram } from './telegram';
import { validateTelegramMiniAppInitData } from './telegram-miniapp-auth';
import { resolveOrCreateTelegramIdentity } from './telegram-identity';
import { createPairingCode } from './telegram-account';

export const MINIAPP_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const MINIAPP_TEXT_MAX_LENGTH = 4096;

function initDataFrom(request: Request) {
  return request.headers.get('authorization')?.match(/^tma\s+(.+)$/i)?.[1] ?? '';
}

async function miniAppAccount(request: Request, env: Env) {
  const validated = await validateTelegramMiniAppInitData(
    initDataFrom(request),
    env.TELEGRAM_BOT_TOKEN,
  );
  const telegramUserId = String(validated.user.id);
  const account = await resolveOrCreateTelegramIdentity(env, telegramUserId);
  return { validated, telegramUserId, account };
}

export async function getMiniAppStatus(request: Request, env: Env) {
  const { validated, account } = await miniAppAccount(request, env);
  return {
    telegramUser: {
      id: String(validated.user.id),
      firstName: validated.user.first_name,
      ...(validated.user.last_name ? { lastName: validated.user.last_name } : {}),
      ...(validated.user.username ? { username: validated.user.username } : {}),
    },
    accountReady: true,
    connection: account?.chatId
      ? {
          connected: true,
          chatTitle: account.chatTitle ?? 'Telegram-группа',
          chatType: account.chatType,
        }
      : { connected: false },
  };
}

export async function createMiniAppPairing(request: Request, env: Env) {
  const { telegramUserId, account } = await miniAppAccount(request, env);
  const pairing = await createPairingCode(env, account.userId, telegramUserId);
  return {
    code: pairing.code,
    command: pairing.command,
    expiresAt: pairing.expiresAt,
  };
}

export async function publishFromMiniApp(request: Request, env: Env, publisher: typeof publishTelegram = publishTelegram) {
  const { account } = await miniAppAccount(request, env);
  if (!account.chatId) throw new AppError('TELEGRAM_NOT_CONNECTED', 'Подключите Telegram-группу', 409);
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
  return { ok: true, publication: await publisher(env, text, image, account.chatId) };
}
