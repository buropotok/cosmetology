(()=>{
const AUTOSAVE_DELAY_MS=4000;

function create({state,auxState=null,fetchImpl=window.fetch.bind(window),authHeaders=()=>({}),setTimer=setTimeout,clearTimer=clearTimeout,enqueue=queueMicrotask,log=()=>{}}){
  let timer=0,revision=0,savedRevision=0,imageRevision=0,imagesDirty=false;
  let saveInFlight=false,saveRequested=false,restoreGeneration=0,restoring=false,hasDraft=false,disposed=false;
  const waiters=[];
  const getState=()=>({revision,savedRevision,imageRevision,imagesDirty,saveInFlight,saveRequested,restoring,hasDraft});
  const emit=()=>window.dispatchEvent(new CustomEvent('cosmo-draft-state',{detail:{restoring,hasDraft}}));
  const auxSnapshot=()=>auxState?.getSnapshot?.()||null;
  const hasContent=(snapshot=state.getSnapshot(),aux=auxSnapshot())=>Boolean(snapshot.plainText.trim()||snapshot.images.length||aux?.prompt?.trim()||aux?.response?.trim()||aux?.discovery?.ideas?.length);

  function onChange(change){
    if(restoring||disposed)return;
    revision++;
    if(change.fields.includes('images')){imagesDirty=true;imageRevision=revision}
    hasDraft=hasContent(change.snapshot);emit();scheduleSave(change.reason);
  }
  function onAuxChange(change){
    if(restoring||disposed)return;
    revision++;hasDraft=hasContent(state.getSnapshot(),change.snapshot);emit();scheduleSave(change.reason||'ai-state');
  }
  const unsubscribe=state.subscribe(onChange),unsubscribeAux=auxState?.subscribe?.(onAuxChange)||(()=>{});

  function serialize(snapshot,includeImages,aux){
    const body=new FormData();body.set('text',snapshot.content);body.set('platform',snapshot.platform);body.set('activePhotoIndex',String(snapshot.activePhotoIndex));body.set('imagesChanged',includeImages?'1':'0');
    if(aux){body.set('screen',aux.screen==='publish'?'publish':'ai');body.set('aiState',JSON.stringify(aux))}
    if(includeImages)snapshot.images.slice(0,10).forEach(file=>body.append('images',file,file.name));
    return body;
  }
  function settleWaiters(ok){for(let i=waiters.length-1;i>=0;i--)if(!ok||savedRevision>=waiters[i].revision)waiters.splice(i,1)[0].resolve(ok)}
  async function drainSaves(){
    if(saveInFlight||restoring||disposed)return;
    if(savedRevision>=revision){saveRequested=false;settleWaiters(true);return}
    saveInFlight=true;saveRequested=false;
    const capturedRevision=revision,capturedImageRevision=imageRevision,includeImages=imagesDirty,snapshot=state.getSnapshot(),aux=auxSnapshot();
    let ok=false;
    try{
      const response=await fetchImpl('/api/miniapp/draft',{method:'POST',headers:authHeaders(),body:serialize(snapshot,includeImages,aux)});ok=response.ok;
      if(ok){savedRevision=Math.max(savedRevision,capturedRevision);if(includeImages&&imageRevision===capturedImageRevision)imagesDirty=false}
      else log('draft-save-failed',{status:response.status,revision:capturedRevision});
    }catch(error){log('draft-save-error',{revision:capturedRevision,error:error?.message||String(error)})}
    finally{
      saveInFlight=false;
      if(!ok){saveRequested=true;settleWaiters(false);return}
      settleWaiters(true);
      if(revision>savedRevision){saveRequested=true;enqueue(drainSaves)}
    }
  }
  function scheduleSave(reason='change'){if(restoring||disposed)return;clearTimer(timer);timer=setTimer(()=>{timer=0;void flush(reason)},AUTOSAVE_DELAY_MS)}
  function flush(reason='manual'){
    clearTimer(timer);timer=0;if(restoring||disposed)return Promise.resolve(false);
    const target=revision;if(savedRevision>=target&&!saveInFlight)return Promise.resolve(true);
    saveRequested=true;log('draft-flush',{reason,revision});
    const completion=new Promise(resolve=>waiters.push({revision:target,resolve}));void drainSaves();return completion;
  }
  async function load(){
    const generation=++restoreGeneration,startVersion=state.getVersion(),startAuxVersion=auxState?.getVersion?.();restoring=true;emit();
    try{
      const response=await fetchImpl('/api/miniapp/draft',{headers:authHeaders(),cache:'no-store'});if(!response.ok)return null;
      const draft=(await response.json())?.draft;if(generation!==restoreGeneration||state.getVersion()!==startVersion||(auxState&&auxState.getVersion()!==startAuxVersion))return null;if(!draft){hasDraft=false;return null}
      const images=[];
      for(const item of Array.isArray(draft.images)?draft.images:[]){
        const imageResponse=await fetchImpl(item.url,{headers:authHeaders(),cache:'no-store'});if(generation!==restoreGeneration||state.getVersion()!==startVersion||(auxState&&auxState.getVersion()!==startAuxVersion))return null;
        if(imageResponse.ok){const blob=await imageResponse.blob();images.push(new File([blob],item.fileName||`photo-${item.position+1}`,{type:item.contentType||blob.type||'image/jpeg'}))}
      }
      if(generation!==restoreGeneration||state.getVersion()!==startVersion||(auxState&&auxState.getVersion()!==startAuxVersion))return null;
      state.restore({content:draft.text||'',images,platform:draft.platform,activePhotoIndex:draft.activePhotoIndex});
      auxState?.restore?.({...draft.aiState,screen:draft.screen});
      hasDraft=hasContent();savedRevision=revision;return draft;
    }finally{if(generation===restoreGeneration){restoring=false;emit()}}
  }
  async function clear(){restoreGeneration++;restoring=false;clearTimer(timer);state.reset();auxState?.reset?.();revision++;imageRevision=revision;imagesDirty=true;hasDraft=false;emit();return flush('clear')}
  function cancelRestore(){restoreGeneration++;restoring=false;emit()}
  function dispose(){disposed=true;restoreGeneration++;clearTimer(timer);unsubscribe();unsubscribeAux();waiters.splice(0).forEach(waiter=>waiter.resolve(false))}
  return Object.freeze({load,scheduleSave,flush,clear,cancelRestore,dispose,getState});
}

window.CosmoDraftStoreFactory=Object.freeze({create,AUTOSAVE_DELAY_MS});
})();
