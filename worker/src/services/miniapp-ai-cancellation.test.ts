import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('./miniapp-ai.ts',import.meta.url),'utf8');
const wrangler=readFileSync(new URL('../../wrangler.jsonc',import.meta.url),'utf8');

describe('Mini App AI request cancellation',()=>{
  it('forwards the incoming request signal to every Gemini generation call',()=>{
    expect(source.match(/abortSignal: req\.signal/g)).toHaveLength(3);
    expect(source).toContain("const cancelled = req.signal.aborted");
    expect(source).toContain("cancelled ? 'AI_GENERATION_CANCELLED' : 'AI_GENERATION_FAILED'");
    expect(source).toContain('if (cancelled) return { cancelled: true }');
  });

  it('enables Cloudflare incoming request cancellation',()=>{
    const config=JSON.parse(wrangler) as {compatibility_flags?:string[]};
    expect(config.compatibility_flags).toContain('enable_request_signal');
  });
});
