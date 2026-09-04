(()=>{
class OnboardingApiError extends Error{
  constructor(message,{status=0,code='ONBOARDING_REQUEST_FAILED'}={}){super(message);this.name='OnboardingApiError';this.status=status;this.code=code}
}

class OnboardingApi{
  constructor({fetchImpl=window.fetch.bind(window),getInitData=()=>window.Telegram?.WebApp?.initData||'',accountState=window.CosmoAccountState}={}){
    this.fetchImpl=fetchImpl;this.getInitData=getInitData;this.accountState=accountState;
  }
  headers(json=false){const headers={Authorization:`tma ${this.getInitData()}`};if(json)headers['Content-Type']='application/json';return headers}
  async request(path,{method='GET',body,signal,cache}={}){
    const response=await this.fetchImpl(path,{method,headers:this.headers(body!==undefined),...(body!==undefined?{body:JSON.stringify(body)}:{}),...(signal?{signal}:{}),...(cache?{cache}:{})});
    const data=await response.json().catch(()=>null);
    if(!response.ok)throw new OnboardingApiError(data?.error?.message||'Не удалось выполнить запрос onboarding.',{status:response.status,code:data?.error?.code});
    return data;
  }
  getAccountState(){return this.accountState?.refresh?this.accountState.refresh():this.request('/api/miniapp/me',{cache:'no-store'})}
  prepareManagedBot({signal}={}){return this.request('/api/miniapp/telegram/managed-bot/prepare',{method:'POST',body:{},signal})}
  createTelegramGroupLink(managedBotId,{signal}={}){return this.request('/api/miniapp/telegram/managed-bot/group-link',{method:'POST',body:{managedBotId},signal})}
  createVkHandoff({signal}={}){return this.request('/api/miniapp/vk-onboarding',{method:'POST',body:{},signal})}
  skipStep(step,{signal}={}){return this.request('/api/miniapp/onboarding/skip',{method:'POST',body:{step},signal})}
}

window.CosmoOnboardingApi=Object.freeze({OnboardingApi,OnboardingApiError,create:options=>new OnboardingApi(options)});
})();
