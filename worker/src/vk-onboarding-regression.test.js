import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe,expect,it} from 'vitest';

const root=process.cwd().endsWith('/worker')?resolve(process.cwd(),'..'):process.cwd();
const onboarding=readFileSync(resolve(root,'worker/src/services/vk-onboarding.ts'),'utf8');

describe('VK onboarding regression coverage',()=>{
  it('keeps token lifecycle and selected group response',()=>{
    expect(onboarding).toContain('TTL_SECONDS = 15 * 60');
    expect(onboarding).toContain('vk_onboarding_handoffs');
    expect(onboarding).toContain("status:row.consumedAt?'connected':'pending'");
    expect(onboarding).toContain('vkGroup:{connected:true,groupId,groupName,screenName:canonicalScreen,groupUrl}');
  });
});
