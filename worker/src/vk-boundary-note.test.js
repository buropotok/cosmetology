import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe,expect,it} from 'vitest';

const root=process.cwd().endsWith('/worker')?resolve(process.cwd(),'..'):process.cwd();
const entry=readFileSync(resolve(root,'worker/src/entry.ts'),'utf8');

describe('VK protected boundaries after legacy cleanup',()=>{
  it('keeps onboarding and link routes while removing only test routes',()=>{
    expect(entry).toContain('/api/miniapp/vk-onboarding');
    expect(entry).toContain('/api/vk-onboarding/');
    expect(entry).toContain('/api/miniapp/vk-link');
    expect(entry).not.toContain("'/vk-test'");
    expect(entry).not.toContain("'/vk-test-image'");
  });
});
