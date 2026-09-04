(()=>{
  const tg=window.Telegram?.WebApp;
  let state=null;
  let refreshPromise=null;
  let resumeTimer=null;
  const subscribers=new Set();

  function headers(){
    return {Authorization:`tma ${tg?.initData||''}`};
  }

  function snapshot(){
    return state;
  }

  function notify(){
    for(const subscriber of subscribers){
      try{subscriber(state)}catch(error){console.error('AccountState subscriber failed',error)}
    }
  }

  async function load(){
    if(!tg?.initData)throw new Error('Telegram initData unavailable');
    const response=await fetch('/api/miniapp/me',{headers:headers(),cache:'no-store'});
    const data=await response.json().catch(()=>null);
    if(!response.ok)throw new Error(data?.error?.message||'Не удалось загрузить состояние аккаунта.');
    state=data;
    notify();
    return state;
  }

  async function refresh(){
    if(refreshPromise)return refreshPromise;
    refreshPromise=load();
    try{return await refreshPromise}
    finally{refreshPromise=null}
  }

  function refreshOnResume(){
    clearTimeout(resumeTimer);
    resumeTimer=setTimeout(()=>{
      refresh().catch(error=>console.warn('AccountState resume refresh failed',error));
    },120);
  }

  function subscribe(subscriber,{immediate=true}={}){
    if(typeof subscriber!=='function')return()=>{};
    subscribers.add(subscriber);
    if(immediate&&state!==null)subscriber(state);
    return()=>subscribers.delete(subscriber);
  }

  tg?.onEvent?.('activated',refreshOnResume);
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible')refreshOnResume();
  });
  window.addEventListener('focus',refreshOnResume);
  window.addEventListener('pageshow',event=>{
    if(event.persisted)refreshOnResume();
  });

  window.CosmoAccountState=Object.freeze({
    refresh,
    getSnapshot:snapshot,
    subscribe
  });
})();
