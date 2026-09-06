(()=>{
  document.addEventListener('click',event=>{
    const target=event.target.closest?.('#flow-new,#flow-manual');
    if(!target)return;
    window.dispatchEvent(new CustomEvent('cosmo-new-post',{detail:{source:target.id}}));
  },true);
})();
