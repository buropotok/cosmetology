(()=>{
  document.addEventListener('click',event=>{
    const button=event.target.closest?.('#flow-continue');
    if(!button)return;
    const state=window.CosmoSofaDraft?.getState?.();
    if(state?.screen!=='beforeafter')return;
    event.preventDefault();
    event.stopImmediatePropagation();
    window.CosmoBeforeAfter?.open?.();
  },true);
})();
