import { AppError, type Env } from '../types';
import { requireTelegramMiniAppSession } from './telegram-miniapp-auth';
import { resolveOrCreateTelegramIdentity } from './telegram-identity';
import { listPermanentMediaAssets } from './media-assets';

async function accountFor(request:Request,env:Env){const validated=await requireTelegramMiniAppSession(request,env);return resolveOrCreateTelegramIdentity(env,String(validated.user.id));}

export async function getMediaGallery(request:Request,env:Env){
  const account=await accountFor(request,env),url=new URL(request.url),thumbnailId=url.searchParams.get('thumbnail');
  if(thumbnailId){
    const asset=await env.DB.prepare('SELECT r2_key AS key,content_type AS contentType FROM media_assets WHERE user_id=? AND thumbnail_id=? LIMIT 1').bind(account.userId,thumbnailId).first<{key:string;contentType:string|null}>();
    if(!asset)throw new AppError('NOT_FOUND','Изображение не найдено',404);
    const object=await env.IMAGES.get(asset.key);if(!object)throw new AppError('NOT_FOUND','Изображение не найдено',404);
    const headers=new Headers({'cache-control':'private, max-age=3600','x-content-type-options':'nosniff'});object.writeHttpMetadata(headers);headers.set('etag',object.httpEtag);if(asset.contentType)headers.set('content-type',asset.contentType);
    return new Response(object.body,{headers});
  }
  const assets=await listPermanentMediaAssets(env,account.userId,Number(url.searchParams.get('limit')||100));
  return {assets:assets.map(asset=>({id:asset.id,thumbnailId:asset.thumbnailId,fileName:asset.fileName,contentType:asset.contentType,size:asset.size,sourceType:asset.sourceType,createdAt:asset.createdAt,thumbnailUrl:asset.thumbnailId?`/api/miniapp/media/thumbnail/${encodeURIComponent(asset.thumbnailId)}`:null}))};
}

export async function getMediaThumbnail(request:Request,env:Env,thumbnailId:string){
  const account=await accountFor(request,env),owned=await env.DB.prepare('SELECT 1 FROM media_assets WHERE user_id=? AND thumbnail_id=? LIMIT 1').bind(account.userId,thumbnailId).first();
  if(!owned)throw new AppError('NOT_FOUND','Миниатюра не найдена',404);
  const object=await env.IMAGES.get(`image_thumbnail/${thumbnailId}`);if(!object)throw new AppError('NOT_FOUND','Миниатюра не найдена',404);
  const headers=new Headers({'cache-control':'private, max-age=86400','content-type':'image/webp','x-content-type-options':'nosniff'});headers.set('etag',object.httpEtag);
  return new Response(object.body,{headers});
}
