import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe,expect,it} from 'vitest';

const repositoryRoot=process.cwd().endsWith('/worker')?resolve(process.cwd(),'..'):process.cwd();
const entry=readFileSync(resolve(repositoryRoot,'worker/src/entry.ts'),'utf8');

describe('VK legacy runtime cleanup',()=>{
  it('does not expose the historical Cloudflare-hosted VK test shell',()=>{
    expect(entry).not.toContain("url.pathname==='/vk-test'");
    expect(entry).not.toContain("url.pathname==='/vk-test-image'");
    expect(entry).not.toContain('VK_TEST_IMAGE_KEY');
    expect(entry).not.toContain('vkMiniAppHtml');
  });
});
