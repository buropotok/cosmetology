import {File} from 'node:buffer';
import {describe,expect,it,vi} from 'vitest';
import {storePermanentMediaAsset} from './services/media-assets';

function fixture({transformFails=false,insertFails=false}={}){
  const rows=[];
  const objects=new Map();
  const DB={prepare(sql){let args=[];return {bind(...values){args=values;return this},async first(){if(sql.includes('content_hash=?'))return rows.find(row=>row.userId===args[0]&&row.contentHash===args[1])||null;return null},async run(){if(sql.startsWith('INSERT OR IGNORE')){if(insertFails)throw new Error('db unavailable');if(!rows.some(row=>row.userId===args[1]&&row.contentHash===args[7])){rows.push({id:args[0],userId:args[1],key:args[2],sourceType:args[3],fileName:args[4],contentType:args[5],size:args[6],contentHash:args[7],thumbnailId:null,createdAt:'now'});return {success:true,meta:{changes:1}}}return {success:true,meta:{changes:0}}}if(sql.startsWith('UPDATE media_assets SET thumbnail_id=')){const row=rows.find(item=>item.id===args[1]&&item.userId===args[2]);if(row)row.thumbnailId=args[0];return {success:true}}throw new Error(`unexpected SQL: ${sql}`)}}}};
  const IMAGES={put:vi.fn(async(key,value)=>{objects.set(key,value)}),delete:vi.fn(async key=>{objects.delete(key)}),get:vi.fn(async key=>objects.get(key)||null)};
  const IMAGE_TRANSFORM={input(){if(transformFails)throw new Error('transform unavailable');return {transform(){return {output(){return {async response(){return new Response(new Uint8Array([1,2,3]))}}}}}}}};
  return {env:{DB,IMAGES,IMAGE_TRANSFORM},rows,objects};
}

const image=()=>new File([new Uint8Array([10,20,30])],'photo.jpg',{type:'image/jpeg'});

describe('permanent media lifecycle',()=>{
  it('commits the original even when thumbnail generation fails',async()=>{const {env,rows,objects}=fixture({transformFails:true});const result=await storePermanentMediaAsset(env,'user-1',image(),'before_after');expect(result.created).toBe(true);expect(rows).toHaveLength(1);expect(rows[0].thumbnailId).toBeNull();expect(objects.has(rows[0].key)).toBe(true)});
  it('deduplicates identical bytes for the same user',async()=>{const {env,rows}=fixture();const first=await storePermanentMediaAsset(env,'user-1',image(),'draft');const second=await storePermanentMediaAsset(env,'user-1',image(),'before_after');expect(first.created).toBe(true);expect(second.created).toBe(false);expect(second.asset.id).toBe(first.asset.id);expect(rows).toHaveLength(1)});
  it('cleans the original when committing media metadata fails',async()=>{const {env,objects}=fixture({insertFails:true});await expect(storePermanentMediaAsset(env,'user-1',image(),'draft')).rejects.toThrow('db unavailable');expect(objects.size).toBe(0)});
  it('stores thumbnails in a user-scoped 400px WebP derivative path',async()=>{const {env,rows,objects}=fixture();await storePermanentMediaAsset(env,'user-1',image(),'draft');expect(rows[0].thumbnailId).toBeTruthy();expect(objects.has(`image_thumbnail/user-1/${rows[0].thumbnailId}`)).toBe(true)});
});
