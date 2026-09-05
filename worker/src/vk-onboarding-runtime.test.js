import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe,expect,it} from 'vitest';

const repositoryRoot=process.cwd().endsWith('/worker')?resolve(process.cwd(),'..'):process.cwd();
const read=path=>readFileSync(resolve(repositoryRoot,path),'utf8');
const onboarding=read('worker/src/services/vk-onboarding.ts');
const entry=read('worker/src/entry.ts');

describe('VK onboarding runtime contract',()=>{
  it('creates a VK Mini App launch URL with a Cloudflare callback',()=>{
    expect(onboarding).toContain("const VK_APP_ID = '54742219'");
    expect(onboarding).toContain('const callbackOrigin=new URL(request.url).origin');
    expect(onboarding).toContain('connect=${encodeURIComponent(token)}&callback=${encodeURIComponent(callbackOrigin)}');
  });

  it('accepts the VK Mini App callback and persists the selected group',()=>{
    expect(entry).toContain("/^\\/api\\/vk-onboarding\\/([A-Za-z0-9_-]+)$/");
    expect(entry).toContain('selectVkOnboardingGroup(env,vkOnboarding[1]');
    expect(onboarding).toContain('INSERT INTO user_vk_group');
    expect(onboarding).toContain('groupUrl=`https://vk.com/${canonicalScreen}`');
  });

  it('retains Yandex replication as part of the onboarding integration',()=>{
    expect(onboarding).toContain("from './yandex-vk-replica'");
    expect(onboarding).toContain('replicateVkArtifactToYandex(env');
  });
});
