import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe,expect,it} from 'vitest';

const repositoryRoot=process.cwd().endsWith('/worker')?resolve(process.cwd(),'..'):process.cwd();
const app=readFileSync(resolve(repositoryRoot,'miniapp/app.js'),'utf8');
const entry=readFileSync(resolve(repositoryRoot,'worker/src/entry.ts'),'utf8');

describe('protected VK publishing preparation',()=>{
  it('keeps clipboard copy and draft-backed Telegram file download',()=>{
    expect(app).toContain('navigator.clipboard.writeText(text.value)');
    expect(app).toContain("fetch('/api/miniapp/draft'");
    expect(app).toContain('webApp.downloadFile({url,file_name:fileName}');
    expect(entry).toContain("url.pathname === '/api/miniapp/draft'");
  });

  it('keeps the separate VK link endpoint available for later restoration',()=>{
    expect(entry).toContain("url.pathname === '/api/miniapp/vk-link'");
    expect(entry).toContain('sendVkLinkBackup');
  });
});
