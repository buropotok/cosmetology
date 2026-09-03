import worker from './index';
import { vkMiniAppHtml } from './vk-miniapp';
import { createVkHandoff, getVkHandoff, getVkHandoffImage, uploadVkHandoffImage } from './services/vk-handoff';
import { createVkOnboardingHandoff, getVkOnboardingHandoff, selectVkOnboardingGroup } from './services/vk-onboarding';
import { getMiniAppDraft, saveMiniAppDraft, getMiniAppDraftImage } from './services/miniapp-drafts';
import { validateTelegramMiniAppInitData } from './services/telegram-miniapp-auth';
import { resolveOrCreateTelegramIdentity } from './services/telegram-identity';
import { adminHtml, listAdminUsers, deleteAdminTelegramBot, deleteAdminTelegramGroup, deleteAdminVkGroup, deleteAdminUser } from './admin';
import { AppError, type Env } from './types';

const VK_TEST_IMAGE_KEY = 'posts/2026/08/10.png';
const json = (body: unknown, status = 200, extra: HeadersInit = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra } });
const onboardingCors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'GET, POST, OPTIONS' };
const vkLinkBackup = String.raw`
;(()=>{
 const tg=window.Telegram?.WebApp;
 const status=document.querySelector('#status'),button=document.querySelector('#publish-vk'),text=document.querySelector('#text'),image=document.querySelector('#image');
 const setStatus=(message,kind='')=>{if(status){status.textContent=message;status.className=kind}};
 function showModal(vkUrl){
   document.querySelector('#vk-publish-modal')?.remove();
   const overlay=document.createElement('div');overlay.id='vk-publish-modal';overlay.style.cssText='position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.42);display:flex;align-items:flex-end;justify-content:center;padding:16px;box-sizing:border-box';
   const card=document.createElement('div');card.style.cssText='width:min(100%,520px);background:var(--tg-theme-bg-color,#fff);color:var(--tg-theme-text-color,#111);border-radius:20px;padding:20px;box-sizing:border-box;box-shadow:0 12px 40px rgba(0,0,0,.25)';
   const title=document.createElement('strong');title.textContent='Публикация в VK';title.style.cssText='display:block;font-size:20px;margin-bottom:10px';
   const note=document.createElement('p');note.style.cssText='margin:0 0 18px;line-height:1.55;white-space:pre-line';note.textContent='1. Отключите VPN\n2. Вернитесь сюда и нажмите "Продолжить".';
   const link=document.createElement('a');link.href=vkUrl;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Продолжить';link.style.cssText='display:block;text-align:center;text-decoration:none;background:var(--tg-theme-button-color,#2481cc);color:var(--tg-theme-button-text-color,#fff);padding:13px 16px;border-radius:12px;font-weight:600';
   const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Отмена';cancel.style.cssText='width:100%;margin-top:8px;padding:12px;border:0;background:transparent;color:var(--tg-theme-link-color,#2481cc);font:inherit';cancel.addEventListener('click',()=>overlay.remove());
   card.append(title,note,link,cancel);overlay.append(card);overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.remove()});document.body.append(overlay);
 }
 document.addEventListener('click',async event=>{
   if(!event.target.closest?.('#publish-vk')||!tg?.initData)return;
   event.preventDefault();event.stopImmediatePropagation();
   const hasText=Boolean(text?.value?.trim()),hasImages=Boolean(image?.files?.length);if(!hasText&&!hasImages){setStatus('Добавьте текст или изображение.','error');return}
   if(button){button.disabled=true;button.textContent='Подготавливаем…'}
   try{
     const response=await fetch('/api/miniapp/vk-link',{method:'POST',headers:{Authorization:'tma '+tg.initData},body:''});
     const result=await response.json().catch(()=>null);if(!response.ok||!result?.vkUrl)throw new Error(result?.error?.message||'Не удалось подготовить публикацию VK.');
     if(hasText){try{await navigator.clipboard.writeText(text.value)}catch{setStatus('Не удалось скопировать текст. Скопируйте его вручную перед публикацией.','error')}}
     showModal(result.vkUrl);
   }catch(error){setStatus(error instanceof Error?error.message:'Не удалось подготовить публикацию VK.','error')}
   finally{if(button){button.disabled=false;button.textContent='Открыть в VK'}}
 },true);
})();`;

