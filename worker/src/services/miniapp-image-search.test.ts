import { describe, expect, it, vi } from 'vitest';
import {
  createSearchDeadline,
  detectSupportedImageContentType,
  extractExpectedOfficialHost,
  extractPageImageCandidates,
  officialHostMatches,
  officialPageHostMatches,
  readLimitedResponseBody,
} from './miniapp-image-search';

describe('official image page extraction',()=>{
  it('prefers real page metadata and resolves relative image URLs',()=>{
    const html=`<html><head>
      <meta property="og:image" content="/media/product.jpg">
      <meta name="twitter:image" content="https://cdn.example.com/product.webp">
    </head></html>`;
    expect(extractPageImageCandidates(html,'https://brand.example/products/test')).toEqual([
      'https://brand.example/media/product.jpg',
      'https://cdn.example.com/product.webp',
    ]);
  });

  it('ignores unsafe non-https image candidates',()=>{
    const html=`<meta property="og:image" content="http://brand.example/product.jpg">
      <meta name="twitter:image" content="https://brand.example/ok.jpg">`;
    expect(extractPageImageCandidates(html,'https://brand.example/product')).toEqual([
      'https://brand.example/ok.jpg',
    ]);
  });
});

describe('official grounded source selection',()=>{
  it('accepts only the hostname explicitly selected by the grounded answer',()=>{
    expect(extractExpectedOfficialHost('FOUND — Test Product — www.brand.example')).toBe('brand.example');
    expect(officialHostMatches('products.brand.example','brand.example')).toBe(true);
    expect(officialHostMatches('unrelated-store.example','brand.example')).toBe(false);
  });

  it('requires the fetched grounded page to use the exact selected hostname',()=>{
    expect(officialPageHostMatches('www.brand.example','brand.example')).toBe(true);
    expect(officialPageHostMatches('products.brand.example','brand.example')).toBe(false);
    expect(officialPageHostMatches('brand.co.uk','co.uk')).toBe(false);
  });

  it('rejects malformed FOUND responses without an official hostname',()=>{
    expect(extractExpectedOfficialHost('FOUND — Test Product')).toBe('');
    expect(extractExpectedOfficialHost('FOUND — Test Product — http://brand.example/path')).toBe('');
    expect(extractExpectedOfficialHost('FOUND — Test Product — com')).toBe('');
  });
});

describe('bounded external response reads',()=>{
  it('cancels a stream as soon as the configured byte limit is exceeded',async()=>{
    let cancelled=false;
    let pullCount=0;
    const stream=new ReadableStream<Uint8Array>({
      pull(controller){
        pullCount+=1;
        controller.enqueue(pullCount===1?new Uint8Array([1,2,3]):new Uint8Array([4,5,6]));
      },
      cancel(){cancelled=true;},
    });
    const response=new Response(stream);
    const result=await readLimitedResponseBody(response,4,new AbortController().signal);
    expect(result).toBeNull();
    expect(cancelled).toBe(true);
    expect(pullCount).toBe(2);
  });

  it('returns a bounded response without relying on Content-Length',async()=>{
    const response=new Response(new Uint8Array([1,2,3,4]));
    const result=await readLimitedResponseBody(response,4,new AbortController().signal);
    expect(Array.from(result||[])).toEqual([1,2,3,4]);
  });
});

describe('overall search deadline',()=>{
  it('aborts the search signal when the application deadline expires',()=>{
    vi.useFakeTimers();
    try{
      const parent=new AbortController();
      const deadline=createSearchDeadline(parent.signal,1000);
      expect(deadline.signal.aborted).toBe(false);
      expect(deadline.timedOut()).toBe(false);
      vi.advanceTimersByTime(1000);
      expect(deadline.signal.aborted).toBe(true);
      expect(deadline.timedOut()).toBe(true);
      deadline.dispose();
    }finally{
      vi.useRealTimers();
    }
  });

  it('preserves request cancellation separately from a timeout',()=>{
    vi.useFakeTimers();
    try{
      const parent=new AbortController();
      const deadline=createSearchDeadline(parent.signal,1000);
      parent.abort();
      expect(deadline.signal.aborted).toBe(true);
      expect(deadline.timedOut()).toBe(false);
      deadline.dispose();
    }finally{
      vi.useRealTimers();
    }
  });
});

function pngFixture(){
  return new Uint8Array([
    0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,
    0,0,0,13,0x49,0x48,0x44,0x52,
    0,0,0,1,0,0,0,1,8,2,0,0,0,0,0,0,0,
    0,0,0,0,0x49,0x45,0x4e,0x44,0,0,0,0,
  ]);
}

function jpegFixture(){
  return new Uint8Array([
    0xff,0xd8,
    0xff,0xc0,0,11,8,0,1,0,1,1,1,0x11,0,
    0xff,0xd9,
  ]);
}

function gifFixture(){
  return new Uint8Array([0x47,0x49,0x46,0x38,0x39,0x61,1,0,1,0,0,0,0,0x3b]);
}

function webpFixture(){
  return new Uint8Array([0x52,0x49,0x46,0x46,12,0,0,0,0x57,0x45,0x42,0x50,0x56,0x50,0x38,0x20,0,0,0,0]);
}

describe('downloaded image validation',()=>{
  it('accepts structurally complete supported image containers',()=>{
    expect(detectSupportedImageContentType(pngFixture())).toBe('image/png');
    expect(detectSupportedImageContentType(jpegFixture())).toBe('image/jpeg');
    expect(detectSupportedImageContentType(gifFixture())).toBe('image/gif');
    expect(detectSupportedImageContentType(webpFixture())).toBe('image/webp');
  });

  it('rejects truncated payloads even when their magic prefix is valid',()=>{
    expect(detectSupportedImageContentType(new Uint8Array([0xff,0xd8,0xff]))).toBe('');
    expect(detectSupportedImageContentType(pngFixture().slice(0,-12))).toBe('');
    expect(detectSupportedImageContentType(gifFixture().slice(0,-1))).toBe('');
    expect(detectSupportedImageContentType(webpFixture().slice(0,-1))).toBe('');
    expect(detectSupportedImageContentType(new TextEncoder().encode('<html>not an image</html>'))).toBe('');
  });
});
