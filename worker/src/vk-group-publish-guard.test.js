import {describe,it,expect} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const flow=fs.readFileSync(path.resolve('../miniapp/onboarding-flow.js'),'utf8');
const bootstrap=fs.readFileSync(path.resolve('../miniapp/bootstrap.js'),'utf8');

describe('VK publish capability ownership',()=>{
  it('keeps the VK publish guard in the shared onboarding flow',()=>{
    expect(flow).toContain("guard('vk_publish')");
    expect(flow).toContain("vkReady=!!state?.vkGroup?.connected");
    expect(flow).toContain('Выберите группу для публикации');
    expect(flow).toContain('В настройках выберите группу ВКонтакте, в которую будут публиковаться ваши посты.');
  });

  it('does not restore the deprecated standalone VK publish guard',()=>{
    expect(bootstrap).not.toContain("import('/vk-group-publish-guard.js')");
    expect(fs.existsSync(path.resolve('../miniapp/vk-group-publish-guard.js'))).toBe(false);
  });

  it('does not restore onboarding return intent for VK group selection',()=>{
    expect(flow).not.toContain("initialStep:'vk_group'");
    expect(flow).not.toContain("returnTo:'composer'");
    expect(flow).not.toContain('data-vk-return-previous');
    expect(flow).not.toContain("controller.finish('completed','vk_group_connected_return')");
  });
});
