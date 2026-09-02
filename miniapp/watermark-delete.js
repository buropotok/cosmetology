(()=>{
const carousel=document.getElementById('watermarkCarousel');
if(!carousel)return;
const authHeaders=()=>window.Telegram?.WebApp?.initData?{Authorization:`tma ${window.Telegram.WebApp.initData}`}:{ };
const decorate=()=>{
  carousel.querySelectorAll('.watermark-item[data-watermark]:not([data-watermark="none"])').forEach(item=>{
    if(item.querySelector('.watermark-delete'))return;
    item.style.position='relative';
    const del=document.createElement('button');
    del.type='button';
    del.className='watermark-delete';
    del.setAttribute('aria-label','Удалить водяной знак');
    del.textContent='×';
    del.style.cssText='position:absolute;right:-5px;top:-5px;width:24px;height:24px;border:0;border-radius:50%;background:#e5484d;color:#fff;font-size:20px;line-height:22px;padding:0;z-index:3;box-shadow:0 1px 4px rgba(0,0,0,.35)';
    del.addEventListener('click',async event=>{
      event.preventDefault();event.stopPropagation();
      if(!confirm('Удалить этот водяной знак?'))return;
      del.disabled=true;
      try{
        const id=item.dataset.watermark;
        const response=await fetch(`/api/miniapp/watermarks/${encodeURIComponent(id)}`,{method:'DELETE',headers:authHeaders()});
        const data=await response.json().catch(()=>null);
        if(!response.ok)throw new Error(data?.error?.message||'Не удалось удалить водяной знак');
        if(item.classList.contains('selected'))carousel.querySelector('[data-watermark="none"]')?.click();
        if(item.dataset.url)URL.revokeObjectURL(item.dataset.url);
        item.remove();
      }catch(error){
        const target=document.getElementById('error');if(target)target.textContent=error?.message||'Не удалось удалить водяной знак';
        del.disabled=false;
      }
    });
    item.append(del);
  });
};
decorate();
new MutationObserver(decorate).observe(carousel,{childList:true});
})();
