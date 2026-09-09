import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe,expect,it} from 'vitest';

const root=process.cwd().endsWith('/worker')?resolve(process.cwd(),'..'):process.cwd();
const file=path=>readFileSync(resolve(root,path),'utf8');

describe('runtime diagnostics integration',()=>{
  it('routes authenticated Mini App diagnostics to the dedicated service',()=>{
    const entry=file('worker/src/entry.ts');
    expect(entry).toContain("import { saveRuntimeDiagnostics } from './services/runtime-diagnostics'");
    expect(entry).toContain("url.pathname === '/api/miniapp/runtime-diagnostics'");
    expect(entry).toContain('saveRuntimeDiagnostics(req,env)');
  });

  it('uses the dedicated runtime log bucket instead of treating logs as post images',()=>{
    expect(file('worker/src/types.ts')).toContain('LOGS:R2Bucket');
    const wrangler=file('worker/wrangler.jsonc');
    expect(wrangler).toContain('"binding": "LOGS"');
    expect(wrangler).toContain('"bucket_name": "cosmetology-runtime-artifacts"');
    expect(file('worker/src/services/runtime-diagnostics.ts')).toContain('env.LOGS.put');
  });
});
