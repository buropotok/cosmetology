import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  detectSupportedImageContentType,
  downloadImage,
  isSafeHttpsUrl,
  parseImageSearchResult,
  readLimitedResponseBody,
} from './miniapp-image-search';
import { buildImageSearchPrompt } from './image-search-profiles';

afterEach(()=>{ vi.unstubAllGlobals(); });

describe('direct image search result contract',()=>{
  it('parses the exact three-line Gemini response',()=>{
    expect(parseImageSearchResult(`IMAGE_URL: https://cdn.brand.example/product.png\nSOURCE_URL: https://brand.example/products/product\nPRODUCT: Product Cream`)).toEqual({
      imageUrl:'https://cdn.brand.example/product.png',
      sourceUrl:'https://brand.example/products/product',
      product:'Product Cream',
    });
  });

  it('rejects malformed and unsafe URLs',()=>{
    expect(parseImageSearchResult('NOT_FOUND')).toBeNull();
    expect(parseImageSearchResult('IMAGE_URL: http://brand.example/a.png\nSOURCE_URL: https://brand.example/p\nPRODUCT: P')).toBeNull();
    expect(parseImageSearchResult('IMAGE_URL: https://127.0.0.1/a.png\nSOURCE_URL: https://brand.example/p\nPRODUCT: P')).toBeNull();
    expect(parseImageSearchResult('IMAGE_URL: https://brand.example/a.png\nSOURCE_URL: https://brand.example/p')).toBeNull();
    expect(isSafeHttpsUrl('https://brand.example/a.png')).toBe(true);
    expect(isSafeHttpsUrl('https://localhost/a.png')).toBe(false);
  });

  it('rebuilds a complete stateless prompt and excludes failed URLs on retry',()=>{
    const prompt=buildImageSearchPrompt('cosmetic_product','official','Бепантен — препарат на основе декспантенола',[
      {imageUrl:'https://brand.example/broken.png',reason:'broken_link'},
    ]);
    expect(prompt).toContain('Бепантен — препарат на основе декспантенола');
    expect(prompt).toContain('IMAGE_URL: https://brand.example/broken.png');
    expect(prompt).toContain('Не возвращай ни один из этих IMAGE_URL повторно');
    expect(prompt).toContain('официальный сайт производителя или официальный сайт бренда');
    expect(prompt).toContain('самостоятельно выбери один наиболее репрезентативный вариант');
  });
});

describe('bounded external response reads',()=>{
  it('cancels a stream as soon as the configured byte limit is exceeded',async()=>{
    let cancelled=false;
    let pullCount=0;
    const stream=new ReadableStream<Uint8Array>({
      pull(controller){ pullCount+=1; controller.enqueue(pullCount===1?new Uint8Array([1,2,3]):new Uint8Array([4,5,6])); },
      cancel(){cancelled=true;},
    });
    const result=await readLimitedResponseBody(new Response(stream),4,new AbortController().signal);
    expect(result).toBeNull();
    expect(cancelled).toBe(true);
    expect(pullCount).toBe(2);
  });
});

function pngFixture(){
  return new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,1,0,0,0,1,8,4,0,0,0,1,2,3,4]);
}
function jpegFixture(){ return new Uint8Array([0xff,0xd8,0xff,0xe0,0,16,0x4a,0x46,0x49,0x46,0,1,1,0,0,1,0xff,0xd9]); }
function gifFixture(){ return new Uint8Array([0x47,0x49,0x46,0x38,0x39,0x61,1,0,1,0,0,0,0,0x2c,0,0,0,0,0x3b]); }
function webpFixture(){ return new Uint8Array([0x52,0x49,0x46,0x46,12,0,0,0,0x57,0x45,0x42,0x50,0x56,0x50,0x38,0x20,1,2,3,4]); }

describe('downloaded image validation',()=>{
  it('accepts supported image signatures and rejects non-images',()=>{
    expect(detectSupportedImageContentType(pngFixture())).toBe('image/png');
    expect(detectSupportedImageContentType(jpegFixture())).toBe('image/jpeg');
    expect(detectSupportedImageContentType(gifFixture())).toBe('image/gif');
    expect(detectSupportedImageContentType(webpFixture())).toBe('image/webp');
    expect(detectSupportedImageContentType(new TextEncoder().encode('<html>not an image</html>'))).toBe('');
  });

  it('classifies a broken link for retry',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>new Response('missing',{status:404})));
    const result=await downloadImage('https://brand.example/missing.png',new AbortController().signal);
    expect(result.image).toBeNull();
    expect(result.reason).toBe('broken_link');
  });

  it('classifies invalid downloaded bytes for retry',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>new Response('<html>blocked</html>',{status:200,headers:{'content-type':'text/html'}})));
    const result=await downloadImage('https://brand.example/product.png',new AbortController().signal);
    expect(result.image).toBeNull();
    expect(result.reason).toBe('invalid_image');
  });

  it('returns valid downloaded image bytes',async()=>{
    const bytes=pngFixture();
    vi.stubGlobal('fetch',vi.fn(async()=>new Response(bytes,{status:200,headers:{'content-type':'image/png'}})));
    const result=await downloadImage('https://brand.example/product.png',new AbortController().signal);
    expect(result.reason).toBeNull();
    expect(result.image?.contentType).toBe('image/png');
    expect(new Uint8Array(result.image?.bytes || new ArrayBuffer(0))).toEqual(bytes);
  });
});
