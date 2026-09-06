import { AppError, type Env } from '../types';
import { validateTelegramMiniAppInitData } from './telegram-miniapp-auth';
import { resolveOrCreateTelegramIdentity } from './telegram-identity';
import { MINIAPP_IMAGE_MAX_BYTES, MINIAPP_IMAGE_MAX_COUNT, MINIAPP_TEXT_MAX_LENGTH } from './miniapp';

const DOWNLOAD_TTL_SECONDS = 5 * 60;
const AI_STATE_MAX_LENGTH = 100_000;
function initDataFrom(request: Request) { return request.headers.get('authorization')?.match(/^tma\s+(.+)$/i)?.[1] ?? ''; }
async function accountFor(request: Request, env: Env) {
  const validated = await validateTelegramMiniAppInitData(initDataFrom(request), env.TELEGRAM_BOT_TOKEN);
  return resolveOrCreateTelegramIdentity(env, String(validated.user.id));
}
function bytesToToken(bytes: Uint8Array) { let binary=''; for(const byte of bytes) binary+=String.fromCharCode(byte); return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,''); }
async function downloadSignature(env: Env, key: string, expires: number) {
  const cryptoKey=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.TELEGRAM_BOT_TOKEN),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return bytesToToken(new Uint8Array(await crypto.subtle.sign('HMAC',cryptoKey,new TextEncoder().encode(`${key}\n${expires}`))));
}
async function signedDownloadUrl(env: Env, key: string) {
  const expires=Math.floor(Date.now()/1000)+DOWNLOAD_TTL_SECONDS,signature=await downloadSignature(env,key,expires);
  return `/api/miniapp/draft/image/${encodeURIComponent(key)}?download=1&expires=${expires}&signature=${encodeURIComponent(signature)}`;
}

export async function getMiniAppDraft(request: Request, env: Env) {
  const account = await accountFor(request, env);
  const draft = await env.DB.prepare('SELECT text_content AS text, platform, active_photo_index AS activePhotoIndex, screen, ai_state AS aiStateJson, updated_at AS updatedAt FROM miniapp_drafts WHERE user_id=?').bind(account.userId).first<{text:string;platform:string;activePhotoIndex:number;screen:string;aiStateJson:string;updatedAt:string}>();
  if (!draft) return { draft: null };
  const { aiStateJson, ...rest } = draft;
  let aiState: unknown = null;
  try { aiState = aiStateJson ? JSON.parse(aiStateJson) : null; } catch { aiState = null; }
  const images = await env.DB.prepare('SELECT position, r2_key AS key, file_name AS fileName, content_type AS contentType, size_bytes AS size FROM miniapp_draft_images WHERE user_id=? ORDER BY position').bind(account.userId).all<{position:number;key:string;fileName:string|null;contentType:string|null;size:number}>();
  const mapped=[]; for(const image of images.results || []) mapped.push({ ...image, url: await signedDownloadUrl(env,image.key) });
  return { draft: { ...rest, aiState, images: mapped } };
}

