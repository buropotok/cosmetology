(()=>{
const tg=window.Telegram?.WebApp,text=document.querySelector('#text'),imageInput=document.querySelector('#image'),previews=document.querySelector('#previews'),removeImage=document.querySelector('#remove-image');
if(!tg?.initData||!text||!imageInput)return;
const auth=()=>({Authorization:`tma ${tg.initData}`});let restoring=true,saveTimer=0,imagesDirty=false,lastPlatform='telegram';
function platform(){const vk=document.querySelector('.composer-tab[data-platform="vk"],.composer-tab[data-tab="vk"]');return vk?.classList.contains('active')?'vk':'telegram'}
function activeIndex(){const imgs=[...previews.querySelectorAll('img')];const i=imgs.findIndex(x=>x.classList.contains('active'));return i<0?0:i}
async function saveNow(){if(restoring)return;clearTimeout(saveTimer);const body=new FormData();body.set('text',text.value);body.set('platform',platform());body.set('activePhotoIndex',String(activeIndex()));body.set('imagesChanged',imagesDirty?'1':'0');if(imagesDirty)[...imageInput.files].slice(0,10).forEach(f=>body.append('images',f,f.name));try{const r=await fetch('/api/miniapp/draft',{method:'POST',headers:auth(),body});if(r.ok)imagesDirty=false}catch(e){console.warn('Draft save failed',e)}}
function schedule(){if(restoring)return;clearTimeout(saveTimer);saveTimer=setTimeout(saveNow,450)}
text.addEventListener('input',schedule);imageInput.addEventListener('change',()=>{if(restoring)return;imagesDirty=true;schedule()});
removeImage?.addEventListener('click',()=>{if(restoring)return;setTimeout(()=>{imagesDirty=true;schedule()},0)});
document.addEventListener('click',e=>{const tab=e.target.closest?.('.composer-tab');if(tab)setTimeout(schedule,0);const thumb=e.target.closest?.('#previews img');if(thumb)setTimeout(schedule,350)});
const observer=new MutationObserver(records=>{if(restoring)return;if(records.some(r=>r.type==='attributes'&&r.attributeName==='class'))schedule()});observer.observe(previews,{subtree:true,attributes:true,attributeFilter:['class']});
document.addEventListener('visibilitychange',()=>{if(document.hidden)saveNow()});window.addEventListener('pagehide',saveNow);
async function restore(){try{const r=await fetch('/api/miniapp/draft',{headers:auth(),cache:'no-store'});if(!r.ok)return;const data=await r.json(),d=data?.draft;if(!d)return;text.value=d.text||'';text.dispatchEvent(new Event('input',{bubbles:true}));lastPlatform=d.platform||'telegram';const images=Array.isArray(d.images)?d.images:[];if(images.length&&typeof DataTransfer!=='undefined'){const dt=new DataTransfer();for(const item of images){const ir=await fetch(item.url,{headers:auth(),cache:'no-store'});if(!ir.ok)continue;const blob=await ir.blob();dt.items.add(new File([blob],item.fileName||`photo-${item.position+1}`,{type:item.contentType||blob.type||'image/jpeg'}))}if(dt.files.length){imageInput.files=dt.files;imageInput.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,80));const thumbs=[...previews.querySelectorAll('img')],idx=Math.min(Math.max(Number(d.activePhotoIndex)||0,0),Math.max(thumbs.length-1,0));thumbs[idx]?.click()}}
const selector=lastPlatform==='vk'?'.composer-tab[data-platform="vk"],.composer-tab[data-tab="vk"]':'.composer-tab[data-platform="telegram"],.composer-tab[data-tab="telegram"]';document.querySelector(selector)?.click();
}catch(e){console.warn('Draft restore failed',e)}finally{restoring=false}}
restore();
window.CosmoSofaDraft={save:saveNow};
})();
import('/navigation.js').then(()=>import('/ai-mock-transfer.js')).catch(error=>console.warn('Navigation shell load failed',error));
