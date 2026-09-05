import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe,expect,it} from 'vitest';

const root=process.cwd().endsWith('/worker')?resolve(process.cwd(),'..'):process.cwd();
const app=readFileSync(resolve(root,'miniapp/app.js'),'utf8');

describe('VK publish preparation regression coverage',()=>{
  it('retains the user-verified one-image preparation path',()=>{
    expect(app).toContain("document.querySelector('#publish-vk')");
    expect(app).toContain('navigator.clipboard.writeText(text.value)');
    expect(app).toContain('result?.draft?.images?.[0]');
    expect(app).toContain('webApp.downloadFile({url,file_name:fileName}');
  });
});
