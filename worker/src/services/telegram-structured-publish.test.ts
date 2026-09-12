import {afterEach,describe,expect,it,vi} from 'vitest';
import {publishTelegram} from './telegram';
import type {Env} from '../types';

const env={TELEGRAM_BOT_TOKEN:'token'} as Env;
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks()});

function okFetch(){let id=20;return vi.fn(async(_url:string,_init:RequestInit)=>new Response(JSON.stringify({ok:true,result:{message_id:id++}}),{status:200}))}

describe('structured Telegram publishing',()=>{
  it('uses sendRichMessage for structured HTML without media',async()=>{
    const fetch=okFetch();vi.stubGlobal('fetch',fetch);
    const result=await publishTelegram(env,{plainText:'A',html:'A',blocks:[],richMessageHtml:'<blockquote><p>A</p></blockquote>'},undefined,'@channel');
    expect(fetch.mock.calls[0][0]).toBe('https://api.telegram.org/bottoken/sendRichMessage');
    const body=fetch.mock.calls[0][1].body as FormData;
    expect(JSON.parse(body.get('rich_message') as string)).toEqual({html:'<blockquote><p>A</p></blockquote>'});
    expect(result.delivery_mode).toBe('rich_message');
  });

  it('sends short plain text with a photo as one captioned photo',async()=>{
    const fetch=okFetch();vi.stubGlobal('fetch',fetch);
    await publishTelegram(env,'Plain caption',new File(['photo'],'post.jpg',{type:'image/jpeg'}),'@channel');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe('https://api.telegram.org/bottoken/sendPhoto');
    const body=fetch.mock.calls[0][1].body as FormData;
    expect(body.get('caption')).toBe('Plain caption');
    expect(body.get('parse_mode')).toBeNull();
  });

  it('sends short rich text with a photo as one HTML caption and preserves formatting',async()=>{
    const fetch=okFetch();vi.stubGlobal('fetch',fetch);
    const html='<b>Bold</b> <i>italic</i> <a href="https://example.com/">link</a>';
    const result=await publishTelegram(env,{plainText:'Bold italic link',html,blocks:[],richMessageHtml:'<details><summary>X</summary><p>Body</p></details>'},new File(['photo'],'post.jpg',{type:'image/jpeg'}),'@channel');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe('https://api.telegram.org/bottoken/sendPhoto');
    const body=fetch.mock.calls[0][1].body as FormData;
    expect(body.get('caption')).toBe(html);
    expect(body.get('parse_mode')).toBe('HTML');
    expect(result.delivery_mode).toBe('photo_with_caption');
  });

  it('does not split a short renderer-supported details/list post merely because richMessageHtml exists',async()=>{
    const fetch=okFetch();vi.stubGlobal('fetch',fetch);
    const html='<blockquote expandable><b>Подробнее</b>\n\nПункт</blockquote>\n• Элемент';
    await publishTelegram(env,{plainText:'Подробнее\nПункт\n• Элемент',html,blocks:[],richMessageHtml:'<details><summary>Подробнее</summary><p>Пункт</p></details><ul><li>Элемент</li></ul>'},new File(['photo'],'post.jpg',{type:'image/jpeg'}),'@channel');
    expect(fetch).toHaveBeenCalledTimes(1);
    const body=fetch.mock.calls[0][1].body as FormData;
    expect(body.get('caption')).toBe(html);
    expect(body.get('parse_mode')).toBe('HTML');
    expect(fetch.mock.calls.some(call=>String(call[0]).endsWith('/sendRichMessage'))).toBe(false);
    expect(fetch.mock.calls.some(call=>String(call[0]).endsWith('/sendMessage'))).toBe(false);
  });

  it('keeps the caption-limit fallback for long rich text',async()=>{
    const fetch=okFetch();vi.stubGlobal('fetch',fetch);
    const text='x'.repeat(1025);
    const result=await publishTelegram(env,{plainText:text,html:`<b>${text}</b>`,blocks:[],richMessageHtml:'<details><summary>X</summary><p>Long</p></details>'},new File(['photo'],'post.jpg',{type:'image/jpeg'}),'@channel');
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[0][0]).toBe('https://api.telegram.org/bottoken/sendPhoto');
    expect((fetch.mock.calls[0][1].body as FormData).get('caption')).toBeNull();
    expect(fetch.mock.calls[1][0]).toBe('https://api.telegram.org/bottoken/sendMessage');
    expect((fetch.mock.calls[1][1].body as FormData).get('text')).toBe(`<b>${text}</b>`);
    expect((fetch.mock.calls[1][1].body as FormData).get('parse_mode')).toBe('HTML');
    expect(result.delivery_mode).toBe('photo_then_text');
  });

  it('uses rendered HTML text length at the 1024-character caption boundary',async()=>{
    const fetch=okFetch();vi.stubGlobal('fetch',fetch);
    const plainText='x'.repeat(1024),html=`${plainText}\n`;
    const result=await publishTelegram(env,{plainText,html,blocks:[],richMessageHtml:'<details><summary>X</summary><p>Body</p></details>'},new File(['photo'],'post.jpg',{type:'image/jpeg'}),'@channel');
    expect(fetch).toHaveBeenCalledTimes(2);
    expect((fetch.mock.calls[0][1].body as FormData).get('caption')).toBeNull();
    expect(fetch.mock.calls[1][0]).toBe('https://api.telegram.org/bottoken/sendMessage');
    expect(result.delivery_mode).toBe('photo_then_text');
  });

  it('avoids sendMessage when rendered rich text exceeds the 4096-character message limit',async()=>{
    const fetch=okFetch();vi.stubGlobal('fetch',fetch);
    const plainText='x'.repeat(4096),html=`${plainText}\n`;
    const result=await publishTelegram(env,{plainText,html,blocks:[],richMessageHtml:'<details><summary>X</summary><p>Body</p></details>'},new File(['photo'],'post.jpg',{type:'image/jpeg'}),'@channel');
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[0][0]).toBe('https://api.telegram.org/bottoken/sendPhoto');
    expect(fetch.mock.calls[1][0]).toBe('https://api.telegram.org/bottoken/sendRichMessage');
    expect(result.delivery_mode).toBe('photo_then_rich_message');
  });

  it('puts short rich HTML on the first media-group item instead of sending a Rich Message',async()=>{
    const fetch=vi.fn(async(url:string,_init:RequestInit)=>new Response(JSON.stringify({ok:true,result:url.endsWith('/sendMediaGroup')?[{message_id:30},{message_id:31}]:{message_id:32}}),{status:200}));vi.stubGlobal('fetch',fetch);
    const images=[new File(['one'],'one.jpg',{type:'image/jpeg'}),new File(['two'],'two.jpg',{type:'image/jpeg'})];
    const html='<b>Album</b>\n• One';
    await publishTelegram(env,{plainText:'Album\n• One',html,blocks:[],richMessageHtml:'<ul><li>One</li></ul>'},images,'@channel');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe('https://api.telegram.org/bottoken/sendMediaGroup');
    const media=JSON.parse((fetch.mock.calls[0][1].body as FormData).get('media') as string);
    expect(media[0]).toMatchObject({caption:html,parse_mode:'HTML'});
    expect(media[1].caption).toBeUndefined();
  });
});
