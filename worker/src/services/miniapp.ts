import { AppError, type Env } from '../types';
import { publishTelegramWithToken } from './telegram';
import { validateTelegramMiniAppInitData } from './telegram-miniapp-auth';
import { resolveOrCreateTelegramIdentity } from './telegram-identity';
import { getManagedBotStateForUser } from './managed-bot-onboarding';
import { decryptManagedBotToken } from './managed-bot-crypto';

export const MINIAPP_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const MINIAPP_IMAGE_MAX_COUNT = 10;
export const MINIAPP_TEXT_MAX_LENGTH = 4096;
function initDataFrom(request: Request) { return request.headers.get('authorization')?.match(/^tma\s+(.+)$/i)?.[1] ?? ''; }
async function miniAppAccount(request: Request, env: Env) { const validated = await validateTelegramMiniAppInitData(initDataFrom(request), env.TELEGRAM_BOT_TOKEN); const telegramUserId = String(validated.user.id); const account = await resolveOrCreateTelegramIdentity(env, telegramUserId); return { validated, telegramUserId, account }; }
async function getVkGroup(env: Env, userId: string) { return env.DB.prepare('SELECT group_id AS groupId, group_url AS groupUrl, screen_name AS screenName, group_name AS groupName FROM user_vk_group WHERE user_id=?').bind(userId).first<{ groupId: number; groupUrl: string; screenName: string | null; groupName: string | null }>(); }
function parseVkGroupUrl(value: string) { let url: URL; try { url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`); } catch { throw new AppError('INVALID_VK_GROUP', 'Некорректная ссылка на VK-группу', 400); } if (!/(^|\.)vk\.(com|ru)$/i.test(url.hostname)) throw new AppError('INVALID_VK_GROUP', 'Нужна ссылка на группу VK', 400); const screenName = url.pathname.split('/').filter(Boolean)[0] ?? ''; const match = screenName.match(/^(?:club|public)(\d+)$/i); if (!match) throw new AppError('VK_GROUP_ID_REQUIRED', 'Пока используйте ссылку вида vk.com/club123456 или vk.com/public123456', 400); return { groupId: Number(match[1]), groupUrl: `https://vk.com/${screenName}`, screenName }; }
type VkGroupApiResponse={response?:{groups?:Array<{id?:number;name?:string;screen_name?:string}>}|Array<{id?:number;name?:string;screen_name?:string}>;error?:{error_msg?:string}};
async function resolveVkGroupName(env:Env,groupId:number){const token=env.VK_ID_SERVICE_TOKEN?.trim()||env.VK_ACCESS_TOKEN?.trim();if(!token)return null;const params=new URLSearchParams({group_ids:String(groupId),access_token:token,v:'5.199'});try{const r=await fetch(`https://api.vk.com/method/groups.getById?${params}`);if(!r.ok)return null;const data=await r.json<VkGroupApiResponse>();if(data.error)return null;const groups=Array.isArray(data.response)?data.response:data.response?.groups;const name=groups?.[0]?.name?.trim();return name||null}catch{return null}}
export async function saveMiniAppVkGroup(request: Request, env: Env) { const { account } = await miniAppAccount(request, env); const body = await request.json().catch(() => { throw new AppError('INVALID_JSON', 'Некорректный JSON', 400); }) as { url?: unknown }; const raw = typeof body?.url === 'string' ? body.url.trim() : ''; if (!raw) throw new AppError('INVALID_VK_GROUP', 'Вставьте ссылку на VK-группу', 400); const group = parseVkGroupUrl(raw); const groupName=await resolveVkGroupName(env,group.groupId); await env.DB.prepare(`INSERT INTO user_vk_group(user_id,group_id,group_url,screen_name,group_name,updated_at) VALUES(?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO UPDATE SET group_id=excluded.group_id,group_url=excluded.group_url,screen_name=excluded.screen_name,group_name=excluded.group_name,updated_at=CURRENT_TIMESTAMP`).bind(account.userId, group.groupId, group.groupUrl, group.screenName,groupName).run(); return { ok: true, vkGroup: {...group,groupName} }; }
export async function getMiniAppStatus(request: Request, env: Env) { const { validated, account } = await miniAppAccount(request, env); const [managed, vkGroup] = await Promise.all([getManagedBotStateForUser(env, account.userId), getVkGroup(env, account.userId)]); return { telegramUser: { id: String(validated.user.id), firstName: validated.user.first_name, ...(validated.user.last_name ? { lastName: validated.user.last_name } : {}), ...(validated.user.username ? { username: validated.user.username } : {}) }, accountReady: true, vkGroup: vkGroup ? { connected: true, ...vkGroup } : { connected: false }, managedBot: managed ? { id: managed.botId, username: managed.username, displayName: managed.displayName, destination: managed.chatId ? { connected: true, chatTitle: managed.chatTitle ?? 'Telegram-группа', chatType: managed.chatType } : { connected: false } } : null }; }
type ManagedPublicationTarget = { telegram_bot_id: string; telegram_chat_id: string; token_ciphertext: string; token_iv: string; token_key_version: number; };
type ManagedPreviewTarget = { telegram_bot_id: string; token_ciphertext: string; token_iv: string; token_key_version: number; };
async function getManagedPublicationTarget(env: Env, userId: string) { return env.DB.prepare(`SELECT mb.telegram_bot_id,d.telegram_chat_id,mb.token_ciphertext,mb.token_iv,mb.token_key_version FROM telegram_managed_bots mb JOIN telegram_managed_bot_destinations d ON d.telegram_bot_id=mb.telegram_bot_id AND d.user_id=mb.user_id AND d.status='active' JOIN telegram_managed_bot_webhooks wh ON wh.telegram_bot_id=mb.telegram_bot_id AND wh.status='active' WHERE mb.user_id=? AND mb.status='active' AND mb.token_ciphertext IS NOT NULL AND mb.token_iv IS NOT NULL ORDER BY mb.updated_at DESC LIMIT 1`).bind(userId).first<ManagedPublicationTarget>(); }
async function getManagedPreviewTarget(env: Env, userId: string) { return env.DB.prepare(`SELECT mb.telegram_bot_id,mb.token_ciphertext,mb.token_iv,mb.token_key_version FROM telegram_managed_bots mb JOIN telegram_managed_bot_webhooks wh ON wh.telegram_bot_id=mb.telegram_bot_id AND wh.status='active' WHERE mb.user_id=? AND mb.status='active' AND mb.token_ciphertext IS NOT NULL AND mb.token_iv IS NOT NULL ORDER BY mb.updated_at DESC LIMIT 1`).bind(userId).first<ManagedPreviewTarget>(); }
async function readMiniAppPublication(request: Request) {
  if (!(request.headers.get('content-type') ?? '').toLowerCase().startsWith('multipart/form-data')) throw new AppError('INVALID_CONTENT_TYPE', 'Ожидается multipart/form-data', 415);
  const form = await request.formData().catch(() => { throw new AppError('INVALID_FORM_DATA', 'Не удалось прочитать форму публикации', 400); });
  const rawText = form.get('text'); const text = typeof rawText === 'string' ? rawText.trim() : '';
  const rawImages = form.getAll('images'); const legacy = form.get('image'); if (legacy !== null) rawImages.push(legacy);
  if (rawImages.some(item => !(item instanceof File))) throw new AppError('INVALID_IMAGE', 'Некорректное изображение', 400);
  const images = (rawImages as File[]).filter(file => file.size > 0);
  if (images.length > MINIAPP_IMAGE_MAX_COUNT) throw new AppError('TOO_MANY_IMAGES', 'Можно выбрать не больше 10 изображений', 400);
  if (text.length > MINIAPP_TEXT_MAX_LENGTH) throw new AppError('INVALID_TEXT', `Текст должен быть короче ${MINIAPP_TEXT_MAX_LENGTH + 1} символов`, 400);
  if (!text && !images.length) throw new AppError('EMPTY_PUBLICATION', 'Добавьте текст или изображение', 400);
  for (const image of images) { if (!image.type.toLowerCase().startsWith('image/')) throw new AppError('INVALID_IMAGE_TYPE', 'Можно выбрать только изображения', 400); if (image.size > MINIAPP_IMAGE_MAX_BYTES) throw new AppError('IMAGE_TOO_LARGE', 'Каждое изображение должно быть не больше 10 МБ', 400); }
  return { text, images };
}
export async function publishFromMiniApp(request: Request, env: Env) {
  const { account } = await miniAppAccount(request, env); const target = await getManagedPublicationTarget(env, account.userId); if (!target) throw new AppError('MANAGED_TELEGRAM_NOT_CONNECTED', 'Подключите персонального Telegram-бота и группу', 409);
  const { text, images } = await readMiniAppPublication(request);
  const token = await decryptManagedBotToken(target.telegram_bot_id, { ciphertext: target.token_ciphertext, iv: target.token_iv, keyVersion: target.token_key_version }, env);
  return { ok: true, publication: await publishTelegramWithToken(token, text, images, target.telegram_chat_id) };
}
export async function previewFromMiniApp(request: Request, env: Env) {
  const { account, telegramUserId } = await miniAppAccount(request, env); const target = await getManagedPreviewTarget(env, account.userId); if (!target) throw new AppError('MANAGED_TELEGRAM_NOT_CONNECTED', 'Персональный Telegram-бот не подключён', 409);
  const { text, images } = await readMiniAppPublication(request);
  const token = await decryptManagedBotToken(target.telegram_bot_id, { ciphertext: target.token_ciphertext, iv: target.token_iv, keyVersion: target.token_key_version }, env);
  try { return { ok: true, publication: await publishTelegramWithToken(token, text, images, telegramUserId) }; }
  catch (error) { if (error instanceof AppError) throw error; throw new AppError('TELEGRAM_PREVIEW_FAILED', 'Не удалось отправить предпросмотр. Откройте личный чат с персональным ботом и нажмите Start.', 409); }
}
