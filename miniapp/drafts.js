(()=>{
const tg=window.Telegram?.WebApp,state=window.CosmoComposerState,aiState=window.CosmoAiWizardState;
if(!tg?.initData||!state||!window.CosmoDraftStoreFactory)return;
const logs=[];
function log(kind,data={}){logs.push({time:new Date().toISOString(),kind,...data});if(logs.length>300)logs.shift()}
window.CosmoDiagnostics={log};
const fetchImpl=window.CosmoDiagnosticsFetch.create({fetchImpl:window.fetch.bind(window),log});
const store=window.CosmoDraftStoreFactory.create({state,auxState:aiState,fetchImpl,authHeaders:()=>({Authorization:`tma ${tg.initData}`}),log});
let beforeAfterFiles=new Map(),beforeAfterFilesInitialized=false,liveSessionActive=false;
function ensureBeforeAfterFiles(){if(beforeAfterFilesInitialized)return;const current=store.getState();beforeAfterFiles=new Map((current.beforeAfterImages||[]).map(item=>[item.role,item.file]));beforeAfterFilesInitialized=true}
async function load(){
  if(liveSessionActive)return {liveSession:true};
  const result=await store.load();
  beforeAfterFilesInitialized=false;
  if(result)liveSessionActive=true;
  return result;
}
function whenReady(){return Promise.resolve(store.getState())}
function clear(){
  liveSessionActive=true;
  const persistence=store.clear();
  beforeAfterFiles.clear();
  beforeAfterFilesInitialized=true;
  void persistence;
  return Promise.resolve(true);
}
function getState(){
  const current=store.getState();
  return liveSessionActive?{...current,hasDraft:true}:current;
}
function setBeforeAfterImage(role,file){if(role!=='before'&&role!=='after')return false;ensureBeforeAfterFiles();if(file)beforeAfterFiles.set(role,file);else beforeAfterFiles.delete(role);return true}
function swapBeforeAfterImages(){ensureBeforeAfterFiles();const before=beforeAfterFiles.get('before')||null,after=beforeAfterFiles.get('after')||null;if(after)beforeAfterFiles.set('before',after);else beforeAfterFiles.delete('before');if(before)beforeAfterFiles.set('after',before);else beforeAfterFiles.delete('after');return true}
function getBeforeAfterDraft(){const current=store.getState();ensureBeforeAfterFiles();const images=[];for(const role of ['before','after']){const index=current.beforeAfterState?.[role]?.imageIndex,file=beforeAfterFiles.get(role);if(Number.isInteger(index)&&index>=0&&file)images[index]=file}return{state:current.beforeAfterState,images}}
window.CosmoSofaDraft=Object.freeze({load,whenReady,scheduleSave:store.scheduleSave,flush:store.flush,save:()=>store.flush('api-save'),clear,cancelRestore:store.cancelRestore,getState,setScreen:store.setScreen,setBeforeAfterState:store.setBeforeAfterState,setBeforeAfterImage,swapBeforeAfterImages,getBeforeAfterDraft});
document.addEventListener('visibilitychange',()=>{if(document.hidden)void store.flush('visibility-hidden')});
window.addEventListener('pagehide',()=>{void store.flush('pagehide')});
})();
