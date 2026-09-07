import { AppError, type Env } from '../types';
import { validateTelegramMiniAppInitData } from './telegram-miniapp-auth';
import { resolveOrCreateTelegramIdentity } from './telegram-identity';
import { MINIAPP_IMAGE_MAX_BYTES } from './miniapp';

type Role = 'before' | 'after';

function initDataFrom(request: Request) {
  return request.headers.get('authorization')?.match(/^tma\s+(.+)$/i)?.[1] ?? '';
}

async function accountFor(request: Request, env: Env) {
  const validated = await validateTelegramMiniAppInitData(initDataFrom(request), env.TELEGRAM_BOT_TOKEN);
  return resolveOrCreateTelegramIdentity(env, String(validated.user.id));
}

function roleFrom(value: FormDataEntryValue | null): Role {
  if (value === 'before' || value === 'after') return value;
  throw new AppError('INVALID_BEFORE_AFTER_ROLE', 'Роль изображения должна быть before или after', 400);
}

function columnFor(role: Role) {
  return role === 'before' ? 'before_asset_id' : 'after_asset_id';
}

export async function saveBeforeAfterAsset(request: Request, env: Env) {
  const account = await accountFor(request, env);
  if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('multipart/form-data')) {
    throw new AppError('INVALID_CONTENT_TYPE', 'Ожидается multipart/form-data', 415);
  }
  const form = await request.formData().catch(() => { throw new AppError('INVALID_FORM_DATA', 'Не удалось прочитать изображение', 400); });
  const role = roleFrom(form.get('role'));
  const image = form.get('image');
  if (!(image instanceof File) || image.size <= 0) throw new AppError('INVALID_IMAGE', 'Изображение обязательно', 400);
  if (!image.type.toLowerCase().startsWith('image/')) throw new AppError('INVALID_IMAGE_TYPE', 'Можно выбрать только изображение', 400);
  if (image.size > MINIAPP_IMAGE_MAX_BYTES) throw new AppError('IMAGE_TOO_LARGE', 'Изображение должно быть не больше 10 МБ', 400);

  const assetId = crypto.randomUUID();
  const key = `draft_storage/${account.userId}/${assetId}`;
  await env.IMAGES.put(key, image.stream(), { httpMetadata: { contentType: image.type } });
  await env.DB.prepare('INSERT INTO media_assets(id,user_id,r2_key,source_type,file_name,content_type,size_bytes) VALUES(?,?,?,?,?,?,?)')
    .bind(assetId, account.userId, key, 'before_after', image.name || null, image.type || null, image.size).run();

  const column = columnFor(role);
  await env.DB.prepare(`INSERT INTO miniapp_before_after_assets(user_id,${column},updated_at) VALUES(?,?,CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO UPDATE SET ${column}=excluded.${column},updated_at=CURRENT_TIMESTAMP`)
    .bind(account.userId, assetId).run();

  return { ok: true, role, assetId };
}

export async function removeBeforeAfterAsset(request: Request, env: Env) {
  const account = await accountFor(request, env);
  let body: unknown;
  try { body = await request.json(); } catch { throw new AppError('INVALID_JSON', 'Некорректный JSON', 400); }
  const role = roleFrom(body && typeof body === 'object' ? String((body as Record<string, unknown>).role ?? '') : '');
  const column = columnFor(role);
  await env.DB.prepare(`UPDATE miniapp_before_after_assets SET ${column}=NULL,updated_at=CURRENT_TIMESTAMP WHERE user_id=?`).bind(account.userId).run();
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
