import { AppError, type Env } from './types';

function requireAdmin(req: Request, env: Env) {
  const expected = env.ADMIN_TOKEN?.trim();
  if (!expected) throw new AppError('ADMIN_NOT_CONFIGURED', 'ADMIN_TOKEN is not configured', 503);
  const supplied = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  if (!supplied || supplied !== expected) throw new AppError('UNAUTHORIZED', 'Admin authorization required', 401);
}

async function requireUser(env: Env, userId: string) {
  const user = await env.DB.prepare('SELECT id FROM users WHERE id=?').bind(userId).first();
  if (!user) throw new AppError('NOT_FOUND', 'Пользователь не найден', 404);
}

export async function listAdminUsers(req: Request, env: Env) {
  requireAdmin(req, env);
  const { results } = await env.DB.prepare(`
    SELECT u.id,u.google_sub,u.created_at,u.updated_at,
      (SELECT ti.telegram_user_id FROM telegram_identities ti WHERE ti.user_id=u.id LIMIT 1) AS telegram_user_id,
      (SELECT mb.telegram_bot_id FROM telegram_managed_bots mb WHERE mb.user_id=u.id AND mb.status='active' ORDER BY mb.created_at DESC LIMIT 1) AS telegram_bot_id,
      (SELECT mb.username FROM telegram_managed_bots mb WHERE mb.user_id=u.id AND mb.status='active' ORDER BY mb.created_at DESC LIMIT 1) AS bot_username,
      (SELECT mb.display_name FROM telegram_managed_bots mb WHERE mb.user_id=u.id AND mb.status='active' ORDER BY mb.created_at DESC LIMIT 1) AS bot_name,
      (SELECT mb.created_at FROM telegram_managed_bots mb WHERE mb.user_id=u.id AND mb.status='active' ORDER BY mb.created_at DESC LIMIT 1) AS bot_created_at,
      (SELECT d.telegram_chat_id FROM telegram_managed_bot_destinations d WHERE d.user_id=u.id AND d.status='active' ORDER BY d.updated_at DESC LIMIT 1) AS telegram_group_id,
      (SELECT d.chat_title FROM telegram_managed_bot_destinations d WHERE d.user_id=u.id AND d.status='active' ORDER BY d.updated_at DESC LIMIT 1) AS telegram_group_title,
      (SELECT d.created_at FROM telegram_managed_bot_destinations d WHERE d.user_id=u.id AND d.status='active' ORDER BY d.updated_at DESC LIMIT 1) AS telegram_group_created_at,
      (SELECT vg.group_id FROM user_vk_group vg WHERE vg.user_id=u.id LIMIT 1) AS vk_group_id,
      (SELECT vg.group_name FROM user_vk_group vg WHERE vg.user_id=u.id LIMIT 1) AS vk_group_name,
      (SELECT vg.group_url FROM user_vk_group vg WHERE vg.user_id=u.id LIMIT 1) AS vk_group_url,
      (SELECT vg.updated_at FROM user_vk_group vg WHERE vg.user_id=u.id LIMIT 1) AS vk_group_created_at
    FROM users u ORDER BY u.created_at DESC
  `).all();
  return { users: results };
}

export async function deleteAdminTelegramGroup(req: Request, env: Env, userId: string) {
  requireAdmin(req, env); await requireUser(env, userId);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM telegram_managed_bot_group_pairings WHERE user_id=?').bind(userId),
    env.DB.prepare('DELETE FROM telegram_managed_bot_destinations WHERE user_id=?').bind(userId),
    env.DB.prepare("DELETE FROM user_onboarding_skip WHERE user_id=? AND step IN ('telegram_group','telegram_preview')").bind(userId),
  ]);
  return { ok: true, user_id: userId };
}

export async function deleteAdminTelegramBot(req: Request, env: Env, userId: string) {
  requireAdmin(req, env); await requireUser(env, userId);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM telegram_managed_bot_group_pairings WHERE user_id=?').bind(userId),
    env.DB.prepare('DELETE FROM telegram_managed_bot_destinations WHERE user_id=?').bind(userId),
    env.DB.prepare('DELETE FROM telegram_managed_bots WHERE user_id=?').bind(userId),
    env.DB.prepare("DELETE FROM user_onboarding_skip WHERE user_id=? AND step IN ('telegram_bot','telegram_group','telegram_preview')").bind(userId),
  ]);
  return { ok: true, user_id: userId };
}

