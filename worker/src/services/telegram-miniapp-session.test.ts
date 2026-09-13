import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bootstrapTelegramMiniAppSession, checkTelegramMiniAppSession, extendTelegramMiniAppSessionAfterDraftSave, requireTelegramMiniAppSession } from './telegram-miniapp-auth';

const token='123456:test-token',encoder=new TextEncoder();
async function initData(authDate=Math.floor(Date.now()/1000)){
  const values={auth_date:String(authDate),user:JSON.stringify({id:42,first_name:'Анна'})};
  const data=Object.entries(values).sort(([a],[b])=>a.localeCompare(b)).map(([key,value])=>`${key}=${value}`).join('\n');
  const secret=await crypto.subtle.sign('HMAC',await crypto.subtle.importKey('raw',encoder.encode('WebAppData'),{name:'HMAC',hash:'SHA-256'},false,['sign']),encoder.encode(token));
  const hash=new Uint8Array(await crypto.subtle.sign('HMAC',await crypto.subtle.importKey('raw',secret,{name:'HMAC',hash:'SHA-256'},false,['sign']),encoder.encode(data)));
  return new URLSearchParams({...values,hash:[...hash].map(byte=>byte.toString(16).padStart(2,'0')).join('')}).toString();
}
function database(){
  let expiresAt:number|null=null,reads=0,writes=0;
  const DB={prepare:(sql:string)=>({bind:(...values:unknown[])=>({
    run:async()=>{writes+=1;if(sql.includes('SELECT telegram_user_id'))expiresAt=Math.max(expiresAt||0,Math.floor(Date.now()/1000)+Number(values[0]));else if(sql.startsWith('INSERT'))expiresAt=Math.max(expiresAt||0,Number(values[1]));return{meta:{changes:1}}},
    first:async()=>{reads+=1;return expiresAt===null?null:{expiresAt}}
  })})};
  return {DB,set expiry(value:number|null){expiresAt=value},get expiry(){return expiresAt},get reads(){return reads},get writes(){return writes}};
}
const request=async(authDate?:number)=>new Request('https://worker/api/miniapp/session',{headers:{authorization:`tma ${await initData(authDate)}`}});

describe('Telegram Mini App server session',()=>{
  beforeEach(()=>vi.useRealTimers());
  it('bootstraps ten minutes only after fresh cryptographic authentication',async()=>{const db=database();await bootstrapTelegramMiniAppSession(await request(),{DB:db.DB,TELEGRAM_BOT_TOKEN:token} as any);expect(db.expiry).toBeGreaterThan(Math.floor(Date.now()/1000)+590)});
  it('repeating bootstrap cannot move expiry past auth_date plus ten minutes',async()=>{const db=database(),authDate=Math.floor(Date.now()/1000)-30;await bootstrapTelegramMiniAppSession(await request(authDate),{DB:db.DB,TELEGRAM_BOT_TOKEN:token} as any);const expiry=db.expiry;await bootstrapTelegramMiniAppSession(await request(authDate),{DB:db.DB,TELEGRAM_BOT_TOKEN:token} as any);expect(db.expiry).toBe(expiry);expect(expiry).toBe(authDate+600)});
  it('accepts an active session even when signed auth_date is old',async()=>{const db=database();db.expiry=Math.floor(Date.now()/1000)+30;await expect(requireTelegramMiniAppSession(await request(Math.floor(Date.now()/1000)-900),{DB:db.DB,TELEGRAM_BOT_TOKEN:token} as any)).resolves.toMatchObject({user:{id:42}})});
  it('reports the canonical expiry without touching storage',async()=>{const db=database();db.expiry=Math.floor(Date.now()/1000)-1;await expect(checkTelegramMiniAppSession(await request(),{DB:db.DB,TELEGRAM_BOT_TOKEN:token} as any)).rejects.toMatchObject({code:'MINIAPP_AUTH_EXPIRED',status:401});expect(db.writes).toBe(0)});
  it('a health read never extends expiry',async()=>{const db=database();db.expiry=Math.floor(Date.now()/1000)+30;const before=db.expiry;await checkTelegramMiniAppSession(await request(),{DB:db.DB,TELEGRAM_BOT_TOKEN:token} as any);expect(db.expiry).toBe(before);expect(db.writes).toBe(0)});
  it('draft-save extension is monotonic and moves expiry ten minutes forward',async()=>{const db=database();db.expiry=Math.floor(Date.now()/1000)+30;await extendTelegramMiniAppSessionAfterDraftSave({DB:db.DB} as any,'user-42');expect(db.expiry).toBeGreaterThan(Math.floor(Date.now()/1000)+590)});
  it('a save authenticated before the deadline can extend after the deadline',async()=>{const db=database();db.expiry=Math.floor(Date.now()/1000)-1;await extendTelegramMiniAppSessionAfterDraftSave({DB:db.DB} as any,'user-42');expect(db.expiry).toBeGreaterThan(Math.floor(Date.now()/1000)+590)});
  it('a first successful save can establish the session after authenticated startup',async()=>{const db=database();await extendTelegramMiniAppSessionAfterDraftSave({DB:db.DB} as any,'user-42');expect(db.expiry).toBeGreaterThan(Math.floor(Date.now()/1000)+590)});
});
