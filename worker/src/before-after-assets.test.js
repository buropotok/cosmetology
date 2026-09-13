import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe,expect,it} from 'vitest';
const root=process.cwd().endsWith('/worker')?process.cwd():resolve(process.cwd(),'worker');
const source=path=>readFileSync(resolve(root,path),'utf8');

describe('Before/After permanent media storage',()=>{
 const service=source('src/services/before-after-assets.ts');
 const media=source('src/services/media-assets.ts');
 const migration=source('migrations/0022_media_asset_content_hash.sql');
 it('reuses shared permanent media assets by content hash',()=>{
  expect(service).toContain("storePermanentMediaAsset(env, account.userId, image, 'before_after')");
  expect(media).toContain("crypto.subtle.digest('SHA-256'");
  expect(media).toContain('WHERE user_id=? AND content_hash=? LIMIT 1');
  expect(migration).toContain('idx_media_assets_user_content_hash');
 });
 it('keeps roles as references to permanent assets',()=>{
  expect(service).toContain('before_asset_id=excluded.before_asset_id');
  expect(service).toContain('after_asset_id=excluded.after_asset_id');
  expect(service).toContain('before_asset_id=NULL');
  expect(service).toContain('after_asset_id=NULL');
 });
 it('swaps references without changing stored media',()=>{
  expect(service).toContain('SET before_asset_id=?,after_asset_id=?');
  expect(service).toContain('.bind(current.afterId, current.beforeId, account.userId)');
 });
});
