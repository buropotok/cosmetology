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

async function requireBot(env: Env, userId: string, botId: string) {
  const bot = await env.DB.prepare('SELECT telegram_bot_id FROM telegram_managed_bots WHERE user_id=? AND telegram_bot_id=?').bind(userId, botId).first();
  if (!bot) throw new AppError('NOT_FOUND', 'Telegram-бот не найден у этого пользователя', 404);
}

export async function listAdminUsers(req: Request, env: Env) {
  requireAdmin(req, env);
  const [usersResult, botsResult] = await Promise.all([
    env.DB.prepare(`
      SELECT u.id,u.google_sub,u.created_at,u.updated_at,
        (SELECT ti.telegram_user_id FROM telegram_identities ti WHERE ti.user_id=u.id LIMIT 1) AS telegram_user_id,
        (SELECT vg.group_id FROM user_vk_group vg WHERE vg.user_id=u.id LIMIT 1) AS vk_group_id,
        (SELECT vg.group_name FROM user_vk_group vg WHERE vg.user_id=u.id LIMIT 1) AS vk_group_name,
        (SELECT vg.group_url FROM user_vk_group vg WHERE vg.user_id=u.id LIMIT 1) AS vk_group_url,
        (SELECT vg.updated_at FROM user_vk_group vg WHERE vg.user_id=u.id LIMIT 1) AS vk_group_created_at
      FROM users u ORDER BY u.created_at DESC
    `).all<any>(),
    env.DB.prepare(`
      SELECT mb.user_id,mb.telegram_bot_id,mb.username,mb.display_name,mb.status,mb.created_at,mb.updated_at,
        d.telegram_chat_id AS telegram_group_id,d.chat_title AS telegram_group_title,d.created_at AS telegram_group_created_at
      FROM telegram_managed_bots mb
      LEFT JOIN telegram_managed_bot_destinations d
        ON d.telegram_bot_id=mb.telegram_bot_id AND d.user_id=mb.user_id AND d.status='active'
      WHERE mb.user_id IS NOT NULL
      ORDER BY mb.created_at DESC
    `).all<any>(),
  ]);
  const botsByUser = new Map<string, any[]>();
  for (const bot of botsResult.results || []) {
    const list = botsByUser.get(bot.user_id) || [];
    list.push({
      telegram_bot_id: bot.telegram_bot_id,
      username: bot.username,
      display_name: bot.display_name,
      status: bot.status,
      created_at: bot.created_at,
      updated_at: bot.updated_at,
      telegram_group: bot.telegram_group_id ? {
        telegram_chat_id: bot.telegram_group_id,
        chat_title: bot.telegram_group_title,
        created_at: bot.telegram_group_created_at,
      } : null,
    });
    botsByUser.set(bot.user_id, list);
  }
  return { users: (usersResult.results || []).map((u: any) => ({ ...u, telegram_bots: botsByUser.get(u.id) || [] })) };
}

export async function deleteAdminTelegramGroup(req: Request, env: Env, userId: string, botId: string) {
  requireAdmin(req, env); await requireUser(env, userId); await requireBot(env, userId, botId);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM telegram_managed_bot_group_pairings WHERE user_id=? AND telegram_bot_id=?').bind(userId, botId),
    env.DB.prepare('DELETE FROM telegram_managed_bot_destinations WHERE user_id=? AND telegram_bot_id=?').bind(userId, botId),
    env.DB.prepare("DELETE FROM user_onboarding_skip WHERE user_id=? AND step IN ('telegram_group','telegram_preview')").bind(userId),
  ]);
  return { ok: true, user_id: userId, telegram_bot_id: botId };
}

