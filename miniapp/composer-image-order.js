export function moveItem(items,from,to){
  if(!Array.isArray(items)||!Number.isInteger(from)||!Number.isInteger(to)||from<0||to<0||from>=items.length||to>=items.length||from===to)return null;
  const next=items.slice();
  const [item]=next.splice(from,1);
  next.splice(to,0,item);
  return next;
}

export function translatedActiveIndex(active,from,to){
  if(active===from)return to;
  if(from<active&&active<=to)return active-1;
  if(to<=active&&active<from)return active+1;
  return active;
}

export function ownsDragPointer(dragState,pointerId){
  return Boolean(dragState)&&dragState.pointerId===pointerId;
}

export function listenForOwnedDragEnd(handle,pointerId,onEnd){
  const listeners={
    pointerup:event=>finish(event,true),
    pointercancel:event=>finish(event,false),
    lostpointercapture:event=>finish(event,false)
  };
  function cleanup(){Object.entries(listeners).forEach(([type,listener])=>handle.removeEventListener(type,listener))}
  function finish(event,commit){
    if(event.pointerId!==pointerId)return;
    cleanup();
    onEnd(event,commit);
  }
  Object.entries(listeners).forEach(([type,listener])=>handle.addEventListener(type,listener));
  return cleanup;
}

export function keyboardReorderTarget(index,length){
  if(!Number.isInteger(index)||!Number.isInteger(length)||length<2||index<0||index>=length)return null;
  return index===length-1?index-1:index+1;
}
