(()=>{
const tg=window.Telegram?.WebApp,state=window.CosmoComposerState,aiState=window.CosmoAiWizardState;
if(!tg?.initData||!state||!window.CosmoDraftStoreFactory)return;
const logs=[];
function log(kind,data={}){logs.push({time:new Date().toISOString(),kind,...data});if(logs.length>300)logs.shift()}
window.CosmoDiagnostics={log};
const fetchImpl=window.CosmoDiagnosticsFetch.create({fetchImpl:window.fetch.bind(window),log});
const store=window.CosmoDraftStoreFactory.create({state,auxState:aiState,fetchImpl,authHeaders:()=>({Authorization:`tma ${tg.initData}`}),log});
const initialLoad=store.load();
const whenReady=()=>initialLoad.then(()=>store.getState());
window.CosmoSofaDraft=Object.freeze({load:store.load,whenReady,scheduleSave:store.scheduleSave,flush:store.flush,save:()=>store.flush('api-save'),clear:store.clear,cancelRestore:store.cancelRestore,getState:store.getState,setScreen:store.setScreen,setBeforeAfterState:store.setBeforeAfterState,getBeforeAfterDraft:()=>{const current=store.getState(),byRole=new Map((current.beforeAfterImages||[]).map(item=>[item.role,item.file])),images=[];for(const role of ['before','after']){const index=current.beforeAfterState?.[role]?.imageIndex,file=byRole.get(role);if(Number.isInteger(index)&&index>=0&&file)images[index]=file}return{state:current.beforeAfterState,images}}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)void store.flush('visibility-hidden')});
window.addEventListener('pagehide',()=>{void store.flush('pagehide')});
void initialLoad.catch(()=>{});
})();
