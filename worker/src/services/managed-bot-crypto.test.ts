import { describe, expect, it } from 'vitest';
import type { Env } from '../types';
import {
  decryptManagedBotToken,
  encryptManagedBotToken,
} from './managed-bot-crypto';

function key(fill: number) {
  return btoa(String.fromCharCode(...new Uint8Array(32).fill(fill)));
}

function env(fill = 7) {
  return { MANAGED_BOT_ENCRYPTION_KEY: key(fill) } as Env;
}

describe('Managed Bot credential encryption', () => {
  it('round-trips a token without storing plaintext', async () => {
    const token = '987654:managed-secret';
    const encrypted = await encryptManagedBotToken('9001', token, env());
    expect(encrypted.ciphertext).not.toContain(token);
    expect(encrypted.keyVersion).toBe(1);
    await expect(
      decryptManagedBotToken('9001', encrypted, env()),
    ).resolves.toBe(token);
  });

  it('uses a fresh IV and ciphertext for every encryption', async () => {
    const first = await encryptManagedBotToken('9001', 'same-token', env());
    const second = await encryptManagedBotToken('9001', 'same-token', env());
    expect(first.iv).not.toBe(second.iv);
    expect(first.ciphertext).not.toBe(second.ciphertext);
  });

  it('rejects a wrong key, corrupted ciphertext, corrupted IV, and another bot AAD', async () => {
    const encrypted = await encryptManagedBotToken('9001', 'token', env());
    await expect(decryptManagedBotToken('9001', encrypted, env(8))).rejects.toMatchObject({ code: 'MANAGED_BOT_CREDENTIAL_DECRYPT_FAILED' });
    await expect(decryptManagedBotToken('9001', { ...encrypted, ciphertext: `${encrypted.ciphertext.slice(0, -2)}AA` }, env())).rejects.toMatchObject({ code: 'MANAGED_BOT_CREDENTIAL_DECRYPT_FAILED' });
    await expect(decryptManagedBotToken('9001', { ...encrypted, iv: btoa('short') }, env())).rejects.toMatchObject({ code: 'MANAGED_BOT_CREDENTIAL_INVALID' });
    await expect(decryptManagedBotToken('9002', encrypted, env())).rejects.toMatchObject({ code: 'MANAGED_BOT_CREDENTIAL_DECRYPT_FAILED' });
  });

  it('fails closed for missing or invalid encryption secrets', async () => {
    await expect(encryptManagedBotToken('9001', 'token', {} as Env)).rejects.toMatchObject({ code: 'MANAGED_BOT_ENCRYPTION_KEY_MISSING' });
    await expect(encryptManagedBotToken('9001', 'token', { MANAGED_BOT_ENCRYPTION_KEY: 'not-base64!' } as Env)).rejects.toMatchObject({ code: 'MANAGED_BOT_ENCRYPTION_KEY_INVALID' });
    await expect(encryptManagedBotToken('9001', 'token', { MANAGED_BOT_ENCRYPTION_KEY: btoa('short') } as Env)).rejects.toMatchObject({ code: 'MANAGED_BOT_ENCRYPTION_KEY_INVALID' });
  });
});
