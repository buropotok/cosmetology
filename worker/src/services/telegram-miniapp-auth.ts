import { AppError, type Env } from '../types';

const encoder = new TextEncoder();
export const MINIAPP_INIT_DATA_MAX_AGE_SECONDS = 10 * 60;
export const MINIAPP_SESSION_TTL_SECONDS = 10 * 60;

export interface TelegramMiniAppUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
}

async function hmac(key: BufferSource, value: string) {
  const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(value)));
}

function hexToBytes(value: string) {
  if (!/^[a-f\d]{64}$/i.test(value)) return null;
  return Uint8Array.from(value.match(/.{2}/g)!, (byte) => parseInt(byte, 16));
}

function timingSafeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

function parseUser(value: string | null): TelegramMiniAppUser {
  let user: unknown;
  try { user = value ? JSON.parse(value) : null; } catch { throw new AppError('MINIAPP_USER_INVALID', 'Некорректные данные пользователя Telegram', 401); }
  if (!user || typeof user !== 'object' || !Number.isSafeInteger((user as TelegramMiniAppUser).id) || typeof (user as TelegramMiniAppUser).first_name !== 'string') {
    throw new AppError('MINIAPP_USER_INVALID', 'Некорректные данные пользователя Telegram', 401);
  }
  return user as TelegramMiniAppUser;
}

/** Implements https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app. */
async function validateSignature(initData: string, botToken: string) {
  if (!initData) throw new AppError('MINIAPP_AUTH_REQUIRED', 'Откройте приложение внутри Telegram', 401);
  if (!botToken) throw new AppError('MINIAPP_NOT_CONFIGURED', 'Telegram-бот не настроен', 500);
  const params = new URLSearchParams(initData);
  const hashValue = params.get('hash');
  const suppliedHash = hashValue ? hexToBytes(hashValue) : null;
  if (!suppliedHash) throw new AppError('MINIAPP_AUTH_INVALID', 'Не удалось подтвердить запуск из Telegram', 401);
  params.delete('hash');
  const entries: [string, string][] = [];
  params.forEach((value, key) => entries.push([key, value]));
  const dataCheckString = entries.sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0).map(([key, value]) => `${key}=${value}`).join('\n');
  const secretKey = await hmac(encoder.encode('WebAppData'), botToken);
  const calculatedHash = await hmac(secretKey, dataCheckString);
  if (!timingSafeEqual(suppliedHash, calculatedHash)) throw new AppError('MINIAPP_AUTH_INVALID', 'Не удалось подтвердить запуск из Telegram', 401);
  const authDate = Number(params.get('auth_date'));
  return { user: parseUser(params.get('user')), authDate };
}

export async function validateTelegramMiniAppInitData(initData: string, botToken: string, nowSeconds = Math.floor(Date.now() / 1000), maxAgeSeconds = MINIAPP_INIT_DATA_MAX_AGE_SECONDS) {
  const validated = await validateSignature(initData, botToken);
  const authDate = validated.authDate;
  if (!Number.isSafeInteger(authDate) || authDate > nowSeconds + 60 || nowSeconds - authDate > maxAgeSeconds) {
    throw new AppError('MINIAPP_AUTH_EXPIRED', 'Сессия Telegram устарела. Откройте приложение заново', 401);
  }
  return validated;
}

function initDataFrom(request: Request) { return request.headers.get('authorization')?.match(/^tma\s+(.+)$/i)?.[1] ?? ''; }

async function verifiedAccount(request: Request, env: Env) {
  const validated = await validateSignature(initDataFrom(request), env.TELEGRAM_BOT_TOKEN);
  return validated;
}

export async function bootstrapTelegramMiniAppSession(request: Request, env: Env) {
  const validated = await validateTelegramMiniAppInitData(initDataFrom(request), env.TELEGRAM_BOT_TOKEN);
  const telegramUserId = String(validated.user.id);
  const initialExpiry = validated.authDate + MINIAPP_SESSION_TTL_SECONDS;
  await env.DB.prepare(`INSERT INTO miniapp_sessions(telegram_user_id,expires_at,created_at,updated_at) VALUES(?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) ON CONFLICT(telegram_user_id) DO UPDATE SET expires_at=MAX(expires_at,excluded.expires_at),updated_at=CURRENT_TIMESTAMP`).bind(telegramUserId, initialExpiry).run();
  return validated;
}

export async function requireTelegramMiniAppSession(request: Request, env: Env) {
  const authenticated = await verifiedAccount(request, env);
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(authenticated.authDate) || authenticated.authDate > nowSeconds + 60) throw new AppError('MINIAPP_AUTH_EXPIRED', 'Сессия Telegram устарела. Откройте приложение заново', 401);
  if (nowSeconds - authenticated.authDate <= MINIAPP_INIT_DATA_MAX_AGE_SECONDS) return authenticated;
  return requireStoredSession(authenticated, env, nowSeconds);
}

async function requireStoredSession(authenticated: Awaited<ReturnType<typeof verifiedAccount>>, env: Env, nowSeconds = Math.floor(Date.now() / 1000)) {
  const session = await env.DB.prepare('SELECT expires_at AS expiresAt FROM miniapp_sessions WHERE telegram_user_id=?').bind(String(authenticated.user.id)).first<{expiresAt:number}>();
  if (!session || Number(session.expiresAt) <= nowSeconds) throw new AppError('MINIAPP_AUTH_EXPIRED', 'Сессия Telegram устарела. Откройте приложение заново', 401);
  return authenticated;
}

export async function checkTelegramMiniAppSession(request: Request, env: Env) {
  const authenticated = await verifiedAccount(request, env);
  return requireStoredSession(authenticated, env);
}

export async function extendTelegramMiniAppSessionAfterDraftSave(env: Env, userId: string) {
  const result = await env.DB.prepare(`INSERT INTO miniapp_sessions(telegram_user_id,expires_at,created_at,updated_at) SELECT telegram_user_id,unixepoch()+?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP FROM telegram_identities WHERE user_id=? ON CONFLICT(telegram_user_id) DO UPDATE SET expires_at=MAX(expires_at,excluded.expires_at),updated_at=CURRENT_TIMESTAMP`).bind(MINIAPP_SESSION_TTL_SECONDS, userId).run();
  if (!result.meta.changes) throw new AppError('MINIAPP_AUTH_EXPIRED', 'Сессия Telegram устарела. Откройте приложение заново', 401);
}
