(()=>{
function safeUrl(raw){try{return new URL(raw,location.origin).pathname}catch{return String(raw).split('?')[0].split('#')[0]}}
function summarizeBody(body){if(!(body instanceof FormData))return null;const summary={};for(const [key,value] of body.entries()){let safeValue;if(value instanceof File)safeValue=`[File ${value.name} ${value.size}b]`;else if(key==='text')safeValue=`[text ${String(value).length} chars]`;else safeValue=String(value);if(key==='images')(summary.images??=[]).push(safeValue);else summary[key]=safeValue}return summary}
function create({fetchImpl=window.fetch.bind(window),log=()=>{},now=()=>performance.now()}={}){let requestId=0;return async function diagnosticsFetch(input,init={}){const id=++requestId,rawUrl=typeof input==='string'?input:input?.url||String(input),url=safeUrl(rawUrl),method=(init.method||(typeof input!=='string'&&input?.method)||'GET').toUpperCase(),started=now();log('request',{id,method,url,body:summarizeBody(init.body)});try{const response=await fetchImpl(input,init);log('response',{id,method,url,status:response.status,ok:response.ok,durationMs:Math.round(now()-started)});return response}catch(error){log('request-error',{id,method,url,durationMs:Math.round(now()-started),error:error?.message||String(error)});throw error}}
}
window.CosmoDiagnosticsFetch=Object.freeze({create});
})();
