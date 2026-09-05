import {existsSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe,expect,it} from 'vitest';

const root=process.cwd().endsWith('/worker')?resolve(process.cwd(),'..'):process.cwd();
const entry=readFileSync(resolve(root,'worker/src/entry.ts'),'utf8');

describe('VK cleanup contract',()=>{
  it('removes obsolete CF test hosting without crossing protected boundaries',()=>{
    expect(existsSync(resolve(root,'worker/src/vk-miniapp.ts'))).toBe(false);
    expect(entry).not.toContain('/vk-test-image');
    expect(entry).toContain('/api/miniapp/vk-onboarding');
    expect(entry).toContain('/api/miniapp/vk-link');
    expect(entry).toContain('/api/miniapp/vk-handoff');
  });
});
