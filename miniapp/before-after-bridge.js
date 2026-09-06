(()=>{
const params=new URLSearchParams(location.search);if(params.get('embedded')!=='1'||window.parent===window)return;
const loader=document.getElementById('saveLoader'),loaderStage=document.getElementById('saveLoaderStage');let saving=false;
function showLoader(message='Подготавливаем изображение…'){if(loaderStage)loaderStage.textContent=message;if(loader)loader.hidden=false}
function hideLoader(){if(loader)loader.hidden=true;if(loaderStage)loaderStage.textContent='Подготавливаем изображение…';saving=false;const finish=document.getElementById('finish');if(finish)finish.disabled=!(document.querySelector('.slot.loaded'))}
function setStage(message){if(loaderStage&&message)loaderStage.textContent=message}
function resetTransient(){hideLoader();const error=document.getElementById('error');if(error)error.textContent=''}
function close(action,payload={}){window.parent.postMessage({type:'cosmo-before-after-close',action,...payload},location.origin)}
async function save(){const result=document.getElementById('compositeResult');let blob=null;if(result?.dataset.url&&!result.hidden)blob=await fetch(result.dataset.url).then(r=>r.blob());if(!blob&&typeof window.cosmoBeforeAfterCompositeBlob==='function')blob=await window.cosmoBeforeAfterCompositeBlob();if(!blob)throw new Error('Не удалось собрать изображение');const controller=window.parent.CosmoBeforeAfter;if(!controller?.save)throw new Error('Редактор недоступен');await controller.save(blob,`before-after-${Date.now()}.jpg`)}
document.addEventListener('click',async event=>{const button=event.target.closest?.('#back,#finish');if(!button||button.disabled||saving)return;event.preventDefault();event.stopImmediatePropagation();if(button.id==='back'){close('back');return}saving=true;button.disabled=true;showLoader();try{await save()}catch(error){resetTransient();const target=document.getElementById('error');if(target)target.textContent=error?.message||'Не удалось сохранить изображение'}},true);
window.addEventListener('pageshow',resetTransient);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&!saving)resetTransient()});
window.CosmoBeforeAfterBridge=Object.freeze({setStage,resetTransient});
})();