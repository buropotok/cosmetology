(()=>{
  if(window.CosmoBeforeAfter)return;
  for(const href of ['/before-after.html','/before-after.css','/before-after.js']){const link=document.createElement('link');link.rel='prefetch';link.href=href;document.head.append(link)}
  const style=document.createElement('style');style.textContent='.before-after-overlay{position:fixed;inset:0;z-index:10000;background:#111}.before-after-overlay[hidden]{display:none!important}.before-after-overlay iframe{display:block;width:100%;height:100%;border:0;background:#111}';document.head.append(style);
  const imageInput=document.querySelector('#image'),webApp=window.Telegram?.WebApp;let overlay=null,currentMode='dual',soloIndex=null,soloFile=null;
  async function restoreSoloIntoFrame(){
    if(currentMode!=='solo'||!soloFile)return false;
    const restore=frameBridge()?.restoreSolo?.(soloFile,soloIndex);if(!restore)return false;
    try{await restore;return true}catch(error){debugLog('SOLO RESTORE rejected',{message:error?.message||String(error),index:soloIndex});return false}
  }
  async function fitSoloIntoFrame(){
    if(currentMode!=='solo')return false;
    const fit=frameBridge()?.fitSolo?.();if(!fit)return false;
    try{await fit;return true}catch(error){debugLog('SOLO FIT rejected',{message:error?.message||String(error),index:soloIndex});return false}
  }
  async function revealSolo(current){
    if(currentMode!=='solo'||overlay!==current)return false;
    if(!await restoreSoloIntoFrame())return false;
    if(currentMode!=='solo'||overlay!==current)return false;
    current.style.visibility='hidden';current.hidden=false;
    await nextPaint();
    if(currentMode!=='solo'||overlay!==current){current.hidden=true;current.style.visibility='';return false}
    if(!await fitSoloIntoFrame()){current.hidden=true;current.style.visibility='';return false}
    if(currentMode!=='solo'||overlay!==current){current.hidden=true;current.style.visibility='';return false}
    current.style.visibility='';return true
  }
  function ensureOverlay(mode='dual'){
    if(overlay&&currentMode===mode)return overlay;
    if(overlay)overlay.remove();
    currentMode=mode;overlay=document.createElement('div');overlay.className='before-after-overlay';overlay.hidden=true;
    overlay.innerHTML=`<iframe src="/before-after.html?embedded=1&mode=${encodeURIComponent(mode)}" title="${mode==='solo'?'Фото':'До / После'}" allow="clipboard-read; clipboard-write"></iframe>`;
    document.body.append(overlay);const current=overlay,frame=current.querySelector('iframe');frame.addEventListener('load',()=>{if(currentMode==='solo'&&overlay===current)void revealSolo(current);else if(currentMode==='dual'&&overlay===current)restoreIntoFrame()});return current
  }
  function frameBridge(){try{return overlay?.querySelector('iframe')?.contentWindow?.CosmoBeforeAfterBridge||null}catch{return null}}
  function debugLog(type,data){try{frameBridge()?.debugLog?.(type,data)}catch{}}
  function setSaveStage(message){frameBridge()?.setStage?.(message)}
  function emitOpen(mode){window.dispatchEvent(new CustomEvent('cosmo-before-after-open',{detail:{mode}}))}
  function restoreIntoFrame(){if(currentMode!=='dual')return;const payload=window.CosmoSofaDraft?.getBeforeAfterDraft?.();if(!payload?.state)return;const restore=frameBridge()?.restoreDraft?.(payload);restore?.catch?.(error=>debugLog('RESTORE rejected',{message:error?.message||String(error),imageCount:payload.images?.length||0}))}
  function open(){
    const request=arguments[0];
    if(request?.mode==='solo'){
      const {file,index}=request;
      if(!(file instanceof File)||!Number.isInteger(index)||index<0)return false;
      soloFile=file;soloIndex=index;const current=ensureOverlay('solo');emitOpen('solo');current.hidden=true;frameBridge()?.resetTransient?.();void revealSolo(current);document.documentElement.style.overflow='hidden';return true
    }
    soloIndex=null;soloFile=null;const current=ensureOverlay('dual');emitOpen('dual');window.CosmoSofaDraft?.setScreen?.('beforeafter');frameBridge()?.resetTransient?.();restoreIntoFrame();current.hidden=false;document.documentElement.style.overflow='hidden';return true
  }
  function destroySolo(){if(!overlay)return;overlay.remove();overlay=null;soloIndex=null;soloFile=null;currentMode='dual'}
  function close(){if(!overlay)return;frameBridge()?.resetTransient?.();if(currentMode==='solo')destroySolo();else overlay.hidden=true;document.documentElement.style.overflow='';window.scrollTo({top:0,behavior:'instant'})}
  function clear(){if(!overlay)return;overlay.remove();overlay=null;soloIndex=null;soloFile=null;currentMode='dual';document.documentElement.style.overflow=''}
  function authHeaders(){if(!webApp?.initData)throw new Error('Telegram Mini App недоступен. Не удалось сохранить изображение.');return{Authorization:`tma ${webApp.initData}`}}
  async function saveDraft(snapshot){if(currentMode!=='dual'||!snapshot?.state)return false;const draft=window.CosmoSofaDraft;if(!draft?.setBeforeAfterState||!draft?.flush)throw new Error('Черновик недоступен.');debugLog('STATE SAVE requested',{state:snapshot.state});await draft.setBeforeAfterState(snapshot.state,{persist:true});await draft.setScreen?.('beforeafter',{persist:false});const saved=await draft.flush('before-after-state');debugLog('STATE SAVE completed',{saved});if(saved!==true)throw new Error('Не удалось сохранить черновик До/После.');return true}
  async function saveAsset(role,file){const body=new FormData();body.set('role',role);body.set('image',file,file.name||`${role}.jpg`);const response=await fetch('/api/miniapp/before-after/asset',{method:'POST',headers:authHeaders(),body}),result=await response.json().catch(()=>null);debugLog(`HTTP ASSET ${role} response`,{status:response.status,ok:response.ok,result});if(!response.ok)throw new Error(result?.error?.message||'Не удалось сохранить фото До/После.');window.CosmoSofaDraft?.setBeforeAfterImage?.(role,file);return result}
  async function removeAsset(role){const response=await fetch('/api/miniapp/before-after/remove',{method:'POST',headers:{...authHeaders(),'content-type':'application/json'},body:JSON.stringify({role})}),result=await response.json().catch(()=>null);debugLog(`HTTP REMOVE ${role} response`,{status:response.status,ok:response.ok,result});if(!response.ok)throw new Error(result?.error?.message||'Не удалось удалить фото из черновика.');window.CosmoSofaDraft?.setBeforeAfterImage?.(role,null);return result}
  async function swapAssets(){const response=await fetch('/api/miniapp/before-after/swap',{method:'POST',headers:authHeaders()}),result=await response.json().catch(()=>null);debugLog('HTTP SWAP response',{status:response.status,ok:response.ok,result});if(!response.ok)throw new Error(result?.error?.message||'Не удалось поменять фото местами.');window.CosmoSofaDraft?.swapBeforeAfterImages?.();return result}
  function replaceSoloFile(file){const manager=window.CosmoComposerImages;if(!manager?.replaceAt||!Number.isInteger(soloIndex))return false;return manager.replaceAt(soloIndex,file)}
  function applyImageFile(file){
    const manager=window.CosmoComposerImages;
    if(manager?.addFiles){
      if((manager.getFiles?.().length||0)>=10)return false;
      manager.addFiles([file]);
      return manager.getFiles?.().includes(file)??true;
    }
    if(!imageInput||typeof DataTransfer==='undefined')return false;
    const current=Array.from(imageInput.files||[]).slice(0,10);
    if(current.length>=10)return false;
    const dt=new DataTransfer();current.forEach(item=>dt.items.add(item));dt.items.add(file);imageInput.files=dt.files;imageInput.dispatchEvent(new Event('change',{bubbles:true}));return true;
  }
  const nextPaint=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  async function save(blob,name=`before-after-${Date.now()}.jpg`){
    if(!blob||typeof blob.size!=='number'||blob.size<=0)throw new Error('Не удалось собрать изображение.');
    const file=new File([blob],name,{type:blob.type||'image/jpeg',lastModified:Date.now()});setSaveStage(currentMode==='solo'?'Заменяем изображение…':'Добавляем изображение…');
    if(currentMode==='solo'){
      if(!replaceSoloFile(file))throw new Error('Не удалось заменить исходное изображение.');
      setSaveStage('Сохраняем изображение…');const draft=window.CosmoSofaDraft;if(draft?.flush&&await draft.flush('before-after-solo-save')!==true)throw new Error('Не удалось сохранить изображение.');close();await nextPaint();return
    }
    if(!applyImageFile(file))throw new Error('В редакторе уже 10 фотографий. Удалите одну и повторите сохранение.');
    const draft=window.CosmoSofaDraft;await draft?.setScreen?.('publish');setSaveStage('Сохраняем изображение…');if(!draft?.flush||await draft.flush('before-after-save')!==true)throw new Error('Не удалось сохранить изображение.');
    const navigation=window.CosmoNavigation;if(!navigation?.replace)throw new Error('Навигация недоступна.');const nextState=await navigation.replace(navigation.STATES.PUBLISH,{focus:false});if(nextState!==navigation.STATES.PUBLISH)throw new Error('Не удалось открыть редактор.');await nextPaint()
  }
  window.addEventListener('message',event=>{const frame=overlay?.querySelector('iframe');if(event.origin!==location.origin||event.source!==frame?.contentWindow)return;if(event.data?.type!=='cosmo-before-after-close'||event.data.action!=='back')return;if(currentMode==='solo'){close();return}const navigation=window.CosmoNavigation;if(navigation?.back)void navigation.back();else close()});
  window.addEventListener('cosmo-new-post',clear);
  window.CosmoBeforeAfter=Object.freeze({open,close,clear,save,saveDraft,saveAsset,removeAsset,swapAssets});
})();
