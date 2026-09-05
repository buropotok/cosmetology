import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe,expect,it} from 'vitest';

const repositoryRoot=process.cwd().endsWith('/worker')?resolve(process.cwd(),'..'):process.cwd();
const app=readFileSync(resolve(repositoryRoot,'miniapp','app.js'),'utf8');

describe('verified VK preparation runtime',()=>{
  it('keeps the canonical VK button and draft-backed Telegram download flow',()=>{
    expect(app).toContain("document.querySelector('#publish-vk')");
    expect(app).toContain("publishVk.addEventListener('click'");
    expect(app).toContain("CosmoComposerActions.publishVk");
    expect(app).toContain("fetch('/api/miniapp/draft'");
    expect(app).toContain("result?.draft?.images?.[0]");
    expect(app).toContain('webApp.downloadFile({url,file_name:fileName}');
    expect(app).toContain('navigator.clipboard.writeText(text.value)');
  });

  it('does not reintroduce the experimental VK test harness',()=>{
    expect(app).not.toContain('combinedTestButton');
    expect(app).not.toContain('legacyPublishVk');
    expect(app).not.toContain('dataset.vkTest');
    expect(app).not.toContain('BUILD-20260904-VK-TEST');
    expect(app).not.toContain("'Тест:");
    expect(app).not.toContain('showVkReadyModal');
    expect(app).not.toContain('prepareVkLink');
  });
});
