import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe,expect,it} from 'vitest';

const root=process.cwd().endsWith('/worker')?process.cwd():resolve(process.cwd(),'worker');
const read=name=>readFileSync(resolve(root,'src',name),'utf8');

describe('Mini App session activity boundary',()=>{
  it('extends only after the complete draft result has been produced',()=>{
    const source=read('services/miniapp-drafts.ts'),save=source.slice(source.indexOf('export async function saveMiniAppDraft'));
    expect(save.indexOf('const saved = await draftForAccount')).toBeGreaterThan(save.indexOf("await env.DB.prepare(`INSERT INTO miniapp_drafts"));
    expect(save.indexOf('await extendTelegramMiniAppSessionAfterDraftSave')).toBeGreaterThan(save.indexOf('const saved = await draftForAccount'));
  });

  it('does not expose session extension to preview, publish, healthcheck, or other services',()=>{
    const entry=read('entry.ts'),miniapp=read('services/miniapp.ts'),auth=read('services/telegram-miniapp-auth.ts');
    expect(entry).not.toContain('extendTelegramMiniAppSessionAfterDraftSave');
    expect(miniapp).not.toContain('extendTelegramMiniAppSessionAfterDraftSave');
    expect((auth.match(/unixepoch\(\)\+\?/g)||[])).toHaveLength(1);
  });
});
