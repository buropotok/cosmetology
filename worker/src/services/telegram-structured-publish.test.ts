import {afterEach,describe,expect,it,vi} from 'vitest';
import {publishTelegram} from './telegram';
import type {Env} from '../types';

const env={TELEGRAM_BOT_TOKEN:'token'} as Env;
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks()});

describe('structured Telegram publishing',()=>{
  it('uses sendRichMessage for structured HTML',async()=>{
    const fetch=vi.fn(async()=>new Response(JSON.stringify({ok:true,result:{message_id:11}}),{status:200}));
    vi.stubGlobal('fetch',fetch);
    const result=await publishTelegram(env,{plainText:'A',html:'A',blocks:[],richMessageHtml:'<blockquote><p>A</p></blockquote>'},undefined,'@channel');
    expect(fetch.mock.calls[0][0]).toBe('https://api.telegram.org/bottoken/sendRichMessage');
    const body=fetch.mock.calls[0][1].body as FormData;
    expect(JSON.parse(body.get('rich_message') as string)).toEqual({html:'<blockquote><p>A</p></blockquote>'});
    expect(result.delivery_mode).toBe('rich_message');
  });

  it('publishes media separately before a Rich Message so structure is not flattened into a caption',async()=>{
    let id=20;
    const fetch=vi.fn(async()=>new Response(JSON.stringify({ok:true,result:{message_id:id++}}),{status:200}));
    vi.stubGlobal('fetch',fetch);
    const image=new File(['photo'],'post.jpg',{type:'image/jpeg'});
    const result=await publishTelegram(env,{plainText:'A',html:'A',blocks:[],richMessageHtml:'<details><summary>X</summary><p>A</p></details>'},image,'@channel');
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[0][0]).toBe('https://api.telegram.org/bottoken/sendPhoto');
    expect((fetch.mock.calls[0][1].body as FormData).get('caption')).toBeNull();
    expect(fetch.mock.calls[1][0]).toBe('https://api.telegram.org/bottoken/sendRichMessage');
    expect(result.delivery_mode).toBe('photo_then_rich_message');
  });
});
