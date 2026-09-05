import {existsSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe,expect,it} from 'vitest';

const root=process.cwd().endsWith('/worker')?resolve(process.cwd(),'..'):process.cwd();
const entry=readFileSync(resolve(root,'worker/src/entry.ts'),'utf8');

describe('first VK legacy removal increment',()=>{
  it('removes only the obsolete CF-hosted test shell',()=>{
    expect(existsSync(resolve(root,'worker/src/vk-miniapp.ts'))).toBe(false);
    expect(entry).not.toContain('vkMiniAppHtml');
    expect(entry).not.toContain('VK_TEST_IMAGE_KEY');
    expect(entry).toContain('createVkOnboardingHandoff');
    expect(entry).toContain('createVkHandoff');
  });
});
