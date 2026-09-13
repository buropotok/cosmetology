import { AppError, type Env } from '../types';
import { MINIAPP_IMAGE_MAX_BYTES } from './miniapp';

export type MediaAsset = { id:string; key:string; fileName:string|null; contentType:string|null; size:number; sourceType:string; contentHash:string|null; createdAt:string };
const SELECT_ASSET='SELECT id,r2_key AS key,file_name AS fileName,content_type AS contentType,size_bytes AS size,source_type AS sourceType,content_hash AS contentHash,created_at AS createdAt FROM media_assets WHERE user_id=? AND content_hash=? LIMIT 1';
function toHex(bytes:Uint8Array){return Array.from(bytes,byte=>byte.toString(16).padStart(2,'0')).join('');}
async function hashOf(image:File){return toHex(new Uint8Array(await crypto.subtle.digest('SHA-256',await image.arrayBuffer())));}
export function validateMediaImage(image:File){if(image.size<=0)throw new AppError('INVALID_IMAGE','Изображение обязательно',400);if(!image.type.toLowerCase().startsWith('image/'))throw new AppError('INVALID_IMAGE_TYPE','Можно выбрать только изображение',400);if(image.size>MINIAPP_IMAGE_MAX_BYTES)throw new AppError('IMAGE_TOO_LARGE','Изображение должно быть не больше 10 МБ',400);}

export async function storePermanentMediaAsset(env:Env,userId:string,image:File,sourceType:string){
 validateMediaImage(image);const hash=await hashOf(image);const existing=await env.DB.prepare(SELECT_ASSET).bind(userId,hash).first<MediaAsset>();if(existing)return {asset:existing,created:false};
 const id=crypto.randomUUID(),key=`media/${userId}/${hash}`;
 await env.IMAGES.put(key,image.stream(),{httpMetadata:{contentType:image.type}});
 await env.DB.prepare('INSERT OR IGNORE INTO media_assets(id,user_id,r2_key,source_type,file_name,content_type,size_bytes,content_hash) VALUES(?,?,?,?,?,?,?,?)').bind(id,userId,key,sourceType,image.name||null,image.type||null,image.size,hash).run();
 const asset=await env.DB.prepare(SELECT_ASSET).bind(userId,hash).first<MediaAsset>();if(!asset)throw new AppError('MEDIA_STORE_FAILED','Не удалось сохранить изображение',500);
 return {asset,created:asset.id===id};
}
export async function listPermanentMediaAssets(env:Env,userId:string,limit=100){const safe=Math.max(1,Math.min(100,Math.floor(limit)||100));const rows=await env.DB.prepare('SELECT id,r2_key AS key,file_name AS fileName,content_type AS contentType,size_bytes AS size,source_type AS sourceType,content_hash AS contentHash,created_at AS createdAt FROM media_assets WHERE user_id=? ORDER BY created_at DESC,id DESC LIMIT ?').bind(userId,safe).all<MediaAsset>();return rows.results||[];}
