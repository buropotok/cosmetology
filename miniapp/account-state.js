(()=>{
  const tg=window.Telegram?.WebApp;
  let state=null,currentRequest=null,queuedRefresh=null,requestGeneration=0,appliedGeneration=0,externalReturnExpectation=null;
  const subscribers=new Set();
  function headers(){return {Authorization:`tma ${tg?.initData||''}`}}
  function snapshot(){return state}
  function notify(){for(const subscriber of subscribers){try{subscriber(state)}catch(error){console.error('AccountState subscriber failed',error)}}}
  function startRefresh(){
    const generation=++requestGeneration;
    const promise=(async()=>{if(!tg?.initData)throw new Error('Telegram initData unavailable');const response=await fetch('/api/miniapp/me',{headers:headers(),cache:'no-store'});const data=await response.json().catch(()=>null);if(!response.ok)throw new Error(data?.error?.message||'Не удалось загрузить состояние аккаунта.');if(generation>=appliedGeneration){appliedGeneration=generation;state=data;notify()}return data})();
    const request={generation,promise};currentRequest=request;promise.finally(()=>{if(currentRequest===request)currentRequest=null}).catch(()=>{});return promise;
  }
  function refresh(){return currentRequest?.promise||startRefresh()}
  // External-return consumers need a request that starts after the request which
  // was active at the boundary. A single queued generation coalesces resume bursts.
  function refreshAfterCurrent(){if(queuedRefresh)return queuedRefresh;const predecessor=currentRequest?.promise;const run=(async()=>{if(predecessor){try{await predecessor}catch{}}return refresh()})();queuedRefresh=run;run.finally(()=>{if(queuedRefresh===run)queuedRefresh=null}).catch(()=>{});return run}
  function expectExternalReturn(){const expectation={};externalReturnExpectation=expectation;return()=>{if(externalReturnExpectation===expectation)externalReturnExpectation=null}}
  function refreshOnResume(){if(externalReturnExpectation){externalReturnExpectation=null;refreshAfterCurrent().catch(error=>console.warn('AccountState external return refresh failed',error));return}if(queuedRefresh)return;refresh().catch(error=>console.warn('AccountState resume refresh failed',error))}
  function subscribe(subscriber,{immediate=true}={}){if(typeof subscriber!=='function')return()=>{};subscribers.add(subscriber);if(immediate&&state!==null)subscriber(state);return()=>subscribers.delete(subscriber)}
  tg?.onEvent?.('activated',refreshOnResume);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refreshOnResume()});
  window.addEventListener('focus',refreshOnResume);
  window.addEventListener('pageshow',event=>{if(event.persisted)refreshOnResume()});
  window.CosmoAccountState=Object.freeze({refresh,refreshAfterCurrent,expectExternalReturn,getSnapshot:snapshot,subscribe});
})();
