import {describe,expect,it,vi} from 'vitest';
import type {PostDocument} from '../../../shared/post-document';
import {isPlausiblePublicUrl,sanitizePostDocumentLinks} from './link-validator';

const document=(url:string):PostDocument=>({schemaVersion:2,blocks:[{type:'paragraph',content:[{text:'Источник',marks:[{type:'link',href:url}]}]}],buttons:[{text:'Подробнее',url}]});

describe('publisher link validator',()=>{
  it('rejects placeholder and local URLs without fetching them',async()=>{
    const fetcher=vi.fn<typeof fetch>();
    const result=await sanitizePostDocumentLinks(document('https://example.com/beauty-trends'),fetcher);
    expect(result.buttons).toEqual([]);
    expect(result.blocks[0]).toEqual({type:'paragraph',content:[{text:'Источник'}]});
    expect(fetcher).not.toHaveBeenCalled();
    expect(isPlausiblePublicUrl('http://127.0.0.1/test')).toBe(false);
  });

  it('keeps a reachable public link',async()=>{
    const fetcher=vi.fn<typeof fetch>().mockResolvedValue(new Response(null,{status:200}));
    const result=await sanitizePostDocumentLinks(document('https://clinic.example.ru/article'),fetcher);
    expect(result.buttons?.[0]?.url).toBe('https://clinic.example.ru/article');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('drops 404 and network failures without failing the post',async()=>{
    const notFound=vi.fn<typeof fetch>().mockResolvedValue(new Response(null,{status:404}));
    expect((await sanitizePostDocumentLinks(document('https://real-domain.test/missing'),notFound)).buttons).toEqual([]);
    const failed=vi.fn<typeof fetch>().mockRejectedValue(new Error('network'));
    expect((await sanitizePostDocumentLinks(document('https://real-domain.test/error'),failed)).buttons).toEqual([]);
  });
});
