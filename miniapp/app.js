const webApp=window.Telegram?.WebApp;webApp?.ready();webApp?.expand();
const form=document.querySelector('#publish-form'),imageInput=document.querySelector('#image'),previewWrap=document.querySelector('#preview-wrap'),previews=document.querySelector('#previews'),removeImage=document.querySelector('#remove-image'),text=document.querySelector('#text'),publish=document.querySelector('#publish'),status=document.querySelector('#status'),publishVk=document.querySelector('#publish-vk');

publishVk.addEventListener('click',async()=>window.CosmoComposerActions.publishVk(async()=>{
  try{
    let textCopied=false,imageDownloadStarted=false;
    if(text.value.trim()){
      await navigator.clipboard.writeText(text.value);
      textCopied=true;
      vkDiag('vk-text-copied',{textLength:text.value.length});
    }
    if(typeof webApp?.downloadFile!=='function')throw new Error('Telegram downloadFile недоступен.');
    const response=await fetch('/api/miniapp/draft',{headers:authHeaders()}),result=await response.json().catch(()=>null);
    if(!response.ok)throw new Error(result?.error?.message||'Не удалось получить изображение.');
    const image=result?.draft?.images?.[0];
    if(!image?.url)throw new Error('Нет сохранённого изображения.');
    const url=new URL(image.url,location.origin).href,fileName=image.fileName||'cosmo-sofa.jpg';
    vkDiag('vk-image-download-request',{fileName,textCopied});
    webApp.downloadFile({url,file_name:fileName},accepted=>{
      imageDownloadStarted=!!accepted;
      vkDiag('vk-image-download-result',{accepted:imageDownloadStarted,textCopied});
      setStatus(imageDownloadStarted?(textCopied?'Текст скопирован, загрузка фото началась.':'Загрузка фото началась.'):(textCopied?'Текст скопирован, загрузка фото отменена.':'Загрузка фото отменена.'),imageDownloadStarted?'success':'error');
    });
  }catch(error){
    const message=error instanceof Error?error.message:'Не удалось подготовить материалы.';
    vkDiag('vk-preparation-error',{message});
    setStatus(message,'error');
  }
}));

let previewUrls=[];const user=webApp?.initDataUnsafe?.user;if(user?.first_name)document.querySelector('#greeting').textContent=`Здравствуйте, ${user.first_name}`;
publish.disabled=false;
function vkDiag(kind,data={}){try{window.CosmoDiagnostics?.log?.(kind,data)}catch{}console.log(`[VK] ${kind}`,data)}
function toggleAccordion(trigger){const item=trigger.closest('.settings-item'),open=trigger.getAttribute('aria-expanded')==='true';trigger.setAttribute('aria-expanded',String(!open));item?.classList.toggle('open',!open);webApp?.HapticFeedback?.selectionChanged()}document.querySelectorAll('.accordion-trigger').forEach(trigger=>{trigger.addEventListener('click',()=>toggleAccordion(trigger));trigger.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleAccordion(trigger)}})});
function authHeaders(){return{Authorization:`tma ${webApp.initData}`}}function setStatus(message,kind=''){status.textContent=message;status.className=kind}function selectedImages(){return Array.from(imageInput.files||[]).slice(0,10)}function clearImage(){imageInput.value='';previewWrap.hidden=true;for(const url of previewUrls)URL.revokeObjectURL(url);previewUrls=[];previews.replaceChildren();const stage=document.querySelector('.composer-image');if(stage){stage.classList.remove('has-photo');stage.style.removeProperty('--active-photo');stage.querySelector('.composer-photo-stage-track')?.remove()}}function appendImages(body){selectedImages().forEach(file=>body.append('images',file,file.name))}
function activePhoto(){return window.CosmoComposerState?.getSnapshot().activePhotoIndex||0}function renderPhoto(index=activePhoto(),animate=true){if(!previewUrls.length)return;const stage=document.querySelector('.composer-image'),track=stage?.querySelector('.composer-photo-stage-track');if(track){track.style.transition=animate?'transform .32s cubic-bezier(.22,.61,.36,1)':'none';track.style.transform=`translate3d(${-index*100}%,0,0)`}previews.querySelectorAll('img').forEach((img,i)=>img.classList.toggle('active',i===index));previews.querySelector('img.active')?.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'})}function selectPhoto(index,animate=true){if(!previewUrls.length)return;window.CosmoComposerState?.setActivePhotoIndex(index);renderPhoto(activePhoto(),animate);webApp?.HapticFeedback?.selectionChanged()}
function buildPhotoStage(){const stage=document.querySelector('.composer-image');if(!stage||!previewUrls.length)return;stage.classList.add('has-photo');stage.querySelector('.composer-photo-stage-track')?.remove();const track=document.createElement('div');track.className='composer-photo-stage-track';for(const url of previewUrls){const img=document.createElement('img');img.src=url;img.alt='Фото публикации';track.append(img)}stage.append(track);let startX=0,currentX=0,dragging=false;stage.ontouchstart=e=>{if(e.touches.length!==1)return;dragging=true;startX=currentX=e.touches[0].clientX;track.style.transition='none'};stage.ontouchmove=e=>{if(!dragging)return;currentX=e.touches[0].clientX;const delta=currentX-startX;track.style.transform=`translate3d(calc(${-activePhoto()*100}% + ${delta}px),0,0)`};stage.ontouchend=()=>{if(!dragging)return;dragging=false;const current=activePhoto(),delta=currentX-startX,threshold=Math.min(70,(stage.clientWidth||300)*.18);if(delta<-threshold&&current<previewUrls.length-1)selectPhoto(current+1);else if(delta>threshold&&current>0)selectPhoto(current-1);else renderPhoto(current)};queueMicrotask(()=>renderPhoto(activePhoto(),false))}
imageInput.addEventListener('change',()=>{for(const url of previewUrls)URL.revokeObjectURL(url);previewUrls=[];previews.replaceChildren();const files=selectedImages();if(!files.length)return clearImage();if((imageInput.files?.length||0)>10)setStatus('Можно выбрать не больше 10 фотографий. Будут использованы первые 10.','error');files.forEach((file,index)=>{const url=URL.createObjectURL(file);previewUrls.push(url);const img=document.createElement('img');img.src=url;img.alt='Предпросмотр '+file.name;img.addEventListener('click',()=>selectPhoto(index));previews.append(img)});previewWrap.hidden=false;buildPhotoStage();if((imageInput.files?.length||0)<=10)setStatus('')});removeImage.addEventListener('click',clearImage);
form.addEventListener('submit',async event=>{event.preventDefault();if(!text.value.trim()&&!selectedImages().length)return setStatus('Добавьте текст или изображение.','error');publish.disabled=true;publish.textContent='Публикуем…';setStatus('Публикуем…');const body=new FormData();body.set('text',text.value);appendImages(body);try{const {response,result}=await window.CosmoComposerActions.publishTelegram({method:'POST',headers:authHeaders(),body});if(!response.ok)throw new Error(result?.error?.message||'Не удалось опубликовать. Попробуйте ещё раз.');setStatus('Опубликовано через персонального бота.','success');webApp.HapticFeedback?.notificationOccurred('success')}catch(error){setStatus(error instanceof Error?error.message:'Не удалось опубликовать.','error');webApp.HapticFeedback?.notificationOccurred('error')}finally{publish.disabled=false;publish.textContent='Опубликовать в Telegram'}});
window.addEventListener('cosmo-composer-restore',()=>{requestAnimationFrame(()=>renderPhoto(activePhoto(),false))});
