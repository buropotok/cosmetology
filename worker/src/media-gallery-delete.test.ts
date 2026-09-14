import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./services/telegram-miniapp-auth',()=>({requireTelegramMiniAppSession:vi.fn(async()=>({user:{id:42}}))}));
vi.mock('./services/telegram-identity',()=>({resolveOrCreateTelegramIdentity:vi.fn(async()=>({userId:'user-42'}))}));

import { deleteMediaGalleryAssets } from './services/media-gallery';

function request(ids:unknown){return new Request('https://example.test/api/miniapp/media/delete',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({ids})});}
function environment(rows:Array<{id:string;key:string;thumbnailId:string|null}>){
  const batches:Array<Array<{sql:string;args:unknown[]}>>=[];
  const deleted:string[]=[];
  const DB={
    prepare(sql:string){return {bind(...args:unknown[]){return {sql,args,all:vi.fn(async()=>({results:rows}))};}};},
    batch:vi.fn(async(statements:Array<{sql:string;args:unknown[]}>)=>{batches.push(statements);return [];})
  };
  const IMAGES={delete:vi.fn(async(key:string)=>{deleted.push(key);})};
  return {env:{DB,IMAGES} as never,batches,deleted};
}

describe('media gallery deletion',()=>{
  beforeEach(()=>vi.clearAllMocks());

  it('deletes only authenticated user assets and their permanent objects',async()=>{
    const {env,batches,deleted}=environment([
      {id:'a',key:'draft_storage/user-42/a',thumbnailId:'ta'},
      {id:'b',key:'draft_storage/user-42/b',thumbnailId:null},
    ]);
    const result=await deleteMediaGalleryAssets(request(['a','b']),env);
    expect(result).toEqual({ok:true,deleted:['a','b']});
    expect(batches).toHaveLength(1);
    expect(batches[0][2].sql).toContain('DELETE FROM media_assets WHERE user_id=?');
    expect(batches[0][2].args).toEqual(['user-42','a','b']);
    expect(deleted).toEqual(['draft_storage/user-42/a','image_thumbnail/user-42/ta','draft_storage/user-42/b']);
  });

  it('rejects a selection containing an asset outside the authenticated user scope',async()=>{
    const {env,batches,deleted}=environment([{id:'a',key:'draft_storage/user-42/a',thumbnailId:null}]);
    await expect(deleteMediaGalleryAssets(request(['a','foreign']),env)).rejects.toMatchObject({code:'NOT_FOUND',status:404});
    expect(batches).toHaveLength(0);
    expect(deleted).toHaveLength(0);
  });

  it.each([[],['a','a'],[123],null])('rejects invalid selections',async ids=>{
    const {env,batches}=environment([]);
    await expect(deleteMediaGalleryAssets(request(ids),env)).rejects.toMatchObject({code:'INVALID_MEDIA_SELECTION',status:400});
    expect(batches).toHaveLength(0);
  });
});
