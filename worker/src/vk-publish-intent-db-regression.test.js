import {describe,it,expect} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const original=fs.readFileSync(path.resolve('migrations/0014_onboarding_action_intents.sql'),'utf8');
const migration=fs.readFileSync(path.resolve('migrations/0016_vk_publish_intent.sql'),'utf8');

describe('VK publish intent D1 regression',()=>{
  it('widens the original CHECK constraints that rejected the new VK state',()=>{
    expect(original).not.toContain("'publish_vk'");
    expect(original).not.toContain("'vk_vpn'");
    expect(migration).toContain("CHECK(action IN ('telegram_preview','telegram_publish','publish_vk'))");
    expect(migration).toContain("'vk_vpn'");
    expect(migration).toContain('INSERT INTO user_onboarding_intent_new');
  });
});
