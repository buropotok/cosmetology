import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./services/telegram-miniapp-auth',()=>({requireTelegramMiniAppSession:vi.fn(async()=>({user:{id:42}}))}));
vi.mock('./services/telegram-identity',()=>({resolveOrCreateTelegramIdentity:vi.fn(async()=>({userId:'user-42'}))}));

import { getMediaGallery } from './services/media-gallery';

const row=(id:string,createdAt:string)=>({id,key:`draft_storage/user-42/${id}`,thumbnailId:null,fileName:`${id}.jpg`,contentType:'image/jpeg',size:10,sourceType:'draft',contentHash:id,createdAt});

function environment(pages:Array<Array<ReturnType<typeof row>>>){
  const calls:Array<{sql:string;args:unknown[]}>=[];
  const DB={prepare(sql:string){return {bind(...args:unknown[]){calls.push({sql,args});return {all:vi.fn(async()=>({results:pages.shift()||[]}))};}};}};
  return {env:{DB} as never,calls};
}

describe('media gallery pagination',()=>{
  beforeEach(()=>vi.clearAllMocks());

  it('returns an opaque stable cursor and uses it in a user-scoped keyset query',async()=>{
    const firstRows=[row('c','2026-01-02 00:00:00'),row('b','2026-01-01 00:00:00'),row('a','2026-01-01 00:00:00')];
    const {env,calls}=environment([firstRows,[row('a','2026-01-01 00:00:00')]]);
    const first=await getMediaGallery(new Request('https://example.test/api/miniapp/media?limit=2'),env);
    expect(first.assets.map(asset=>asset.id)).toEqual(['c','b']);
    expect(first.nextCursor).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(first.assets[0]).not.toHaveProperty('key');

    const second=await getMediaGallery(new Request(`https://example.test/api/miniapp/media?limit=2&cursor=${first.nextCursor}`),env);
    expect(second.assets.map(asset=>asset.id)).toEqual(['a']);
    expect(second.nextCursor).toBeNull();
    expect(calls[1].sql).toContain('WHERE user_id=? AND (created_at<? OR (created_at=? AND id<?))');
    expect(calls[1].args).toEqual(['user-42','2026-01-01 00:00:00','2026-01-01 00:00:00','b',3]);
  });

  it.each(['0','101','1.5','nope'])('rejects invalid limit %s',async limit=>{
    const {env,calls}=environment([]);
    await expect(getMediaGallery(new Request(`https://example.test/api/miniapp/media?limit=${limit}`),env)).rejects.toMatchObject({code:'INVALID_PAGINATION',status:400});
    expect(calls).toHaveLength(0);
  });

  it('rejects malformed cursors without querying assets',async()=>{
    const {env,calls}=environment([]);
    await expect(getMediaGallery(new Request('https://example.test/api/miniapp/media?cursor=not%2Ba%2Bcursor'),env)).rejects.toMatchObject({code:'INVALID_PAGINATION',status:400});
    expect(calls).toHaveLength(0);
  });
});
