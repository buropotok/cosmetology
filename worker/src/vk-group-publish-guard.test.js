import {describe,it,expect} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const guard=fs.readFileSync(path.resolve('../miniapp/vk-group-publish-guard.js'),'utf8');
const bootstrap=fs.readFileSync(path.resolve('../miniapp/bootstrap.js'),'utf8');

describe('VK missing group publish flow',()=>{
  it('saves the draft and routes settings to VK group onboarding',()=>{
    expect(guard).toContain("flush?.('vk-group-check')");
    expect(guard).toContain('Группа не подключена');
    expect(guard).toContain('Ваш черновик сохранён');
    expect(guard).toContain("initialStep:'vk_group'");
    expect(guard).toContain("returnTo:'composer'");
  });

  it('shows an explicit return button after the VK group is connected',()=>{
    expect(guard).toContain('data-vk-return-previous');
    expect(guard).toContain('← Вернуться назад');
    expect(guard).toContain('state.account?.vkGroup?.connected');
    expect(guard).toContain("controller.finish('completed','vk_group_connected_return')");
  });

  it('keeps the existing VK onboarding implementation and only composes the guard',()=>{
    expect(bootstrap).toContain("import('/vk-group-publish-guard.js')");
    expect(guard).not.toContain('/api/miniapp/vk-handoff');
    expect(guard).not.toContain('user_vk_group');
  });
});
