import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe,expect,it} from 'vitest';

const root=process.cwd().endsWith('/worker')?resolve(process.cwd(),'..'):process.cwd();
const api=readFileSync(resolve(root,'miniapp/onboarding-api.js'),'utf8');
const controller=readFileSync(resolve(root,'miniapp/onboarding-controller.js'),'utf8');
const selection=readFileSync(resolve(root,'miniapp/vk-destination-selection.js'),'utf8');

describe('isolated VK onboarding client',()=>{
  it('keeps the dedicated handoff API behind the shared destination operation',()=>{
    expect(api).toContain("createVkHandoff({signal}={}){return this.request('/api/miniapp/vk-onboarding'");
    expect(api).not.toContain("this.request('/api/miniapp/vk-handoff'");
    expect(selection).toContain('this.api.createVkHandoff()');
    expect(selection).toContain('this.telegram.openExternalLink(handoff.vkUrl)');
    expect(controller).toContain('this.vkSelection.open()');
  });
});
