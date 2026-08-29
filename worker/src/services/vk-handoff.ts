import { AppError, type Env } from '../types';
import { validateTelegramMiniAppInitData } from './telegram-miniapp-auth';
import { resolveOrCreateTelegramIdentity } from './telegram-identity';

const HANDOFF_TTL_SECONDS = 15 * 60;
const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
const TEXT_MAX_LENGTH = 4096;
const VK_APP_ID = '54742217';

function initDataFrom(request: Request) {
  return request.headers.get('authorization')?.match(/^tma\s+(.+)$/i)?.[1] ?? '';
}

async function userIdFromMiniApp(request: Request, env: Env) {
  const validated = await validateTelegramMiniAppInitData(initDataFrom(request), env.TELEGRAM_BOT_TOKEN);
  const account = await resolveOrCreateTelegramIdentity(env, String(validated.user.id));
  return account.userId;
}

function bytesToToken(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function hashToken(token: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

function imageExtension(type: string) {
  return ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' } as Record<string, string>)[type] ?? 'bin';
}

export async function createVkHandoff(request: Request, env: Env) {
  const userId = await userIdFromMiniApp(request, env);
  const group = await env.DB.prepare('SELECT group_id AS groupId FROM user_vk_group WHERE user_id=?')
    .bind(userId).first<{ groupId: number }>();
  if (!group) throw new AppError('VK_GROUP_NOT_CONNECTED', 'Сначала сохраните VK-группу', 409);
  if (!(request.headers.get('content-type') ?? '').toLowerCase().startsWith('multipart/form-data'))
    throw new AppError('INVALID_CONTENT_TYPE', 'Ожидается multipart/form-data', 415);

  const form = await request.formData().catch(() => { throw new AppError('INVALID_FORM_DATA', 'Не удалось прочитать публикацию', 400); });
  const rawText = form.get('text');
  const text = typeof rawText === 'string' ? rawText.trim() : '';
  const rawImage = form.get('image');
  const image = rawImage instanceof File && rawImage.size > 0 ? rawImage : undefined;
  if (rawImage !== null && !(rawImage instanceof File)) throw new AppError('INVALID_IMAGE', 'Некорректное изображение', 400);
  if (text.length > TEXT_MAX_LENGTH) throw new AppError('INVALID_TEXT', `Текст должен быть короче ${TEXT_MAX_LENGTH + 1} символов`, 400);
  if (!text && !image) throw new AppError('EMPTY_PUBLICATION', 'Добавьте текст или изображение', 400);
  if (image && !image.type.toLowerCase().startsWith('image/')) throw new AppError('INVALID_IMAGE_TYPE', 'Можно выбрать только изображение', 400);
  if (image && image.size > IMAGE_MAX_BYTES) throw new AppError('IMAGE_TOO_LARGE', 'Изображение должно быть не больше 10 МБ', 400);

  const random = new Uint8Array(32);
  crypto.getRandomValues(random);
  const token = bytesToToken(random);
  const tokenHash = await hashToken(token);
  const expiresAt = new Date(Date.now() + HANDOFF_TTL_SECONDS * 1000).toISOString();
  let imageKey: string | null = null;
  if (image) {
    imageKey = `vk-handoffs/${tokenHash}.${imageExtension(image.type)}`;
    await env.IMAGES.put(imageKey, await image.arrayBuffer(), { httpMetadata: { contentType: image.type } });
  }

  await env.DB.prepare('INSERT INTO vk_handoffs(token_hash,user_id,group_id,text,image_key,expires_at) VALUES(?,?,?,?,?,?)')
    .bind(tokenHash, userId, group.groupId, text, imageKey, expiresAt).run();

  return { ok: true, token, expiresAt, vkUrl: `https://vk.com/app${VK_APP_ID}#handoff=${encodeURIComponent(token)}` };
}

export async function getVkHandoff(env: Env, token: string, origin: string) {
  if (!/^[A-Za-z0-9_-]{40,64}$/.test(token)) throw new AppError('INVALID_HANDOFF', 'Некорректная ссылка публикации', 400);
  const tokenHash = await hashToken(token);
  const row = await env.DB.prepare('SELECT group_id AS groupId,text,image_key AS imageKey,expires_at AS expiresAt FROM vk_handoffs WHERE token_hash=?')
    .bind(tokenHash).first<{ groupId: number; text: string; imageKey: string | null; expiresAt: string }>();
  if (!row || Date.parse(row.expiresAt) <= Date.now()) throw new AppError('HANDOFF_EXPIRED', 'Ссылка публикации истекла. Вернитесь в Telegram и откройте VK снова.', 410);
  return {
    groupId: row.groupId,
    text: row.text,
    imageUrl: row.imageKey ? `${origin}/api/vk-handoff-image/${encodeURIComponent(token)}` : null,
    expiresAt: row.expiresAt,
  };
}

export async function getVkHandoffImage(env: Env, token: string) {
  if (!/^[A-Za-z0-9_-]{40,64}$/.test(token)) return null;
  const tokenHash = await hashToken(token);
  const row = await env.DB.prepare('SELECT image_key AS imageKey,expires_at AS expiresAt FROM vk_handoffs WHERE token_hash=?')
    .bind(tokenHash).first<{ imageKey: string | null; expiresAt: string }>();
  if (!row?.imageKey || Date.parse(row.expiresAt) <= Date.now()) return null;
  return env.IMAGES.get(row.imageKey);
}
