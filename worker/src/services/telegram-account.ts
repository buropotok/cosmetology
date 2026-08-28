import {AppError,type Env} from '../types';import type {CurrentUser} from './auth';import {getTelegramChatMember,sendTelegramMiniAppButton,sendTelegramText} from './telegram';import {completeTelegramLink} from './telegram-identity';import {handleManagedBotUpdate} from './telegram-managed-bots';
const TTL_SECONDS=600,encoder=new TextEncoder();
async function codeHash(code:string,env:Env){const key=await crypto.subtle.importKey('raw',encoder.encode(env.PAIRING_CODE_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']),bytes=new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(code)));return[...bytes].map(x=>x.toString(16).padStart(2,'0')).join('')}
function pairingCode(){const max=Math.floor(0x100000000/1_000_000)*1_000_000;let value=0;do value=crypto.getRandomValues(new Uint32Array(1))[0];while(value>=max);return String(value%1_000_000).padStart(6,'0')}
async function rateLimit(env:Env,key:string,max:number,seconds:number){const now=Math.floor(Date.now()/1000),row=await env.DB.prepare('SELECT window_start,attempts FROM telegram_rate_limits WHERE rate_key=?').bind(key).first<{window_start:number;attempts:number}>();if(row&&now-row.window_start<seconds&&row.attempts>=max)throw new AppError('PAIRING_RATE_LIMITED','Слишком много попыток. Повторите позже.',429);if(!row||now-row.window_start>=seconds)await env.DB.prepare('INSERT INTO telegram_rate_limits(rate_key,window_start,attempts) VALUES(?,?,1) ON CONFLICT(rate_key) DO UPDATE SET window_start=excluded.window_start,attempts=1').bind(key,now).run();else await env.DB.prepare('UPDATE telegram_rate_limits SET attempts=attempts+1 WHERE rate_key=?').bind(key).run()}
export async function createPairingCode(env:Env,userId:string,telegramUserId?:string){await env.DB.prepare("UPDATE telegram_pairings SET status='cancelled' WHERE user_id=? AND status='pending'").bind(userId).run();for(let attempt=0;attempt<12;attempt++){const code=pairingCode(),hash=await codeHash(code,env),id=`tgp_${crypto.randomUUID().replaceAll('-','')}`,expires=new Date(Date.now()+TTL_SECONDS*1000),expiresAt=expires.toISOString(),dbExpiresAt=expiresAt.slice(0,19).replace('T',' ');try{await env.DB.prepare('INSERT INTO telegram_pairings(id,user_id,code_hash,expires_at,telegram_user_id) VALUES(?,?,?,?,?)').bind(id,userId,hash,dbExpiresAt,telegramUserId??null).run();return{pairingId:id,code,command:`/connect ${code}`,expiresAt}}catch(e){const collision=e instanceof Error&&/UNIQUE constraint failed:\s*telegram_pairings\.code_hash/i.test(e.message);if(!collision||attempt===11)throw e}}throw new AppError('PAIRING_UNAVAILABLE','Не удалось создать код подключения',503)}
export async function createPairing(env:Env,user:CurrentUser){await rateLimit(env,`pair:${user.id}`,5,600);return createPairingCode(env,user.id)}
export async function getConnection(env:Env,user:CurrentUser){const row=await env.DB.prepare("SELECT chat_title,chat_type FROM telegram_connections WHERE user_id=? AND status='active'").bind(user.id).first<{chat_title:string|null;chat_type:string}>();return row?{connected:true,chatTitle:row.chat_title??'Telegram-группа',chatType:row.chat_type}:{connected:false}}
export async function disconnect(env:Env,user:CurrentUser){await env.DB.prepare("UPDATE telegram_connections SET status='inactive',updated_at=CURRENT_TIMESTAMP WHERE user_id=?").bind(user.id).run();await env.DB.prepare("UPDATE telegram_pairings SET status='cancelled' WHERE user_id=? AND status='pending'").bind(user.id).run();return{connected:false}}
export async function activeChatId(env:Env,userId:string){return(await env.DB.prepare("SELECT chat_id FROM telegram_connections WHERE user_id=? AND status='active'").bind(userId).first<{chat_id:string}>())?.chat_id}
export function parseConnectCommand(text:string){return text.trim().match(/^\/connect(?:@[A-Za-z0-9_]+)?\s+(\d{6})$/i)?.[1]??null}
export async function telegramWebhook(request:Request,env:Env){
  if(request.headers.get('x-telegram-bot-api-secret-token')!==env.TELEGRAM_WEBHOOK_SECRET)throw new AppError('WEBHOOK_UNAUTHORIZED','Forbidden',403);
  const update=await request.json<any>().catch(()=>null);
  const message=update?.message,rawText=typeof message?.text==='string'?message.text:'',code=parseConnectCommand(rawText),diagnosticText=code?rawText.replace(/\d{6}/,'[REDACTED]'):rawText||null;
  console.log({
    event:'telegram_webhook_update',
    updateId:update?.update_id??null,
    chatId:message?.chat?.id!=null?String(message.chat.id):null,
    chatType:message?.chat?.type??null,
    fromId:message?.from?.id!=null?String(message.from.id):null,
    text:diagnosticText,
  });
  if(await handleManagedBotUpdate(update,env))return{ok:true};
  if(/^\/start(?:@\w+)?(?:\s|$)/i.test(rawText)){
    const chatId=message?.chat?.id!=null?String(message.chat.id):null,url=env.MINIAPP_URL?.trim();
    if(chatId){
      console.log({event:'telegram_start',chatId,miniAppConfigured:Boolean(url)});
      if(url){
        await sendTelegramMiniAppButton(env,chatId,url);
        console.log({event:'telegram_start_sent',chatId});
      }
    }
    return{ok:true};
  }
  if(!code)return{ok:true};
  const chatType=message?.chat?.type,chatId=message?.chat?.id,fromId=message?.from?.id;
  if(!['group','supergroup'].includes(chatType)||chatId==null||fromId==null)return{ok:true};
  try{await rateLimit(env,`connect:${String(chatId)}:${String(fromId)}`,10,600)}catch{await sendTelegramText(env,String(chatId),'Слишком много попыток. Повторите позже.');return{ok:true}}
  const hash=await codeHash(code,env),pairing=await env.DB.prepare("SELECT id,user_id,telegram_user_id FROM telegram_pairings WHERE code_hash=? AND status='pending' AND expires_at>CURRENT_TIMESTAMP").bind(hash).first<{id:string;user_id:string;telegram_user_id:string|null}>();
  if(!pairing){await sendTelegramText(env,String(chatId),'Код подключения недействителен или истёк.\nСоздайте новый код.');return{ok:true}}
  if(pairing.telegram_user_id!==null&&pairing.telegram_user_id!==String(fromId)){await sendTelegramText(env,String(chatId),'Этот код создан другим Telegram-пользователем.');return{ok:true}}
  const member=await getTelegramChatMember(env,String(chatId),String(fromId));
  if(!['administrator','creator'].includes(member.status)){await sendTelegramText(env,String(chatId),'Подключить группу может только администратор.');return{ok:true}}
  try{await completeTelegramLink(env,{pairingId:pairing.id,userId:pairing.user_id,telegramUserId:String(fromId),chatId:String(chatId),chatTitle:message.chat.title??null,chatType})}catch(error){if(error instanceof AppError&&['TELEGRAM_IDENTITY_CONFLICT','TELEGRAM_LINK_FAILED'].includes(error.code)){await sendTelegramText(env,String(chatId),error.message);return{ok:true}}throw error}
  await sendTelegramText(env,String(chatId),'✅ Группа подключена к Cosmetology Publisher.');return{ok:true}
}
