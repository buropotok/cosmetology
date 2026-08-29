import { AppError, type Env } from '../types';
import { publishTelegram } from './telegram';
import { validateTelegramMiniAppInitData } from './telegram-miniapp-auth';
import { resolveOrCreateTelegramIdentity } from './telegram-identity';
import { createPairingCode } from './telegram-account';
import { getManagedBotStateForUser } from './managed-bot-onboarding';

export const MINIAPP_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const MINIAPP_TEXT_MAX_LENGTH = 4096;

function initDataFrom(request: Request) {
  return request.headers.get('authorization')?.match(/^tma\s+(.+)$/i)?.[1] ?? '';
}

async function miniAppAccount(request: Request, env: Env) {
  const validated = await validateTelegramMiniAppInitData(initDataFrom(request), env.TELEGRAM_BOT_TOKEN);
  const telegramUserId = String(validated.user.id);
  const account = await resolveOrCreateTelegramIdentity(env, telegramUserId);
  return { validated, telegramUserId, account };
}

async function getVkGroup(env: Env, userId: string) {
  return env.DB.prepare('SELECT group_id AS groupId, group_url AS groupUrl, screen_name AS screenName FROM user_vk_group WHERE user_id=?')
    .bind(userId).first<{ groupId: number; groupUrl: string; screenName: string | null }>();
}

function parseVkGroupUrl(value: string) {
  let url: URL;
  try { url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`); }
  catch { throw new AppError('INVALID_VK_GROUP', 'Некорректная ссылка на VK-группу', 400); }
  if (!/(^|\.)vk\.(com|ru)$/i.test(url.hostname)) throw new AppError('INVALID_VK_GROUP', 'Нужна ссылка на группу VK', 400);
  const screenName = url.pathname.split('/').filter(Boolean)[0] ?? '';
  const match = screenName.match(/^(?:club|public)(\d+)$/i);
  if (!match) throw new AppError('VK_GROUP_ID_REQUIRED', 'Пока используйте ссылку вида vk.com/club123456 или vk.com/public123456', 400);
  return { groupId: Number(match[1]), groupUrl: `https://vk.com/${screenName}`, screenName };
}

export async function saveMiniAppVkGroup(request: Request, env: Env) {
  const { account } = await miniAppAccount(request, env);
  const body = await request.json().catch(() => { throw new AppError('INVALID_JSON', 'Некорректный JSON', 400); }) as { url?: unknown };
  const raw = typeof body?.url === 'string' ? body.url.trim() : '';
  if (!raw) throw new AppError('INVALID_VK_GROUP', 'Вставьте ссылку на VK-группу', 400);
  const group = parseVkGroupUrl(raw);
  await env.DB.prepare(`INSERT INTO user_vk_group(user_id,group_id,group_url,screen_name,updated_at) VALUES(?,?,?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(user_id) DO UPDATE SET group_id=excluded.group_id,group_url=excluded.group_url,screen_name=excluded.screen_name,updated_at=CURRENT_TIMESTAMP`)
    .bind(account.userId, group.groupId, group.groupUrl, group.screenName).run();
  return { ok: true, vkGroup: group };
}

export async function getMiniAppStatus(request: Request, env: Env) {
  const { validated, account } = await miniAppAccount(request, env);
  const [managed, vkGroup] = await Promise.all([getManagedBotStateForUser(env, account.userId), getVkGroup(env, account.userId)]);
  return {
    telegramUser: { id: String(validated.user.id), firstName: validated.user.first_name, ...(validated.user.last_name ? { lastName: validated.user.last_name } : {}), ...(validated.user.username ? { username: validated.user.username } : {}) },
    accountReady: true,
    vkGroup: vkGroup ? { connected: true, ...vkGroup } : { connected: false },
    managedBot: managed ? { id: managed.botId, username: managed.username, destination: managed.chatId ? { connected: true, chatTitle: managed.chatTitle ?? 'Telegram-группа', chatType: managed.chatType } : { connected: false } } : null,
    connection: account?.chatId ? { connected: true, chatTitle: account.chatTitle ?? 'Telegram-группа', chatType: account.chatType } : { connected: false },
  };
}

export async function createMiniAppPairing(request: Request, env: Env) {
  const { telegramUserId, account } = await miniAppAccount(request, env);
  const pairing = await createPairingCode(env, account.userId, telegramUserId);
  return { code: pairing.code, command: pairing.command, expiresAt: pairing.expiresAt };
}

export async function publishFromMiniApp(request: Request, env: Env, publisher: typeof publishTelegram = publishTelegram) {
  const { account } = await miniAppAccount(request, env);
  if (!account.chatId) throw new AppError('TELEGRAM_NOT_CONNECTED', 'Подключите Telegram-группу', 409);
  if (!(request.headers.get('content-type') ?? '').toLowerCase().startsWith('multipart/form-data')) throw new AppError('INVALID_CONTENT_TYPE', 'Ожидается multipart/form-data', 415);
  const form = await request.formData().catch(() => { throw new AppError('INVALID_FORM_DATA', 'Не удалось прочитать форму публикации', 400); });
  const rawText = form.get('text'); const text = typeof rawText === 'string' ? rawText.trim() : '';
  const rawImage = form.get('image'); const image = rawImage instanceof File && rawImage.size > 0 ? rawImage : undefined;
  if (rawImage !== null && !(rawImage instanceof File)) throw new AppError('INVALID_IMAGE', 'Некорректное изображение', 400);
  if (text.length > MINIAPP_TEXT_MAX_LENGTH) throw new AppError('INVALID_TEXT', `Текст должен быть короче ${MINIAPP_TEXT_MAX_LENGTH + 1} символов`, 400);
  if (!text && !image) throw new AppError('EMPTY_PUBLICATION', 'Добавьте текст или изображение', 400);
  if (image && !image.type.toLowerCase().startsWith('image/')) throw new AppError('INVALID_IMAGE_TYPE', 'Можно выбрать только изображение', 400);
  if (image && image.size > MINIAPP_IMAGE_MAX_BYTES) throw new AppError('IMAGE_TOO_LARGE', 'Изображение должно быть не больше 10 МБ', 400);
  return { ok: true, publication: await publisher(env, text, image, account.chatId) };
}
