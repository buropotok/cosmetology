import worker from './index';
import { vkMiniAppHtml } from './vk-miniapp';
import { createVkHandoff, getVkHandoff, getVkHandoffImage, uploadVkHandoffImage } from './services/vk-handoff';
import { createVkOnboardingHandoff, getVkOnboardingHandoff, selectVkOnboardingGroup } from './services/vk-onboarding';
import { getMiniAppDraft, saveMiniAppDraft, getMiniAppDraftImage } from './services/miniapp-drafts';
import { adminHtml, listAdminUsers, resetAdminOnboarding } from './admin';
import { AppError, type Env } from './types';

const VK_TEST_IMAGE_KEY = 'posts/2026/08/10.png';
const json = (body: unknown, status = 200, extra: HeadersInit = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra } });
const onboardingCors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'GET, POST, OPTIONS' };
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

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(req.url);
    try {
      if (req.method === 'GET' && url.pathname === '/app.js') {
        const asset = await env.ASSETS.fetch(req); const source = await asset.text();
        return new Response(`${source}\nimport('/drafts.js').catch(error=>console.warn('Draft client load failed',error));`, { headers: { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' } });
      }
      if (req.method === 'GET' && url.pathname === '/settings.js') {
        const asset = await env.ASSETS.fetch(req); const source = await asset.text();
        return new Response(`${source}\n${vkSettingsOverride}`, { headers: { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' } });
      }
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
      if (req.method === 'GET' && handoffImageMatch) { const object = await getVkHandoffImage(env, handoffImageMatch[1]); if (!object) return new Response('Not found', { status: 404 }); const headers = new Headers(); object.writeHttpMetadata(headers); headers.set('etag', object.httpEtag); headers.set('cache-control', 'public, max-age=300'); headers.set('x-content-type-options', 'nosniff'); return new Response(object.body, { headers }); }
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
