import { AppError, type Env } from '../types';
import { MINIAPP_IMAGE_MAX_BYTES } from './miniapp';
import { createMediaThumbnail } from './media-thumbnails';

type MediaAsset={id:string;key:string;thumbnailId:string|null;fileName:string|null;contentType:string|null;size:number;sourceType:string;contentHash:string|null;createdAt:string};
const SELECT_BY_HASH='SELECT id,r2_key AS key,thumbnail_id AS thumbnailId,file_name AS fileName,content_type AS contentType,size_bytes AS size,source_type AS sourceType,content_hash AS contentHash,created_at AS createdAt FROM media_assets WHERE user_id=? AND content_hash=? LIMIT 1';
function hex(bytes:Uint8Array){return Array.from(bytes,byte=>byte.toString(16).padStart(2,'0')).join('');}

export function validateMediaImage(image:File){
  if(image.size<=0)throw new AppError('INVALID_IMAGE','Изображение обязательно',400);
  if(!image.type.toLowerCase().startsWith('image/'))throw new AppError('INVALID_IMAGE_TYPE','Можно выбрать только изображение',400);
  if(image.size>MINIAPP_IMAGE_MAX_BYTES)throw new AppError('IMAGE_TOO_LARGE','Изображение должно быть не больше 10 МБ',400);
}

export async function storePermanentMediaAsset(env:Env,userId:string,image:File,sourceType:string){
  validateMediaImage(image);
  const bytes=await image.arrayBuffer();
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  const hash=hex(new Uint8Array(digest));
  const existing=await env.DB.prepare(SELECT_BY_HASH).bind(userId,hash).first<MediaAsset>();
  if(existing)return {asset:existing,created:false};
  const id=crypto.randomUUID(),key=`draft_storage/${userId}/${id}`;
  await env.IMAGES.put(key,bytes,{httpMetadata:{contentType:image.type}});
  let inserted=false;
  try{
    const result=await env.DB.prepare('INSERT OR IGNORE INTO media_assets(id,user_id,r2_key,source_type,file_name,content_type,size_bytes,content_hash,thumbnail_id) VALUES(?,?,?,?,?,?,?,?,NULL)').bind(id,userId,key,sourceType,image.name||null,image.type||null,image.size,hash).run();
    inserted=Number(result.meta?.changes||0)>0;
    if(!inserted){
      const winner=await env.DB.prepare(SELECT_BY_HASH).bind(userId,hash).first<MediaAsset>();
      await env.IMAGES.delete(key);
      if(!winner)throw new AppError('MEDIA_STORE_FAILED','Не удалось сохранить изображение',500);
      return {asset:winner,created:false};
    }
    const asset:MediaAsset={id,key,thumbnailId:null,fileName:image.name||null,contentType:image.type||null,size:image.size,sourceType,contentHash:hash,createdAt:new Date().toISOString()};
    const thumbnailId=crypto.randomUUID();
    try{
      await createMediaThumbnail(env,new File([bytes],image.name,{type:image.type}),userId,thumbnailId);
      await env.DB.prepare('UPDATE media_assets SET thumbnail_id=? WHERE id=? AND user_id=?').bind(thumbnailId,id,userId).run();
      asset.thumbnailId=thumbnailId;
    }catch(error){
      await env.IMAGES.delete(`image_thumbnail/${userId}/${thumbnailId}`).catch(()=>null);
      console.error('media thumbnail generation failed',{assetId:id,error:error instanceof Error?error.message:String(error)});
    }
    return {asset,created:true};
  }catch(error){
    if(!inserted)await env.IMAGES.delete(key);
    throw error;
  }
}

export type MediaAssetCursor={createdAt:string;id:string};

export async function listPermanentMediaAssets(env:Env,userId:string,limit:number,cursor?:MediaAssetCursor){
  const sql=`SELECT id,r2_key AS key,thumbnail_id AS thumbnailId,file_name AS fileName,content_type AS contentType,size_bytes AS size,source_type AS sourceType,content_hash AS contentHash,created_at AS createdAt FROM media_assets WHERE user_id=?${cursor?' AND (created_at<? OR (created_at=? AND id<?))':''} ORDER BY created_at DESC,id DESC LIMIT ?`;
  const statement=env.DB.prepare(sql);
  const bound=cursor?statement.bind(userId,cursor.createdAt,cursor.createdAt,cursor.id,limit):statement.bind(userId,limit);
  const rows=await bound.all<MediaAsset>();
  return rows.results||[];
}
