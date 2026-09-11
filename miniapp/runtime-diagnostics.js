const ENDPOINT='/api/miniapp/runtime-diagnostics';
const MAX_EVENTS=200;
const MAX_ERROR_LENGTH=700;
const telegram=window.Telegram?.WebApp;
const sessionNumber=String(Date.now());
const sessionStartedAt=new Date().toISOString();
const transportFetch=typeof window.fetch==='function'?window.fetch.bind(window):null;
const events=[];
let sequence=0;
let deliveryQueue=Promise.resolve();
let sessionEventRecorded=false;
let initialDeliveryQueued=false;

function detectDeviceType(){
  const platform=String(telegram?.platform||'').toLowerCase();
  const ua=String(navigator.userAgent||'');
  if(platform==='ios'||/iPhone|iPad|iPod/i.test(ua))return'ios';
  if(platform==='android'||/Android/i.test(ua))return'android';
  if(['tdesktop','macos','weba','webk'].includes(platform))return'desktop';
  if(platform==='web')return'web';
  return'unknown';
}

const deviceType=detectDeviceType();
const clock=()=>typeof performance?.now==='function'?performance.now():Date.now();
function redactSecrets(value){return String(value||'').replace(/\btma\s+[^\s]+/gi,'tma [redacted]').replace(/\b(access[_-]?token|api[_-]?key|token)\s*[:=]\s*[^\s&,;]+/gi,'$1=[redacted]')}
const errorText=error=>redactSecrets(error?.message||error||'Unknown error').replace(/[\r\n]+/g,' ').slice(0,MAX_ERROR_LENGTH);
const hasTelegramAuth=()=>Boolean(window.Telegram?.WebApp?.initData);
function safeDetails(details){
  if(!details||typeof details!=='object'||Array.isArray(details))return undefined;
  const result={};
  for(const [key,value] of Object.entries(details)){
    if(value===undefined)continue;
    if(/authorization|initdata|token|secret|api.?key/i.test(key)){result[key]='[redacted]';continue}
    if(typeof value==='string')result[key]=redactSecrets(value).slice(0,300);
    else if(typeof value==='number'||typeof value==='boolean'||value===null)result[key]=value;
  }
  return Object.keys(result).length?result:undefined;
}

function snapshot(){
  return{
    schemaVersion:1,
    sessionNumber,
    sessionStartedAt,
    deviceType,
    telegramPlatform:String(telegram?.platform||''),
    telegramVersion:String(telegram?.version||''),
    buildId:String(window.COSMO_BUILD_ID||''),
    userAgent:String(navigator.userAgent||''),
    language:String(navigator.language||''),
    viewport:{width:window.innerWidth||0,height:window.innerHeight||0,devicePixelRatio:window.devicePixelRatio||1},
    events:events.map(item=>({...item,details:item.details?{...item.details}:undefined}))
  };
}

async function deliver(data){
  const initData=window.Telegram?.WebApp?.initData;
  if(!transportFetch||!initData)return;
  const response=await transportFetch(ENDPOINT,{method:'POST',headers:{'content-type':'application/json',authorization:`tma ${initData}`},body:JSON.stringify(data),cache:'no-store',keepalive:true});
  if(!response.ok)throw new Error(`Runtime diagnostics HTTP ${response.status}`);
}

function queueDelivery(){
  const data=snapshot();
  deliveryQueue=deliveryQueue.catch(()=>undefined).then(()=>deliver(data)).catch(()=>undefined);
}

function appendEvent({event,stage,module,status,durationMs,error,details}){
  const entry={seq:++sequence,time:new Date().toISOString(),event:String(event),stage:String(stage),module:String(module),status:String(status)};
  if(Number.isFinite(durationMs))entry.durationMs=Math.max(0,Math.round(durationMs));
  if(error)entry.error=errorText(error);
  const sanitized=safeDetails(details);
  if(sanitized)entry.details=sanitized;
  events.push(entry);
  if(events.length>MAX_EVENTS)events.splice(0,events.length-MAX_EVENTS);
  window.dispatchEvent(new CustomEvent('cosmo-runtime-diagnostic',{detail:Object.freeze({...entry,details:entry.details?Object.freeze({...entry.details}):undefined})}));
  return entry;
}

function ensureSessionEvent(){
  if(sessionEventRecorded)return;
  sessionEventRecorded=true;
  appendEvent({event:'session_started',stage:'application.startup',module:'runtime-diagnostics',status:'loaded'});
}

export function startRuntimeDiagnostics(){
  ensureSessionEvent();
  if(!hasTelegramAuth())return Object.freeze({started:false,reason:'telegram_auth_missing'});
  if(!initialDeliveryQueued){initialDeliveryQueued=true;queueDelivery()}
  return Object.freeze({started:true,sessionNumber,sessionStartedAt,deviceType});
}

export function recordRuntimeDiagnostic({event='module_load',stage,module,status,durationMs,error,details}={}){
  if(!stage||!module||!status)return null;
  ensureSessionEvent();
  const entry=appendEvent({event,stage,module,status,durationMs,error,details});
  if(hasTelegramAuth())queueDelivery();
  return Object.freeze({...entry,details:entry.details?Object.freeze({...entry.details}):undefined});
}

export async function loadRuntimeModule({stage,module,load,validate,validationError}={}){
  const started=clock();
  recordRuntimeDiagnostic({event:'module_load',stage,module,status:'loading'});
  try{
    const value=await load();
    if(validate&&!validate(value))throw new Error(validationError||`${module} did not initialize`);
    recordRuntimeDiagnostic({event:'module_load',stage,module,status:'loaded',durationMs:clock()-started});
    return{ok:true,value};
  }catch(error){
    recordRuntimeDiagnostic({event:'module_load',stage,module,status:'failed',durationMs:clock()-started,error});
    return{ok:false,error};
  }
}

export function skipRuntimeModule({stage,module,dependency}={}){
  const reason=dependency?`dependency_failed:${dependency}`:'dependency_failed';
  recordRuntimeDiagnostic({event:'module_skip',stage,module,status:'skipped_dependency',error:reason});
  return{ok:false,skipped:true,error:new Error(reason)};
}

export function getRuntimeSessionInfo(){return Object.freeze({sessionNumber,sessionStartedAt,deviceType})}
export function getRuntimeDiagnosticSnapshot(){return snapshot()}
