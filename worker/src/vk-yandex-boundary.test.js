import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe,expect,it} from 'vitest';

const root=process.cwd().endsWith('/worker')?resolve(process.cwd(),'..'):process.cwd();
const onboarding=readFileSync(resolve(root,'worker/src/services/vk-onboarding.ts'),'utf8');

describe('Yandex VK onboarding bridge',()=>{
  it('remains a protected dependency of group selection',()=>{
    expect(onboarding).toContain("import { replicateVkArtifactToYandex } from './yandex-vk-replica'");
    expect(onboarding).toContain("kind:'vk_group_connection'");
    expect(onboarding).toContain("console.error('Yandex VK onboarding replica failed'");
  });
});
