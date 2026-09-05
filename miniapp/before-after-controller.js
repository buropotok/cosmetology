(()=>{
  if(window.CosmoBeforeAfter)return;

  for(const href of ['/before-after.html','/before-after.css','/before-after.js']){
    const link=document.createElement('link');
    link.rel='prefetch';
    link.href=href;
    document.head.append(link);
  }

  const style=document.createElement('style');
  style.textContent='.before-after-overlay{position:fixed;inset:0;z-index:10000;background:#111}.before-after-overlay[hidden]{display:none!important}.before-after-overlay iframe{display:block;width:100%;height:100%;border:0;background:#111}';
  document.head.append(style);

  const imageInput=document.querySelector('#image');
  let overlay=null;

  function ensureOverlay(){
    if(overlay)return overlay;
    overlay=document.createElement('div');
    overlay.className='before-after-overlay';
    overlay.hidden=true;
    overlay.innerHTML='<iframe src="/before-after.html?embedded=1" title="До / После" allow="clipboard-read; clipboard-write"></iframe>';
    document.body.append(overlay);
    return overlay;
  }

  function open(){
    const current=ensureOverlay();
    current.hidden=false;
    document.documentElement.style.overflow='hidden';
  }

  function close(){
    if(!overlay)return;
    overlay.hidden=true;
    document.documentElement.style.overflow='';
    window.scrollTo({top:0,behavior:'instant'});
  }

  function applyImage(image){
    if(!image?.buffer)return;
    const file=new File([image.buffer],image.name||'before-after.jpg',{type:image.mime||'image/jpeg'});
    const manager=window.CosmoComposerImages;
    if(manager?.replaceFiles){
      manager.replaceFiles([file]);
      return;
    }
    if(!imageInput)return;
    const dt=new DataTransfer();
    dt.items.add(file);
    imageInput.files=dt.files;
    imageInput.dispatchEvent(new Event('change',{bubbles:true}));
  }

  window.addEventListener('message',event=>{
    const frame=overlay?.querySelector('iframe');
    if(event.origin!==location.origin||event.source!==frame?.contentWindow)return;
    if(event.data?.type!=='cosmo-before-after-close')return;
    if(event.data.action==='save')applyImage(event.data.image);
    close();
    window.dispatchEvent(new CustomEvent('cosmo-before-after-close',{detail:{action:event.data.action}}));
  });

  window.CosmoBeforeAfter=Object.freeze({open,close});
})();
