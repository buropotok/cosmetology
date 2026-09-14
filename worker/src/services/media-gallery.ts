import { AppError, type Env } from '../types';
import { requireTelegramMiniAppSession } from './telegram-miniapp-auth';
import { resolveOrCreateTelegramIdentity } from './telegram-identity';
import { listPermanentMediaAssets } from './media-assets';

async function accountFor(request:Request,env:Env){const validated=await requireTelegramMiniAppSession(request,env);return resolveOrCreateTelegramIdentity(env,String(validated.user.id));}
function invalidPagination():never{throw new AppError('INVALID_PAGINATION','Некорректные параметры пагинации',400);}
function parseLimit(value:string|null){if(value===null)return 100;if(!/^\d+$/.test(value))return invalidPagination();const limit=Number(value);if(!Number.isSafeInteger(limit)||limit<1||limit>100)return invalidPagination();return limit;}
function encodeCursor(cursor:{createdAt:string;id:string}){return btoa(JSON.stringify(cursor)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
function parseCursor(value:string|null){
  if(value===null)return undefined;if(value.length>512)return invalidPagination();
  if(!/^[A-Za-z0-9_-]+$/.test(value))return invalidPagination();
  try{const padded=value.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-value.length%4)%4);const parsed=JSON.parse(atob(padded)) as Record<string,unknown>;if(Object.keys(parsed).length!==2||typeof parsed.createdAt!=='string'||!parsed.createdAt||parsed.createdAt.length>64||typeof parsed.id!=='string'||!parsed.id||parsed.id.length>128)return invalidPagination();return {createdAt:parsed.createdAt,id:parsed.id};}catch{return invalidPagination();}
}
function chunks<T>(items:T[],size=90){const result:T[][]=[];for(let index=0;index<items.length;index+=size)result.push(items.slice(index,index+size));return result;}

export async function getMediaGallery(request:Request,env:Env){
  const account=await accountFor(request,env),url=new URL(request.url);
  const limit=parseLimit(url.searchParams.get('limit')),rows=await listPermanentMediaAssets(env,account.userId,limit+1,parseCursor(url.searchParams.get('cursor'))),hasMore=rows.length>limit,assets=rows.slice(0,limit),last=assets[assets.length-1];
  return {assets:assets.map(asset=>({id:asset.id,thumbnailId:asset.thumbnailId,fileName:asset.fileName,contentType:asset.contentType,size:asset.size,sourceType:asset.sourceType,createdAt:asset.createdAt,originalUrl:`/api/miniapp/media/original/${encodeURIComponent(asset.id)}`,thumbnailUrl:asset.thumbnailId?`/api/miniapp/media/thumbnail/${encodeURIComponent(asset.thumbnailId)}`:null})),nextCursor:hasMore&&last?encodeCursor({createdAt:last.createdAt,id:last.id}):null};
}

export async function deleteMediaGalleryAssets(request:Request,env:Env){
  const account=await accountFor(request,env);
  let body:unknown;try{body=await request.json()}catch{throw new AppError('INVALID_MEDIA_SELECTION','Некорректный список изображений',400);}
  const ids=Array.isArray((body as {ids?:unknown})?.ids)?(body as {ids:unknown[]}).ids:null;
  if(!ids||ids.length===0||ids.some(id=>typeof id!=='string'||!id||id.length>128)||new Set(ids).size!==ids.length)throw new AppError('INVALID_MEDIA_SELECTION','Некорректный список изображений',400);
  const idChunks=chunks(ids as string[]),owned:Array<{id:string;key:string;thumbnailId:string|null}>=[];
  for(const part of idChunks){const placeholders=part.map(()=>'?').join(',');const rows=await env.DB.prepare(`SELECT id,r2_key AS key,thumbnail_id AS thumbnailId FROM media_assets WHERE user_id=? AND id IN (${placeholders})`).bind(account.userId,...part).all<{id:string;key:string;thumbnailId:string|null}>();owned.push(...(rows.results||[]));}
  if(owned.length!==ids.length)throw new AppError('NOT_FOUND','Одно или несколько изображений не найдены',404);
  const statements=idChunks.flatMap(part=>{const placeholders=part.map(()=>'?').join(',');return [
    env.DB.prepare(`UPDATE miniapp_before_after_assets SET before_asset_id=NULL WHERE user_id=? AND before_asset_id IN (${placeholders})`).bind(account.userId,...part),
    env.DB.prepare(`UPDATE miniapp_before_after_assets SET after_asset_id=NULL WHERE user_id=? AND after_asset_id IN (${placeholders})`).bind(account.userId,...part),
    env.DB.prepare(`DELETE FROM media_assets WHERE user_id=? AND id IN (${placeholders})`).bind(account.userId,...part),
  ];});
  await env.DB.batch(statements);
  const keys=owned.flatMap(asset=>[asset.key,...(asset.thumbnailId?[`image_thumbnail/${account.userId}/${asset.thumbnailId}`]:[])]);
  const cleanup=await Promise.allSettled(keys.map(key=>env.IMAGES.delete(key)));
  cleanup.forEach((result,index)=>{if(result.status==='rejected')console.error('gallery media cleanup failed',{key:keys[index],error:result.reason instanceof Error?result.reason.message:String(result.reason)})});
  return {ok:true,deleted:owned.map(asset=>asset.id)};
}

export async function getMediaOriginal(request:Request,env:Env,assetId:string){
  const account=await accountFor(request,env),asset=await env.DB.prepare('SELECT r2_key AS key,content_type AS contentType FROM media_assets WHERE user_id=? AND id=? LIMIT 1').bind(account.userId,assetId).first<{key:string;contentType:string|null}>();
  if(!asset)throw new AppError('NOT_FOUND','Изображение не найдено',404);
  const object=await env.IMAGES.get(asset.key);if(!object)throw new AppError('NOT_FOUND','Изображение не найдено',404);
  const headers=new Headers({'cache-control':'private, max-age=3600','x-content-type-options':'nosniff'});object.writeHttpMetadata(headers);headers.set('etag',object.httpEtag);if(asset.contentType)headers.set('content-type',asset.contentType);
  return new Response(object.body,{headers});
}

export async function getMediaThumbnail(request:Request,env:Env,thumbnailId:string){
  const account=await accountFor(request,env),owned=await env.DB.prepare('SELECT 1 FROM media_assets WHERE user_id=? AND thumbnail_id=? LIMIT 1').bind(account.userId,thumbnailId).first();
  if(!owned)throw new AppError('NOT_FOUND','Миниатюра не найдена',404);
  const object=await env.IMAGES.get(`image_thumbnail/${account.userId}/${thumbnailId}`);if(!object)throw new AppError('NOT_FOUND','Миниатюра не найдена',404);
  const headers=new Headers({'cache-control':'private, max-age=86400','content-type':'image/webp','x-content-type-options':'nosniff'});headers.set('etag',object.httpEtag);
  return new Response(object.body,{headers});
}
