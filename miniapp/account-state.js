(()=>{
  const tg=window.Telegram?.WebApp;
  let state=null,currentRequest=null,requestGeneration=0,appliedGeneration=0;
  const afterRequests=new Set(),subscribers=new Set();
  function headers(){return {Authorization:`tma ${tg?.initData||''}`}}
  function snapshot(){return state}
  function notify(){for(const subscriber of subscribers){try{subscriber(state)}catch(error){console.error('AccountState subscriber failed',error)}}}
  function startRefresh(){
    const generation=++requestGeneration;
    const promise=(async()=>{if(!tg?.initData)throw new Error('Telegram initData unavailable');const response=await fetch('/api/miniapp/me',{headers:headers(),cache:'no-store'});const data=await response.json().catch(()=>null);if(!response.ok)throw new Error(data?.error?.message||'Не удалось загрузить состояние аккаунта.');if(generation>=appliedGeneration){appliedGeneration=generation;state=data;notify()}return data})();
    const request={generation,promise};currentRequest=request;promise.finally(()=>{if(currentRequest===request)currentRequest=null}).catch(()=>{});return request;
  }
  function refresh(){return currentRequest?.promise||startRefresh().promise}
  function getRefreshBoundary(){return requestGeneration}
  // A boundary is the latest generation visible to a caller. This method only
  // resolves from a generation strictly newer than that boundary. Callers with
  // compatible boundaries coalesce; a stronger boundary receives a later request.
  function refreshAfter(boundary){
    const required=Number.isFinite(boundary)?boundary:requestGeneration;
    if(currentRequest&&currentRequest.generation>required)return currentRequest.promise;
    for(const queued of afterRequests)if(queued.boundary>=required)return queued.promise;
    const predecessor=currentRequest;
    const queued={boundary:required,promise:null};
    queued.promise=(async()=>{
      if(predecessor){try{await predecessor.promise}catch{}}
      if(currentRequest&&currentRequest.generation>required)return currentRequest.promise;
      return startRefresh().promise;
    })();
    afterRequests.add(queued);queued.promise.finally(()=>afterRequests.delete(queued)).catch(()=>{});return queued.promise;
  }
  function refreshAfterCurrent(){return refreshAfter(requestGeneration)}
  // Resume signals are hints that external factual state may have changed, not
  // completion acknowledgements. Every burst requests post-signal freshness.
  function refreshOnResume(){refreshAfterCurrent().catch(error=>console.warn('AccountState resume refresh failed',error))}
  function subscribe(subscriber,{immediate=true}={}){if(typeof subscriber!=='function')return()=>{};subscribers.add(subscriber);if(immediate&&state!==null)subscriber(state);return()=>subscribers.delete(subscriber)}
  tg?.onEvent?.('activated',refreshOnResume);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refreshOnResume()});
  window.addEventListener('focus',refreshOnResume);
  window.addEventListener('pageshow',event=>{if(event.persisted)refreshOnResume()});
  window.CosmoAccountState=Object.freeze({refresh,refreshAfter,refreshAfterCurrent,getRefreshBoundary,getSnapshot:snapshot,subscribe});
})();
