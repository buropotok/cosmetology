import { beforeEach, describe, expect, it, vi } from 'vitest';

const {storePermanentMediaAsset}=vi.hoisted(()=>({storePermanentMediaAsset:vi.fn()}));
vi.mock('./services/media-assets',()=>({storePermanentMediaAsset}));

import { retryDraftMediaRegistrations } from './services/miniapp-drafts';

function environment(){
  const retry={key:'drafts/user-1/source',fileName:'source.jpg',contentType:'image/jpeg'};
  let queued=true,attempts=1,lastError='initial failure';
  const deleted:string[]=[];
  const DB={prepare(sql:string){let args:unknown[]=[];return {bind(...values:unknown[]){args=values;return this},async all(){if(sql.startsWith('SELECT r2_key AS key,file_name'))return {results:queued?[retry]:[]};throw new Error(`unexpected all: ${sql}`)},async first(){if(sql.startsWith('SELECT 1 FROM miniapp_draft_images'))return null;throw new Error(`unexpected first: ${sql}`)},async run(){if(sql.startsWith('DELETE FROM draft_media_registration_retries')){queued=false;return {success:true}}if(sql.startsWith('UPDATE draft_media_registration_retries')){attempts++;lastError=String(args[0]);return {success:true}}throw new Error(`unexpected run: ${sql}`)}}}};
  const IMAGES={get:vi.fn(async()=>({arrayBuffer:async()=>new Uint8Array([1,2,3]).buffer,httpMetadata:{contentType:'image/jpeg'}})),delete:vi.fn(async(key:string)=>{deleted.push(key)})};
  return {env:{DB,IMAGES} as never,state:()=>({queued,attempts,lastError,deleted})};
}

describe('draft permanent-media registration retry',()=>{
  beforeEach(()=>{vi.clearAllMocks();vi.spyOn(console,'error').mockImplementation(()=>{});});

  it('retains durable retry state after another transient registration failure',async()=>{
    const {env,state}=environment();storePermanentMediaAsset.mockRejectedValueOnce(new Error('still unavailable'));
    await retryDraftMediaRegistrations(env,'user-1');
    expect(state()).toMatchObject({queued:true,attempts:2,lastError:'still unavailable',deleted:[]});
  });

  it('clears retry state and a stale Draft source after successful registration',async()=>{
    const {env,state}=environment();storePermanentMediaAsset.mockResolvedValueOnce({created:true});
    await retryDraftMediaRegistrations(env,'user-1');
    expect(storePermanentMediaAsset).toHaveBeenCalledWith(env,'user-1',expect.any(File),'draft');
    expect(state()).toMatchObject({queued:false,attempts:1,deleted:['drafts/user-1/source']});
  });
});
