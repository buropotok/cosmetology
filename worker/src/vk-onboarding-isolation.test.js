import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe,expect,it} from 'vitest';

const root=process.cwd().endsWith('/worker')?resolve(process.cwd(),'..'):process.cwd();
const api=readFileSync(resolve(root,'miniapp/onboarding-api.js'),'utf8');
const controller=readFileSync(resolve(root,'miniapp/onboarding-controller.js'),'utf8');

describe('isolated VK onboarding client',()=>{
  it('continues to use the dedicated onboarding API rather than publication handoff',()=>{
    expect(api).toContain("createVkHandoff({signal}={}){return this.request('/api/miniapp/vk-onboarding'");
    expect(api).not.toContain("this.request('/api/miniapp/vk-handoff'");
    expect(controller).toContain('async connectVk()');
    expect(controller).toContain('this.telegram.openExternalLink(data.vkUrl)');
  });
});
