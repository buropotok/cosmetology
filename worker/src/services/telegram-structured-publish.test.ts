import {afterEach,describe,expect,it,vi} from 'vitest';
import {publishTelegram} from './telegram';
import type {Env} from '../types';

const env={TELEGRAM_BOT_TOKEN:'token'} as Env;
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks()});
function ok(id=11){return new Response(JSON.stringify({ok:true,result:{message_id:id}}),{status:200})}
function rich(){return {plainText:'A',html:'A',blocks:[],richMessageHtml:'<details><summary>X</summary><p>A</p></details>'}}
const telegramFetch=(reply:()=>Response)=>vi.fn(async(_url:string,_init:RequestInit)=>reply());

describe('structured Telegram publishing',()=>{
  it('uses one sendRichMessage call without media',async()=>{
    const fetch=telegramFetch(()=>ok());vi.stubGlobal('fetch',fetch);
    const result=await publishTelegram(env,rich(),undefined,'@channel');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe('https://api.telegram.org/bottoken/sendRichMessage');
    expect(JSON.parse((fetch.mock.calls[0][1].body as FormData).get('rich_message') as string)).toEqual({html:rich().richMessageHtml});
    expect(result.delivery_mode).toBe('rich_message');
  });

  it('embeds one uploaded photo in the same Rich Message',async()=>{
    const fetch=telegramFetch(()=>ok(20));vi.stubGlobal('fetch',fetch);
    const image=new File(['photo'],'post.jpg',{type:'image/jpeg'});
    const result=await publishTelegram(env,rich(),image,'@channel');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe('https://api.telegram.org/bottoken/sendRichMessage');
    const body=fetch.mock.calls[0][1].body as FormData;
    const uploaded=body.get('photo0') as File;
    expect(uploaded).toBeInstanceOf(File);
    expect(uploaded.name).toBe(image.name);
    expect(uploaded.type).toBe(image.type);
    expect(uploaded.size).toBe(image.size);
    expect(JSON.parse(body.get('rich_message') as string)).toEqual({
      html:`<img src="tg://photo?id=photo0"/>${rich().richMessageHtml}`,
      media:[{id:'photo0',media:{type:'photo',media:'attach://photo0'}}],
    });
    expect(result.delivery_mode).toBe('rich_message_photo');
  });

  it('embeds multiple photos as a slideshow by default',async()=>{
    const fetch=telegramFetch(()=>ok(30));vi.stubGlobal('fetch',fetch);
    const images=[new File(['a'],'a.jpg',{type:'image/jpeg'}),new File(['b'],'b.jpg',{type:'image/jpeg'})];
    const result=await publishTelegram(env,rich(),images,'@channel');
    const payload=JSON.parse(((fetch.mock.calls[0][1].body as FormData).get('rich_message')) as string);
    expect(payload.html).toContain('<tg-slideshow>');
    expect(payload.html).toContain('tg://photo?id=photo0');
    expect(payload.html).toContain('tg://photo?id=photo1');
    expect(result.delivery_mode).toBe('rich_message_slideshow');
  });

  it('embeds multiple photos as a collage when selected',async()=>{
    const fetch=telegramFetch(()=>ok(40));vi.stubGlobal('fetch',fetch);
    const images=[new File(['a'],'a.jpg',{type:'image/jpeg'}),new File(['b'],'b.jpg',{type:'image/jpeg'})];
    const result=await publishTelegram(env,rich(),images,'@channel','collage');
    const payload=JSON.parse(((fetch.mock.calls[0][1].body as FormData).get('rich_message')) as string);
    expect(payload.html).toContain('<tg-collage>');
    expect(payload.html).not.toContain('<tg-slideshow>');
    expect(result.delivery_mode).toBe('rich_message_collage');
  });

  it('does not leave partially published media when Telegram rejects the Rich Message',async()=>{
    const fetch=telegramFetch(()=>new Response(JSON.stringify({ok:false,error_code:400,description:'bad rich message'}),{status:400}));vi.stubGlobal('fetch',fetch);
    const image=new File(['photo'],'post.jpg',{type:'image/jpeg'});
    await expect(publishTelegram(env,rich(),image,'@channel')).rejects.toMatchObject({code:'TELEGRAM_ERROR'});
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe('https://api.telegram.org/bottoken/sendRichMessage');
  });
});
