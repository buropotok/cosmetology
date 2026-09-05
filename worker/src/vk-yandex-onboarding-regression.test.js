import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe,expect,it} from 'vitest';

const root=process.cwd().endsWith('/worker')?resolve(process.cwd(),'..'):process.cwd();
const source=readFileSync(resolve(root,'worker/src/services/vk-onboarding.ts'),'utf8');

describe('VK Yandex onboarding regression',()=>{
  it('keeps asynchronous replication after group persistence',()=>{
    const persist=source.indexOf('INSERT INTO user_vk_group');
    const replicate=source.indexOf('replicateVkArtifactToYandex(env');
    expect(persist).toBeGreaterThan(-1);
    expect(replicate).toBeGreaterThan(persist);
    expect(source).toContain('ctx.waitUntil');
  });
});
