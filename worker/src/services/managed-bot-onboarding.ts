import { AppError, type Env } from '../types';
import { validateTelegramMiniAppInitData } from './telegram-miniapp-auth';
import { resolveOrCreateTelegramIdentity } from './telegram-identity';
import { setTelegramWebhookWithToken } from './telegram';

const PAIRING_TTL_SECONDS = 10 * 60;
const WEBHOOK_PATH = '/api/telegram/managed/';

function base64Url(bytes: Uint8Array) { let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte); return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, ''); }
function randomOpaque(byteLength: number) { return base64Url(crypto.getRandomValues(new Uint8Array(byteLength))); }
async function sha256(value: string) { const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)); return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join(''); }
function safeEqual(left: string, right: string) { if (left.length !== right.length) return false; let difference = 0; for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index); return difference === 0; }
function initDataFrom(request: Request) { return request.headers.get('authorization')?.match(/^tma\s+(.+)$/i)?.[1] ?? ''; }
async function authenticatedAccount(request: Request, env: Env) { const validated = await validateTelegramMiniAppInitData(initDataFrom(request), env.TELEGRAM_BOT_TOKEN); const account = await resolveOrCreateTelegramIdentity(env, String(validated.user.id)); return { validated, account }; }

type WebhookRow = { webhook_id: string; status: string };
export async function configureManagedBotWebhook(env: Env, managedBotId: string, token: string, setWebhook = setTelegramWebhookWithToken) {
  const configured = await env.DB.prepare(`SELECT webhook_id,status FROM telegram_managed_bot_webhooks WHERE telegram_bot_id=?`).bind(managedBotId).first<WebhookRow>();
  if (configured?.status === 'active') return configured.webhook_id;
  if (!env.MINIAPP_URL) throw new AppError('MANAGED_BOT_WEBHOOK_URL_MISSING', 'Не настроен публичный URL Worker', 500);
  const origin = new URL(env.MINIAPP_URL).origin;
  if (!origin.startsWith('https://')) throw new AppError('MANAGED_BOT_WEBHOOK_URL_INVALID', 'Managed bot webhook требует HTTPS', 500);
  const webhookId = randomOpaque(24), webhookSecret = randomOpaque(32), secretHash = await sha256(webhookSecret);
  await env.DB.prepare(`INSERT INTO telegram_managed_bot_webhooks(webhook_id,telegram_bot_id,secret_hash,status) VALUES(?,?,?,'pending') ON CONFLICT(telegram_bot_id) DO UPDATE SET webhook_id=excluded.webhook_id,secret_hash=excluded.secret_hash,status='pending',updated_at=CURRENT_TIMESTAMP`).bind(webhookId, managedBotId, secretHash).run();
  try { const ok = await setWebhook(token, `${origin}${WEBHOOK_PATH}${webhookId}`, webhookSecret); if (ok !== true) throw new AppError('MANAGED_BOT_WEBHOOK_SETUP_FAILED', 'Telegram не подтвердил webhook', 502); }
  catch (error) { console.error({event:'telegram_managed_bot_webhook_setup_failed',managedBotId,errorCode:error instanceof AppError?error.code:'UNKNOWN'}); throw error; }
  await env.DB.prepare(`UPDATE telegram_managed_bot_webhooks SET status='active',updated_at=CURRENT_TIMESTAMP WHERE webhook_id=? AND telegram_bot_id=?`).bind(webhookId, managedBotId).run();
  console.log({ event: 'telegram_managed_bot_webhook_configured', managedBotId }); return webhookId;
}

type OwnedManagedBotRow = { telegram_bot_id: string; username: string };
export async function createManagedBotGroupLink(request: Request, env: Env) {
  const { account } = await authenticatedAccount(request, env); const body = await request.json().catch(() => ({})) as { managedBotId?: unknown }; const managedBotId = typeof body.managedBotId === 'string' ? body.managedBotId : '';
  if (!managedBotId) throw new AppError('MANAGED_BOT_ID_REQUIRED', 'Выберите персонального бота', 400);
  const bot = await env.DB.prepare(`SELECT mb.telegram_bot_id,mb.username FROM telegram_managed_bots mb JOIN telegram_managed_bot_webhooks wh ON wh.telegram_bot_id=mb.telegram_bot_id AND wh.status='active' WHERE mb.telegram_bot_id=? AND mb.user_id=? AND mb.status='active' AND mb.username IS NOT NULL AND mb.token_ciphertext IS NOT NULL AND mb.token_iv IS NOT NULL`).bind(managedBotId, account.userId).first<OwnedManagedBotRow>();
  if (!bot) throw new AppError('MANAGED_BOT_NOT_READY', 'Персональный бот не найден или ещё не готов', 404);
  const nonce = randomOpaque(24), nonceHash = await sha256(nonce), expiresAt = new Date(Date.now() + PAIRING_TTL_SECONDS * 1000).toISOString();
  await env.DB.batch([
    env.DB.prepare(`UPDATE telegram_managed_bot_group_pairings SET status='cancelled' WHERE user_id=? AND telegram_bot_id=? AND status='pending'`).bind(account.userId, bot.telegram_bot_id),
    env.DB.prepare(`INSERT INTO telegram_managed_bot_group_pairings(id,user_id,telegram_bot_id,nonce_hash,expires_at) VALUES(?,?,?,?,?)`).bind(`tmgp_${crypto.randomUUID().replaceAll('-', '')}`, account.userId, bot.telegram_bot_id, nonceHash, expiresAt),
  ]);
  return { url: `https://t.me/${bot.username}?startgroup=${nonce}`, managedBot: { id: bot.telegram_bot_id, username: bot.username }, expiresAt };
}

