(()=>{
  let bypassOnce=false;

  function hasDraft(){
    return Boolean(window.CosmoSofaDraft?.getState?.()?.hasDraft);
  }

  function confirmDelete(onContinue){
    const tg=window.Telegram?.WebApp;
    const params={
      title:'Ваш черновик будет удален!',
      message:'',
      buttons:[
        {id:'continue',type:'destructive',text:'Продолжить'},
        {id:'cancel',type:'cancel',text:'Отмена'}
      ]
    };
    if(typeof tg?.showPopup==='function'){
      tg.showPopup(params,id=>{if(id==='continue')onContinue()});
      return;
    }
    if(window.confirm('Ваш черновик будет удален!'))onContinue();
  }

  document.addEventListener('click',event=>{
    const button=event.target.closest?.('#flow-new');
    if(!button)return;
    if(bypassOnce){bypassOnce=false;return}
    if(!hasDraft())return;
    event.preventDefault();
    event.stopImmediatePropagation();
    confirmDelete(()=>{
      bypassOnce=true;
      button.click();
    });
  },true);
})();
