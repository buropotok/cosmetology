import {AppError,type Env} from '../types';
import {validateTelegramMiniAppInitData} from './telegram-miniapp-auth';

const MAX_PAYLOAD_BYTES=256*1024;
const MAX_EVENTS=200;
const MAX_TEXT=700;
const STATUSES=new Set(['loading','loaded','failed','skipped_dependency']);

type RuntimeViewport={width:number;height:number;devicePixelRatio:number};
export type RuntimeDiagnosticEvent={seq:number;time:string;event:string;stage:string;module:string;status:string;durationMs?:number;error?:string};
export type RuntimeDiagnosticSnapshot={schemaVersion:1;sessionNumber:string;sessionStartedAt:string;deviceType:string;telegramPlatform:string;telegramVersion:string;buildId:string;userAgent:string;language:string;viewport:RuntimeViewport;events:RuntimeDiagnosticEvent[]};

const oneLine=(value:unknown,max=MAX_TEXT)=>String(value??'').replace(/[\r\n\t]+/g,' ').trim().slice(0,max);
const token=(value:unknown,fallback='unknown')=>{const cleaned=oneLine(value,40).toLowerCase().replace(/[^a-z0-9_-]+/g,'-').replace(/^-+|-+$/g,'');return cleaned||fallback};
const finite=(value:unknown,fallback=0)=>{const number=Number(value);return Number.isFinite(number)?number:fallback};
const redactSecrets=(value:unknown)=>oneLine(value).replace(/\btma\s+[^\s]+/gi,'tma [redacted]').replace(/\b(access[_-]?token|api[_-]?key|token)\s*[:=]\s*[^\s&,;]+/gi,'$1=[redacted]');
function iso(value:unknown,field:string){const raw=oneLine(value,40),date=new Date(raw);if(!raw||!Number.isFinite(date.getTime()))throw new AppError('INVALID_RUNTIME_DIAGNOSTIC',`${field} некорректен`,400);return date.toISOString()}

export function normalizeRuntimeDiagnosticSnapshot(input:unknown):RuntimeDiagnosticSnapshot{
  if(!input||typeof input!=='object')throw new AppError('INVALID_RUNTIME_DIAGNOSTIC','JSON object обязателен',400);
  const raw=input as Record<string,unknown>;
  const sessionNumber=oneLine(raw.sessionNumber,20);
  if(!/^\d{10,18}$/.test(sessionNumber))throw new AppError('INVALID_RUNTIME_DIAGNOSTIC','sessionNumber некорректен',400);
  if(Number(raw.schemaVersion)!==1)throw new AppError('INVALID_RUNTIME_DIAGNOSTIC','schemaVersion не поддерживается',400);
  const rawViewport=raw.viewport&&typeof raw.viewport==='object'?raw.viewport as Record<string,unknown>:{};
  const rawEvents=Array.isArray(raw.events)?raw.events:[];
  if(rawEvents.length>MAX_EVENTS)throw new AppError('INVALID_RUNTIME_DIAGNOSTIC','Слишком много diagnostic events',400);
  const events=rawEvents.map((item,index)=>{
    if(!item||typeof item!=='object')throw new AppError('INVALID_RUNTIME_DIAGNOSTIC',`Event ${index+1} некорректен`,400);
    const event=item as Record<string,unknown>,status=oneLine(event.status,40);
    if(!STATUSES.has(status))throw new AppError('INVALID_RUNTIME_DIAGNOSTIC',`Event ${index+1}: неизвестный status`,400);
    const normalized:RuntimeDiagnosticEvent={
      seq:Math.max(1,Math.trunc(finite(event.seq,index+1))),
      time:iso(event.time,`events[${index}].time`),
      event:oneLine(event.event,80)||'module_load',
      stage:oneLine(event.stage,120)||'unknown',
      module:oneLine(event.module,160)||'unknown',
      status
    };
    if(Number.isFinite(Number(event.durationMs)))normalized.durationMs=Math.max(0,Math.round(Number(event.durationMs)));
    if(event.error)normalized.error=redactSecrets(event.error);
    return normalized;
  });
  return{
    schemaVersion:1,
    sessionNumber,
    sessionStartedAt:iso(raw.sessionStartedAt,'sessionStartedAt'),
    deviceType:token(raw.deviceType),
    telegramPlatform:oneLine(raw.telegramPlatform,40),
    telegramVersion:oneLine(raw.telegramVersion,40),
    buildId:oneLine(raw.buildId,120),
    userAgent:oneLine(raw.userAgent,500),
    language:oneLine(raw.language,40),
    viewport:{width:Math.max(0,Math.round(finite(rawViewport.width))),height:Math.max(0,Math.round(finite(rawViewport.height))),devicePixelRatio:Math.max(0,finite(rawViewport.devicePixelRatio,1))},
    events
  };
}

