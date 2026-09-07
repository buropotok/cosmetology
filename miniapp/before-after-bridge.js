(()=>{
const params=new URLSearchParams(location.search);if(params.get('embedded')!=='1'||window.parent===window)return;
const loader=document.getElementById('saveOverlay'),loaderStage=document.getElementById('saveStage');let saving=false,parameterTimer=0;
const PARAMETER_SAVE_DELAY_MS=700;
function showLoader(message='Подготавливаем изображение…'){if(loaderStage)loaderStage.textContent=message;if(loader)loader.hidden=false}
function hideLoader(){if(loader)loader.hidden=true;if(loaderStage)loaderStage.textContent='Подготавливаем изображение…';saving=false;const finish=document.getElementById('finish');if(finish)finish.disabled=!(document.querySelector('.slot.loaded'))}
function setStage(message){if(loaderStage&&message)loaderStage.textContent=message}
function resetTransient(){hideLoader();const error=document.getElementById('error');if(error)error.textContent=''}
function close(action,payload={}){window.parent.postMessage({type:'cosmo-before-after-close',action,...payload},location.origin)}
function snapshot(){return window.CosmoBeforeAfterState?.getDraftSnapshot?.()||null}
async function persistParameters(){const current=snapshot();if(!current?.state)return;await window.parent.CosmoBeforeAfter?.saveDraftState?.(current.state)}
function scheduleParameterSave(){clearTimeout(parameterTimer);parameterTimer=setTimeout(()=>{parameterTimer=0;void persistParameters().catch(()=>{})},PARAMETER_SAVE_DELAY_MS)}
async function flushParameterSave(){if(!parameterTimer)return;clearTimeout(parameterTimer);parameterTimer=0;await persistParameters()}
async function persistImageChange(detail){const current=snapshot();if(!current?.state)return;await window.parent.CosmoBeforeAfter?.saveDraftImage?.(current,detail||{})}
async function persistImageRemove(detail){const current=snapshot();if(!current?.state)return;await window.parent.CosmoBeforeAfter?.saveDraftRemoval?.(current.state,detail||{})}
async function restoreDraft(payload){if(!payload?.state)return;clearTimeout(parameterTimer);parameterTimer=0;await window.CosmoBeforeAfterState?.restoreDraft?.(payload.state,payload.images||[]);resetTransient()}
async function save(){await flushParameterSave();const result=document.getElementById('compositeResult');let blob=null;if(result?.dataset.url&&!result.hidden)blob=await fetch(result.dataset.url).then(r=>r.blob());if(!blob&&typeof window.cosmoBeforeAfterCompositeBlob==='function')blob=await window.cosmoBeforeAfterCompositeBlob();if(!blob)throw new Error('Не удалось собрать изображение');const controller=window.parent.CosmoBeforeAfter;if(!controller?.save)throw new Error('Редактор недоступен');await controller.save(blob,`before-after-${Date.now()}.jpg`)}
window.addEventListener('cosmo-before-after-change',event=>{const kind=event.detail?.kind||'parameters';if(kind==='image'){void persistImageChange(event.detail).catch(()=>{});return}if(kind==='remove'){void persistImageRemove(event.detail).catch(()=>{});return}scheduleParameterSave()});
document.addEventListener('click',async event=>{const button=event.target.closest?.('#back,#finish');if(!button||button.disabled||saving)return;event.preventDefault();event.stopImmediatePropagation();if(button.id==='back'){try{await flushParameterSave()}finally{close('back')}return}saving=true;button.disabled=true;showLoader();try{await save()}catch(error){resetTransient();const target=document.getElementById('error');if(target)target.textContent=error?.message||'Не удалось сохранить изображение'}},true);
window.addEventListener('pageshow',resetTransient);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&!saving)resetTransient()});
window.CosmoBeforeAfterBridge=Object.freeze({setStage,resetTransient,restoreDraft,persistParameters,flushParameterSave});
})();
