(()=>{
const STEPS=Object.freeze(['telegram_bot','telegram_group','telegram_preview','vk_group']);
const STATUS=Object.freeze({IDLE:'idle',LOADING:'loading',READY:'ready',SUBMITTING:'submitting',WAITING_EXTERNAL_RETURN:'waiting_external_return',ERROR:'error'});

class OnboardingController{
  constructor({api,telegram}){
    if(!api||!telegram)throw new TypeError('OnboardingController requires api and telegram');
    this.api=api;this.telegram=telegram;this.listeners=new Set();this.state={status:STATUS.IDLE,step:null,account:null,error:null};this.refreshPromise=null;
    this.unsubscribeAccount=api.accountState?.subscribe?.(account=>this.acceptAccountState(account),{immediate:true})||null;
  }
  getState(){return this.state}
  subscribe(listener,{immediate=true}={}){if(typeof listener!=='function')return()=>{};this.listeners.add(listener);if(immediate)listener(this.state);return()=>this.listeners.delete(listener)}
  emit(patch){this.state=Object.freeze({...this.state,...patch});for(const listener of this.listeners)listener(this.state);return this.state}
  acceptAccountState(account){if(account)this.emit({account,error:null,...(this.state.status===STATUS.LOADING?{status:STATUS.READY}:{})})}
  async refresh(){if(this.refreshPromise)return this.refreshPromise;this.emit({status:STATUS.LOADING,error:null});this.refreshPromise=this.api.getAccountState();try{const account=await this.refreshPromise;this.emit({status:STATUS.READY,account,error:null});return account}catch(error){this.emit({status:STATUS.ERROR,error});throw error}finally{this.refreshPromise=null}}
  async open(step){if(!STEPS.includes(step))throw new RangeError(`Unknown onboarding step: ${step}`);this.emit({step,error:null});await this.refresh();return this.state}
  async run(action,{waiting=false}={}){this.emit({status:STATUS.SUBMITTING,error:null});try{const value=await action();this.emit({status:waiting?STATUS.WAITING_EXTERNAL_RETURN:STATUS.READY,error:null});return value}catch(error){this.emit({status:STATUS.ERROR,error});throw error}}
  async prepareManagedBot(){const data=await this.run(()=>this.api.prepareManagedBot());const accepted=await this.run(()=>this.telegram.requestManagedBot(data.requestId),{waiting:true});if(accepted)setTimeout(()=>this.refresh().catch(()=>{}),500);return accepted}
  async connectTelegramGroup(){const bot=this.state.account?.managedBot;if(!bot)throw new Error('Сначала создайте персонального бота');const data=await this.run(()=>this.api.createTelegramGroupLink(bot.id),{waiting:true});this.telegram.openTelegramLink(data.url);return data}
  openPreview(){const username=this.state.account?.managedBot?.username;if(!username)throw new Error('Сначала создайте персонального бота');this.telegram.openTelegramLink(`https://t.me/${username}`);this.emit({status:STATUS.WAITING_EXTERNAL_RETURN,error:null})}
  async connectVk(){const data=await this.run(async()=>{const handoff=await this.api.createVkHandoff();if(!handoff?.vkUrl)throw new Error('Не удалось открыть выбор группы.');return handoff},{waiting:true});this.telegram.notifySelection();this.telegram.openExternalLink(data.vkUrl);return data}
  async skip(step=this.state.step){if(!STEPS.includes(step))throw new RangeError(`Unknown onboarding step: ${step}`);await this.run(()=>this.api.skipStep(step));return this.refresh()}
  async resume(){if(this.state.status!==STATUS.WAITING_EXTERNAL_RETURN)return this.state.account;return this.refresh()}
  result(status='completed'){const skips=new Set(this.state.account?.onboardingSkips||[]);return Object.freeze({status,completedSteps:STEPS.filter(step=>this.isComplete(step)),skippedSteps:STEPS.filter(step=>skips.has(step)),accountState:this.state.account})}
  isComplete(step){const account=this.state.account||{},bot=account.managedBot;return step==='telegram_bot'?!!bot:step==='telegram_group'?!!bot?.destination?.connected:step==='telegram_preview'?!!account.previewReady:step==='vk_group'?!!account.vkGroup?.connected:false}
  dispose(){this.unsubscribeAccount?.();this.listeners.clear()}
}

window.CosmoOnboardingController=Object.freeze({OnboardingController,STEPS,STATUS,create:options=>new OnboardingController(options)});
})();
