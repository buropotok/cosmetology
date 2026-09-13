import type { Env } from '../types';

export async function createMediaThumbnail(env:Env,image:File,thumbnailId:string){
  const result=await env.IMAGE_TRANSFORM.input(image.stream()).transform({width:400,height:400,fit:'scale-down'}).output({format:'image/webp'});
  const bytes=await result.response().arrayBuffer();
  await env.IMAGES.put(`image_thumbnail/${thumbnailId}`,bytes,{httpMetadata:{contentType:'image/webp'}});
}
