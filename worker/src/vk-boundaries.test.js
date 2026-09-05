import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe,expect,it} from 'vitest';

const repositoryRoot=process.cwd().endsWith('/worker')?resolve(process.cwd(),'..'):process.cwd();
const read=path=>readFileSync(resolve(repositoryRoot,path),'utf8');
const entry=read('worker/src/entry.ts');
const onboarding=read('worker/src/services/vk-onboarding.ts');
const api=read('miniapp/onboarding-api.js');
const controller=read('miniapp/onboarding-controller.js');

describe('protected VK onboarding boundary',()=>{
  it('keeps the Telegram Mini App -> Cloudflare onboarding entry point',()=>{
    expect(api).toContain("this.request('/api/miniapp/vk-onboarding'");
    expect(entry).toContain("url.pathname==='/api/miniapp/vk-onboarding'");
    expect(entry).toContain('createVkOnboardingHandoff(req,env)');
  });

  it('keeps the external VK Mini App callback contract',()=>{
    expect(onboarding).toContain('VK_APP_ID');
    expect(onboarding).toContain('callbackOrigin');
    expect(onboarding).toContain('vkUrl:`https://vk.com/app${VK_APP_ID}#${launch}`');
    expect(entry).toContain("/^\\/api\\/vk-onboarding\\/([A-Za-z0-9_-]+)$/");
    expect(entry).toContain('selectVkOnboardingGroup');
  });

  it('keeps group persistence and onboarding completion semantics',()=>{
    expect(onboarding).toContain('INSERT INTO user_vk_group');
    expect(onboarding).toContain("DELETE FROM user_onboarding_skip WHERE user_id=? AND step='vk_group'");
    expect(controller).toContain("step==='vk_group'?!!account.vkGroup?.connected:false");
  });

  it('keeps the Yandex replication dependency used by VK onboarding',()=>{
    expect(onboarding).toContain("import { replicateVkArtifactToYandex } from './yandex-vk-replica'");
    expect(onboarding).toContain('replicateVkArtifactToYandex(env');
    expect(onboarding).toContain("kind:'vk_group_connection'");
  });
});
