import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root=process.cwd().endsWith('/worker')?resolve(process.cwd(),'..'):process.cwd();
const entry=readFileSync(resolve(root,'worker/src/entry.ts'),'utf8');

describe('Mini App image search route',()=>{
  it('keeps internet search separate from generative image endpoint',()=>{
    expect(entry).toContain("url.pathname === '/api/miniapp/ai/image'");
    expect(entry).toContain("url.pathname === '/api/miniapp/ai/image/search'");
    expect(entry).toContain('searchMiniAppImage(req, env)');
  });
});
