import {describe,it,expect} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('VK publish intent migration ordering',()=>{
  it('runs after the existing 0015 migration',()=>{
    const migrations=fs.readdirSync(path.resolve('migrations')).sort();
    expect(migrations).toContain('0015_vk_backup_message.sql');
    expect(migrations).toContain('0016_vk_publish_intent.sql');
    expect(migrations.indexOf('0016_vk_publish_intent.sql')).toBeGreaterThan(migrations.indexOf('0015_vk_backup_message.sql'));
  });
});
