import {insertionSide,moveItem,translatedActiveIndex} from './composer-image-reorder.js';

(()=>{
const input=document.querySelector('#image'),previews=document.querySelector('#previews'),removeAll=document.querySelector('#remove-image'),status=document.querySelector('#status');
if(!input||!previews)return;
let files=Array.from(input.files||[]).slice(0,10),internalChange=false,wideCheckGeneration=0,telegramLayout='slideshow',dragState=null;
const VK_MAX_ASPECT=16/9;

const telegramLayoutRow=document.createElement('div');
telegramLayoutRow.className='composer-telegram-photo-layout';
telegramLayoutRow.hidden=true;
telegramLayoutRow.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:10px;padding:11px 12px 1px;border-top:1px solid #e5e5ea;color:#6e6e73;font-size:14px;line-height:1.2';
const telegramLayoutLabel=document.createElement('span');
telegramLayoutLabel.textContent='Отображение фото в Telegram:';
const telegramLayoutButton=document.createElement('button');
telegramLayoutButton.type='button';
telegramLayoutButton.className='composer-telegram-layout-toggle';
telegramLayoutButton.style.cssText='flex:0 0 auto;border:0;border-radius:9px;background:#e8f3fb;color:#2481cc;padding:8px 12px;font:600 14px/1.2 inherit';
telegramLayoutButton.textContent='Карусель';
telegramLayoutButton.setAttribute('aria-label','Отображение фото в Telegram: Карусель. Нажмите, чтобы выбрать коллаж.');
telegramLayoutRow.append(telegramLayoutLabel,telegramLayoutButton);
removeAll?.after(telegramLayoutRow);

function updateTelegramLayoutVisibility(){telegramLayoutRow.hidden=files.length<2}
function renderTelegramLayout(){
 const isCollage=telegramLayout==='collage';
 telegramLayoutButton.textContent=isCollage?'Коллаж':'Карусель';
 telegramLayoutButton.setAttribute('aria-label',`Отображение фото в Telegram: ${isCollage?'Коллаж':'Карусель'}. Нажмите, чтобы выбрать ${isCollage?'карусель':'коллаж'}.`);
}
function setTelegramLayout(value){telegramLayout=value==='collage'?'collage':'slideshow';renderTelegramLayout()}
telegramLayoutButton.addEventListener('click',()=>setTelegramLayout(telegramLayout==='slideshow'?'collage':'slideshow'));

function syncInput(){
 if(typeof DataTransfer==='undefined')return false;
 try{
  const dt=new DataTransfer();
  files.forEach(file=>dt.items.add(file));
  input.files=dt.files;
  return true;
 }catch{return false}
}

function notifyChange(){
 updateTelegramLayoutVisibility();
 void updateVkAspectWarning();
 if(!syncInput())return false;
 internalChange=true;
 try{input.dispatchEvent(new Event('change',{bubbles:true}))}finally{internalChange=false}
 return true;
}

function showLimit(){
 if(!status)return;
 status.textContent='Можно выбрать не больше 10 фотографий. Будут использованы первые 10.';
 status.className='error';
}

function readImageSize(file){
 return new Promise(resolve=>{
  const url=URL.createObjectURL(file),img=new Image();
  const done=value=>{URL.revokeObjectURL(url);resolve(value)};
  img.onload=()=>done({width:img.naturalWidth,height:img.naturalHeight});
  img.onerror=()=>done(null);
  img.src=url;
 });
}

function formatIndexes(indexes){
 if(indexes.length===1)return `Изображение №${indexes[0]}`;
 if(indexes.length===2)return `Изображения №${indexes[0]} и №${indexes[1]}`;
 return `Изображения ${indexes.slice(0,-1).map(n=>`№${n}`).join(', ')} и №${indexes[indexes.length-1]}`;
}

async function updateVkAspectWarning(){
 const generation=++wideCheckGeneration;
 const current=files.slice();
 const sizes=await Promise.all(current.map(readImageSize));
 if(generation!==wideCheckGeneration)return;
 const wide=[];
 sizes.forEach((size,index)=>{if(size?.height>0&&size.width/size.height>VK_MAX_ASPECT+0.001)wide.push(index+1)});
 let warning=document.querySelector('#vk-aspect-warning');
 if(!wide.length){warning?.remove();return}
 if(!warning){warning=document.createElement('p');warning.id='vk-aspect-warning';warning.setAttribute('role','status');warning.style.cssText='margin:8px 0 0;padding:10px 12px;border-radius:10px;background:rgba(255,149,0,.14);color:#b35a00;font-size:14px;line-height:1.35';previews.parentElement?.append(warning)}
 warning.textContent=`${formatIndexes(wide)} шире 16:9. ВКонтакте обрежет ${wide.length===1?'его':'их'} по краям.`;
}

function addFiles(incoming){
 const next=Array.from(incoming||[]);
 const total=files.length+next.length;
 files=[...files,...next].slice(0,10);
 notifyChange();
 if(total>10)showLimit();
}

function replaceAt(index,file){
 if(!Number.isInteger(index)||index<0||index>=files.length||!(file instanceof File))return false;
 files[index]=file;
 notifyChange();
 return true;
}

function moveFile(from,to){
 const next=moveItem(files,from,to);
 if(!next)return false;
 const previous=files;
 const state=window.CosmoComposerState;
 const active=state?.getSnapshot?.().activePhotoIndex;
 files=next;
 if(!notifyChange()){
  files=previous;
  return false;
 }
 if(Number.isInteger(active))state?.setActivePhotoIndex?.(translatedActiveIndex(active,from,to));
 return true;
}

window.CosmoComposerImages={
 addFiles,
 replaceFiles(incoming){files=Array.from(incoming||[]).slice(0,10);notifyChange()},
 replaceAt,
 moveFile,
 getFiles(){return files.slice()},
 getTelegramLayout(){return telegramLayout},
 setTelegramLayout
};

input.addEventListener('change',event=>{
 if(internalChange)return;
 const incoming=Array.from(input.files||[]).slice(0,10);
 if(event.isTrusted)addFiles(incoming);
 else{files=incoming;internalChange=true;try{input.dispatchEvent(new Event('change',{bubbles:true}))}finally{internalChange=false}updateTelegramLayoutVisibility();void updateVkAspectWarning()}
});

removeAll?.addEventListener('click',()=>{files=[];notifyChange()});

function thumbNodes(){return [...previews.querySelectorAll('.composer-thumb')]}

function resetDraggedCard(state){
 const {wrap,placeholder}=state;
 wrap.classList.remove('is-dragging');
 wrap.style.position='relative';
 wrap.style.left='';
 wrap.style.top='';
 wrap.style.width='62px';
 wrap.style.height='62px';
 wrap.style.zIndex='';
 wrap.style.transform='';
 wrap.style.boxShadow='';
 wrap.style.transition='';
 wrap.style.pointerEvents='';
 placeholder.replaceWith(wrap);
}

function dragTargetIndex(state){
 const slots=[...previews.children].filter(node=>node===state.placeholder||node.classList?.contains('composer-thumb'));
 return slots.indexOf(state.placeholder);
}

function finishDrag(event,commit){
 const state=dragState;
 if(!state||event.pointerId!==state.pointerId)return;
 dragState=null;
 const to=dragTargetIndex(state);
 if(!commit){
  const thumbs=thumbNodes().filter(node=>node!==state.wrap);
  const anchor=thumbs[state.from]||null;
  previews.insertBefore(state.placeholder,anchor);
 }
 resetDraggedCard(state);
 try{state.wrap.releasePointerCapture?.(event.pointerId)}catch{}
 if(commit&&to>=0&&to!==state.from)moveFile(state.from,to);
}

function moveDrag(event){
 const state=dragState;
 if(!state||event.pointerId!==state.pointerId)return;
 event.preventDefault();
 state.moved=true;
 state.wrap.style.left=`${event.clientX-state.grabX}px`;
 state.wrap.style.top=`${event.clientY-state.grabY}px`;
 const candidates=thumbNodes().filter(node=>node!==state.wrap);
 let placed=false;
 for(const candidate of candidates){
  const side=insertionSide(event.clientX,candidate.getBoundingClientRect());
  if(side==='before'){
   previews.insertBefore(state.placeholder,candidate);
   placed=true;
   break;
  }
 }
 if(!placed){
  const last=candidates[candidates.length-1];
  if(last)previews.insertBefore(state.placeholder,last.nextSibling===state.wrap?state.wrap:last.nextSibling);
 }
}

function startDrag(event,wrap){
 if(dragState||files.length<2||event.button>0||event.target.closest('.composer-image-delete'))return;
 const from=thumbNodes().indexOf(wrap);
 if(from<0||from>=files.length)return;
 event.preventDefault();
 const rect=wrap.getBoundingClientRect();
 const placeholder=document.createElement('span');
 placeholder.className='composer-thumb-placeholder';
 placeholder.style.cssText=`display:block;flex:0 0 ${rect.width}px;width:${rect.width}px;height:${rect.height}px`;
 previews.insertBefore(placeholder,wrap);
 dragState={pointerId:event.pointerId,from,wrap,placeholder,grabX:event.clientX-rect.left,grabY:event.clientY-rect.top,moved:false};
 wrap.setPointerCapture?.(event.pointerId);
 wrap.classList.add('is-dragging');
 wrap.style.position='fixed';
 wrap.style.left=`${rect.left}px`;
 wrap.style.top=`${rect.top}px`;
 wrap.style.width=`${rect.width}px`;
 wrap.style.height=`${rect.height}px`;
 wrap.style.zIndex='10000';
 wrap.style.transform='scale(1.08)';
 wrap.style.boxShadow='0 14px 28px rgba(0,0,0,.32)';
 wrap.style.transition='none';
 wrap.style.pointerEvents='none';
}

function decorate(){
 const images=[...previews.querySelectorAll('img')];
 images.forEach(img=>{
  if(img.parentElement?.classList.contains('composer-thumb'))return;
  const wrap=document.createElement('span');
  wrap.className='composer-thumb';
  wrap.style.cssText='position:relative;display:block;flex:0 0 62px;width:62px;height:62px;overflow:visible;cursor:pointer;touch-action:none;user-select:none;-webkit-user-select:none;transition:transform .16s ease';
  img.parentNode.insertBefore(wrap,img);
  wrap.append(img);
  wrap.addEventListener('pointerdown',event=>startDrag(event,wrap));
  wrap.addEventListener('pointermove',moveDrag);
  wrap.addEventListener('pointerup',event=>finishDrag(event,true));
  wrap.addEventListener('pointercancel',event=>finishDrag(event,false));
  wrap.addEventListener('lostpointercapture',event=>finishDrag(event,false));
  const del=document.createElement('button');
  del.type='button';
  del.className='composer-image-delete';
  del.setAttribute('aria-label','Удалить изображение');
  del.textContent='×';
  del.style.cssText='position:absolute;right:-5px;top:-5px;width:24px;height:24px;border:0;border-radius:50%;background:#e5484d;color:#fff;font-size:20px;line-height:22px;padding:0;z-index:3;box-shadow:0 1px 4px rgba(0,0,0,.35)';
  del.addEventListener('click',event=>{
   event.preventDefault();
   event.stopPropagation();
   if(!confirm('Удалить это изображение?'))return;
   const current=[...previews.querySelectorAll('img')];
   const index=current.indexOf(img);
   if(index<0||index>=files.length)return;
   files.splice(index,1);
   notifyChange();
  });
  wrap.append(del);
 });
}

renderTelegramLayout();
updateTelegramLayoutVisibility();
decorate();
void updateVkAspectWarning();
new MutationObserver(decorate).observe(previews,{childList:true});
})();
