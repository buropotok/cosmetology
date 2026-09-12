import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./telegram-miniapp-auth',()=>({
  validateTelegramMiniAppInitData:vi.fn(async()=>({user:{id:1}})),
}));

import {
  buildOpenAIImageSearchRequest,
  detectSupportedImageContentType,
  downloadImage,
  extractImageSearchResults,
  isSafeHttpsUrl,
  readLimitedResponseBody,
  searchMiniAppImage,
} from './miniapp-image-search';

afterEach(()=>{ vi.unstubAllGlobals(); });

describe('OpenAI image web search contract',()=>{
  it('requires raw image results from the Responses web_search tool',()=>{
    const request=buildOpenAIImageSearchRequest('find product images');
    expect(request.model).toBe('gpt-5.6-luna');
    expect(request.tool_choice).toBe('required');
    expect(request.include).toEqual(['web_search_call.results']);
    expect(request.tools).toEqual([{
      type:'web_search',
      search_content_types:['image','text'],
      image_settings:{max_results:8,caption:true},
    }]);
  });

  it('extracts, normalizes and deduplicates image_result entries',()=>{
    const payload={output:[{type:'web_search_call',results:[
      {type:'image_result',image_url:'https://brand.example/product.jpg',thumbnail_url:'https://thumb.example/product.jpg',source_website_url:'https://brand.example/product',caption:'Product'},
      {type:'image_result',image_url:'https://brand.example/product.jpg',thumbnail_url:'https://thumb.example/duplicate.jpg',source_website_url:'https://brand.example/product',caption:'Duplicate'},
      {type:'search_result',url:'https://brand.example/text'},
      {type:'image_result',image_url:'http://unsafe.example/product.jpg',source_website_url:'https://brand.example/product'},
    ]}]};
    expect(extractImageSearchResults(payload)).toEqual([{
      imageUrl:'https://brand.example/product.jpg',
      thumbnailUrl:'https://thumb.example/product.jpg',
      sourceUrl:'https://brand.example/product',
      caption:'Product',
    }]);
  });

  it('falls back to the canonical image when thumbnail_url is missing or unsafe',()=>{
    const payload={output:[{type:'web_search_call',results:[
      {type:'image_result',image_url:'https://brand.example/a.jpg',source_website_url:'https://brand.example/a',caption:null},
      {type:'image_result',image_url:'https://brand.example/b.jpg',thumbnail_url:'http://unsafe.example/b.jpg',source_website_url:'https://brand.example/b'},
    ]}]};
    expect(extractImageSearchResults(payload).map(item=>item.thumbnailUrl)).toEqual([
      'https://brand.example/a.jpg','https://brand.example/b.jpg',
    ]);
    expect(isSafeHttpsUrl('https://brand.example/a.png')).toBe(true);
    expect(isSafeHttpsUrl('https://localhost/a.png')).toBe(false);
  });

  it('signs returned URLs and rejects a tampered selection token before downloading',async()=>{
    const openAiFetch=vi.fn(async()=>new Response(JSON.stringify({output:[{type:'web_search_call',results:[
      {type:'image_result',image_url:'https://brand.example/product.png',thumbnail_url:'https://brand.example/thumb.png',source_website_url:'https://brand.example/product',caption:'Product'},
    ]}]}),{status:200,headers:{'content-type':'application/json'}}));
    vi.stubGlobal('fetch',openAiFetch);
    const env={TELEGRAM_BOT_TOKEN:'test-bot-secret',OPENAI_API_KEY:'test-openai-key'} as any;
    const searchRequest=new Request('https://app.example/api/miniapp/ai/image/search',{
      method:'POST',headers:{authorization:'tma test','content-type':'application/json'},
      body:JSON.stringify({text:'Пост про Product',searchProfile:'cosmetic_product',sourcePolicy:'official'}),
    });
    const searchResponse=await searchMiniAppImage(searchRequest,env);
    const payload=await searchResponse.json() as {images:Array<{imageUrl:string;importToken:string}>};
    expect(payload.images).toHaveLength(1);
    expect(payload.images[0].importToken).toContain('.');
    const token=payload.images[0].importToken;
    const tampered=`${token.slice(0,-1)}${token.endsWith('a')?'b':'a'}`;
    const importRequest=new Request('https://app.example/api/miniapp/ai/image/search',{
      method:'POST',headers:{authorization:'tma test','content-type':'application/json'},
      body:JSON.stringify({imageUrl:payload.images[0].imageUrl,importToken:tampered}),
    });
    await expect(searchMiniAppImage(importRequest,env)).rejects.toMatchObject({code:'AI_IMAGE_SEARCH_RESULT_INVALID',status:400});
    expect(openAiFetch).toHaveBeenCalledTimes(1);
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
  return new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,1,0,0,0,1,8,4,0,0,0,181,28,12,2,0,0,0,11,73,68,65,84,120,218,99,100,248,15,0,1,5,1,1,39,24,227,102,0,0,0,0,73,69,78,68,174,66,96,130]);
}
function jpegFixture(){ return new Uint8Array([0xff,0xd8,0xff,0xc0,0,11,8,0,1,0,1,1,1,0,0,0xff,0xda,0,8,1,1,0,0,0,0,1,2,0xff,0xd9]); }
function gifFixture(){ return new Uint8Array([0x47,0x49,0x46,0x38,0x39,0x61,1,0,1,0,0,0,0,0x2c,0,0,0,0,1,0,1,0,0,2,1,0,0,0x3b]); }
function webpFixture(){ return new Uint8Array([0x52,0x49,0x46,0x46,16,0,0,0,0x57,0x45,0x42,0x50,0x56,0x50,0x38,0x20,4,0,0,0,1,2,3,4]); }

describe('selected web image validation',()=>{
  it('accepts structurally complete supported images and rejects non-images',()=>{
    expect(detectSupportedImageContentType(pngFixture())).toBe('image/png');
    expect(detectSupportedImageContentType(jpegFixture())).toBe('image/jpeg');
    expect(detectSupportedImageContentType(gifFixture())).toBe('image/gif');
    expect(detectSupportedImageContentType(webpFixture())).toBe('image/webp');
    expect(detectSupportedImageContentType(new TextEncoder().encode('<html>not an image</html>'))).toBe('');
  });

  it('rejects truncated files even when their signatures are intact',()=>{
    const png=pngFixture();
    const jpeg=jpegFixture();
    const gif=gifFixture();
    const webp=webpFixture();
    expect(detectSupportedImageContentType(png.slice(0,-12))).toBe('');
    expect(detectSupportedImageContentType(jpeg.slice(0,-2))).toBe('');
    expect(detectSupportedImageContentType(gif.slice(0,-1))).toBe('');
    expect(detectSupportedImageContentType(webp.slice(0,-2))).toBe('');
  });

  it('classifies a broken selected URL as unavailable',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>new Response('missing',{status:404})));
    const result=await downloadImage('https://brand.example/missing.png',new AbortController().signal);
    expect(result.image).toBeNull();
    expect(result.reason).toBe('broken_link');
  });

  it('returns valid downloaded image bytes for the selected result',async()=>{
    const bytes=pngFixture();
    vi.stubGlobal('fetch',vi.fn(async()=>new Response(bytes,{status:200,headers:{'content-type':'image/png'}})));
    const result=await downloadImage('https://brand.example/product.png',new AbortController().signal);
    expect(result.reason).toBeNull();
    expect(result.image?.contentType).toBe('image/png');
    expect(new Uint8Array(result.image?.bytes || new ArrayBuffer(0))).toEqual(bytes);
  });

  it('rejects invalid selected image bytes',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>new Response('<html>blocked</html>',{status:200,headers:{'content-type':'text/html'}})));
    const invalid=await downloadImage('https://brand.example/product.png',new AbortController().signal);
    expect(invalid.image).toBeNull();
    expect(invalid.reason).toBe('invalid_image');
  });

  it('rejects truncated selected image bytes',async()=>{
    const truncated=pngFixture().slice(0,-12);
    vi.stubGlobal('fetch',vi.fn(async()=>new Response(truncated,{status:200,headers:{'content-type':'image/png'}})));
    const invalid=await downloadImage('https://brand.example/truncated.png',new AbortController().signal);
    expect(invalid.image).toBeNull();
    expect(invalid.reason).toBe('invalid_image');
  });
});
