(()=>{
class VkDestinationSelection{
  constructor({api=window.CosmoOnboardingApi?.create?.(),telegram=window.CosmoTelegramGateway?.create?.(),accountState=window.CosmoAccountState}={}){this.api=api;this.telegram=telegram;this.accountState=accountState;this.pending=null}
  open(){if(this.pending)return this.pending;const run=(async()=>{if(typeof this.api?.createVkHandoff!=='function')throw new Error('Выбор группы VK недоступен.');const handoff=await this.api.createVkHandoff();if(!handoff?.vkUrl)throw new Error('Не удалось открыть выбор группы.');if(typeof this.telegram?.openExternalLink!=='function')throw new Error('Открытие VK недоступно.');const cancelExpectedReturn=this.accountState?.expectExternalReturn?.()||(()=>{});try{this.telegram.notifySelection?.();this.telegram.openExternalLink(handoff.vkUrl)}catch(error){cancelExpectedReturn();throw error}return handoff})();this.pending=run;run.finally(()=>{if(this.pending===run)this.pending=null}).catch(()=>{});return run}
}
const selection=new VkDestinationSelection();
window.CosmoVkDestinationSelection=Object.freeze({open:()=>selection.open()});
window.CosmoVkDestinationSelectionFactory=Object.freeze({create:options=>new VkDestinationSelection(options)});
})();
