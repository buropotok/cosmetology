import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe,expect,it} from 'vitest';

const root=process.cwd().endsWith('/worker')?resolve(process.cwd(),'..'):process.cwd();
const entry=readFileSync(resolve(root,'worker/src/entry.ts'),'utf8');

describe('VK route safety boundary',()=>{
  it('retains production VK routes needed by current or protected flows',()=>{
    expect(entry).toContain('/api/miniapp/vk-link');
    expect(entry).toContain('/api/miniapp/vk-onboarding');
    expect(entry).toContain("url.pathname.match(/^\\/api\\/vk-onboarding\\/");
    expect(entry).toContain('/api/miniapp/vk-handoff');
    expect(entry).toContain("url.pathname.match(/^\\/api\\/vk-handoff\\/");
    expect(entry).toContain("url.pathname.match(/^\\/api\\/vk-handoff-upload\\/");
    expect(entry).toContain("url.pathname.match(/^\\/api\\/vk-handoff-image\\/");
  });
});
