(()=>{
const photos={before:null,after:null};let layout='horizontal',pending='before',editing=null,editSnapshot=null,cropHeight=null;
const $=id=>document.getElementById(id),slots=$('slots'),file=$('file'),editor=$('editor'),stage=$('stage'),editImage=$('editImage'),rotation=$('rotation'),cropHandle=$('cropHandle');
function transformFor(p){return `translate(calc(-50% + ${p.x}px),calc(-50% + ${p.y}px)) scale(${p.scale}) rotate(${p.rotation}deg)`}
function render(){slots.dataset.layout=layout;document.querySelectorAll('[data-layout]').forEach(b=>b.classList.toggle('selected',b.dataset.layout===layout));['before','after'].forEach(s=>{const el=document.querySelector(`[data-slot=${s}]`),img=el.querySelector('img'),p=photos[s];el.classList.toggle('loaded',!!p);if(p){img.src=p.url;img.style.width=`${p.img.naturalWidth}px`;img.style.height=`${p.img.naturalHeight}px`;img.style.transform=transformFor(p)}});$('finish').disabled=!(photos.before||photos.after)}
document.querySelectorAll('[data-layout]').forEach(b=>b.onclick=()=>{layout=b.dataset.layout;requestAnimationFrame(()=>{refitForComposite();render()})});
document.querySelectorAll('[data-slot]').forEach(b=>b.onclick=()=>{const s=b.dataset.slot;if(photos[s])openEditor(s);else{pending=s;file.click()}});
file.onchange=()=>{const f=file.files?.[0];file.value='';if(!f)return;if(!['image/jpeg','image/png','image/webp'].includes(f.type)){$('error').textContent='Поддерживаются JPEG, PNG и WebP.';return}const url=URL.createObjectURL(f),img=new Image();img.onload=()=>{if(photos[pending])URL.revokeObjectURL(photos[pending].url);photos[pending]={file:f,url,img,x:0,y:0,scale:1,rotation:0,fitted:false};render();openEditor(pending)};img.src=url};
$('swap').onclick=()=>{[photos.before,photos.after]=[photos.after,photos.before];render()};
function transform(){if(!editing)return;const p=photos[editing];editImage.style.width=`${p.img.naturalWidth}px`;editImage.style.height=`${p.img.naturalHeight}px`;editImage.style.transform=transformFor(p)}
function fit(p,r=stage.getBoundingClientRect()){p.scale=Math.max(r.width/p.img.naturalWidth,r.height/p.img.naturalHeight);p.x=p.y=0;p.fitted=true}
function refitForComposite(){['before','after'].forEach(s=>{const p=photos[s],slot=document.querySelector(`[data-slot=${s}]`);if(!p||!slot)return;const r=slot.getBoundingClientRect();const min=Math.max(r.width/p.img.naturalWidth,r.height/p.img.naturalHeight);if(p.scale<min)p.scale=min})}
function openEditor(s){editing=s;const p=photos[s];editSnapshot={x:p.x,y:p.y,scale:p.scale,rotation:p.rotation,fitted:p.fitted};editor.hidden=false;$('editorTitle').textContent=s==='before'?'До':'После';editImage.src=p.url;requestAnimationFrame(()=>{if(!p.fitted)fit(p);rotation.value=String(p.rotation);$('angle').textContent=`${p.rotation}°`;transform()})}
$('editorCancel').onclick=()=>{if(editing&&editSnapshot)Object.assign(photos[editing],editSnapshot);editor.hidden=true;editing=null;editSnapshot=null;render()};
$('editorSave').onclick=()=>{editor.hidden=true;editing=null;editSnapshot=null;requestAnimationFrame(()=>{refitForComposite();render()})};
rotation.oninput=()=>{if(!editing)return;photos[editing].rotation=Number(rotation.value);$('angle').textContent=`${rotation.value}°`;transform()};
$('gridToggle').onclick=()=>{const g=$('grid');g.hidden=!g.hidden;$('gridToggle').textContent=g.hidden?'Показать сетку':'Скрыть сетку'};
const pointers=new Map;let gesture=null;
function point(e){return{x:e.clientX,y:e.clientY}}
function beginGesture(){if(!editing)return;const a=[...pointers.values()],p=photos[editing];if(a.length===1)gesture={type:'pan',start:a[0],x:p.x,y:p.y};else if(a.length>=2){gesture={type:'pinch',distance:Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y),scale:p.scale}}}
stage.onpointerdown=e=>{stage.setPointerCapture(e.pointerId);pointers.set(e.pointerId,point(e));beginGesture()};
stage.onpointermove=e=>{if(!editing||!pointers.has(e.pointerId))return;pointers.set(e.pointerId,point(e));const a=[...pointers.values()],p=photos[editing];if(a.length===1){if(!gesture||gesture.type!=='pan')beginGesture();const g=gesture;p.x=g.x+a[0].x-g.start.x;p.y=g.y+a[0].y-g.start.y}else if(a.length>=2){if(!gesture||gesture.type!=='pinch')beginGesture();const d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);p.scale=Math.max(.1,Math.min(10,gesture.scale*d/Math.max(1,gesture.distance)))}transform()};
function end(e){pointers.delete(e.pointerId);beginGesture()}stage.onpointerup=end;stage.onpointercancel=end;
let cropGesture=null;
function startCrop(e){e.preventDefault();e.stopPropagation();const r=slots.getBoundingClientRect();cropGesture={startY:e.clientY,startHeight:r.height};cropHandle.setPointerCapture?.(e.pointerId)}
function moveCrop(e){if(!cropGesture)return;e.preventDefault();const minHeight=180,maxHeight=Math.max(minHeight,window.innerHeight-120);const next=Math.max(minHeight,Math.min(maxHeight,cropGesture.startHeight+(e.clientY-cropGesture.startY)));cropHeight=next;slots.style.height=`${next}px`;requestAnimationFrame(()=>{refitForComposite();render()})}
function endCrop(e){if(!cropGesture)return;cropGesture=null;cropHandle.releasePointerCapture?.(e.pointerId)}
cropHandle.onpointerdown=startCrop;cropHandle.onpointermove=moveCrop;cropHandle.onpointerup=endCrop;cropHandle.onpointercancel=endCrop;
$('finish').onclick=()=>history.back();$('back').onclick=()=>history.back();window.addEventListener('beforeunload',()=>['before','after'].forEach(s=>photos[s]&&URL.revokeObjectURL(photos[s].url)));render();
})();