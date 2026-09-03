import { AppError, type Env } from '../types';
import { validateTelegramMiniAppInitData } from './telegram-miniapp-auth';
import { resolveOrCreateTelegramIdentity } from './telegram-identity';
import { replicateVkArtifactToYandex } from './yandex-vk-replica';

const TTL_SECONDS = 15 * 60;
const VK_APP_ID = '54742219';

function initDataFrom(request: Request) { return request.headers.get('authorization')?.match(/^tma\s+(.+)$/i)?.[1] ?? ''; }
function bytesToToken(bytes: Uint8Array) { let binary=''; for(const byte of bytes) binary+=String.fromCharCode(byte); return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,''); }
async function hashToken(token:string){const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');}
function assertToken(token:string){if(!/^[A-Za-z0-9_-]{40,64}$/.test(token))throw new AppError('INVALID_HANDOFF','Некорректная ссылка подключения',400);}

export async function createVkOnboardingHandoff(request:Request,env:Env){
  const validated=await validateTelegramMiniAppInitData(initDataFrom(request),env.TELEGRAM_BOT_TOKEN);
  const account=await resolveOrCreateTelegramIdentity(env,String(validated.user.id));
  const random=new Uint8Array(32);crypto.getRandomValues(random);const token=bytesToToken(random),tokenHash=await hashToken(token),expiresAt=new Date(Date.now()+TTL_SECONDS*1000).toISOString();
  await env.DB.prepare('INSERT INTO vk_onboarding_handoffs(token_hash,user_id,expires_at) VALUES(?,?,?)').bind(tokenHash,account.userId,expiresAt).run();
  const callbackOrigin=new URL(request.url).origin;
  const launch=`connect=${encodeURIComponent(token)}&callback=${encodeURIComponent(callbackOrigin)}`;
  return {ok:true,token,expiresAt,vkUrl:`https://vk.com/app${VK_APP_ID}#${launch}`};
}

export async function getVkOnboardingHandoff(env:Env,token:string){
  assertToken(token);const tokenHash=await hashToken(token);const row=await env.DB.prepare('SELECT expires_at AS expiresAt,consumed_at AS consumedAt,group_id AS groupId,group_name AS groupName,screen_name AS screenName FROM vk_onboarding_handoffs WHERE token_hash=?').bind(tokenHash).first<{expiresAt:string;consumedAt:string|null;groupId:number|null;groupName:string|null;screenName:string|null}>();
  if(!row||Date.parse(row.expiresAt)<=Date.now())throw new AppError('HANDOFF_EXPIRED','Ссылка подключения истекла. Вернитесь в Telegram и нажмите «Выбрать группу» ещё раз.',410);
  return {ok:true,status:row.consumedAt?'connected':'pending',group:row.groupId?{id:row.groupId,name:row.groupName,screenName:row.screenName}:null,expiresAt:row.expiresAt};
}

export async function selectVkOnboardingGroup(env:Env,token:string,request:Request,ctx?:ExecutionContext){
  assertToken(token);const tokenHash=await hashToken(token);const row=await env.DB.prepare('SELECT user_id AS userId,expires_at AS expiresAt,consumed_at AS consumedAt FROM vk_onboarding_handoffs WHERE token_hash=?').bind(tokenHash).first<{userId:string;expiresAt:string;consumedAt:string|null}>();
  if(!row||Date.parse(row.expiresAt)<=Date.now())throw new AppError('HANDOFF_EXPIRED','Ссылка подключения истекла.',410);
  if(row.consumedAt)throw new AppError('HANDOFF_CONSUMED','Эта ссылка подключения уже использована.',409);
  const body=await request.json().catch(()=>{throw new AppError('INVALID_JSON','Некорректный JSON',400)}) as {vkUserId?:unknown;groupId?:unknown;groupName?:unknown;screenName?:unknown};
  const groupId=Number(body.groupId),groupName=typeof body.groupName==='string'?body.groupName.trim().slice(0,160):'',screenName=typeof body.screenName==='string'?body.screenName.trim().slice(0,100):'',vkUserId=String(body.vkUserId??'').trim();
  if(!Number.isSafeInteger(groupId)||groupId<=0||!groupName||!/^\d+$/.test(vkUserId))throw new AppError('INVALID_VK_GROUP','Некорректная группа VK',400);
  const canonicalScreen=screenName||`club${groupId}`,groupUrl=`https://vk.com/${canonicalScreen}`;
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO user_vk_group(user_id,group_id,group_url,screen_name,group_name,updated_at) VALUES(?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO UPDATE SET group_id=excluded.group_id,group_url=excluded.group_url,screen_name=excluded.screen_name,group_name=excluded.group_name,updated_at=CURRENT_TIMESTAMP`).bind(row.userId,groupId,groupUrl,canonicalScreen,groupName),
    env.DB.prepare('UPDATE vk_onboarding_handoffs SET consumed_at=CURRENT_TIMESTAMP,vk_user_id=?,group_id=?,group_name=?,screen_name=? WHERE token_hash=? AND consumed_at IS NULL').bind(vkUserId,groupId,groupName,canonicalScreen,tokenHash),
    env.DB.prepare("DELETE FROM user_onboarding_skip WHERE user_id=? AND step='vk_group'").bind(row.userId),
  ]);
  const artifactId=crypto.randomUUID();
  if(ctx){
    ctx.waitUntil(replicateVkArtifactToYandex(env,{artifactId,handoffToken:token,version:1,vkGroupId:groupId,text:JSON.stringify({kind:'vk_group_connection',vkUserId,groupId,groupName,screenName:canonicalScreen}),expiresAt:row.expiresAt,imageKeys:[]}).catch(error=>console.error('Yandex VK onboarding replica failed',{artifactId,error:error instanceof Error?error.message:String(error)})));
  }
  return {ok:true,vkGroup:{connected:true,groupId,groupName,screenName:canonicalScreen,groupUrl},artifactId};
}