export async function deleteAdminVkGroup(req: Request, env: Env, userId: string) {
  requireAdmin(req, env); await requireUser(env, userId);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM vk_handoffs WHERE user_id=?').bind(userId),
    env.DB.prepare('DELETE FROM vk_onboarding_handoffs WHERE user_id=?').bind(userId),
    env.DB.prepare('DELETE FROM vk_backup_messages WHERE user_id=?').bind(userId),
    env.DB.prepare('DELETE FROM user_vk_group WHERE user_id=?').bind(userId),
    env.DB.prepare("DELETE FROM user_onboarding_skip WHERE user_id=? AND step='vk_group'").bind(userId),
  ]);
  return { ok: true, user_id: userId };
}

export async function deleteAdminUser(req: Request, env: Env, userId: string) {
  requireAdmin(req, env); await requireUser(env, userId);
  const [postImages, draftImages] = await Promise.all([
    env.DB.prepare('SELECT image_key FROM posts WHERE user_id=? AND image_key IS NOT NULL').bind(userId).all<{ image_key: string }>(),
    env.DB.prepare('SELECT r2_key FROM miniapp_draft_images WHERE user_id=?').bind(userId).all<{ r2_key: string }>(),
  ]);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM telegram_managed_bots WHERE user_id=?').bind(userId),
    env.DB.prepare('DELETE FROM user_vk_group WHERE user_id=?').bind(userId),
    env.DB.prepare('DELETE FROM user_onboarding_skip WHERE user_id=?').bind(userId),
    env.DB.prepare('DELETE FROM posts WHERE user_id=?').bind(userId),
    env.DB.prepare('DELETE FROM users WHERE id=?').bind(userId),
  ]);
  const keys = new Set([...(postImages.results || []).map(x => x.image_key), ...(draftImages.results || []).map(x => x.r2_key)].filter(Boolean));
  await Promise.all([...keys].map(key => env.IMAGES.delete(key).catch(() => undefined)));
  return { ok: true, user_id: userId, fully_deleted: true };
}

