(()=>{
function create({
  getDraftStore=()=>window.CosmoSofaDraft,
  getTelegramLayout=()=>window.CosmoComposerImages?.getTelegramLayout?.()??'slideshow',
  fetchImpl=(...args)=>window.fetch(...args),
  onTelegramPreviewed=()=>window.dispatchEvent(new CustomEvent('cosmo-telegram-previewed')),
  onTelegramPublished=async result=>{window.dispatchEvent(new CustomEvent('cosmo-telegram-published',{detail:result}));await window.CosmoVkReturnConfirmation?.telegramPublished?.()},
}={}){
  function withTelegramLayout(init={}){
    const body=init.body;
    if(typeof FormData!=='undefined'&&body instanceof FormData&&!body.has('telegram_layout'))body.set('telegram_layout',getTelegramLayout()==='collage'?'collage':'slideshow');
    return init;
  }
  async function request(reason,url,init){
    await getDraftStore()?.flush?.(reason);
    const response=await fetchImpl(url,init),result=await response.json().catch(()=>null);
    return {response,result};
  }
  return Object.freeze({
    async preview(init){const outcome=await request('preview','/api/miniapp/preview',withTelegramLayout(init));if(outcome.response.ok)await onTelegramPreviewed(outcome.result);return outcome},
    async publishTelegram(init){const outcome=await request('telegram-publish','/api/miniapp/publish',withTelegramLayout(init));if(outcome.response.ok)await onTelegramPublished(outcome.result);return outcome},
    async publishVk(operation){await getDraftStore()?.flush?.('vk-publish');return operation()},
  });
}
window.CosmoComposerActionsFactory=Object.freeze({create});
window.CosmoComposerActions??=create();
})();
