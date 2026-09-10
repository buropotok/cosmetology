import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe,expect,it} from 'vitest';

const root=process.cwd().endsWith('/worker')?resolve(process.cwd(),'..'):process.cwd();
const app=readFileSync(resolve(root,'miniapp/app.js'),'utf8');

describe('VK publish preparation regression coverage',()=>{
  it('copies canonical Composer text and downloads every saved image before persisting the resumable VK intent',()=>{
    expect(app).toContain("document.querySelector('#publish-vk')");
    expect(app).toContain("window.CosmoRichEditor?.getPlainText?.()??''");
    expect(app).not.toContain('getPlainText?.()??text.value');
    expect(app).toContain('const plainText=currentPlainText();if(plainText.trim()){await navigator.clipboard.writeText(plainText)');
    expect(app).toContain('result?.draft?.images||[]');
    expect(app).toContain('for(let index=0;index<images.length;index++)await downloadVkPhoto(images[index],index)');
    expect(app).toContain('webApp.downloadFile({url,file_name:fileName}');
    expect(app).toContain('await createVkPublishIntent();');
    expect(app).toContain('showVkVpnModal();');
    expect(app).not.toContain('result?.draft?.images?.[0]');
  });
});
