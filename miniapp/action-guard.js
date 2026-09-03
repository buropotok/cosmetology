(()=>{
  const tg=window.Telegram?.WebApp;

  function authHeaders(){
    return {Authorization:`tma ${tg?.initData||''}`};
  }

  async function readState(){
    if(!tg?.initData)throw new Error('Откройте Mini App внутри Telegram.');
    const response=await fetch('/api/miniapp/me',{headers:authHeaders(),cache:'no-store'});
    const data=await response.json().catch(()=>null);
    if(!response.ok)throw new Error(data?.error?.message||'Не удалось проверить подключения.');
    return data||{};
  }

  function decision(action,state){
    const botReady=!!state.managedBot;
    const tgGroupReady=!!state.managedBot?.destination?.connected;
    const vkGroupReady=!!state.vkGroup?.connected;
    if(action==='preview')return botReady?{allow:true}:{allow:false,onboarding:'bot'};
    if(action==='publish_tg'){
      if(!botReady)return {allow:false,onboarding:'bot'};
      if(!tgGroupReady)return {allow:false,onboarding:'tg-group'};
      return {allow:true};
    }
    if(action==='publish_vk')return vkGroupReady?{allow:true}:{allow:false,onboarding:'vk'};
    throw new Error(`Unknown guarded action: ${action}`);
  }

  async function requireAction(action){
    const state=await readState();
    const result=decision(action,state);
    if(result.allow)return true;
    const onboarding=window.CosmoOnboarding;
    if(!onboarding)throw new Error('Онбординг ещё не готов.');
    if(result.onboarding==='bot')onboarding.openBot?.();
    else if(result.onboarding==='tg-group')onboarding.openTelegramGroup?.();
    else if(result.onboarding==='vk')onboarding.openVkGroup?.();
    return false;
  }

  window.CosmoActionGuard=Object.freeze({require:requireAction,check:async action=>decision(action,await readState())});
})();
