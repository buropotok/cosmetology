import {createNavigationStack,NAVIGATION_STATES as STATES} from './navigation-stack.js';

(()=>{
const tg=window.Telegram?.WebApp,router=window.CosmoRouter;
const composer=document.querySelector('#composer-screen');
const text=document.querySelector('#text');
const imageInput=document.querySelector('#image');
if(!composer||!text||!imageInput)return;

const style=document.createElement('style');
style.textContent=`
.cosmo-flow-screen{--c-bg:#f2f2f7;--c-card:#fff;--c-text:#111;--c-muted:#6e6e73;--c-line:#e5e5ea;--c-blue:#2481cc;color:var(--c-text);background:var(--c-bg);margin:-22px -18px -24px;padding:calc(22px + env(safe-area-inset-top)) 16px calc(30px + env(safe-area-inset-bottom));min-height:100vh;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",sans-serif;box-sizing:border-box}.cosmo-flow-screen[hidden]{display:none!important}.cosmo-flow-nav{height:42px;display:flex;align-items:center;justify-content:center;position:relative}.cosmo-flow-nav .cosmo-logo{position:absolute;left:0;width:36px;height:36px;background:url('/assets/icons/cosmo-sofa.svg') center/contain no-repeat}.cosmo-flow-nav .cosmo-settings-button{position:absolute;top:1px;right:0;width:40px;height:40px;margin:0;padding:8px;border:0;border-radius:0;background:transparent url('/assets/icons/settings.svg') center/24px 24px no-repeat;display:grid;place-items:center;appearance:none}.cosmo-flow-nav h1{font-size:17px;font-weight:700;margin:0}.cosmo-home-hero{padding:42px 4px 28px;text-align:center}.cosmo-home-mark{width:76px;height:76px;margin:0 auto 18px;background:url('/assets/icons/cosmo-sofa.svg') center/contain no-repeat}.cosmo-home-hero h2{font-size:28px;margin:0 0 8px}.cosmo-home-hero p{color:var(--c-muted);font-size:15px;line-height:1.45;margin:0}.cosmo-flow-actions{display:grid;gap:11px}.cosmo-primary,.cosmo-secondary{width:100%;border:0;border-radius:12px;padding:15px 16px;font:700 16px/1.2 inherit}.cosmo-primary{background:var(--c-blue);color:#fff}.cosmo-secondary{background:#fff;color:var(--c-blue)}.cosmo-composer-back{position:absolute!important;left:0!important;width:auto!important;height:36px!important;border:0!important;background:transparent!important;color:var(--c-blue)!important;font:600 15px/1 inherit!important;padding:8px 4px!important;z-index:3}.approved-composer .composer-nav::before{display:none!important}.cosmo-draft-loading{position:absolute;inset:0;z-index:20;display:flex;align-items:center;justify-content:center;gap:10px;background:rgba(255,255,255,.88);border-radius:inherit;font:600 14px/1.2 inherit;color:#555}.cosmo-draft-loading[hidden]{display:none!important}.cosmo-draft-spinner{width:20px;height:20px;border:2px solid #cfd4d8;border-top-color:var(--c-blue);border-radius:50%;animation:cosmo-spin .8s linear infinite}.cosmo-preparation-overlay{position:fixed;inset:0;z-index:10050;display:grid;place-items:center;background:rgba(242,242,247,.84);padding:24px}.cosmo-preparation-overlay[hidden]{display:none!important}.cosmo-preparation-card{min-width:160px;display:flex;align-items:center;justify-content:center;gap:11px;padding:16px 20px;border-radius:16px;background:#fff;box-shadow:0 12px 36px rgba(0,0,0,.16);font:600 15px/1.2 inherit;color:#333}.cosmo-preparation-card .cosmo-draft-spinner{flex:0 0 auto}@keyframes cosmo-spin{to{transform:rotate(360deg)}}
`;
document.head.append(style);

const home=document.createElement('section');home.id='home-screen';home.className='cosmo-flow-screen';home.innerHTML=`<header class="cosmo-flow-nav"><span class="cosmo-logo" aria-hidden="true"></span><h1>Cosmo Sofa</h1><button class="cosmo-flow-settings cosmo-settings-button" type="button" aria-label="Настройки"></button></header><div class="cosmo-home-hero"><div class="cosmo-home-mark" aria-hidden="true"></div><h2>Создайте публикацию</h2><p>Подготовьте новый материал или вернитесь к сохранённому черновику.</p></div><div class="cosmo-flow-actions"><button id="flow-new" class="cosmo-primary" type="button">Новый пост</button><button id="flow-continue" class="cosmo-secondary" type="button">Продолжить</button></div>`;
document.querySelector('main')?.prepend(home);
const continueButton=home.querySelector('#flow-continue');
let preparationOverlay;
function getPreparationOverlay(){
  if(preparationOverlay)return preparationOverlay;
  preparationOverlay=document.createElement('div');preparationOverlay.className='cosmo-preparation-overlay';preparationOverlay.hidden=true;preparationOverlay.setAttribute('role','status');preparationOverlay.setAttribute('aria-live','polite');preparationOverlay.innerHTML='<div class="cosmo-preparation-card"><span class="cosmo-draft-spinner" aria-hidden="true"></span><span>Подготовка…</span></div>';document.body.append(preparationOverlay);
  return preparationOverlay;
}
function syncDraftState(state=window.CosmoSofaDraft?.getState?.()){
  const loading=document.querySelector('#cosmo-draft-loading');if(loading)loading.hidden=!state?.restoring;imageInput.disabled=Boolean(state?.restoring)
}
window.addEventListener('cosmo-draft-state',e=>syncDraftState(e.detail));syncDraftState();
const previewArea=document.querySelector('#preview-wrap')||document.querySelector('.composer-media')||imageInput.parentElement;if(previewArea){const cs=getComputedStyle(previewArea);if(cs.position==='static')previewArea.style.position='relative';const loading=document.createElement('div');loading.id='cosmo-draft-loading';loading.className='cosmo-draft-loading';loading.innerHTML='<span class="cosmo-draft-spinner" aria-hidden="true"></span><span>Загрузка черновика</span>';previewArea.append(loading);syncDraftState()}

function popup(options){
  if(tg?.showPopup)return new Promise(resolve=>tg.showPopup(options,id=>resolve(id)));
  return Promise.resolve(window.confirm(options.message)?'continue':'cancel');
}
async function confirmDraftReplacement(){
  const id=await popup({title:'Новый пост',message:'Ваш черновик будет удален!',buttons:[{id:'cancel',type:'cancel',text:'Отмена'},{id:'continue',type:'destructive',text:'Продолжить'}]});
  return id==='continue';
}
async function showDraftLoadError(){
  await popup({title:'Черновик недоступен',message:'Не удалось проверить сохранённый черновик. Попробуйте ещё раз.',buttons:[{id:'ok',type:'ok',text:'ОК'}]});
}
async function showNewPostLoadError(){
  await popup({title:'Новый пост недоступен',message:'Не удалось открыть создание публикации. Попробуйте ещё раз.',buttons:[{id:'ok',type:'ok',text:'ОК'}]});
}
const PREPARATION_MIN_MS=450;
const PREPARATION_STAGE='new-post.preparation';
let diagnosticsPromise,editorPreparationPromise,editorPrepared=false;
function loadRuntimeDiagnostics(){
  if(!diagnosticsPromise)diagnosticsPromise=import('/runtime-diagnostics.js').catch(error=>{diagnosticsPromise=undefined;console.warn('Runtime diagnostics failed to load',error);return null});
  return diagnosticsPromise;
}
function prepareNewPostRuntime(){
  if(editorPrepared)return Promise.resolve({ok:true,cached:true});
  if(!editorPreparationPromise){
    const startupReady=window.CosmoMiniAppReady||Promise.resolve();
    editorPreparationPromise=Promise.resolve(startupReady)
      .then(async()=>{
        const diagnostics=await loadRuntimeDiagnostics();
        diagnostics?.recordRuntimeDiagnostic({event:'stage_started',stage:PREPARATION_STAGE,module:'new-post',status:'loading'});
        let result;
        if(diagnostics?.loadRuntimeModule){
          const runtime=await diagnostics.loadRuntimeModule({stage:PREPARATION_STAGE,module:'composer-editor-runtime',load:()=>import('/composer-editor-runtime.js')});
          if(runtime.ok){
            try{result=await runtime.value.loadComposerEditorRuntime()}catch(error){result={ok:false,error}}
          }else result={ok:false,error:runtime.error};
        }else{
          try{const runtime=await import('/composer-editor-runtime.js');result=await runtime.loadComposerEditorRuntime()}catch(error){result={ok:false,error}}
        }
        diagnostics?.recordRuntimeDiagnostic({event:'stage_completed',stage:PREPARATION_STAGE,module:'new-post',status:result?.ok?'loaded':'failed',error:result?.ok?undefined:result?.error});
        return result||{ok:false};
      })
      .then(result=>{
        editorPrepared=Boolean(result?.ok);
        if(!editorPrepared)editorPreparationPromise=undefined;
        return result;
      })
      .catch(error=>{
        editorPreparationPromise=undefined;
        console.error('New Post runtime preparation failed',error);
        return{ok:false,error};
      });
  }
  return editorPreparationPromise;
}
function settlePreparation(){return prepareNewPostRuntime().catch(error=>({ok:false,error}))}
function wait(ms){return new Promise(resolve=>setTimeout(resolve,ms))}
async function prepareNewPostOrReport(preparation=settlePreparation()){
  if(editorPrepared)return true;
  const overlay=getPreparationOverlay();overlay.hidden=false;
  const started=Date.now();
  try{
    const prepared=await preparation;
    if(!prepared?.ok)console.warn('New Post preparation completed with module failures',prepared?.error||prepared);
    const remaining=PREPARATION_MIN_MS-(Date.now()-started);
    if(remaining>0)await wait(remaining);
    return true;
  }catch(error){
    console.error('New Post preparation failed unexpectedly',error);
    return true;
  }finally{overlay.hidden=true}
}
let newPostEntryPromise;
async function loadNewPostEntry(){
  if(window.CosmoComposerView)return window.CosmoComposerView;
  if(!newPostEntryPromise){
    newPostEntryPromise=import('/new-post-entry.js').catch(error=>{
      newPostEntryPromise=undefined;
      throw error;
    });
  }
  await newPostEntryPromise;
  if(!window.CosmoComposerView){
    newPostEntryPromise=undefined;
    throw new Error('New Post entry did not initialize');
  }
  return window.CosmoComposerView;
}
async function getNewPostEntryOrReport(){
  try{return await loadNewPostEntry()}
  catch(error){
    console.error('New Post entry failed to load',error);
    await showNewPostLoadError();
    return null;
  }
}
async function renderState(state,options={}){
  if(state===STATES.HOME){
    window.CosmoBeforeAfter?.close?.();
    router.show('home');
    return true;
  }
  const composerView=await getNewPostEntryOrReport();
  if(!composerView)return false;
  if(state===STATES.BEFORE_AFTER){
    const beforeAfter=window.CosmoBeforeAfter;
    if(!beforeAfter?.open)return false;
    router.show('composer');
    beforeAfter.open();
    return true;
  }
  window.CosmoBeforeAfter?.close?.();
  router.show('composer');
  if(state===STATES.MENU)composerView.showEntry();
  else if(state===STATES.AI)composerView.showAi();
  else if(state===STATES.PUBLISH)composerView.showEditor(options);
  else return false;
  return true;
}
const navigation=createNavigationStack({render:renderState});
window.CosmoNavigation=navigation;

const nav=composer.querySelector('.composer-nav');if(nav&&!nav.querySelector('#flow-composer-back')){const backButton=document.createElement('button');backButton.id='flow-composer-back';backButton.className='cosmo-composer-back';backButton.type='button';backButton.setAttribute('aria-label','Назад');backButton.textContent='‹ Назад';nav.prepend(backButton);backButton.addEventListener('click',()=>{void navigation.back()})}

async function commitNewPost(draft){
  const composerView=await getNewPostEntryOrReport();
  if(!composerView)return;
  if(draft?.clear)await draft.clear();
  else draft?.cancelRestore?.();
  window.dispatchEvent(new CustomEvent('cosmo-new-post',{detail:{source:'flow-new'}}));
  window.dispatchEvent(new CustomEvent('cosmo-ai-wizard-reset'));
  await navigation.reset([STATES.HOME,STATES.MENU]);
}
let newPostInFlight=false;
async function openNewPost(){
  if(newPostInFlight)return;
  newPostInFlight=true;
  const button=home.querySelector('#flow-new');button.disabled=true;
  const preparation=settlePreparation();
  try{
    const draft=window.CosmoSofaDraft;
    if(!draft){if(await prepareNewPostOrReport(preparation))await commitNewPost(draft);return}
    let state;
    try{state=draft.whenReady?await draft.whenReady():draft.getState?.()}catch{await showDraftLoadError();return}
    if(!state||state.loadStatus!=='ready'){await showDraftLoadError();return}
    if(state.hasDraft&&!(await confirmDraftReplacement()))return;
    if(!(await prepareNewPostOrReport(preparation)))return;
    await commitNewPost(draft);
  }finally{newPostInFlight=false;button.disabled=false}
}
let resumeInFlight=false;
async function resumeDraft(){
  if(resumeInFlight)return;
  const draft=window.CosmoSofaDraft,overlay=window.CosmoDraftLoadingOverlay;
  if(!draft?.load)return;
  resumeInFlight=true;continueButton.disabled=true;overlay?.showLoading?.();
  const preparation=settlePreparation();
  try{
    let restored;
    try{restored=await draft.load()}catch{overlay?.hide?.();await showDraftLoadError();return}
    const prepared=await preparation;
    if(!prepared?.ok)console.warn('Continue preparation completed with module failures',prepared?.error||prepared);
    const state=draft.getState?.();
    if(!restored||!state?.hasDraft){
      if(overlay?.showEmpty)await overlay.showEmpty();
      else await popup({title:'Сессия не найдена',message:'Нет сохранённых сессий!',buttons:[{id:'continue',type:'ok',text:'Продолжить'}]});
      continueButton.hidden=true;
      return;
    }
    overlay?.hide?.();
    await navigation.reset([STATES.HOME,STATES.MENU]);
  }finally{resumeInFlight=false;continueButton.disabled=false}
}
home.querySelector('#flow-new').addEventListener('click',()=>{void openNewPost()});
continueButton.addEventListener('click',()=>{void resumeDraft()});
router.show('home',{notify:false});
})();
