import { describe, expect, it, vi } from 'vitest';

const {appFetch}=vi.hoisted(()=>({appFetch:vi.fn(async()=>new Response('app route'))}));
vi.mock('./entry',()=>({default:{fetch:appFetch}}));
vi.mock('./services/watermarks',()=>({deleteWatermark:vi.fn(),getWatermark:vi.fn(),listWatermarks:vi.fn(),uploadWatermark:vi.fn()}));

import watermarkEntry from './watermark-entry';

describe('media route ownership',()=>{
  it('delegates gallery routes from the watermark wrapper to the application router',async()=>{
    const request=new Request('https://example.test/api/miniapp/media');
    const response=await watermarkEntry.fetch(request,{} as never,{} as never);
    expect(await response.text()).toBe('app route');
    expect(appFetch).toHaveBeenCalledWith(request,expect.anything(),expect.anything());
  });
});
