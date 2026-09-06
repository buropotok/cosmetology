(()=>{
const AUTOSAVE_DELAY_MS=4000;
const LOAD_TIMEOUT_MS=10000;

function create({state,auxState=null,fetchImpl=window.fetch.bind(window),authHeaders=()=>({}),setTimer=setTimeout,clearTimer=clearTimeout,enqueue=queueMicrotask,log=()=>{}}){
  let timer=0,revision=0,savedRevision=0,imageRevision=0,imagesDirty=false;
  let saveInFlight=false,saveRequested=false,restoreGeneration=0,restoring=false,hasDraft=false,disposed=false,loadStatus='idle',activeLoadController=null,draftScreen='ai';
  const waiters=[];
  const normalizeScreen=value=>value==='beforeafter'?'beforeafter':value==='publish'?'publish':'ai';
  const getState=()=>({revision,savedRevision,imageRevision,imagesDirty,saveInFlight,saveRequested,restoring,hasDraft,loadStatus,screen:draftScreen});
  const emit=()=>window.dispatchEvent(new CustomEvent('cosmo-draft-state',{detail:{restoring,hasDraft,loadStatus,screen:draftScreen}}));
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
    body.set('screen',draftScreen==='beforeafter'?'beforeafter':aux?.screen==='publish'?'publish':'ai');
    if(aux)body.set('aiState',JSON.stringify(aux));
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
  function setScreen(value,{persist=true}={}){
    const next=normalizeScreen(value);if(draftScreen===next)return Promise.resolve(true);draftScreen=next;
    if(!persist){emit();return Promise.resolve(true)}
    revision++;hasDraft=hasDraft||next==='beforeafter'||hasContent();emit();scheduleSave('screen');return Promise.resolve(true)
  }
  async function load(){
    activeLoadController?.abort('draft-load-replaced');
    const controller=new AbortController();activeLoadController=controller;
    const timeout=setTimeout(()=>controller.abort('draft-load-timeout'),LOAD_TIMEOUT_MS);
    const generation=++restoreGeneration,startVersion=state.getVersion(),startAuxVersion=auxState?.getVersion?.();restoring=true;loadStatus='loading';emit();
    try{
      const loadInit={headers:authHeaders(),cache:'no-store',signal:controller.signal};
      const response=await fetchImpl('/api/miniapp/draft',loadInit);
      if(!response.ok)throw new Error(`Draft load HTTP ${response.status}`);
      const draft=(await response.json())?.draft;if(generation!==restoreGeneration||state.getVersion()!==startVersion||(auxState&&auxState.getVersion()!==startAuxVersion))return null;if(!draft){hasDraft=false;draftScreen='ai';loadStatus='ready';return null}
      draftScreen=normalizeScreen(draft.screen);
      const images=[];
      for(const item of Array.isArray(draft.images)?draft.images:[]){
        const imageResponse=await fetchImpl(item.url,loadInit);if(generation!==restoreGeneration||state.getVersion()!==startVersion||(auxState&&auxState.getVersion()!==startAuxVersion))return null;
        if(imageResponse.ok){const blob=await imageResponse.blob();images.push(new File([blob],item.fileName||`photo-${item.position+1}`,{type:item.contentType||blob.type||'image/jpeg'}))}
      }
      if(generation!==restoreGeneration||state.getVersion()!==startVersion||(auxState&&auxState.getVersion()!==startAuxVersion))return null;
      state.restore({content:draft.text||'',images,platform:draft.platform,activePhotoIndex:draft.activePhotoIndex});
      auxState?.restore?.({...draft.aiState,screen:draftScreen==='beforeafter'?'ai':draftScreen});
      hasDraft=draftScreen==='beforeafter'||hasContent();savedRevision=revision;loadStatus='ready';return draft;
    }catch(error){
      if(generation===restoreGeneration){loadStatus='error';log('draft-load-error',{error:error?.message||String(error)})}
      throw error;
    }finally{
      clearTimeout(timeout);
      if(activeLoadController===controller)activeLoadController=null;
      if(generation===restoreGeneration){restoring=false;emit()}
    }
  }
  async function clear(){restoreGeneration++;activeLoadController?.abort('draft-load-cancelled');activeLoadController=null;restoring=false;loadStatus='ready';draftScreen='ai';clearTimer(timer);state.reset();auxState?.reset?.();revision++;imageRevision=revision;imagesDirty=true;hasDraft=false;emit();return flush('clear')}
  function cancelRestore(){restoreGeneration++;activeLoadController?.abort('draft-load-cancelled');activeLoadController=null;restoring=false;loadStatus='idle';emit()}
  function dispose(){disposed=true;restoreGeneration++;activeLoadController?.abort('draft-load-disposed');activeLoadController=null;clearTimer(timer);unsubscribe();unsubscribeAux();waiters.splice(0).forEach(waiter=>waiter.resolve(false))}
  return Object.freeze({load,scheduleSave,flush,clear,cancelRestore,dispose,getState,setScreen});
}

window.CosmoDraftStoreFactory=Object.freeze({create,AUTOSAVE_DELAY_MS,LOAD_TIMEOUT_MS});
})();