export async function deleteAdminTelegramBot(req: Request, env: Env, userId: string, botId: string) {
  requireAdmin(req, env); await requireUser(env, userId); await requireBot(env, userId, botId);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM telegram_managed_bot_group_pairings WHERE user_id=? AND telegram_bot_id=?').bind(userId, botId),
    env.DB.prepare('DELETE FROM telegram_managed_bot_destinations WHERE user_id=? AND telegram_bot_id=?').bind(userId, botId),
    env.DB.prepare('DELETE FROM telegram_managed_bots WHERE user_id=? AND telegram_bot_id=?').bind(userId, botId),
    env.DB.prepare("DELETE FROM user_onboarding_skip WHERE user_id=? AND step IN ('telegram_bot','telegram_group','telegram_preview')").bind(userId),
  ]);
  return { ok: true, user_id: userId, telegram_bot_id: botId };
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
*{box-sizing:border-box}body{margin:0;background:#f4f5f7;color:#16181d;font:14px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.wrap{max-width:1100px;margin:auto;padding:28px 18px 60px}h1{font-size:28px;margin:0}.muted{color:#727780}.auth,.user{background:#fff;border:1px solid #e2e5e9;border-radius:16px}.auth{display:flex;gap:10px;padding:14px;margin:18px 0}input{width:100%;border:1px solid #ccd0d5;border-radius:10px;padding:11px 12px;font:inherit}button{border:0;border-radius:9px;padding:10px 13px;font:600 13px inherit;cursor:pointer;background:#2481cc;color:#fff}button.danger{background:#e5484d}button.ghost-danger{background:#fff;color:#c62f35;border:1px solid #e9b8ba}button:disabled{opacity:.38;cursor:default}.users{display:grid;gap:16px}.user{overflow:hidden}.user-head{padding:16px 18px;border-bottom:1px solid #eceef1}.uid{font-weight:700}.small{font-size:12px}.content{padding:18px;display:grid;gap:14px}.telegram{display:grid;gap:12px}.bot{border:1px solid #dfe3e8;border-radius:13px;overflow:hidden}.bot-main{padding:15px;display:flex;gap:16px;justify-content:space-between}.bot-info{flex:1}.title-row{display:flex;align-items:center;gap:8px;margin-bottom:10px}.title{font-weight:750;font-size:15px}.state{font-size:11px;font-weight:700;padding:3px 7px;border-radius:999px}.yes{background:#e9f7ee;color:#18753c}.no{background:#f0f1f2;color:#747980}.details{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.label{color:#7a7f87;font-size:11px}.value{font-weight:600;word-break:break-word;margin-top:2px}.group{margin:0 15px 15px 32px;border-left:3px solid #d8dde3;background:#f8f9fa;border-radius:0 10px 10px 0;padding:12px 14px;display:flex;justify-content:space-between;gap:14px;align-items:center}.group .details{flex:1;grid-template-columns:repeat(3,minmax(0,1fr))}.vk{border:1px solid #dfe3e8;border-radius:13px;padding:15px;display:flex;justify-content:space-between;gap:16px}.vk .details{flex:1}.danger-zone{border-top:1px solid #eceef1;padding:14px 18px;display:flex;align-items:center;justify-content:space-between;gap:16px;background:#fffafa}.empty{padding:14px;border:1px dashed #d5d9de;border-radius:12px}.status{margin:0 0 14px}@media(max-width:760px){.details,.group .details{grid-template-columns:1fr 1fr}.bot-main,.group,.vk,.auth,.danger-zone{flex-direction:column;align-items:stretch}.group{margin-left:15px}}
</style></head><body><main class="wrap"><h1>Cosmo Sofa Admin</h1><div class="muted">Пользователи и подключения публикации</div><div class="auth"><input id="token" type="password" placeholder="ADMIN_TOKEN"><button id="load">Показать пользователей</button></div><div id="status" class="muted status"></div><div id="users" class="users"></div></main><script>
(()=>{const token=document.querySelector('#token'),users=document.querySelector('#users'),status=document.querySelector('#status'),loadBtn=document.querySelector('#load');token.value=sessionStorage.getItem('adminToken')||'';
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=s=>s?new Date(String(s).replace(' ','T')+'Z').toLocaleString('ru-RU'):'—';
async function api(path,opts={}){const t=token.value.trim();sessionStorage.setItem('adminToken',t);opts.headers={...(opts.headers||{}),Authorization:'Bearer '+t};const r=await fetch(path,opts),d=await r.json().catch(()=>null);if(!r.ok)throw new Error(d?.error?.message||'Ошибка запроса');return d}
function state(ok){return '<span class="state '+(ok?'yes':'no')+'">'+(ok?'● Есть':'○ Нет')+'</span>'}
function field(label,value){return '<div><div class="label">'+label+'</div><div class="value">'+esc(value||'—')+'</div></div>'}
function botCard(b){const group=b.telegram_group,botId=esc(b.telegram_bot_id);return '<div class="bot" data-bot-id="'+botId+'"><div class="bot-main"><div class="bot-info"><div class="title-row"><span class="title">TG Bot</span>'+state(b.status==='active')+'</div><div class="details">'+field('Имя бота',b.display_name)+field('Username',b.username?'@'+b.username:'—')+field('Bot ID',b.telegram_bot_id)+field('Создан',date(b.created_at))+'</div></div><button class="danger" data-action="telegram-bot">Удалить бота</button></div><div class="group"><div><div class="title-row"><span class="title">↳ TG Group</span>'+state(!!group)+'</div>'+(group?'<div class="details">'+field('Title',group.chat_title)+field('Chat ID',group.telegram_chat_id)+field('Создана',date(group.created_at))+'</div>':'<div class="muted">Группа не подключена</div>')+'</div><button class="danger" data-action="telegram-group" '+(!group?'disabled':'')+'>Удалить TG-группу</button></div></div>'}
function card(u){const id=esc(u.id),bots=u.telegram_bots||[],vk=!!u.vk_group_id;return '<section class="user" data-user-id="'+id+'"><div class="user-head"><div class="uid">'+id+'</div><div class="muted small">Telegram user: '+esc(u.telegram_user_id||'—')+' · Создан: '+esc(date(u.created_at))+'</div></div><div class="content"><div><b>Telegram</b><div class="muted small">Ботов: '+bots.length+'</div></div><div class="telegram">'+(bots.length?bots.map(botCard).join(''):'<div class="empty muted">Telegram-ботов нет</div>')+'</div><div class="vk"><div><div class="title-row"><span class="title">VK Group</span>'+state(vk)+'</div>'+(vk?'<div class="details">'+field('Title',u.vk_group_name)+field('Group ID',u.vk_group_id)+field('URL',u.vk_group_url)+field('Дата записи',date(u.vk_group_created_at))+'</div>':'<div class="muted">VK-группа не подключена</div>')+'</div><button class="danger" data-action="vk-group" '+(!vk?'disabled':'')+'>Удалить VK-группу</button></div></div><div class="danger-zone"><div><b>Удаление пользователя</b><div class="muted small">Удаляет пользователя, все его Telegram-боты и группы, VK и историю.</div></div><button class="ghost-danger" data-action="user">Удалить пользователя целиком</button></div></section>'}
async function load(){status.textContent='Загрузка…';users.innerHTML='';try{const d=await api('/api/admin/users');status.textContent='Пользователей: '+d.users.length;users.innerHTML=d.users.length?d.users.map(card).join(''):'<div class="user empty muted">Пользователей нет</div>'}catch(e){status.textContent=e.message||String(e)}}
loadBtn.addEventListener('click',load);users.addEventListener('click',async e=>{const b=e.target.closest('[data-action]');if(!b||b.disabled)return;const user=b.closest('.user'),id=user.dataset.userId,action=b.dataset.action,bot=b.closest('.bot'),botId=bot?.dataset.botId;let path,message;if(action==='telegram-bot'){path='/api/admin/users/'+encodeURIComponent(id)+'/telegram-bots/'+encodeURIComponent(botId);message='Удалить бота '+botId+'? Его подключенная TG-группа также будет удалена.'}else if(action==='telegram-group'){path='/api/admin/users/'+encodeURIComponent(id)+'/telegram-bots/'+encodeURIComponent(botId)+'/telegram-group';message='Удалить TG-группу этого бота? Сам бот останется.'}else if(action==='vk-group'){path='/api/admin/users/'+encodeURIComponent(id)+'/vk-group';message='Удалить подключение VK-группы?'}else{path='/api/admin/users/'+encodeURIComponent(id);message='ПОЛНОСТЬЮ удалить пользователя '+id+'? Будут удалены ВСЕ его боты, TG-группы, VK и история публикаций.'}if(!confirm(message))return;b.disabled=true;try{await api(path,{method:'DELETE'});await load()}catch(x){alert(x.message||String(x));b.disabled=false}});})();
</script></body></html>`;
}
