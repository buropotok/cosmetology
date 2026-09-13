(()=>{
class VkDestinationSelection{
  constructor({api=window.CosmoOnboardingApi?.create?.(),telegram=window.CosmoTelegramGateway?.create?.()}={}){this.api=api;this.telegram=telegram;this.pending=null}
  open(){if(this.pending)return this.pending;const run=(async()=>{if(typeof this.api?.createVkHandoff!=='function')throw new Error('Выбор группы VK недоступен.');const handoff=await this.api.createVkHandoff();if(!handoff?.vkUrl)throw new Error('Не удалось открыть выбор группы.');if(typeof this.telegram?.openExternalLink!=='function')throw new Error('Открытие VK недоступно.');this.telegram.notifySelection?.();this.telegram.openExternalLink(handoff.vkUrl);return handoff})();this.pending=run;run.finally(()=>{if(this.pending===run)this.pending=null}).catch(()=>{});return run}
}
const selection=new VkDestinationSelection();
window.CosmoVkDestinationSelection=Object.freeze({open:()=>selection.open()});
window.CosmoVkDestinationSelectionFactory=Object.freeze({create:options=>new VkDestinationSelection(options)});
})();
