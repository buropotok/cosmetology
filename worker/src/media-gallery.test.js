import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe,expect,it} from 'vitest';
const root=process.cwd().endsWith('/worker')?process.cwd():resolve(process.cwd(),'worker');
const source=path=>readFileSync(resolve(root,path),'utf8');

describe('permanent media gallery',()=>{
 const media=source('src/services/media-assets.ts'),gallery=source('src/services/media-gallery.ts'),drafts=source('src/services/miniapp-drafts.ts'),entry=source('src/watermark-entry.ts');
 it('deduplicates assets per user by SHA-256 and a unique database index',()=>{expect(media).toContain("digest('SHA-256'");expect(media).toContain('INSERT OR IGNORE INTO media_assets');expect(media).toContain('media/${userId}/${hash}');});
 it('keeps draft replacement separate from permanent asset lifetime',()=>{expect(drafts).toContain("storePermanentMediaAsset(env,account.userId,image,'draft')");expect(drafts).toContain('DELETE FROM miniapp_draft_images WHERE user_id=?');expect(drafts).not.toContain('env.IMAGES.delete(row.key)');});
 it('lists only authenticated user media through the gallery endpoint',()=>{expect(gallery).toContain('requireTelegramMiniAppSession');expect(gallery).toContain('listPermanentMediaAssets(env,account.userId');expect(entry).toContain("url.pathname==='/api/miniapp/gallery'");});
});