export async function getManagedBotStateForUser(env: Env, userId: string) {
  return env.DB.prepare(`SELECT mb.telegram_bot_id AS botId,mb.username,mb.display_name AS displayName,d.telegram_chat_id AS chatId,d.chat_title AS chatTitle,d.chat_type AS chatType,d.status AS destinationStatus FROM telegram_managed_bots mb LEFT JOIN telegram_managed_bot_destinations d ON d.telegram_bot_id=mb.telegram_bot_id AND d.user_id=mb.user_id AND d.status='active' WHERE mb.user_id=? AND mb.status='active' ORDER BY mb.updated_at DESC,d.updated_at DESC LIMIT 1`).bind(userId).first<{botId:string;username:string|null;displayName:string|null;chatId:string|null;chatTitle:string|null;chatType:string|null;destinationStatus:string|null}>();
}

type IncomingWebhookRow = { telegram_bot_id: string; secret_hash: string };
type PrivateOwnerRow={user_id:string};
function startPayload(text: unknown) { if (typeof text !== 'string') return null; return text.match(/^\/start(?:@[A-Za-z0-9_]+)?\s+([A-Za-z0-9_-]{16,64})$/)?.[1] ?? null; }
function isPlainStart(text:unknown){return typeof text==='string'&&/^\/start(?:@[A-Za-z0-9_]+)?\s*$/.test(text)}
async function sendManagedBotReturn(token:string,chatId:string){const body=new FormData();body.set('chat_id',chatId);body.set('text','ВЕРНИТЕСЬ В ПРОГРАММУ COSMO SOFA. ВЫ ВСЕГДА МОЖЕТЕ ЭТО СДЕЛАТЬ НАЖАВ НА КНОПКУ ВНИЗУ ЭКРАНА.');const r=await fetch(`https://api.telegram.org/bot${token}/sendMessage`,{method:'POST',body});if(!r.ok)console.error({event:'managed_bot_return_message_failed',status:r.status})}
export async function managedBotWebhook(request: Request, env: Env, webhookId: string) {
  const route = await env.DB.prepare(`SELECT telegram_bot_id,secret_hash FROM telegram_managed_bot_webhooks WHERE webhook_id=? AND status='active'`).bind(webhookId).first<IncomingWebhookRow>();
  if (!route) throw new AppError('MANAGED_BOT_WEBHOOK_UNAUTHORIZED', 'Webhook не авторизован', 401);
  const suppliedSecret = request.headers.get('x-telegram-bot-api-secret-token') ?? '';
  if (!suppliedSecret || !safeEqual(await sha256(suppliedSecret), route.secret_hash)) throw new AppError('MANAGED_BOT_WEBHOOK_UNAUTHORIZED', 'Webhook не авторизован', 401);
  const update = await request.json().catch(() => { throw new AppError('INVALID_TELEGRAM_UPDATE', 'Некорректный Telegram update', 400); }) as any;
  const membership = update?.my_chat_member;
  if (membership) {
    const chatId = membership.chat?.id != null ? String(membership.chat.id) : null, memberBotId = membership.new_chat_member?.user?.id != null ? String(membership.new_chat_member.user.id) : null, status = membership.new_chat_member?.status;
    if (chatId && memberBotId === route.telegram_bot_id && (status === 'left' || status === 'kicked')) { await env.DB.prepare(`UPDATE telegram_managed_bot_destinations SET status='inactive',updated_at=CURRENT_TIMESTAMP WHERE telegram_bot_id=? AND telegram_chat_id=? AND status='active'`).bind(route.telegram_bot_id, chatId).run(); console.log({ event: 'telegram_managed_bot_destination_inactive', managedBotId: route.telegram_bot_id, chatId }); }
    return { ok: true };
  }
  const message = update?.message, nonce = startPayload(message?.text), chatType = message?.chat?.type, chatId = message?.chat?.id != null ? String(message.chat.id) : null, telegramUserId = message?.from?.id != null ? String(message.from.id) : null;
  if(chatType==='private'&&chatId&&telegramUserId&&isPlainStart(message?.text)){
    const owner=await env.DB.prepare(`SELECT mb.user_id FROM telegram_managed_bots mb JOIN telegram_identities ti ON ti.user_id=mb.user_id AND ti.telegram_user_id=? WHERE mb.telegram_bot_id=? AND mb.status='active' LIMIT 1`).bind(telegramUserId,route.telegram_bot_id).first<PrivateOwnerRow>();
    if(owner){await env.DB.prepare(`INSERT INTO telegram_managed_bot_private_chats(user_id,telegram_bot_id,telegram_chat_id,telegram_user_id,status,updated_at) VALUES(?,?,?,?,'active',CURRENT_TIMESTAMP) ON CONFLICT(user_id,telegram_bot_id) DO UPDATE SET telegram_chat_id=excluded.telegram_chat_id,telegram_user_id=excluded.telegram_user_id,status='active',updated_at=CURRENT_TIMESTAMP`).bind(owner.user_id,route.telegram_bot_id,chatId,telegramUserId).run();const credential=await env.DB.prepare(`SELECT token_ciphertext,token_iv,token_key_version FROM telegram_managed_bots WHERE telegram_bot_id=? AND user_id=?`).bind(route.telegram_bot_id,owner.user_id).first<{token_ciphertext:string;token_iv:string;token_key_version:number}>();if(credential){const {decryptManagedBotToken}=await import('./managed-bot-crypto');const token=await decryptManagedBotToken(route.telegram_bot_id,{ciphertext:credential.token_ciphertext,iv:credential.token_iv,keyVersion:credential.token_key_version},env);await sendManagedBotReturn(token,chatId)}console.log({event:'telegram_managed_bot_private_chat_ready',managedBotId:route.telegram_bot_id,userId:owner.user_id})}
    return {ok:true};
  }
  if (!nonce || !chatId || !telegramUserId || (chatType !== 'group' && chatType !== 'supergroup')) return { ok: true };
  const nonceHash = await sha256(nonce);
  const pairing = await env.DB.prepare(`SELECT p.id,p.user_id,p.telegram_bot_id FROM telegram_managed_bot_group_pairings p JOIN telegram_identities ti ON ti.user_id=p.user_id AND ti.telegram_user_id=? WHERE p.nonce_hash=? AND p.telegram_bot_id=? AND p.status='pending' AND p.expires_at>CURRENT_TIMESTAMP`).bind(telegramUserId, nonceHash, route.telegram_bot_id).first<{id:string;user_id:string;telegram_bot_id:string}>();
  if (!pairing) { console.log({ event: 'telegram_managed_bot_group_pairing_rejected', managedBotId: route.telegram_bot_id }); return { ok: true }; }
  const title = typeof message.chat?.title === 'string' ? message.chat.title : null;
  await env.DB.batch([
    env.DB.prepare(`UPDATE telegram_managed_bot_destinations SET status='inactive',updated_at=CURRENT_TIMESTAMP WHERE telegram_bot_id=? AND status='active' AND EXISTS(SELECT 1 FROM telegram_managed_bot_group_pairings WHERE id=? AND status='pending' AND expires_at>CURRENT_TIMESTAMP)`).bind(route.telegram_bot_id, pairing.id),
    env.DB.prepare(`INSERT INTO telegram_managed_bot_destinations(id,user_id,telegram_bot_id,telegram_chat_id,chat_type,chat_title) SELECT ?,user_id,telegram_bot_id,?,?,? FROM telegram_managed_bot_group_pairings WHERE id=? AND status='pending' AND expires_at>CURRENT_TIMESTAMP ON CONFLICT(telegram_bot_id,telegram_chat_id) DO UPDATE SET user_id=excluded.user_id,chat_type=excluded.chat_type,chat_title=excluded.chat_title,status='active',updated_at=CURRENT_TIMESTAMP`).bind(`tmd_${crypto.randomUUID().replaceAll('-', '')}`, chatId, chatType, title, pairing.id),
    env.DB.prepare(`UPDATE telegram_managed_bot_group_pairings SET status='completed',completed_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending' AND expires_at>CURRENT_TIMESTAMP`).bind(pairing.id),
  ]);
  console.log({ event: 'telegram_managed_bot_destination_connected', managedBotId: route.telegram_bot_id, chatId, chatType }); return { ok: true };
}
