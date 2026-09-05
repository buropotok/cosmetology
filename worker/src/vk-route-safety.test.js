import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe,expect,it} from 'vitest';

const root=process.cwd().endsWith('/worker')?resolve(process.cwd(),'..'):process.cwd();
const entry=readFileSync(resolve(root,'worker/src/entry.ts'),'utf8');

describe('VK route safety boundary',()=>{
  it('retains production VK routes needed by current or protected flows',()=>{
    for(const route of ['/api/miniapp/vk-link','/api/miniapp/vk-onboarding','/api/vk-onboarding/','/api/miniapp/vk-handoff','/api/vk-handoff/','/api/vk-handoff-upload/']){
      expect(entry).toContain(route);
    }
  });
});
