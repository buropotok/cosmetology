import {afterEach,describe,expect,it,vi} from 'vitest';
import {publishTelegram} from './telegram';
import type {Env} from '../types';

const env={TELEGRAM_BOT_TOKEN:'token'} as Env;
afterEach(()=>vi.unstubAllGlobals());
describe('Telegram rich-text publishing',()=>{
  it('sends renderer HTML with parse_mode and a real expandable blockquote',async()=>{
    const fetch=vi.fn(async(_url:string,init:RequestInit)=>new Response(JSON.stringify({ok:true,result:{message_id:7}}),{status:200}));vi.stubGlobal('fetch',fetch);
    await publishTelegram(env,{plainText:'Подробнее',html:'<blockquote expandable><tg-spoiler>Подробнее</tg-spoiler></blockquote>',blocks:[]},undefined,'@channel');
    const body=fetch.mock.calls[0][1].body as FormData;
    expect(body.get('parse_mode')).toBe('HTML');
    expect(body.get('text')).toBe('<blockquote expandable><tg-spoiler>Подробнее</tg-spoiler></blockquote>');
  });
  it('uses the shared plan to split an over-limit photo caption',async()=>{
    const fetch=vi.fn(async(_url:string,init:RequestInit)=>new Response(JSON.stringify({ok:true,result:{message_id:8}}),{status:200}));vi.stubGlobal('fetch',fetch);
    const result=await publishTelegram(env,{plainText:'x'.repeat(1025),html:'x'.repeat(1025),blocks:[]},new File(['photo'],'post.jpg',{type:'image/jpeg'}),'@channel');
    expect(fetch).toHaveBeenCalledTimes(2);expect((fetch.mock.calls[0][1] as RequestInit).body instanceof FormData).toBe(true);expect(((fetch.mock.calls[0][1] as RequestInit).body as FormData).get('caption')).toBeNull();expect(((fetch.mock.calls[1][1] as RequestInit).body as FormData).get('text')).toBe('x'.repeat(1025));expect(result.delivery_mode).toBe('photo_then_text');
  });
  it('sends document buttons as an inline keyboard',async()=>{const fetch=vi.fn(async(_url:string,init:RequestInit)=>new Response(JSON.stringify({ok:true,result:{message_id:9}}),{status:200}));vi.stubGlobal('fetch',fetch);await publishTelegram(env,{plainText:'Текст',html:'Текст',blocks:[],buttons:[{text:'Открыть',url:'https://example.com/'}]},undefined,'@channel');expect(JSON.parse((fetch.mock.calls[0][1].body as FormData).get('reply_markup') as string)).toEqual({inline_keyboard:[[{text:'Открыть',url:'https://example.com/'}]]})});
});
