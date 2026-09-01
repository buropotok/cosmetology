import worker from './index';
import { vkMiniAppHtml } from './vk-miniapp';
import { createVkHandoff, getVkHandoff, getVkHandoffImage, uploadVkHandoffImage } from './services/vk-handoff';
import { createVkOnboardingHandoff, getVkOnboardingHandoff, selectVkOnboardingGroup } from './services/vk-onboarding';
import { getMiniAppDraft, saveMiniAppDraft, getMiniAppDraftImage } from './services/miniapp-drafts';
import { validateTelegramMiniAppInitData } from './services/telegram-miniapp-auth';
import { resolveOrCreateTelegramIdentity } from './services/telegram-identity';
import { sendTelegramText } from './services/telegram';
import { adminHtml, listAdminUsers, resetAdminOnboarding } from './admin';
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
   const note=document.createElement('p');note.textContent='Если VK попросит отключить VPN: отключите VPN, вернитесь в Telegram в чат Cosmo Sofa и нажмите резервную ссылку на публикацию в VK.';note.style.cssText='margin:0 0 18px;line-height:1.45';
   const link=document.createElement('a');link.href=vkUrl;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Продолжить в VK';link.style.cssText='display:block;text-align:center;text-decoration:none;background:var(--tg-theme-button-color,#2481cc);color:var(--tg-theme-button-text-color,#fff);padding:13px 16px;border-radius:12px;font-weight:600';
   const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Отмена';cancel.style.cssText='width:100%;margin-top:10px;padding:12px;border:0;background:transparent;color:var(--tg-theme-link-color,#2481cc);font:inherit';cancel.addEventListener('click',()=>overlay.remove());
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
const vkSettingsOverride = String.raw`
;(()=>{
 const tg=window.Telegram?.WebApp,$=s=>document.querySelector(s);
 const auth=()=>({Authorization:'tma '+(tg?.initData||'')});
 const prepare=()=>{const s=$('#vk-group-screen'),b=$('#paste-vk-group');if(!s||!b)return;b.textContent='Выбрать группу';b.dataset.vkNativePicker='1';const m=$('#vk-manual-paste'),a=$('#vk-paste-alert');if(m)m.hidden=true;if(a)a.hidden=true;const p=s.querySelector('.onboarding-hero p');if(p)p.textContent='Выберите сообщество ВКонтакте, которым вы управляете.'};
 const show=()=>{prepare();const s=$('#vk-group-screen');if(!s)return;document.querySelectorAll('.onboarding-step-screen').forEach(x=>x.hidden=x!==s);const settings=$('#settings-screen'),composer=$('#composer-screen');if(settings)settings.hidden=true;if(composer)composer.hidden=true;s.hidden=false;scrollTo(0,0)};
 const open=async b=>{if(!tg?.initData){tg?.showAlert?.('Откройте Cosmo Sofa внутри Telegram.');return}b.disabled=true;const old=b.textContent;b.textContent='Открываем VK…';try{const r=await fetch('/api/miniapp/vk-onboarding',{method:'POST',headers:{...auth(),'Content-Type':'application/json'},body:'{}'}),d=await r.json().catch(()=>null);if(!r.ok||!d?.vkUrl)throw Error(d?.error?.message||'Не удалось открыть выбор группы.');tg?.openLink?tg.openLink(d.vkUrl,{try_instant_view:false}):location.assign(d.vkUrl)}catch(e){tg?.showAlert?tg.showAlert(e?.message||'Не удалось открыть выбор группы.'):alert(e?.message||'Не удалось открыть выбор группы.')}finally{b.disabled=false;b.textContent=old}};
 document.addEventListener('click',e=>{const edit=e.target.closest?.('#edit-vk-group');if(edit){e.preventDefault();e.stopImmediatePropagation();show();return}const b=e.target.closest?.('#paste-vk-group');if(b){e.preventDefault();e.stopImmediatePropagation();open(b)}},true);
 prepare();
})();`;

async function sendVkLinkBackup(req: Request, env: Env) {
  const initData = req.headers.get('authorization')?.match(/^tma\s+(.+)$/i)?.[1] ?? '';
  const validated = await validateTelegramMiniAppInitData(initData, env.TELEGRAM_BOT_TOKEN);
  const account = await resolveOrCreateTelegramIdentity(env, String(validated.user.id));
  const group = await env.DB.prepare('SELECT group_id AS groupId FROM user_vk_group WHERE user_id=?').bind(account.userId).first<{ groupId: number }>();
  const groupId = Number(group?.groupId);
  if (!Number.isSafeInteger(groupId) || groupId <= 0) throw new AppError('VK_GROUP_NOT_CONNECTED', 'Группа VK не подключена', 409);
  const vkUrl = `https://m.vk.ru/new_post/-${groupId}?redirect_url=${encodeURIComponent(`https://m.vk.ru/club${groupId}`)}&creation_entry_point=group_wall_button&screen=group`;
  await sendTelegramText(env, String(validated.user.id), `Резервная ссылка на публикацию VK:\n${vkUrl}`);
  return { ok: true, vkUrl };
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(req.url);
    try {
      if (req.method === 'GET' && url.pathname === '/app.js') {
        const asset = await env.ASSETS.fetch(req); const source = await asset.text();
        return new Response(`${source}\nimport('/drafts.js').catch(error=>console.warn('Draft client load failed',error));\n${vkLinkBackup}`, { headers: { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' } });
      }
      if (req.method === 'GET' && url.pathname === '/settings.js') {
        const asset = await env.ASSETS.fetch(req); const source = await asset.text();
        return new Response(`${source}\n${vkSettingsOverride}`, { headers: { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' } });
      }
      if (req.method === 'POST' && url.pathname === '/api/miniapp/vk-link') return json(await sendVkLinkBackup(req, env));
      if (req.method === 'GET' && url.pathname === '/api/miniapp/draft') return json(await getMiniAppDraft(req, env));
      if (req.method === 'POST' && url.pathname === '/api/miniapp/draft') return json(await saveMiniAppDraft(req, env));
      const draftImage = url.pathname.match(/^\/api\/miniapp\/draft\/image\/(.+)$/);
      if (req.method === 'GET' && draftImage) return getMiniAppDraftImage(req, env, decodeURIComponent(draftImage[1]));
      if (req.method === 'GET' && (url.pathname === '/admin' || url.pathname === '/admin/')) return new Response(adminHtml(), { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });
      if (req.method === 'GET' && url.pathname === '/api/admin/users') return json(await listAdminUsers(req, env));
      const adminReset = url.pathname.match(/^\/api\/admin\/users\/([^/]+)\/reset-onboarding$/);
      if (req.method === 'POST' && adminReset) return json(await resetAdminOnboarding(req, env, decodeURIComponent(adminReset[1])));
      if (req.method === 'GET' && (url.pathname === '/vk-test' || url.pathname === '/vk-test/')) return new Response(vkMiniAppHtml, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });
      if (req.method === 'POST' && url.pathname === '/api/miniapp/vk-onboarding') return json(await createVkOnboardingHandoff(req, env), 201);
      const vkOnboarding = url.pathname.match(/^\/api\/vk-onboarding\/([A-Za-z0-9_-]+)$/);
      if (vkOnboarding && req.method === 'OPTIONS') return new Response(null, { status: 204, headers: onboardingCors });
      if (vkOnboarding && req.method === 'GET' && url.searchParams.get('select') === '1') {
        const body = JSON.stringify({
          vkUserId: url.searchParams.get('vkUserId') ?? '',
          groupId: url.searchParams.get('groupId') ?? '',
          groupName: url.searchParams.get('groupName') ?? '',
          screenName: url.searchParams.get('screenName') ?? '',
        });
        const syntheticRequest = new Request(req.url, { method: 'POST', headers: { 'content-type': 'application/json' }, body });
        return json(await selectVkOnboardingGroup(env, vkOnboarding[1], syntheticRequest, ctx), 200, onboardingCors);
      }
      if (vkOnboarding && req.method === 'GET') return json(await getVkOnboardingHandoff(env, vkOnboarding[1]), 200, onboardingCors);
      if (vkOnboarding && req.method === 'POST') return json(await selectVkOnboardingGroup(env, vkOnboarding[1], req, ctx), 200, onboardingCors);
      if (req.method === 'POST' && url.pathname === '/api/miniapp/vk-handoff') return json(await createVkHandoff(req, env, ctx), 201);
      const handoffMatch = url.pathname.match(/^\/api\/vk-handoff\/([A-Za-z0-9_-]+)$/);
      if (req.method === 'GET' && handoffMatch) return json(await getVkHandoff(env, handoffMatch[1], url.origin));
      const handoffUploadMatch = url.pathname.match(/^\/api\/vk-handoff-upload\/([A-Za-z0-9_-]+)$/);
      if (req.method === 'POST' && handoffUploadMatch) return json(await uploadVkHandoffImage(env, handoffUploadMatch[1], req));
      const handoffImageMatch = url.pathname.match(/^\/api\/vk-handoff-image\/([A-Za-z0-9_-]+)$/);
      if (req.method === 'GET' && handoffImageMatch) { const object = await env.IMAGES.get(decodeURIComponent(handoffImageMatch[1])); if (!object) return new Response('Not found', { status: 404 }); const headers = new Headers(); object.writeHttpMetadata(headers); headers.set('etag', object.httpEtag); headers.set('cache-control', 'public, max-age=300'); headers.set('x-content-type-options', 'nosniff'); return new Response(object.body, { headers }); }
      if (req.method === 'GET' && url.pathname === '/vk-test-image') { const object = await env.IMAGES.get(VK_TEST_IMAGE_KEY); if (!object) return new Response('Not found', { status: 404 }); const headers = new Headers(); object.writeHttpMetadata(headers); headers.set('etag', object.httpEtag); headers.set('cache-control', 'public, max-age=300'); headers.set('x-content-type-options', 'nosniff'); return new Response(object.body, { headers }); }
      return worker.fetch(req, env);
    } catch (error) {
      const err = error instanceof AppError ? error : new AppError('INTERNAL_ERROR', 'Внутренняя ошибка сервера');
      if (!(error instanceof AppError)) console.error(error);
      const cors = url.pathname.startsWith('/api/vk-onboarding/') ? onboardingCors : {};
      return json({ error: { code: err.code, message: err.message } }, err.status, cors);
    }
  },
};