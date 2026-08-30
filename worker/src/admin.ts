import { AppError, type Env } from './types';

const html = String.raw;

function requireAdmin(req: Request, env: Env) {
  const expected = env.ADMIN_TOKEN?.trim();
  if (!expected) throw new AppError('ADMIN_NOT_CONFIGURED', 'ADMIN_TOKEN is not configured', 503);
  const supplied = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  if (!supplied || supplied !== expected) throw new AppError('UNAUTHORIZED', 'Admin authorization required', 401);
}

export async function listAdminUsers(req: Request, env: Env) {
  requireAdmin(req, env);
  const { results } = await env.DB.prepare(`
    SELECT u.id,u.google_sub,u.created_at,u.updated_at,
      ti.telegram_user_id,
      mb.telegram_bot_id,mb.username AS bot_username,mb.display_name AS bot_name,
      d.chat_title AS telegram_group,
      vg.group_id AS vk_group_id,vg.group_name AS vk_group_name,vg.group_url AS vk_group_url,
      (SELECT COUNT(*) FROM posts p WHERE p.user_id=u.id) AS post_count
    FROM users u
    LEFT JOIN telegram_identities ti ON ti.user_id=u.id
    LEFT JOIN telegram_managed_bots mb ON mb.user_id=u.id AND mb.status='active'
    LEFT JOIN telegram_managed_bot_destinations d ON d.user_id=u.id AND d.status='active'
    LEFT JOIN user_vk_group vg ON vg.user_id=u.id
    ORDER BY u.created_at DESC
  `).all();
  return { users: results };
}

export async function resetAdminOnboarding(req: Request, env: Env, userId: string) {
  requireAdmin(req, env);
  const user = await env.DB.prepare('SELECT id FROM users WHERE id=?').bind(userId).first();
  if (!user) throw new AppError('NOT_FOUND', 'Пользователь не найден', 404);
  const bots = await env.DB.prepare('SELECT telegram_bot_id FROM telegram_managed_bots WHERE user_id=?').bind(userId).all<{telegram_bot_id:string}>();
  const botIds = (bots.results || []).map(x => x.telegram_bot_id);

  const statements = [
    env.DB.prepare('DELETE FROM user_vk_group WHERE user_id=?').bind(userId),
    env.DB.prepare('DELETE FROM vk_handoffs WHERE user_id=?').bind(userId),
    env.DB.prepare('DELETE FROM telegram_managed_bot_group_pairings WHERE user_id=?').bind(userId),
    env.DB.prepare('DELETE FROM telegram_managed_bot_destinations WHERE user_id=?').bind(userId),
    env.DB.prepare('DELETE FROM telegram_pairings WHERE user_id=?').bind(userId),
    env.DB.prepare('DELETE FROM telegram_connections WHERE user_id=?').bind(userId),
    env.DB.prepare('DELETE FROM telegram_managed_bots WHERE user_id=?').bind(userId),
  ];
  const result = await env.DB.batch(statements);
  return { ok: true, user_id: userId, managed_bot_ids: botIds, history_preserved: true, database_operations: result.length };
}

export function adminHtml() {
  return html`<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cosmo Sofa Admin</title><style>
  *{box-sizing:border-box}body{margin:0;background:#f2f2f7;color:#111;font:15px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.wrap{max-width:980px;margin:0 auto;padding:28px 18px}h1{font-size:28px;margin:0 0 6px}.muted{color:#6e6e73}.auth,.card{background:#fff;border:1px solid #e5e5ea;border-radius:16px;padding:16px;margin-top:18px}.auth{display:flex;gap:10px}input{width:100%;border:1px solid #d1d1d6;border-radius:10px;padding:11px 12px;font:inherit}button{border:0;border-radius:10px;padding:11px 14px;font:600 14px inherit;cursor:pointer;background:#2481cc;color:#fff}button.danger{background:#ff3b30}button:disabled{opacity:.5}.grid{display:grid;gap:12px;margin-top:18px}.row{display:grid;grid-template-columns:minmax(190px,1.2fr) 2fr auto;gap:14px;align-items:center}.name{font-weight:700}.meta{font-size:13px;color:#6e6e73;line-height:1.5}.chips{display:flex;gap:6px;flex-wrap:wrap}.chip{font-size:12px;background:#f2f2f7;padding:5px 8px;border-radius:999px}.ok{color:#248a3d}.empty{text-align:center;color:#6e6e73;padding:30px}@media(max-width:700px){.row{grid-template-columns:1fr}.auth{flex-direction:column}}
  </style></head><body><main class="wrap"><h1>Cosmo Sofa Admin</h1><div class="muted">Тестирование первичного onboarding. История публикаций при сбросе сохраняется.</div><div class="auth"><input id="token" type="password" placeholder="ADMIN_TOKEN"><button id="load">Показать пользователей</button></div><div id="status" class="muted" style="margin-top:12px"></div><div id="users" class="grid"></div></main><script>
  const token=document.querySelector('#token'),users=document.querySelector('#users'),status=document.querySelector('#status');token.value=sessionStorage.getItem('adminToken')||'';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  async function api(path,opts={}){const t=token.value.trim();sessionStorage.setItem('adminToken',t);const r=await fetch(path,{...opts,headers:{...(opts.headers||{}),Authorization:'Bearer '+t}}),d=await r.json();if(!r.ok)throw Error(d?.error?.message||'Ошибка запроса');return d}
  async function load(){status.textContent='Загрузка…';users.innerHTML='';try{const d=await api('/api/admin/users');status.textContent='Пользователей: '+d.users.length;users.innerHTML=d.users.length?d.users.map(u=>`<section class="card row"><div><div class="name">${esc(u.bot_name||u.telegram_user_id||u.id)}</div><div class="meta">${esc(u.id)}<br>Создан: ${esc(u.created_at)}</div></div><div class="chips"><span class="chip">Telegram ID: ${esc(u.telegram_user_id||'—')}</span><span class="chip">Бот: ${esc(u.bot_username?'@'+u.bot_username:'—')}</span><span class="chip">TG группа: ${esc(u.telegram_group||'—')}</span><span class="chip">VK: ${esc(u.vk_group_name||u.vk_group_url||'—')}</span><span class="chip">История: ${esc(u.post_count||0)}</span></div><button class="danger" data-reset="${esc(u.id)}">Сбросить onboarding</button></section>`).join(''):'<div class="card empty">Пользователей нет</div>'}catch(e){status.textContent=e.message}}
  users.addEventListener('click',async e=>{const b=e.target.closest('[data-reset]');if(!b)return;const id=b.dataset.reset;if(!confirm('Сбросить onboarding этого пользователя?\n\nПерсональный бот, Telegram-группа и VK-группа будут отвязаны. История публикаций сохранится.'))return;b.disabled=true;try{await api('/api/admin/users/'+encodeURIComponent(id)+'/reset-onboarding',{method:'POST'});await load()}catch(x){alert(x.message);b.disabled=false}});document.querySelector('#load').onclick=load;
  </script></body></html>`;
}