export function adminHtml() {
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cosmo Sofa Admin</title><style>
*{box-sizing:border-box}body{margin:0;background:#f4f5f7;color:#16181d;font:14px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.wrap{max-width:1180px;margin:auto;padding:28px 18px 60px}h1{font-size:28px;margin:0}.muted{color:#727780}.auth,.user{background:#fff;border:1px solid #e2e5e9;border-radius:16px}.auth{display:flex;gap:10px;padding:14px;margin:18px 0}input{width:100%;border:1px solid #ccd0d5;border-radius:10px;padding:11px 12px;font:inherit}button{border:0;border-radius:9px;padding:10px 13px;font:600 13px inherit;cursor:pointer;background:#2481cc;color:#fff}button.danger{background:#e5484d}button.ghost-danger{background:#fff;color:#c62f35;border:1px solid #e9b8ba}button:disabled{opacity:.38;cursor:default}.users{display:grid;gap:16px}.user{overflow:hidden}.user-head{padding:16px 18px;border-bottom:1px solid #eceef1;display:flex;justify-content:space-between;gap:16px;align-items:center}.uid{font-weight:700}.small{font-size:12px}.services{display:grid;grid-template-columns:repeat(3,1fr)}.service{padding:18px;border-right:1px solid #eceef1;min-height:210px;display:flex;flex-direction:column}.service:last-child{border-right:0}.service-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:15px}.service-title{font-weight:750;font-size:15px}.state{font-size:12px;font-weight:700;padding:4px 8px;border-radius:999px}.yes{background:#e9f7ee;color:#18753c}.no{background:#f0f1f2;color:#747980}.details{display:grid;gap:7px;line-height:1.35}.label{color:#7a7f87;font-size:12px}.value{font-weight:600;word-break:break-word}.service button{margin-top:auto;align-self:flex-start}.danger-zone{border-top:1px solid #eceef1;padding:14px 18px;display:flex;align-items:center;justify-content:space-between;gap:16px;background:#fffafa}.empty{padding:30px;text-align:center}.status{margin:0 0 14px}@media(max-width:760px){.services{grid-template-columns:1fr}.service{border-right:0;border-bottom:1px solid #eceef1}.auth,.user-head,.danger-zone{flex-direction:column;align-items:stretch}}
</style></head><body><main class="wrap"><h1>Cosmo Sofa Admin</h1><div class="muted">Пользователи и подключения публикации</div><div class="auth"><input id="token" type="password" placeholder="ADMIN_TOKEN"><button id="load">Показать пользователей</button></div><div id="status" class="muted status"></div><div id="users" class="users"></div></main><script>
(()=>{const token=document.querySelector('#token'),users=document.querySelector('#users'),status=document.querySelector('#status'),loadBtn=document.querySelector('#load');token.value=sessionStorage.getItem('adminToken')||'';
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=s=>s?new Date(String(s).replace(' ','T')+'Z').toLocaleString('ru-RU'):'—';
async function api(path,opts={}){const t=token.value.trim();sessionStorage.setItem('adminToken',t);opts.headers={...(opts.headers||{}),Authorization:'Bearer '+t};const r=await fetch(path,opts),d=await r.json().catch(()=>null);if(!r.ok)throw new Error(d?.error?.message||'Ошибка запроса');return d}
function state(ok){return '<span class="state '+(ok?'yes':'no')+'">'+(ok?'● Есть':'○ Нет')+'</span>'}
function field(label,value){return '<div><div class="label">'+label+'</div><div class="value">'+esc(value||'—')+'</div></div>'}
function service(title,ok,fields,action,label){return '<div class="service"><div class="service-head"><div class="service-title">'+title+'</div>'+state(ok)+'</div><div class="details">'+fields.join('')+'</div><button class="danger" data-action="'+action+'" '+(!ok?'disabled':'')+'>'+label+'</button></div>'}
function card(u){const id=esc(u.id),bot=!!u.telegram_bot_id,tg=!!u.telegram_group_id,vk=!!u.vk_group_id;return '<section class="user"><div class="user-head"><div><div class="uid">'+id+'</div><div class="muted small">Telegram user: '+esc(u.telegram_user_id||'—')+' · Создан: '+esc(date(u.created_at))+'</div></div></div><div class="services">'+service('TG Bot',bot,[field('Имя бота',u.bot_name),field('Username',u.bot_username?'@'+u.bot_username:'—'),field('Bot ID',u.telegram_bot_id),field('Создан',date(u.bot_created_at))],'telegram-bot','Удалить бота')+service('TG Group',tg,[field('Title',u.telegram_group_title),field('Chat ID',u.telegram_group_id),field('Создана',date(u.telegram_group_created_at))],'telegram-group','Удалить TG-группу')+service('VK Group',vk,[field('Title',u.vk_group_name),field('Group ID',u.vk_group_id),field('URL',u.vk_group_url),field('Дата записи',date(u.vk_group_created_at))],'vk-group','Удалить VK-группу')+'</div><div class="danger-zone"><div><b>Удаление пользователя</b><div class="muted small">Удаляет аккаунт, подключения, публикации и связанные данные.</div></div><button class="ghost-danger" data-action="user">Удалить пользователя целиком</button></div></section>'}
async function load(){status.textContent='Загрузка…';users.innerHTML='';try{const d=await api('/api/admin/users');status.textContent='Пользователей: '+d.users.length;users.innerHTML=d.users.length?d.users.map(card).join(''):'<div class="user empty muted">Пользователей нет</div>'}catch(e){status.textContent=e.message||String(e)}}
loadBtn.addEventListener('click',load);users.addEventListener('click',async e=>{const b=e.target.closest('[data-action]');if(!b||b.disabled)return;const card=b.closest('.user'),id=card.querySelector('.uid').textContent,action=b.dataset.action;let path,method='DELETE',message;if(action==='telegram-bot'){path='/api/admin/users/'+encodeURIComponent(id)+'/telegram-bot';message='Удалить Telegram-бота? Подключенная TG-группа также будет удалена.'}else if(action==='telegram-group'){path='/api/admin/users/'+encodeURIComponent(id)+'/telegram-group';message='Удалить подключение Telegram-группы? Бот останется.'}else if(action==='vk-group'){path='/api/admin/users/'+encodeURIComponent(id)+'/vk-group';message='Удалить подключение VK-группы?'}else{path='/api/admin/users/'+encodeURIComponent(id);message='ПОЛНОСТЬЮ удалить пользователя '+id+'? Будут удалены аккаунт, подключения и история публикаций.'}if(!confirm(message))return;b.disabled=true;try{await api(path,{method});await load()}catch(x){alert(x.message||String(x));b.disabled=false}});})();
</script></body></html>`;
}
