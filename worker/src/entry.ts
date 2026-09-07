import worker from './index';
import { createVkHandoff, getVkHandoff, getVkHandoffImage, uploadVkHandoffImage } from './services/vk-handoff';
import { createVkOnboardingHandoff, getVkOnboardingHandoff, selectVkOnboardingGroup } from './services/vk-onboarding';
import { getMiniAppDraft, saveMiniAppDraft, getMiniAppDraftImage } from './services/miniapp-drafts';
import { saveBeforeAfterAsset, removeBeforeAfterAsset, swapBeforeAfterAssets } from './services/before-after-assets';
import { generateMiniAppAiReply } from './services/miniapp-ai';
import { getMiniAppNewsGenerationStatus } from './services/ai-generation-status';
import { generateMiniAppImage } from './services/miniapp-image-generation';
import { validateTelegramMiniAppInitData } from './services/telegram-miniapp-auth';
import { resolveOrCreateTelegramIdentity } from './services/telegram-identity';
import { decryptManagedBotToken } from './services/managed-bot-crypto';
import { deleteTelegramMessageWithToken, getTelegramBotMeWithToken, sendTelegramVkBackupWithToken } from './services/telegram';
import { adminHtml, listAdminUsers, deleteAdminTelegramBot, deleteAdminTelegramGroup, deleteAdminVkGroup, deleteAdminUser } from './admin';
import { AppError, type Env } from './types';

const json = (body: unknown, status = 200, extra: HeadersInit = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra } });
const onboardingCors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'GET, POST, OPTIONS' };

type VkBackupTarget={telegram_bot_id:string;telegram_chat_id:string;token_ciphertext:string;token_iv:string;token_key_version:number};
async function prepareVkLink(req: Request, env: Env) {
  const initData = req.headers.get('authorization')?.match(/^tma\s+(.+)$/i)?.[1] ?? '';
  const validated = await validateTelegramMiniAppInitData(initData, env.TELEGRAM_BOT_TOKEN);
  const account = await resolveOrCreateTelegramIdentity(env, String(validated.user.id));
  const group = await env.DB.prepare('SELECT group_id AS groupId FROM user_vk_group WHERE user_id=?').bind(account.userId).first<{ groupId: number }>();
  const groupId = Number(group?.groupId);
  if (!Number.isSafeInteger(groupId) || groupId <= 0) throw new AppError('VK_GROUP_NOT_CONNECTED', 'Группа VK не подключена', 409);
  const vkUrl = `https://m.vk.ru/new_post/-${groupId}?redirect_url=${encodeURIComponent(`https://m.vk.ru/club${groupId}`)}&creation_entry_point=group_wall_button&screen=group`;
  let body:any={};try{body=await req.json()}catch{}
  const delivery=body?.delivery==='managed_bot'?'managed_bot':'direct';
  if(delivery==='direct')return {ok:true,vkUrl};
  const target=await env.DB.prepare(`SELECT mb.telegram_bot_id,pc.telegram_chat_id,mb.token_ciphertext,mb.token_iv,mb.token_key_version FROM telegram_managed_bots mb JOIN telegram_managed_bot_private_chats pc ON pc.telegram_bot_id=mb.telegram_bot_id AND pc.user_id=mb.user_id AND pc.status='active' JOIN telegram_managed_bot_webhooks wh ON wh.telegram_bot_id=mb.telegram_bot_id AND wh.status='active' WHERE mb.user_id=? AND mb.status='active' AND mb.token_ciphertext IS NOT NULL AND mb.token_iv IS NOT NULL ORDER BY mb.updated_at DESC LIMIT 1`).bind(account.userId).first<VkBackupTarget>();
  if(!target)throw new AppError('MANAGED_TELEGRAM_PREVIEW_NOT_READY','Откройте личный чат с персональным ботом и нажмите Start.',409);
  const token=await decryptManagedBotToken(target.telegram_bot_id,{ciphertext:target.token_ciphertext,iv:target.token_iv,keyVersion:target.token_key_version},env);
  const bot=await getTelegramBotMeWithToken(token);
  if(!bot.username)throw new AppError('TELEGRAM_ERROR','У персонального бота отсутствует username',502);
  const chatId=target.telegram_chat_id;
  const previous = await env.DB.prepare('SELECT message_id AS messageId,telegram_chat_id AS chatId FROM vk_backup_messages WHERE user_id=?').bind(account.userId).first<{ messageId: number;chatId:string }>();
  if (previous?.messageId&&previous.chatId===chatId) await deleteTelegramMessageWithToken(token,chatId,previous.messageId).catch(()=>null);
  const sent:any=await sendTelegramVkBackupWithToken(token,chatId,vkUrl);
  if(!sent?.message_id)throw new AppError('TELEGRAM_ERROR','Не удалось отправить ссылку публикации',502);
  await env.DB.prepare('INSERT INTO vk_backup_messages(user_id,telegram_chat_id,message_id,updated_at) VALUES(?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO UPDATE SET telegram_chat_id=excluded.telegram_chat_id,message_id=excluded.message_id,updated_at=CURRENT_TIMESTAMP').bind(account.userId, chatId, sent.message_id).run();
  return { ok: true, vkUrl, managedBotUrl:`https://t.me/${bot.username}` };
}