export async function saveMiniAppDraft(request: Request, env: Env) {
  const account = await accountFor(request, env);
  if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('multipart/form-data')) throw new AppError('INVALID_CONTENT_TYPE','Ожидается multipart/form-data',415);
  const form = await request.formData().catch(() => { throw new AppError('INVALID_FORM_DATA','Не удалось прочитать черновик',400); });
  const text = typeof form.get('text') === 'string' ? String(form.get('text')) : '';
  if (text.length > MINIAPP_TEXT_MAX_LENGTH) throw new AppError('INVALID_TEXT',`Текст должен быть короче ${MINIAPP_TEXT_MAX_LENGTH + 1} символов`,400);
  const platform = form.get('platform') === 'vk' ? 'vk' : 'telegram';
  const activeRaw = Number(form.get('activePhotoIndex') || 0);
  const activePhotoIndex = Number.isFinite(activeRaw) && activeRaw >= 0 ? Math.floor(activeRaw) : 0;
  const requestedScreen = String(form.get('screen') || '');
  const screen = requestedScreen === 'beforeafter' ? 'beforeafter' : requestedScreen === 'publish' ? 'publish' : 'ai';
  const aiStateJson = typeof form.get('aiState') === 'string' ? String(form.get('aiState')) : '';
  if (aiStateJson.length > AI_STATE_MAX_LENGTH) throw new AppError('INVALID_AI_STATE','Состояние AI слишком большое',400);
  if (aiStateJson) { try { JSON.parse(aiStateJson); } catch { throw new AppError('INVALID_AI_STATE','Некорректное состояние AI',400); } }
  const imagesChanged = form.get('imagesChanged') === '1';
  await env.DB.prepare(`INSERT INTO miniapp_drafts(user_id,text_content,platform,active_photo_index,screen,ai_state,created_at,updated_at) VALUES(?,?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO UPDATE SET text_content=excluded.text_content,platform=excluded.platform,active_photo_index=excluded.active_photo_index,screen=excluded.screen,ai_state=excluded.ai_state,updated_at=CURRENT_TIMESTAMP`).bind(account.userId,text,platform,activePhotoIndex,screen,aiStateJson).run();
  if (imagesChanged) {
    const rawImages = form.getAll('images');
    if (rawImages.some(item => !(item instanceof File))) throw new AppError('INVALID_IMAGE','Некорректное изображение',400);
    const images = (rawImages as File[]).filter(file => file.size > 0);
    if (images.length > MINIAPP_IMAGE_MAX_COUNT) throw new AppError('TOO_MANY_IMAGES','Можно выбрать не больше 10 изображений',400);
    for (const image of images) {
      if (!image.type.toLowerCase().startsWith('image/')) throw new AppError('INVALID_IMAGE_TYPE','Можно выбрать только изображения',400);
      if (image.size > MINIAPP_IMAGE_MAX_BYTES) throw new AppError('IMAGE_TOO_LARGE','Каждое изображение должно быть не больше 10 МБ',400);
    }
    const old = await env.DB.prepare('SELECT r2_key AS key FROM miniapp_draft_images WHERE user_id=?').bind(account.userId).all<{key:string}>();
    await env.DB.prepare('DELETE FROM miniapp_draft_images WHERE user_id=?').bind(account.userId).run();
    await Promise.all((old.results || []).map(row => env.IMAGES.delete(row.key)));
    for (let i=0;i<images.length;i++) {
      const image=images[i];
      const key=`drafts/${account.userId}/${crypto.randomUUID()}`;
      await env.IMAGES.put(key,image.stream(),{httpMetadata:{contentType:image.type}});
      await env.DB.prepare('INSERT INTO miniapp_draft_images(user_id,position,r2_key,file_name,content_type,size_bytes) VALUES(?,?,?,?,?,?)').bind(account.userId,i,key,image.name||null,image.type||null,image.size).run();
    }
  }
  return getMiniAppDraft(request, env);
}

export async function getMiniAppDraftImage(request: Request, env: Env, key: string) {
  const url=new URL(request.url),download=url.searchParams.get('download')==='1';
  let owned:{fileName:string|null;contentType:string|null}|null=null;
  if(download){
    const expires=Number(url.searchParams.get('expires')),signature=url.searchParams.get('signature')||'';
    if(!Number.isSafeInteger(expires)||expires<Math.floor(Date.now()/1000)||expires>Math.floor(Date.now()/1000)+DOWNLOAD_TTL_SECONDS+60) throw new AppError('DOWNLOAD_LINK_EXPIRED','Ссылка на изображение истекла',410);
    const expected=await downloadSignature(env,key,expires);
    if(signature.length!==expected.length){throw new AppError('INVALID_DOWNLOAD_LINK','Некорректная ссылка на изображение',403)}
    let diff=0; for(let i=0;i<signature.length;i++) diff|=signature.charCodeAt(i)^expected.charCodeAt(i); if(diff!==0) throw new AppError('INVALID_DOWNLOAD_LINK','Некорректная ссылка на изображение',403);
    owned=await env.DB.prepare('SELECT file_name AS fileName, content_type AS contentType FROM miniapp_draft_images WHERE r2_key=? LIMIT 1').bind(key).first<{fileName:string|null;contentType:string|null}>();
  } else {
    const account = await accountFor(request, env);
    owned=await env.DB.prepare('SELECT file_name AS fileName, content_type AS contentType FROM miniapp_draft_images WHERE user_id=? AND r2_key=? LIMIT 1').bind(account.userId,key).first<{fileName:string|null;contentType:string|null}>();
  }
  if (!owned) throw new AppError('NOT_FOUND','Изображение не найдено',404);
  const object = await env.IMAGES.get(key);
  if (!object) throw new AppError('NOT_FOUND','Изображение не найдено',404);
  const headers = new Headers({'cache-control':download?'private, no-store':'private, max-age=3600'}); object.writeHttpMetadata(headers); headers.set('etag',object.httpEtag);
  if (owned.contentType) headers.set('content-type',owned.contentType);
  const safeFileName=(owned.fileName||'cosmo-sofa.jpg').replace(/["\\\r\n]/g,'_');
  headers.set('content-disposition',`attachment; filename="${safeFileName}"`);
  headers.set('access-control-allow-origin','https://web.telegram.org');
  headers.set('x-content-type-options','nosniff');
  return new Response(object.body,{headers});
}
