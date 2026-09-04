(()=>{
function create({
  getDraftStore=()=>window.CosmoSofaDraft,
  fetchImpl=(...args)=>window.fetch(...args),
  onTelegramPublished=()=>window.CosmoVkReturnConfirmation?.telegramPublished?.(),
}={}){
  async function request(reason,url,init){
    await getDraftStore()?.flush?.(reason);
    const response=await fetchImpl(url,init),result=await response.json().catch(()=>null);
    return {response,result};
  }
  return Object.freeze({
    preview:init=>request('preview','/api/miniapp/preview',init),
    async publishTelegram(init){const outcome=await request('telegram-publish','/api/miniapp/publish',init);if(outcome.response.ok)await onTelegramPublished(outcome.result);return outcome},
    async publishVk(operation){await getDraftStore()?.flush?.('vk-publish');return operation()},
  });
}
window.CosmoComposerActionsFactory=Object.freeze({create});
window.CosmoComposerActions??=create();
})();