export default { async fetch(req: Request, env: Env, ctx: ExecutionContext) {
  const url = new URL(req.url);
  try {
    if (req.method === 'POST' && url.pathname === '/api/miniapp/ai/chat') return json(await generateMiniAppAiReply(req, env));
    if (req.method === 'GET' && url.pathname === '/api/miniapp/news/status') return json(await getMiniAppNewsGenerationStatus(req, env));
    if (req.method === 'POST' && url.pathname === '/api/miniapp/ai/image') return generateMiniAppImage(req, env);
    if (req.method === 'POST' && url.pathname === '/api/miniapp/vk-link') return json(await prepareVkLink(req,env));
    if (req.method === 'GET' && url.pathname === '/api/miniapp/draft') return json(await getMiniAppDraft(req,env));
    if (req.method === 'POST' && url.pathname === '/api/miniapp/draft') return json(await saveMiniAppDraft(req,env));
    if (req.method === 'POST' && url.pathname === '/api/miniapp/before-after/asset') return json(await saveBeforeAfterAsset(req,env),201);
    if (req.method === 'POST' && url.pathname === '/api/miniapp/before-after/remove') return json(await removeBeforeAfterAsset(req,env));
    if (req.method === 'POST' && url.pathname === '/api/miniapp/before-after/swap') return json(await swapBeforeAfterAssets(req,env));
    const draftImage=url.pathname.match(/^\/api\/miniapp\/draft\/image\/(.+)$/);if(req.method==='GET'&&draftImage)return getMiniAppDraftImage(req,env,decodeURIComponent(draftImage[1]));
    if(req.method==='GET'&&(url.pathname==='/admin'||url.pathname==='/admin/'))return new Response(adminHtml(),{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
    if(req.method==='GET'&&url.pathname==='/api/admin/users')return json(await listAdminUsers(req,env));
    const adminBot=url.pathname.match(/^\/api\/admin\/users\/([^/]+)\/telegram-bots\/([^/]+)$/);if(req.method==='DELETE'&&adminBot)return json(await deleteAdminTelegramBot(req,env,decodeURIComponent(adminBot[1]),decodeURIComponent(adminBot[2])));
    const adminTg=url.pathname.match(/^\/api\/admin\/users\/([^/]+)\/telegram-bots\/([^/]+)\/telegram-group$/);if(req.method==='DELETE'&&adminTg)return json(await deleteAdminTelegramGroup(req,env,decodeURIComponent(adminTg[1]),decodeURIComponent(adminTg[2])));
    const adminVk=url.pathname.match(/^\/api\/admin\/users\/([^/]+)\/vk-group$/);if(req.method==='DELETE'&&adminVk)return json(await deleteAdminVkGroup(req,env,decodeURIComponent(adminVk[1])));
    const adminUser=url.pathname.match(/^\/api\/admin\/users\/([^/]+)$/);if(req.method==='DELETE'&&adminUser)return json(await deleteAdminUser(req,env,decodeURIComponent(adminUser[1])));
    if(req.method==='POST'&&url.pathname==='/api/miniapp/vk-onboarding')return json(await createVkOnboardingHandoff(req,env),201);
    const vkOnboarding=url.pathname.match(/^\/api\/vk-onboarding\/([A-Za-z0-9_-]+)$/);if(vkOnboarding&&req.method==='OPTIONS')return new Response(null,{status:204,headers:onboardingCors});
    if(vkOnboarding&&req.method==='GET'&&url.searchParams.get('select')==='1'){const body=JSON.stringify({vkUserId:url.searchParams.get('vkUserId')??'',groupId:url.searchParams.get('groupId')??'',groupName:url.searchParams.get('groupName')??'',screenName:url.searchParams.get('screenName')??''});const syntheticRequest=new Request(req.url,{method:'POST',headers:{'content-type':'application/json'},body});return json(await selectVkOnboardingGroup(env,vkOnboarding[1],syntheticRequest,ctx),200,onboardingCors)}
    if(vkOnboarding&&req.method==='GET')return json(await getVkOnboardingHandoff(env,vkOnboarding[1]),200,onboardingCors);if(vkOnboarding&&req.method==='POST')return json(await selectVkOnboardingGroup(env,vkOnboarding[1],req,ctx),200,onboardingCors);
    if(req.method==='POST'&&url.pathname==='/api/miniapp/vk-handoff')return json(await createVkHandoff(req,env,ctx),201);
    const handoffMatch=url.pathname.match(/^\/api\/vk-handoff\/([A-Za-z0-9_-]+)$/);if(req.method==='GET'&&handoffMatch)return json(await getVkHandoff(env,handoffMatch[1],url.origin));
    const handoffUploadMatch=url.pathname.match(/^\/api\/vk-handoff-upload\/([A-Za-z0-9_-]+)$/);if(req.method==='POST'&&handoffUploadMatch)return json(await uploadVkHandoffImage(env,handoffUploadMatch[1],req));
    const handoffImageMatch=url.pathname.match(/^\/api\/vk-handoff-image\/([A-Za-z0-9_-]+)$/);if(req.method==='GET'&&handoffImageMatch){const object=await getVkHandoffImage(env,handoffImageMatch[1]);if(!object)return new Response('Not found',{status:404});const headers=new Headers();object.writeHttpMetadata(headers);headers.set('etag',object.httpEtag);headers.set('cache-control','public, max-age=300');headers.set('x-content-type-options','nosniff');return new Response(object.body,{headers})}
    return worker.fetch(req,env);
  } catch(error){const err=error instanceof AppError?error:new AppError('INTERNAL_ERROR','Внутренняя ошибка сервера');if(!(error instanceof AppError))console.error(error);const cors=url.pathname.startsWith('/api/vk-onboarding/')?onboardingCors:{};return json({error:{code:err.code,message:err.message}},err.status,cors)}
}};