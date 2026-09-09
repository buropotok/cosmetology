import {describe,expect,it,vi} from 'vitest';
import type {PostDocument} from '../../../shared/post-document';
import {isPlausiblePublicUrl,isReachablePublicUrl,resolveReachablePublicUrl,sanitizePostDocumentLinks} from './link-validator';

const document=(url:string):PostDocument=>({schemaVersion:2,blocks:[{type:'paragraph',content:[{text:'Источник',marks:[{type:'link',href:url}]}]}],buttons:[{text:'Подробнее',url}]});
const responseAt=(url:string,status=200)=>({status,url} as Response);

describe('publisher link validator',()=>{
  it('rejects placeholder and local URLs without fetching them',async()=>{
    const fetcher=vi.fn<typeof fetch>();
    const result=await sanitizePostDocumentLinks(document('https://example.com/beauty-trends'),fetcher);
    expect(result.buttons).toEqual([]);
    expect(result.blocks[0]).toEqual({type:'paragraph',content:[{text:'Источник'}]});
    expect(fetcher).not.toHaveBeenCalled();
    expect(isPlausiblePublicUrl('https://docs.example.com/source')).toBe(false);
    expect(isPlausiblePublicUrl('http://127.0.0.1/test')).toBe(false);
    expect(await isReachablePublicUrl('https://example.org/source',fetcher)).toBe(false);
  });

  it('keeps a reachable public link',async()=>{
    const fetcher=vi.fn<typeof fetch>().mockResolvedValue(new Response(null,{status:200}));
    const result=await sanitizePostDocumentLinks(document('https://clinic.example.ru/article'),fetcher);
    expect(result.buttons?.[0]?.url).toBe('https://clinic.example.ru/article');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(await isReachablePublicUrl('https://clinic.example.ru/article',fetcher)).toBe(true);
  });

  it('falls back to a ranged GET when HEAD cannot verify the page',async()=>{
    const fetcher=vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null,{status:403}))
      .mockResolvedValueOnce(new Response(null,{status:206}));
    expect(await isReachablePublicUrl('https://journal.example.ru/article',fetcher)).toBe(true);
    expect(fetcher).toHaveBeenNthCalledWith(1,'https://journal.example.ru/article',expect.objectContaining({method:'HEAD',redirect:'follow'}));
    expect(fetcher).toHaveBeenNthCalledWith(2,'https://journal.example.ru/article',expect.objectContaining({method:'GET',redirect:'follow',headers:{Range:'bytes=0-0'}}));
  });

  it('resolves Google grounding redirects to the final public page and rewrites links',async()=>{
    const redirect='https://vertexaisearch.cloud.google.com/grounding-api-redirect/token';
    const finalUrl='https://www.uclahealth.org/news/article/skin-research';
    const fetcher=vi.fn<typeof fetch>().mockResolvedValue(responseAt(finalUrl));
    expect(await resolveReachablePublicUrl(redirect,fetcher)).toBe(finalUrl);
    const result=await sanitizePostDocumentLinks(document(redirect),fetcher);
    expect(result.buttons?.[0]?.url).toBe(finalUrl);
    expect(result.blocks[0]).toEqual({type:'paragraph',content:[{text:'Источник',marks:[{type:'link',href:finalUrl}]}]});
  });

  it('rejects redirects whose final URL is not public',async()=>{
    const fetcher=vi.fn<typeof fetch>().mockResolvedValue(responseAt('http://127.0.0.1/internal'));
    expect(await resolveReachablePublicUrl('https://public.example.ru/redirect',fetcher)).toBeNull();
  });

  it('drops 404 and network failures without failing the post',async()=>{
    const notFound=vi.fn<typeof fetch>().mockResolvedValue(new Response(null,{status:404}));
    expect((await sanitizePostDocumentLinks(document('https://real-domain.test/missing'),notFound)).buttons).toEqual([]);
    const failed=vi.fn<typeof fetch>().mockRejectedValue(new Error('network'));
    expect((await sanitizePostDocumentLinks(document('https://real-domain.test/error'),failed)).buttons).toEqual([]);
  });
});
