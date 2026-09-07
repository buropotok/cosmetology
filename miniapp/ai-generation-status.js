(()=>{
  const root=document.querySelector('#publish-ai-wizard');
  if(!root)return;
  const responseBody=root.querySelector('[data-ai-response]');
  if(!responseBody)return;

  const DEFAULT_PENDING='Генерирую ответ…';
  const NEWS_PENDING='Ищем актуальные новости...';

  function activePreset(){
    return [...root.querySelectorAll('.publish-ai-wizard__presets button')]
      .find(button=>button.classList.contains('is-active'))?.textContent.trim()||'';
  }

  function syncPendingCopy(){
    if(!root.classList.contains('is-pending'))return;
    const text=responseBody.textContent?.trim();
    if(text!==DEFAULT_PENDING&&text!==NEWS_PENDING)return;
    const next=activePreset()==='Новости'?NEWS_PENDING:'Идёт генерация...';
    const target=responseBody.querySelector('.publish-ai-wizard__response-text');
    if(target&&target.textContent!==next)target.textContent=next;
  }

  const observer=new MutationObserver(syncPendingCopy);
  observer.observe(root,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class']});
  root.querySelector('.publish-ai-wizard__presets')?.addEventListener('click',()=>queueMicrotask(syncPendingCopy));
})();
