(()=>{
const params=new URLSearchParams(location.search);
if(params.get('embedded')!=='1'||window.parent===window)return;
const saveOverlay=document.getElementById('saveOverlay'),saveStage=document.getElementById('saveStage');
function close(action){window.parent.postMessage({type:'cosmo-before-after-close',action},location.origin)}
function setStage(message){if(saveStage)saveStage.textContent=message||''}
function showLoader(message='Сохраняем копию в галерею…'){setStage(message);if(saveOverlay)saveOverlay.hidden=false}
function hideLoader(){if(saveOverlay)saveOverlay.hidden=true}
async function compositeBlob(){
  const result=document.getElementById('compositeResult');
  if(result?.dataset.url&&!result.hidden)return fetch(result.dataset.url).then(r=>r.blob());
  if(typeof window.cosmoBeforeAfterCompositeBlob==='function')return window.cosmoBeforeAfterCompositeBlob();
  return null;
}
async function save(){
  showLoader();
  const blob=await compositeBlob();
  if(!blob)throw new Error('Не удалось собрать изображение');
  const parentApi=window.parent.CosmoBeforeAfter;
  if(typeof parentApi?.save!=='function')throw new Error('Редактор недоступен. Попробуйте открыть До / После заново.');
  await parentApi.save(blob,`before-after-${Date.now()}.jpg`);
}
document.addEventListener('click',async event=>{
  const button=event.target.closest?.('#back,#finish');
  if(!button||button.disabled)return;
  event.preventDefault();event.stopImmediatePropagation();
  if(button.id==='back'){close('back');return}
  button.disabled=true;
  const target=document.getElementById('error');if(target)target.textContent='';
  try{await save()}catch(error){hideLoader();if(target)target.textContent=error?.message||'Не удалось сохранить изображение';button.disabled=false}
},true);
window.CosmoBeforeAfterBridge=Object.freeze({setStage,showLoader,hideLoader});
})();