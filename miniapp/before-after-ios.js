(()=>{
const file=document.getElementById('file');
const slots=document.getElementById('slots');
const cropHandle=document.getElementById('cropHandle');
if(!file||!slots||!cropHandle)return;

function protectNativePicker(){
  document.querySelectorAll('.slot[data-slot]').forEach(slot=>{
    const originalDown=slot.onpointerdown;
    if(typeof originalDown!=='function')return;
    slot.onpointerdown=function(event){
      if(event.target?.closest?.('.delete-photo'))return;
      if(!slot.classList.contains('loaded')){
        const originalClick=file.click;
        file.click=()=>{};
        try{return originalDown.call(slot,event)}finally{file.click=originalClick}
      }
      return originalDown.call(slot,event);
    };
  });
}

async function removePhoto(slotName){
  const stateApi=window.CosmoBeforeAfterState;
  const snapshot=stateApi?.getDraftSnapshot?.();
  if(!snapshot?.state)return;
  const keepName=slotName==='before'?'after':'before';
  const keepState=snapshot.state[keepName];
  const keepFile=keepState&&Number.isInteger(keepState.imageIndex)?snapshot.files?.[keepState.imageIndex]:null;
  const nextState={...snapshot.state,[slotName]:null};
  if(keepState&&keepFile){
    nextState[keepName]={...keepState,imageIndex:0};
    await stateApi.restoreDraft(nextState,[keepFile]);
  }else{
    nextState[keepName]=null;
    await stateApi.restoreDraft(nextState,[]);
  }
  window.dispatchEvent(new CustomEvent('cosmo-before-after-change'));
}

document.querySelectorAll('[data-delete-photo]').forEach(button=>{
  button.addEventListener('pointerdown',event=>{event.preventDefault();event.stopPropagation()});
  button.addEventListener('click',event=>{
    event.preventDefault();event.stopPropagation();
    void removePhoto(button.dataset.deletePhoto).catch(error=>{
      const target=document.getElementById('error');
      if(target)target.textContent=error?.message||'Не удалось удалить фото';
    });
  });
});

function installResizeCompatibility(){
  const originalDown=cropHandle.onpointerdown;
  const originalMove=cropHandle.onpointermove;
  const originalUp=cropHandle.onpointerup;
  if(typeof originalDown!=='function'||typeof originalMove!=='function'||typeof originalUp!=='function')return;
  let active=null;

  function cleanup(){
    window.removeEventListener('pointermove',onMove,true);
    window.removeEventListener('pointerup',onEnd,true);
    window.removeEventListener('pointercancel',onEnd,true);
    active=null;
  }

  function onMove(event){
    if(!active||event.pointerId!==active.pointerId)return;
    if(event.cancelable)event.preventDefault();
    const width=slots.getBoundingClientRect().width;
    const minHeight=width/(16/9);
    const maxHeight=Math.max(minHeight,window.innerHeight-120);
    const next=Math.max(minHeight,Math.min(maxHeight,active.startHeight+event.clientY-active.startY));
    slots.style.height=`${next}px`;
    slots.style.aspectRatio='auto';
  }

  function onEnd(event){
    if(!active||event.pointerId!==active.pointerId)return;
    if(event.cancelable)event.preventDefault();
    try{originalMove.call(cropHandle,event)}catch{}
    const release=cropHandle.releasePointerCapture;
    cropHandle.releasePointerCapture=()=>{};
    try{originalUp.call(cropHandle,event)}catch{}finally{cropHandle.releasePointerCapture=release;cleanup()}
  }

  cropHandle.onpointerdown=event=>{
    if(event.cancelable)event.preventDefault();
    event.stopPropagation();
    cleanup();
    active={pointerId:event.pointerId,startY:event.clientY,startHeight:slots.getBoundingClientRect().height};
    const capture=cropHandle.setPointerCapture;
    cropHandle.setPointerCapture=()=>{};
    try{originalDown.call(cropHandle,event)}finally{cropHandle.setPointerCapture=capture}
    window.addEventListener('pointermove',onMove,{capture:true,passive:false});
    window.addEventListener('pointerup',onEnd,true);
    window.addEventListener('pointercancel',onEnd,true);
  };
  cropHandle.onpointermove=null;
  cropHandle.onpointerup=null;
  cropHandle.onpointercancel=null;
}

protectNativePicker();
installResizeCompatibility();
window.CosmoBeforeAfterIos=Object.freeze({removePhoto});
})();