async function sendVkLinkBackup(req: Request, env: Env) {
  const initData = req.headers.get('authorization')?.match(/^tma\s+(.+)$/i)?.[1] ?? '';
  const validated = await validateTelegramMiniAppInitData(initData, env.TELEGRAM_BOT_TOKEN);
  const account = await resolveOrCreateTelegramIdentity(env, String(validated.user.id));
  const group = await env.DB.prepare('SELECT group_id AS groupId FROM user_vk_group WHERE user_id=?').bind(account.userId).first<{ groupId: number }>();
  const groupId = Number(group?.groupId);
  if (!Number.isSafeInteger(groupId) || groupId <= 0) throw new AppError('VK_GROUP_NOT_CONNECTED', 'Группа VK не подключена', 409);
  const vkUrl = `https://m.vk.ru/new_post/-${groupId}?redirect_url=${encodeURIComponent(`https://m.vk.ru/club${groupId}`)}&creation_entry_point=group_wall_button&screen=group`;
  const chatId = String(validated.user.id);
  const previous = await env.DB.prepare('SELECT message_id AS messageId FROM vk_backup_messages WHERE user_id=?').bind(account.userId).first<{ messageId: number }>();
  if (previous?.messageId) {
    const deleteBody = new FormData(); deleteBody.set('chat_id', chatId); deleteBody.set('message_id', String(previous.messageId));
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/deleteMessage`, { method: 'POST', body: deleteBody }).catch(() => null);
  }
  const sendBody = new FormData(); sendBody.set('chat_id', chatId); sendBody.set('text', 'Публикация в VK\nЕсли переход прервался, используйте резервную ссылку.');
  sendBody.set('reply_markup', JSON.stringify({ inline_keyboard: [[{ text: 'Резервная ссылка', url: vkUrl }]] }));
  const sentResponse = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, { method: 'POST', body: sendBody });
  const sent: any = await sentResponse.json().catch(() => null);
  if (!sentResponse.ok || !sent?.ok || !sent?.result?.message_id) throw new AppError('TELEGRAM_ERROR', 'Не удалось отправить резервную ссылку', 502);
  await env.DB.prepare('INSERT INTO vk_backup_messages(user_id,telegram_chat_id,message_id,updated_at) VALUES(?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO UPDATE SET telegram_chat_id=excluded.telegram_chat_id,message_id=excluded.message_id,updated_at=CURRENT_TIMESTAMP').bind(account.userId, chatId, sent.result.message_id).run();
  return { ok: true, vkUrl };
}

export default { async fetch(req: Request, env: Env, ctx: ExecutionContext) {
  const url = new URL(req.url);
  try {
    if (req.method === 'GET' && url.pathname === '/app.js') { const asset=await env.ASSETS.fetch(req);const source=await asset.text();return new Response(`${source}\nimport('/drafts.js').catch(error=>console.warn('Draft client load failed',error));\n${vkLinkBackup}`,{headers:{'content-type':'text/javascript; charset=utf-8','cache-control':'no-store'}}); }
    if (req.method === 'GET' && url.pathname === '/settings.js') { const asset=await env.ASSETS.fetch(req);const source=await asset.text();return new Response(`${source}\nimport('/vk-onboarding.js').catch(error=>console.warn('VK onboarding state load failed',error));`,{headers:{'content-type':'text/javascript; charset=utf-8','cache-control':'no-store'}}); }
    if (req.method === 'POST' && url.pathname === '/api/miniapp/vk-link') return json(await sendVkLinkBackup(req,env));
    if (req.method === 'GET' && url.pathname === '/api/miniapp/draft') return json(await getMiniAppDraft(req,env));
    if (req.method === 'POST' && url.pathname === '/api/miniapp/draft') return json(await saveMiniAppDraft(req,env));
    const draftImage=url.pathname.match(/^\/api\/miniapp\/draft\/image\/(.+)$/);if(req.method==='GET'&&draftImage)return getMiniAppDraftImage(req,env,decodeURIComponent(draftImage[1]));
    if(req.method==='GET'&&(url.pathname==='/admin'||url.pathname==='/admin/'))return new Response(adminHtml(),{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
    if(req.method==='GET'&&url.pathname==='/api/admin/users')return json(await listAdminUsers(req,env));
    const adminBot=url.pathname.match(/^\/api\/admin\/users\/([^/]+)\/telegram-bot$/);if(req.method==='DELETE'&&adminBot)return json(await deleteAdminTelegramBot(req,env,decodeURIComponent(adminBot[1])));
    const adminTg=url.pathname.match(/^\/api\/admin\/users\/([^/]+)\/telegram-group$/);if(req.method==='DELETE'&&adminTg)return json(await deleteAdminTelegramGroup(req,env,decodeURIComponent(adminTg[1])));
    const adminVk=url.pathname.match(/^\/api\/admin\/users\/([^/]+)\/vk-group$/);if(req.method==='DELETE'&&adminVk)return json(await deleteAdminVkGroup(req,env,decodeURIComponent(adminVk[1])));
    const adminUser=url.pathname.match(/^\/api\/admin\/users\/([^/]+)$/);if(req.method==='DELETE'&&adminUser)return json(await deleteAdminUser(req,env,decodeURIComponent(adminUser[1])));
    if(req.method==='GET'&&(url.pathname==='/vk-test'||url.pathname==='/vk-test/'))return new Response(vkMiniAppHtml,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
    if(req.method==='POST'&&url.pathname==='/api/miniapp/vk-onboarding')return json(await createVkOnboardingHandoff(req,env),201);
    const vkOnboarding=url.pathname.match(/^\/api\/vk-onboarding\/([A-Za-z0-9_-]+)$/);if(vkOnboarding&&req.method==='OPTIONS')return new Response(null,{status:204,headers:onboardingCors});
    if(vkOnboarding&&req.method==='GET'&&url.searchParams.get('select')==='1'){const body=JSON.stringify({vkUserId:url.searchParams.get('vkUserId')??'',groupId:url.searchParams.get('groupId')??'',groupName:url.searchParams.get('groupName')??'',screenName:url.searchParams.get('screenName')??''});const syntheticRequest=new Request(req.url,{method:'POST',headers:{'content-type':'application/json'},body});return json(await selectVkOnboardingGroup(env,vkOnboarding[1],syntheticRequest,ctx),200,onboardingCors)}
    if(vkOnboarding&&req.method==='GET')return json(await getVkOnboardingHandoff(env,vkOnboarding[1]),200,onboardingCors);if(vkOnboarding&&req.method==='POST')return json(await selectVkOnboardingGroup(env,vkOnboarding[1],req,ctx),200,onboardingCors);
    if(req.method==='POST'&&url.pathname==='/api/miniapp/vk-handoff')return json(await createVkHandoff(req,env,ctx),201);
    const handoffMatch=url.pathname.match(/^\/api\/vk-handoff\/([A-Za-z0-9_-]+)$/);if(req.method==='GET'&&handoffMatch)return json(await getVkHandoff(env,handoffMatch[1],url.origin));
    const handoffUploadMatch=url.pathname.match(/^\/api\/vk-handoff-upload\/([A-Za-z0-9_-]+)$/);if(req.method==='POST'&&handoffUploadMatch)return json(await uploadVkHandoffImage(env,handoffUploadMatch[1],req));
    const handoffImageMatch=url.pathname.match(/^\/api\/vk-handoff-image\/([A-Za-z0-9_-]+)$/);if(req.method==='GET'&&handoffImageMatch){const object=await getVkHandoffImage(env,handoffImageMatch[1]);if(!object)return new Response('Not found',{status:404});const headers=new Headers();object.writeHttpMetadata(headers);headers.set('etag',object.httpEtag);headers.set('cache-control','public, max-age=300');headers.set('x-content-type-options','nosniff');return new Response(object.body,{headers})}
    if(req.method==='GET'&&url.pathname==='/vk-test-image'){const object=await env.IMAGES.get(VK_TEST_IMAGE_KEY);if(!object)return new Response('Not found',{status:404});const headers=new Headers();object.writeHttpMetadata(headers);headers.set('etag',object.httpEtag);headers.set('cache-control','public, max-age=300');headers.set('x-content-type-options','nosniff');return new Response(object.body,{headers})}
    return worker.fetch(req,env);
  } catch(error){const err=error instanceof AppError?error:new AppError('INTERNAL_ERROR','Внутренняя ошибка сервера');if(!(error instanceof AppError))console.error(error);const cors=url.pathname.startsWith('/api/vk-onboarding/')?onboardingCors:{};return json({error:{code:err.code,message:err.message}},err.status,cors)}
}};
