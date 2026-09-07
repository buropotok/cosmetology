(()=>{
const params=new URLSearchParams(location.search);if(params.get('embedded')!=='1'||window.parent===window)return;
const loader=document.getElementById('saveOverlay'),loaderStage=document.getElementById('saveStage');let saving=false,saveTimer=0,lastRoles={before:null,after:null},restoring=false,assetQueue=Promise.resolve();
function showLoader(message='Подготавливаем изображение…'){if(loaderStage)loaderStage.textContent=message;if(loader)loader.hidden=false}
function hideLoader(){if(loader)loader.hidden=true;if(loaderStage)loaderStage.textContent='Подготавливаем изображение…';saving=false;const finish=document.getElementById('finish');if(finish)finish.disabled=!(document.querySelector('.slot.loaded'))}
function setStage(message){if(loaderStage&&message)loaderStage.textContent=message}
function resetTransient(){hideLoader();const error=document.getElementById('error');if(error)error.textContent=''}
function close(action,payload={}){window.parent.postMessage({type:'cosmo-before-after-close',action,...payload},location.origin)}
function snapshot(){return window.CosmoBeforeAfterState?.getDraftSnapshot?.()||null}
function roleFiles(value){const files=value?.files||[],state=value?.state||{};const fileFor=role=>{const index=state?.[role]?.imageIndex;return Number.isInteger(index)&&index>=0?files[index]||null:null};return{before:fileFor('before'),after:fileFor('after')}}
async function persistDraft(){const value=snapshot();if(!value)return;await window.parent.CosmoBeforeAfter?.saveDraft?.(value)}
function scheduleStateSave(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>void persistDraft().catch(()=>{}),800)}
function samePair(a,b){return a.before===b.before&&a.after===b.after}
function isSwap(previous,next){return previous.before&&previous.after&&next.before===previous.after&&next.after===previous.before}
async function persistSemanticChange(value){const next=roleFiles(value),previous=lastRoles,controller=window.parent.CosmoBeforeAfter;if(isSwap(previous,next)){await controller?.swapAssets?.()}else{for(const role of ['before','after']){if(next[role]===previous[role])continue;if(next[role])await controller?.saveAsset?.(role,next[role]);else if(previous[role])await controller?.removeAsset?.(role)}}lastRoles=next;await controller?.saveDraft?.(value)}
function onChange(){if(restoring)return;const value=snapshot();if(!value)return;const next=roleFiles(value);if(samePair(lastRoles,next)){scheduleStateSave();return}clearTimeout(saveTimer);assetQueue=assetQueue.then(()=>persistSemanticChange(value)).catch(()=>{})}
async function restoreDraft(payload){if(!payload?.state)return;clearTimeout(saveTimer);restoring=true;try{await window.CosmoBeforeAfterState?.restoreDraft?.(payload.state,payload.images||[]);lastRoles=roleFiles(snapshot())}finally{restoring=false}resetTransient()}
async function save(){clearTimeout(saveTimer);const result=document.getElementById('compositeResult');let blob=null;if(result?.dataset.url&&!result.hidden)blob=await fetch(result.dataset.url).then(r=>r.blob());if(!blob&&typeof window.cosmoBeforeAfterCompositeBlob==='function')blob=await window.cosmoBeforeAfterCompositeBlob();if(!blob)throw new Error('Не удалось собрать изображение');const controller=window.parent.CosmoBeforeAfter;if(!controller?.save)throw new Error('Редактор недоступен');await controller.save(blob,`before-after-${Date.now()}.jpg`)}
window.addEventListener('cosmo-before-after-change',onChange);
document.addEventListener('click',async event=>{const button=event.target.closest?.('#back,#finish');if(!button||button.disabled||saving)return;event.preventDefault();event.stopImmediatePropagation();if(button.id==='back'){clearTimeout(saveTimer);close('back');return}saving=true;button.disabled=true;showLoader();try{await save()}catch(error){resetTransient();const target=document.getElementById('error');if(target)target.textContent=error?.message||'Не удалось сохранить изображение'}},true);
window.addEventListener('pageshow',resetTransient);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&!saving)resetTransient()});
window.CosmoBeforeAfterBridge=Object.freeze({setStage,resetTransient,restoreDraft,persistDraft});
})();