export function runtimeDiagnosticKey(snapshot:RuntimeDiagnosticSnapshot){const date=snapshot.sessionStartedAt.slice(0,10);return`runtime-logs/${date}/${date}_${snapshot.deviceType}_session-${snapshot.sessionNumber}.log`}

export function renderRuntimeDiagnosticLog(snapshot:RuntimeDiagnosticSnapshot,updatedAt=new Date().toISOString()){
  const lines=[
    'COSMO RUNTIME DIAGNOSTICS',
    `schema_version: ${snapshot.schemaVersion}`,
    `session_number: ${snapshot.sessionNumber}`,
    `session_started_at: ${snapshot.sessionStartedAt}`,
    `artifact_updated_at: ${updatedAt}`,
    `device_type: ${snapshot.deviceType}`,
    `telegram_platform: ${snapshot.telegramPlatform||'-'}`,
    `telegram_version: ${snapshot.telegramVersion||'-'}`,
    `build_id: ${snapshot.buildId||'-'}`,
    `user_agent: ${snapshot.userAgent||'-'}`,
    `language: ${snapshot.language||'-'}`,
    `viewport: ${snapshot.viewport.width}x${snapshot.viewport.height} @${snapshot.viewport.devicePixelRatio}`,
    '',
    'events:'
  ];
  for(const event of snapshot.events){
    let line=`${String(event.seq).padStart(3,'0')} | ${event.time} | event=${event.event} | stage=${event.stage} | module=${event.module} | status=${event.status}`;
    if(event.durationMs!==undefined)line+=` | duration_ms=${event.durationMs}`;
    if(event.error)line+=` | error=${event.error}`;
    lines.push(line);
  }
  return`${lines.join('\n')}\n`;
}

export async function storeRuntimeDiagnosticSnapshot(env:Env,snapshot:RuntimeDiagnosticSnapshot,updatedAt=new Date().toISOString()){
  const key=runtimeDiagnosticKey(snapshot),body=renderRuntimeDiagnosticLog(snapshot,updatedAt);
  await env.LOGS.put(key,body,{httpMetadata:{contentType:'text/plain; charset=utf-8'}});
  return{key,eventCount:snapshot.events.length};
}

export async function saveRuntimeDiagnostics(request:Request,env:Env){
  const initData=request.headers.get('authorization')?.match(/^tma\s+(.+)$/i)?.[1]??'';
  await validateTelegramMiniAppInitData(initData,env.TELEGRAM_BOT_TOKEN);
  const raw=await request.text();
  if(new TextEncoder().encode(raw).byteLength>MAX_PAYLOAD_BYTES)throw new AppError('RUNTIME_DIAGNOSTIC_TOO_LARGE','Runtime diagnostic payload слишком большой',413);
  let parsed:unknown;try{parsed=JSON.parse(raw)}catch{throw new AppError('INVALID_JSON','Некорректный JSON',400)}
  const snapshot=normalizeRuntimeDiagnosticSnapshot(parsed);
  return{ok:true,...await storeRuntimeDiagnosticSnapshot(env,snapshot)};
}
