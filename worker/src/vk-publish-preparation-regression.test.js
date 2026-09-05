import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe,expect,it} from 'vitest';

const root=process.cwd().endsWith('/worker')?resolve(process.cwd(),'..'):process.cwd();
const app=readFileSync(resolve(root,'miniapp/app.js'),'utf8');

describe('VK publish preparation regression coverage',()=>{
  it('downloads every saved image before opening the VK continuation modal',()=>{
    expect(app).toContain("document.querySelector('#publish-vk')");
    expect(app).toContain('navigator.clipboard.writeText(text.value)');
    expect(app).toContain('result?.draft?.images||[]');
    expect(app).toContain('for(let index=0;index<images.length;index++)await downloadVkPhoto(images[index],index)');
    expect(app).toContain('webApp.downloadFile({url,file_name:fileName}');
    expect(app).toContain('showVkReadyModal({vkUrl,textCopied,photoCount:images.length})');
    expect(app).not.toContain('result?.draft?.images?.[0]');
  });
});
