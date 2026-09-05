import {describe,it,expect} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const migration=fs.readFileSync(path.resolve('migrations/0016_vk_publish_intent.sql'),'utf8');

describe('VK publish intent migration',()=>{
  it('preserves existing intents while adding VK states',()=>{
    expect(migration).toContain("'publish_vk'");
    expect(migration).toContain("'vk_vpn'");
    expect(migration).toContain("'telegram_preview'");
    expect(migration).toContain("'telegram_publish'");
    expect(migration).toContain('ALTER TABLE user_onboarding_intent_new RENAME TO user_onboarding_intent');
  });
});
