import {afterEach,describe,expect,it,vi} from 'vitest';
import {publishTelegram} from './telegram';
import type {Env} from '../types';

const env={TELEGRAM_BOT_TOKEN:'token'} as Env;
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks()});
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

describe('Managed Bot request reply keyboard',()=>{
  it('sends request_managed_bot in a reply keyboard, never an inline keyboard',async()=>{
    const fetch=vi.fn(async(_url:string,init:RequestInit)=>new Response(JSON.stringify({ok:true,result:{message_id:10}})));vi.stubGlobal('fetch',fetch);
    const {sendTelegramManagedBotRequest}=await import('./telegram');
    await sendTelegramManagedBotRequest(env,'42',-123456789,'Cosmo Sofa Test','cosmo_sofa_ab12cd_bot');
    const body=fetch.mock.calls[0][1].body as FormData,markup=JSON.parse(body.get('reply_markup') as string);
    expect(body.get('chat_id')).toBe('42');
    expect(body.get('text')).toBe('Создайте персонального Telegram-бота для Cosmo Sofa.');
    expect(markup).toEqual({keyboard:[[{text:'Создать персонального бота',request_managed_bot:{request_id:-123456789,suggested_name:'Cosmo Sofa Test',suggested_username:'cosmo_sofa_ab12cd_bot'}}]],resize_keyboard:true,one_time_keyboard:true});
    expect(markup.inline_keyboard).toBeUndefined();
  });
});

describe('Managed Bot token transport diagnostics',()=>{
  it('passes the getManagedBotToken String unchanged into a valid getMe request',async()=>{
    const managedToken='8771271779:managed-secret';
    const fetch=vi.fn(async(url:string,init:RequestInit)=>url.endsWith('/getManagedBotToken')
      ?new Response(JSON.stringify({ok:true,result:managedToken}))
      :new Response(JSON.stringify({ok:true,result:{id:8771271779,username:'managed_bot',first_name:'Managed'}})));
    vi.stubGlobal('fetch',fetch);
    const {getManagedTelegramBotToken,getTelegramBotMeWithToken}=await import('./telegram');
    const received=await getManagedTelegramBotToken(env,'8771271779');
    await getTelegramBotMeWithToken(received);
    expect(received).toBe(managedToken);
    expect(fetch.mock.calls[0][0]).toBe('https://api.telegram.org/bottoken/getManagedBotToken');
    expect(((fetch.mock.calls[0][1].body as FormData).get('user_id'))).toBe('8771271779');
    expect(fetch.mock.calls[1][0]).toBe(`https://api.telegram.org/bot${managedToken}/getMe`);
    expect((fetch.mock.calls[1][1].body as FormData).get('user_id')).toBeNull();
  });

  it('logs a redacted transport failure when fetch throws',async()=>{
    const managedToken='8771271779:transport-secret';
    const url=`https://api.telegram.org/bot${managedToken}/getMe`;
    const error=vi.spyOn(console,'error').mockImplementation(()=>undefined);
    vi.stubGlobal('fetch',vi.fn(async()=>{throw new TypeError(`Failed to fetch ${url} using ${managedToken}`)}));
    const {getTelegramBotMeWithToken}=await import('./telegram');
    await expect(getTelegramBotMeWithToken(managedToken)).rejects.toMatchObject({code:'TELEGRAM_ERROR',status:502});
    expect(error).toHaveBeenCalledWith({event:'telegram_bot_api_transport_error',method:'getMe',errorName:'TypeError',errorMessage:'Failed to fetch [REDACTED] using [REDACTED]'});
    expect(JSON.stringify(error.mock.calls)).not.toContain(managedToken);
  });

  it('logs response metadata without logging a non-JSON response body',async()=>{
    const managedToken='8771271779:parse-secret';
    const responseBody='upstream body must stay private';
    const error=vi.spyOn(console,'error').mockImplementation(()=>undefined);
    vi.stubGlobal('fetch',vi.fn(async()=>new Response(responseBody,{status:502,headers:{'content-type':'text/plain'}})));
    const {getTelegramBotMeWithToken}=await import('./telegram');
    await expect(getTelegramBotMeWithToken(managedToken)).rejects.toMatchObject({code:'TELEGRAM_ERROR',status:502});
    expect(error).toHaveBeenCalledWith({event:'telegram_bot_api_response_parse_error',method:'getMe',httpStatus:502,contentType:'text/plain',responseLength:responseBody.length});
    const logged=JSON.stringify(error.mock.calls);
    expect(logged).not.toContain(responseBody);
    expect(logged).not.toContain(managedToken);
  });

  it('logs only safe Telegram error metadata and keeps the token out of logs',async()=>{
    const managedToken='8771271779:never-log-this';
    const error=vi.spyOn(console,'error').mockImplementation(()=>undefined);
    vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({ok:false,error_code:401,description:`Unauthorized ${managedToken}`}),{status:401})));
    const {getTelegramBotMeWithToken}=await import('./telegram');
    await expect(getTelegramBotMeWithToken(managedToken)).rejects.toMatchObject({code:'TELEGRAM_ERROR',status:502});
    expect(error).toHaveBeenCalledWith({event:'telegram_managed_bot_api_error',method:'getMe',errorCode:401,description:'Unauthorized [REDACTED]'});
    expect(JSON.stringify(error.mock.calls)).not.toContain(managedToken);
  });
});
