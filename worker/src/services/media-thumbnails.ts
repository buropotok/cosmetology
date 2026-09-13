import type { Env } from '../types';

export async function createMediaThumbnail(env:Env,image:File,userId:string,thumbnailId:string){
  const result=await env.IMAGE_TRANSFORM.input(image.stream()).transform({width:400,height:400,fit:'scale-down'}).output({format:'image/webp'});
  const response=await result.response();
  const bytes=await response.arrayBuffer();
  await env.IMAGES.put(`image_thumbnail/${userId}/${thumbnailId}`,bytes,{httpMetadata:{contentType:'image/webp'}});
}
