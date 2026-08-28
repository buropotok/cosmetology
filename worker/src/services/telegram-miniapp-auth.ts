import { AppError } from '../types';

const encoder = new TextEncoder();
export const MINIAPP_INIT_DATA_MAX_AGE_SECONDS = 10 * 60;

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
export async function validateTelegramMiniAppInitData(initData: string, botToken: string, nowSeconds = Math.floor(Date.now() / 1000), maxAgeSeconds = MINIAPP_INIT_DATA_MAX_AGE_SECONDS) {
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
  if (!Number.isSafeInteger(authDate) || authDate > nowSeconds + 60 || nowSeconds - authDate > maxAgeSeconds) {
    throw new AppError('MINIAPP_AUTH_EXPIRED', 'Сессия Telegram устарела. Откройте приложение заново', 401);
  }
  return { user: parseUser(params.get('user')), authDate };
}
