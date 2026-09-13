import type { Env } from '../types';

export async function createMediaThumbnail(env:Env,userId:string,image:File,thumbnailId:string){
  const result=await env.IMAGE_TRANSFORM.input(image.stream()).transform({width:400,height:400,fit:'scale-down'}).output({format:'image/webp'});
  const response=result.response();
  await env.IMAGES.put(`image_thumbnail/${userId}/${thumbnailId}`,await response.arrayBuffer(),{httpMetadata:{contentType:'image/webp'}});
}
