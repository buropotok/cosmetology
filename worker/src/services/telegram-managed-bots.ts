import { AppError, type Env } from '../types';
import { validateTelegramMiniAppInitData } from './telegram-miniapp-auth';
import {
  getManagedTelegramBotToken,
  getTelegramBotMe,
  getTelegramBotMeWithToken,
} from './telegram';

const MANAGER_BOT_USERNAME = 'cosmo_sofa_bot';
const SUGGESTED_NAME = 'Cosmo Sofa Test';
const USERNAME_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

type TelegramUser = {
  id?: unknown;
  username?: unknown;
  first_name?: unknown;
};

export interface ManagedBotTelegramApi {
  getManagerMe(env: Env): ReturnType<typeof getTelegramBotMe>;
  getManagedToken(env: Env, botId: string): Promise<string>;
  getManagedMe(token: string): ReturnType<typeof getTelegramBotMeWithToken>;
}

const telegramApi: ManagedBotTelegramApi = {
  getManagerMe: getTelegramBotMe,
  getManagedToken: getManagedTelegramBotToken,
  getManagedMe: getTelegramBotMeWithToken,
};

function telegramId(value: unknown) {
  return typeof value === 'number' && Number.isSafeInteger(value)
    ? String(value)
    : null;
}

function optionalString(value: unknown) {
  return typeof value === 'string' && value ? value : null;
}

function randomSuffix() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return [...bytes]
    .map((byte) => USERNAME_ALPHABET[byte % USERNAME_ALPHABET.length])
    .join('');
}

export async function getManagerBotDiagnostic(
  env: Env,
  api: ManagedBotTelegramApi = telegramApi,
) {
  const bot = await api.getManagerMe(env);
  const canManageBots = bot.can_manage_bots === true;
  return {
    ok: canManageBots,
    username: bot.username ?? null,
    canManageBots,
  };
}

export async function createManagedBotLink(request: Request, env: Env) {
  const initData =
    request.headers.get('authorization')?.match(/^tma\s+(.+)$/i)?.[1] ?? '';
  await validateTelegramMiniAppInitData(initData, env.TELEGRAM_BOT_TOKEN);
  const suggestedUsername = `cosmo_sofa_${randomSuffix()}_bot`;
  return {
    url: `https://t.me/newbot/${MANAGER_BOT_USERNAME}/${suggestedUsername}?name=${encodeURIComponent(SUGGESTED_NAME)}`,
    suggestedName: SUGGESTED_NAME,
    suggestedUsername,
  };
}

async function storeManagedBot(
  env: Env,
  ownerId: string,
  botId: string,
  username: string | null,
  displayName: string | null,
) {
  await env.DB.prepare(
    `INSERT INTO telegram_managed_bots(
       id,user_id,telegram_owner_user_id,telegram_bot_id,username,display_name
     ) VALUES(
       ?,(SELECT user_id FROM telegram_identities WHERE telegram_user_id=?),?,?,?,?
     )
     ON CONFLICT(telegram_bot_id) DO UPDATE SET
       user_id=COALESCE(excluded.user_id,telegram_managed_bots.user_id),
       telegram_owner_user_id=excluded.telegram_owner_user_id,
       username=excluded.username,
       display_name=excluded.display_name,
       status='active',
       updated_at=CURRENT_TIMESTAMP`,
  )
    .bind(
      `tmb_${crypto.randomUUID().replaceAll('-', '')}`,
      ownerId,
      ownerId,
      botId,
      username,
      displayName,
    )
    .run();
}

export async function handleManagedBotUpdate(
  update: any,
  env: Env,
  api: ManagedBotTelegramApi = telegramApi,
) {
  if (update?.managed_bot !== undefined) {
    const managed = update.managed_bot;
    const ownerId = telegramId(managed?.user?.id);
    const botId = telegramId(managed?.bot?.id);
    if (!ownerId || !botId) {
      console.log({ event: 'telegram_managed_bot_invalid' });
      return true;
    }
    const username = optionalString((managed.bot as TelegramUser).username);
    const displayName = optionalString((managed.bot as TelegramUser).first_name);
    console.log({
      event: 'telegram_managed_bot_updated',
      telegramUserId: ownerId,
      managedBotId: botId,
      managedBotUsername: username,
      managedBotName: displayName,
    });
    const token = await api.getManagedToken(env, botId);
    if (typeof token !== 'string' || !token) {
      throw new AppError(
        'MANAGED_BOT_TOKEN_INVALID',
        'Telegram не вернул token managed bot',
        502,
      );
    }
    const verifiedBot = await api.getManagedMe(token);
    const verified = telegramId(verifiedBot.id) === botId;
    if (!verified) {
      throw new AppError(
        'MANAGED_BOT_TOKEN_INVALID',
        'Telegram вернул token другого managed bot',
        502,
      );
    }
    await storeManagedBot(env, ownerId, botId, username, displayName);
    console.log({
      event: 'telegram_managed_bot_token_verified',
      managedBotId: botId,
      managedBotUsername: optionalString(verifiedBot.username) ?? username,
      verified: true,
    });
    return true;
  }

  if (update?.message?.managed_bot_created !== undefined) {
    const message = update.message;
    const ownerId = telegramId(message?.from?.id);
    const bot = message?.managed_bot_created?.bot;
    const botId = telegramId(bot?.id);
    if (!ownerId || !botId) {
      console.log({ event: 'telegram_managed_bot_created_message_invalid' });
      return true;
    }
    const username = optionalString((bot as TelegramUser).username);
    const displayName = optionalString((bot as TelegramUser).first_name);
    console.log({
      event: 'telegram_managed_bot_created_message',
      telegramUserId: ownerId,
      managedBotId: botId,
      managedBotUsername: username,
    });
    await storeManagedBot(env, ownerId, botId, username, displayName);
    return true;
  }

  return false;
}
