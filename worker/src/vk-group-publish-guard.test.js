import {describe,it,expect} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const bootstrap=fs.readFileSync(path.resolve('../miniapp/bootstrap.js'),'utf8');
const settings=fs.readFileSync(path.resolve('../miniapp/settings.js'),'utf8');
const app=fs.readFileSync(path.resolve('../miniapp/app.js'),'utf8');
const selection=fs.readFileSync(path.resolve('../miniapp/vk-destination-selection.js'),'utf8');
const composer=fs.readFileSync(path.resolve('../miniapp/composer-vk-destination.js'),'utf8');

describe('VK destination selection architecture',()=>{
  it('removes the global capture guard and its onboarding DOM bridge',()=>{
    expect(fs.existsSync(path.resolve('../miniapp/vk-group-publish-guard.js'))).toBe(false);
    expect(bootstrap).not.toContain('vk-group-publish-guard.js');
    expect(composer).not.toContain("addEventListener('click'");
    expect(composer).not.toContain('data-vk-return-previous');
  });
  it('routes Settings and Composer through one public selection operation',()=>{
    expect(settings).toContain('CosmoVkDestinationSelection.open()');
    expect(composer).toContain('selection.open()');
    expect(selection).toContain('this.api.createVkHandoff()');
    expect(settings).not.toContain("initialStep:'vk_group'");
    expect(composer).not.toContain('openOnboarding');
  });
  it('keeps the existing publication operation behind Composer confirmation',()=>{
    expect(app).toContain('publishVkExistingFlow');
    expect(app).toContain('flow.requestPublication');
    expect(composer).toContain("primary.textContent='Продолжить'");
  });
});
