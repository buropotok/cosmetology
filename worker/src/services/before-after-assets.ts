import { AppError, type Env } from '../types';
import { requireTelegramMiniAppSession } from './telegram-miniapp-auth';
import { resolveOrCreateTelegramIdentity } from './telegram-identity';
import { storePermanentMediaAsset } from './media-assets';

type Role = 'before' | 'after';

async function accountFor(request: Request, env: Env) {
  const validated = await requireTelegramMiniAppSession(request, env);
  return resolveOrCreateTelegramIdentity(env, String(validated.user.id));
}

function roleFrom(value: FormDataEntryValue | null): Role {
  if (value === 'before' || value === 'after') return value;
  throw new AppError('INVALID_BEFORE_AFTER_ROLE', 'Роль изображения должна быть before или after', 400);
}

export async function saveBeforeAfterAsset(request: Request, env: Env) {
  const account = await accountFor(request, env);
  if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('multipart/form-data')) {
    throw new AppError('INVALID_CONTENT_TYPE', 'Ожидается multipart/form-data', 415);
  }
  const form = await request.formData().catch(() => { throw new AppError('INVALID_FORM_DATA', 'Не удалось прочитать изображение', 400); });
  const role = roleFrom(form.get('role'));
  const image = form.get('image');
  if (!(image instanceof File)) throw new AppError('INVALID_IMAGE', 'Изображение обязательно', 400);

  const stored = await storePermanentMediaAsset(env, account.userId, image, 'before_after');
  if (role === 'before') {
    await env.DB.prepare('INSERT INTO miniapp_before_after_assets(user_id,before_asset_id,updated_at) VALUES(?,?,CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO UPDATE SET before_asset_id=excluded.before_asset_id,updated_at=CURRENT_TIMESTAMP')
      .bind(account.userId, stored.asset.id).run();
  } else {
    await env.DB.prepare('INSERT INTO miniapp_before_after_assets(user_id,after_asset_id,updated_at) VALUES(?,?,CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO UPDATE SET after_asset_id=excluded.after_asset_id,updated_at=CURRENT_TIMESTAMP')
      .bind(account.userId, stored.asset.id).run();
  }
  return { ok: true, role, assetId: stored.asset.id, created: stored.created };
}

export async function removeBeforeAfterAsset(request: Request, env: Env) {
  const account = await accountFor(request, env);
  let body: unknown;
  try { body = await request.json(); } catch { throw new AppError('INVALID_JSON', 'Некорректный JSON', 400); }
  const role = roleFrom(body && typeof body === 'object' ? String((body as Record<string, unknown>).role ?? '') : '');
  if (role === 'before') {
    await env.DB.prepare('UPDATE miniapp_before_after_assets SET before_asset_id=NULL,updated_at=CURRENT_TIMESTAMP WHERE user_id=?').bind(account.userId).run();
  } else {
    await env.DB.prepare('UPDATE miniapp_before_after_assets SET after_asset_id=NULL,updated_at=CURRENT_TIMESTAMP WHERE user_id=?').bind(account.userId).run();
  }
  return { ok: true, role };
}

export async function swapBeforeAfterAssets(request: Request, env: Env) {
  const account = await accountFor(request, env);
  const current = await env.DB.prepare('SELECT before_asset_id AS beforeId,after_asset_id AS afterId FROM miniapp_before_after_assets WHERE user_id=?')
    .bind(account.userId).first<{ beforeId: string | null; afterId: string | null }>();
  if (!current) return { ok: true };
  await env.DB.prepare('UPDATE miniapp_before_after_assets SET before_asset_id=?,after_asset_id=?,updated_at=CURRENT_TIMESTAMP WHERE user_id=?')
    .bind(current.afterId, current.beforeId, account.userId).run();
  return { ok: true };
}
