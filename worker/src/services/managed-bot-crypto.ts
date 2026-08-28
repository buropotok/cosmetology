import { AppError, type Env } from '../types';

const KEY_VERSION = 1;
const IV_LENGTH = 12;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export type EncryptedManagedBotToken = {
  ciphertext: string;
  iv: string;
  keyVersion: number;
};

function decodeBase64(value: string, code: string) {
  try {
    const binary = atob(value);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    throw new AppError(code, 'Некорректные данные шифрования managed bot', 500);
  }
}

function encodeBase64(value: ArrayBuffer | Uint8Array) {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function encryptionKey(env: Env) {
  if (!env.MANAGED_BOT_ENCRYPTION_KEY) {
    throw new AppError(
      'MANAGED_BOT_ENCRYPTION_KEY_MISSING',
      'Не настроен secret шифрования managed bot',
      500,
    );
  }
  const raw = decodeBase64(
    env.MANAGED_BOT_ENCRYPTION_KEY,
    'MANAGED_BOT_ENCRYPTION_KEY_INVALID',
  );
  if (raw.byteLength !== 32) {
    throw new AppError(
      'MANAGED_BOT_ENCRYPTION_KEY_INVALID',
      'Secret шифрования managed bot должен содержать 32 байта',
      500,
    );
  }
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ]);
}

function additionalData(botId: string, keyVersion: number) {
  return encoder.encode(`telegram-managed-bot:${botId}:v${keyVersion}`);
}

export async function encryptManagedBotToken(
  botId: string,
  token: string,
  env: Env,
): Promise<EncryptedManagedBotToken> {
  const key = await encryptionKey(env);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: additionalData(botId, KEY_VERSION) },
    key,
    encoder.encode(token),
  );
  return {
    ciphertext: encodeBase64(ciphertext),
    iv: encodeBase64(iv),
    keyVersion: KEY_VERSION,
  };
}

export async function decryptManagedBotToken(
  botId: string,
  encrypted: EncryptedManagedBotToken,
  env: Env,
) {
  if (encrypted.keyVersion !== KEY_VERSION) {
    throw new AppError(
      'MANAGED_BOT_KEY_VERSION_UNSUPPORTED',
      'Версия ключа managed bot не поддерживается',
      500,
    );
  }
  const key = await encryptionKey(env);
  const iv = decodeBase64(encrypted.iv, 'MANAGED_BOT_CREDENTIAL_INVALID');
  const ciphertext = decodeBase64(
    encrypted.ciphertext,
    'MANAGED_BOT_CREDENTIAL_INVALID',
  );
  if (iv.byteLength !== IV_LENGTH) {
    throw new AppError(
      'MANAGED_BOT_CREDENTIAL_INVALID',
      'Некорректный IV managed bot',
      500,
    );
  }
  try {
    const plaintext = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv,
        additionalData: additionalData(botId, encrypted.keyVersion),
      },
      key,
      ciphertext,
    );
    return decoder.decode(plaintext);
  } catch {
    throw new AppError(
      'MANAGED_BOT_CREDENTIAL_DECRYPT_FAILED',
      'Не удалось расшифровать credential managed bot',
      500,
    );
  }
}
