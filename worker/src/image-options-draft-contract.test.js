import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root=process.cwd().endsWith('/worker')?resolve(process.cwd(),'..'):process.cwd();
const drafts=readFileSync(resolve(root,'worker/src/services/miniapp-drafts.ts'),'utf8');
const migration=readFileSync(resolve(root,'worker/migrations/0020_miniapp_draft_image_options.sql'),'utf8');

describe('Composer image options draft contract',()=>{
  it('persists image options as Composer draft state instead of AI state',()=>{
    expect(migration).toContain('image_options');
    expect(drafts).toContain('image_options AS imageOptionsJson');
    expect(drafts).toContain("form.get('imageOptions')");
    expect(drafts).toContain('image_options=excluded.image_options');
    expect(drafts).toContain('imageOptions');
  });
});
