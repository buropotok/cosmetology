import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe,expect,it} from 'vitest';

const repositoryRoot=process.cwd().endsWith('/worker')?resolve(process.cwd(),'..'):process.cwd();
const entry=readFileSync(resolve(repositoryRoot,'worker/src/entry.ts'),'utf8');

describe('VK cleanup scope',()=>{
  it('leaves historical handoff routes intact until their Yandex relationship is audited separately',()=>{
    expect(entry).toContain("url.pathname==='/api/miniapp/vk-handoff'");
    expect(entry).toContain("url.pathname.match(/^\\/api\\/vk-handoff\\/");
    expect(entry).toContain("url.pathname.match(/^\\/api\\/vk-handoff-upload\\/");
    expect(entry).toContain("url.pathname.match(/^\\/api\\/vk-handoff-image\\/");
  });
});
