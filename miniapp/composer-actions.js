(()=>{
function create({
  getDraftStore=()=>window.CosmoSofaDraft,
  fetchImpl=(...args)=>window.fetch(...args),
  onTelegramPreviewed=()=>window.dispatchEvent(new CustomEvent('cosmo-telegram-previewed')),
  onTelegramPublished=async result=>{window.dispatchEvent(new CustomEvent('cosmo-telegram-published',{detail:result}));await window.CosmoVkReturnConfirmation?.telegramPublished?.()},
}={}){
  async function request(reason,url,init){
    await getDraftStore()?.flush?.(reason);
    const response=await fetchImpl(url,init),result=await response.json().catch(()=>null);
    return {response,result};
  }
  return Object.freeze({
    async preview(init){const outcome=await request('preview','/api/miniapp/preview',init);if(outcome.response.ok)await onTelegramPreviewed(outcome.result);return outcome},
    async publishTelegram(init){const outcome=await request('telegram-publish','/api/miniapp/publish',init);if(outcome.response.ok)await onTelegramPublished(outcome.result);return outcome},
    async publishVk(operation){await getDraftStore()?.flush?.('vk-publish');return operation()},
  });
}
window.CosmoComposerActionsFactory=Object.freeze({create});
window.CosmoComposerActions??=create();
})();
