(()=>{
const home=document.querySelector('#home-screen');
const actions=home?.querySelector('.cosmo-flow-actions');
const tg=window.Telegram?.WebApp;
if(!home||!actions||!tg?.initData||home.querySelector('#flow-test-d1'))return;

const button=document.createElement('button');
button.id='flow-test-d1';
button.className='cosmo-secondary';
button.type='button';
button.textContent='Test D1';
const result=document.createElement('pre');
result.id='flow-test-d1-result';
result.hidden=true;
result.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;margin:4px 0 0;padding:12px;border-radius:12px;background:#fff;font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--c-text)';
actions.append(button,result);

let inFlight=false;
button.addEventListener('click',async()=>{
  if(inFlight)return;
  inFlight=true;button.disabled=true;result.hidden=false;result.textContent='Testing…';
  try{
    const response=await fetch('/api/miniapp/diagnostics/d1',{method:'POST',headers:{Authorization:`tma ${tg.initData}`}});
    let body;
    try{body=await response.json()}catch{body={ok:false,stage:'response',error:`HTTP ${response.status}: invalid JSON`}}
    result.textContent=JSON.stringify({httpStatus:response.status,...body},null,2);
  }catch(error){
    result.textContent=JSON.stringify({ok:false,stage:'network',error:error?.message||String(error)},null,2);
  }finally{inFlight=false;button.disabled=false}
});
})();
