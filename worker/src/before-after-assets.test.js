import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe,expect,it} from 'vitest';

const root=process.cwd().endsWith('/worker')?process.cwd():resolve(process.cwd(),'worker');
const source=path=>readFileSync(resolve(root,path),'utf8');

describe('Before/After durable asset storage',()=>{
  const service=source('src/services/before-after-assets.ts');
  const migration=source('migrations/0019_draft_storage_media_assets.sql');
  const entry=source('src/entry.ts');

  it('stores every uploaded source image as a new immutable draft_storage asset',()=>{
    expect(service).toContain('const assetId = crypto.randomUUID()');
    expect(service).toContain('`draft_storage/${account.userId}/${assetId}`');
    expect(service).toContain("'before_after'");
    expect(service).not.toMatch(/IMAGES\.delete\s*\(/);
    expect(service).not.toMatch(/IMAGES\.put\([^,]*before_asset_id/);
  });

  it('keeps Before/After roles as references instead of physical R2 folders',()=>{
    expect(migration).toContain('CREATE TABLE media_assets');
    expect(migration).toContain('CREATE TABLE miniapp_before_after_assets');
    expect(migration).toContain('before_asset_id TEXT');
    expect(migration).toContain('after_asset_id TEXT');
    expect(migration).not.toMatch(/watermark/i);
    expect(service).not.toContain('draft_storage/before');
    expect(service).not.toContain('draft_storage/after');
  });

  it('removes only the current role reference and never deletes the durable asset',()=>{
    expect(service).toContain('SET ${column}=NULL');
    expect(service).not.toMatch(/DELETE\s+FROM\s+media_assets/i);
    expect(service).not.toMatch(/IMAGES\.delete\s*\(/);
  });

  it('swaps role references without copying or deleting R2 objects',()=>{
    expect(service).toContain('SET before_asset_id=?,after_asset_id=?');
    expect(service).toContain('.bind(current.afterId, current.beforeId, account.userId)');
    const swap=service.slice(service.indexOf('export async function swapBeforeAfterAssets'));
    expect(swap).not.toMatch(/IMAGES\.(?:put|delete)\s*\(/);
  });

  it('exposes isolated BA endpoints without changing the Publisher draft endpoint',()=>{
    expect(entry).toContain("url.pathname === '/api/miniapp/before-after/asset'");
    expect(entry).toContain("url.pathname === '/api/miniapp/before-after/remove'");
    expect(entry).toContain("url.pathname === '/api/miniapp/before-after/swap'");
    expect(entry).toContain("url.pathname === '/api/miniapp/draft'");
  });
});
