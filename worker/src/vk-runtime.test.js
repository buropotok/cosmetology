import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe,expect,it} from 'vitest';

const repositoryRoot=process.cwd().endsWith('/worker')?resolve(process.cwd(),'..'):process.cwd();
const app=readFileSync(resolve(repositoryRoot,'miniapp','app.js'),'utf8');
const composerScreen=readFileSync(resolve(repositoryRoot,'miniapp','composer-screen.js'),'utf8');

describe('verified VK preparation runtime',()=>{
  it('keeps the canonical VK button and downloads all draft-backed photos',()=>{
    expect(app).toContain("document.querySelector('#publish-vk')");
    expect(app).toContain("publishVk.addEventListener('click'");
    expect(app).toContain("CosmoComposerActions.publishVk");
    expect(app).toContain("fetch('/api/miniapp/draft'");
    expect(app).toContain("const images=(result?.draft?.images||[]).filter(image=>image?.url).slice(0,10)");
    expect(app).toContain('for(let index=0;index<images.length;index++)await downloadVkPhoto(images[index],index)');
    expect(app).toContain('webApp.downloadFile({url,file_name:fileName}');
    expect(app).toContain('navigator.clipboard.writeText(text.value)');
    expect(composerScreen).toContain("document.querySelector('#publish-vk')");
  });

  it('uses only the simple preparation modal and existing VK link',()=>{
    expect(app).not.toContain('combinedTestButton');
    expect(app).not.toContain('legacyPublishVk');
    expect(app).not.toContain('dataset.vkTest');
    expect(app).not.toContain('BUILD-20260904-VK-TEST');
    expect(app).not.toContain("'Тест:");
    expect(app).toContain('showVkReadyModal');
    expect(app).toContain('prepareVkLink');
    expect(app).toContain("fetch('/api/miniapp/vk-link'");
    expect(app).not.toContain('post_id');
    expect(composerScreen).not.toContain('publish-vk-test');
    expect(composerScreen).not.toContain('testVk');
  });
});
