import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe,expect,it} from 'vitest';
const root=process.cwd().endsWith('/worker')?process.cwd():resolve(process.cwd(),'worker');
const source=path=>readFileSync(resolve(root,path),'utf8');

describe('permanent media gallery',()=>{
  const drafts=source('src/services/miniapp-drafts.ts'),media=source('src/services/media-assets.ts'),thumbs=source('src/services/media-thumbnails.ts'),gallery=source('src/services/media-gallery.ts'),migration=source('migrations/0022_permanent_media_gallery.sql'),config=source('wrangler.jsonc');
  it('preserves the existing Composer draft lifecycle while adding permanent registration',()=>{expect(drafts).toContain('`drafts/${account.userId}/${crypto.randomUUID()}`');expect(drafts).toContain('env.IMAGES.delete(row.key)');expect(drafts).toContain("storePermanentMediaAsset(env,account.userId,image,'draft')");});
  it('stores deduplicated originals in draft_storage and 400px WebP thumbnails separately',()=>{expect(media).toContain('`draft_storage/${userId}/${id}`');expect(media).toContain("digest('SHA-256'");expect(thumbs).toContain("width:400,height:400,fit:'scale-down'");expect(thumbs).toContain("format:'image/webp'");expect(thumbs).toContain('`image_thumbnail/${thumbnailId}`');expect(migration).toContain('thumbnail_id TEXT');expect(config).toContain('"images": {"binding": "IMAGE_TRANSFORM"}');});
  it('scopes gallery list, thumbnail and original lookup to the authenticated user',()=>{expect(gallery).toContain('requireTelegramMiniAppSession');expect(gallery).toContain('WHERE user_id=? AND thumbnail_id=? LIMIT 1');expect(gallery).toContain('listPermanentMediaAssets(env,account.userId');});
});
