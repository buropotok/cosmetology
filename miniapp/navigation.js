import {createNavigationStack,NAVIGATION_STATES as STATES} from './navigation-stack.js';

(()=>{
const tg=window.Telegram?.WebApp,router=window.CosmoRouter;
const composer=document.querySelector('#composer-screen');
const text=document.querySelector('#text');
const imageInput=document.querySelector('#image');
if(!composer||!text||!imageInput)return;

const style=document.createElement('style');
style.textContent=`
.cosmo-flow-screen{--c-bg:#f2f2f7;--c-card:#fff;--c-text:#111;--c-muted:#6e6e73;--c-line:#e5e5ea;--c-blue:#2481cc;color:var(--c-text);background:var(--c-bg);margin:-22px -18px -24px;padding:calc(22px + env(safe-area-inset-top)) 16px calc(30px + env(safe-area-inset-bottom));min-height:100vh;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",sans-serif;box-sizing:border-box}.cosmo-flow-screen[hidden]{display:none!important}.cosmo-flow-nav{height:42px;display:flex;align-items:center;justify-content:center;position:relative}.cosmo-flow-nav .cosmo-logo{position:absolute;left:0;width:36px;height:36px;background:url('/assets/icons/cosmo-sofa.svg') center/contain no-repeat}.cosmo-flow-nav .cosmo-settings-button{position:absolute;top:1px;right:0;width:40px;height:40px;margin:0;padding:8px;border:0;border-radius:0;background:transparent url('/assets/icons/settings.svg') center/24px 24px no-repeat;display:grid;place-items:center;appearance:none}.cosmo-flow-nav h1{font-size:17px;font-weight:700;margin:0}.cosmo-flow-back{position:absolute;left:0;border:0;background:transparent;color:var(--c-blue);font:600 15px/1 inherit;padding:8px 4px}.cosmo-home-hero{padding:42px 4px 28px;text-align:center}#flow-continue[hidden]{display:none!important}.cosmo-home-mark{width:228px;height:228px;margin:0 auto 18px;background:url('/assets/icons/cosmo-sofa.svg') center/contain no-repeat}.cosmo-home-hero h2{font-size:28px;margin:0 0 8px}.cosmo-home-hero p{color:var(--c-muted);font-size:15px;line-height:1.45;margin:0}.cosmo-flow-actions{display:grid;gap:11px}.cosmo-primary,.cosmo-secondary{width:100%;border:0;border-radius:12px;padding:15px 16px;font:700 16px/1.2 inherit}.cosmo-primary{background:var(--c-blue);color:#fff}.cosmo-secondary{background:#fff;color:var(--c-blue)}.cosmo-ai-intro{margin:18px 0 12px}.cosmo-ai-intro strong{display:block;font-size:21px;margin-bottom:5px}.cosmo-ai-intro span{color:var(--c-muted);font-size:14px}.cosmo-ai-card{background:#fff;border-radius:15px;padding:14px;margin-bottom:14px}.cosmo-ai-head{display:flex;gap:10px;align-items:center}.cosmo-ai-avatar{width:38px;height:38px;border-radius:50%;background:var(--c-blue);color:#fff;display:grid;place-items:center;font-size:19px}.cosmo-ai-head strong{display:block;font-size:16px}.cosmo-ai-head span{display:block;color:var(--c-muted);font-size:13px}.cosmo-ai-chips{display:flex;gap:8px;overflow-x:auto;margin:14px -2px 12px;padding:2px;scrollbar-width:none}.cosmo-ai-chip{white-space:nowrap;border:0;background:#f2f2f7;border-radius:999px;padding:9px 12px;font:400 13px/1 inherit;color:#444}.cosmo-ai-chip.active{background:var(--c-blue);color:#fff}.cosmo-ai-prompt{display:flex;gap:7px;background:#f2f2f7;border-radius:11px;padding:4px 5px}.cosmo-ai-prompt input{min-width:0;flex:1;border:0;outline:0;padding:8px;background:transparent;font:14px/1.2 inherit}.cosmo-ai-prompt button{width:34px;height:34px;border:0;border-radius:9px;background:var(--c-blue);color:#fff;font-size:16px}.cosmo-ai-prompt button:disabled{opacity:.55}.cosmo-ai-test{display:flex;gap:8px;margin:10px 0 0}.cosmo-ai-test input{min-width:0;flex:1;border:1px solid #c7c7cc;border-radius:10px;background:#fff;padding:11px 12px;font:16px/1.2 sans-serif;color:#111;position:relative;z-index:50;pointer-events:auto;-webkit-user-select:text;user-select:text}.cosmo-ai-test button{border:0;border-radius:10px;background:#111;color:#fff;padding:0 14px;font:600 14px/1 sans-serif;position:relative;z-index:50}.cosmo-ai-test button:disabled{opacity:.55}.cosmo-manual{margin-top:10px}.cosmo-ai-result{background:#fff;border-radius:15px;overflow:hidden;margin:14px 0}.cosmo-ai-image{height:205px;background:#e9edf1}.cosmo-ai-image svg{display:block;width:100%;height:100%}.cosmo-ai-copy{padding:15px}.cosmo-ai-copy h3{font-size:17px;margin:0 0 9px}.cosmo-ai-copy p{font-size:15px;line-height:1.5;margin:0;color:#26282c}.cosmo-ai-note{font-size:12px;color:var(--c-muted);text-align:center;margin:10px 0 0}.cosmo-composer-back{position:absolute!important;left:0!important;width:auto!important;height:36px!important;border:0!important;background:transparent!important;color:var(--c-blue)!important;font:600 15px/1 inherit!important;padding:8px 4px!important;z-index:3}.approved-composer .composer-nav::before{display:none!important}.cosmo-draft-loading{position:absolute;inset:0;z-index:20;display:flex;align-items:center;justify-content:center;gap:10px;background:rgba(255,255,255,.88);border-radius:inherit;font:600 14px/1.2 inherit;color:#555}.cosmo-draft-loading[hidden]{display:none!important}.cosmo-draft-spinner{width:20px;height:20px;border:2px solid #cfd4d8;border-top-color:var(--c-blue);border-radius:50%;animation:cosmo-spin .8s linear infinite}@keyframes cosmo-spin{to{transform:rotate(360deg)}}
`;
document.head.append(style);

const home=document.createElement('section');home.id='home-screen';home.className='cosmo-flow-screen';home.innerHTML=`<header class="cosmo-flow-nav"><span class="cosmo-logo" aria-hidden="true"></span><h1>Cosmo Sofa</h1><button class="cosmo-flow-settings cosmo-settings-button" type="button" aria-label="Настройки"></button></header><div class="cosmo-home-hero"><div class="cosmo-home-mark" aria-hidden="true"></div><h2>Создайте публикацию</h2><p>Подготовьте новый материал или вернитесь к сохранённому черновику.</p></div><div class="cosmo-flow-actions"><button id="flow-new" class="cosmo-primary" type="button">Новый пост</button><button id="flow-continue" class="cosmo-secondary" type="button">Продолжить</button></div>`;
document.querySelector('main')?.prepend(home);
const continueButton=home.querySelector('#flow-continue');
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
let newPostEntryPromise;
async function loadNewPostEntry(){
  if(window.CosmoComposerView)return window.CosmoComposerView;
  if(!newPostEntryPromise){
    newPostEntryPromise=import('./new-post-runtime.js').then(module=>module.loadNewPostRuntime()).catch(error=>{
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
let beforeAfterPromise;
async function loadBeforeAfterOrReport(){
  if(window.CosmoBeforeAfter)return window.CosmoBeforeAfter;
  if(!beforeAfterPromise){
    beforeAfterPromise=import('./before-after-controller.js').then(()=>{
      if(!window.CosmoBeforeAfter)throw new Error('Before/After runtime did not initialize');
      return window.CosmoBeforeAfter;
    }).catch(error=>{beforeAfterPromise=undefined;throw error});
  }
  try{return await beforeAfterPromise}
  catch(error){console.error('Before/After failed to load',error);await showNewPostLoadError();return null}
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
    const beforeAfter=await loadBeforeAfterOrReport();
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
  try{
    const draft=window.CosmoSofaDraft;
    if(!draft){await commitNewPost(draft);return}
    let state;
    try{state=draft.whenReady?await draft.whenReady():draft.getState?.()}catch{await showDraftLoadError();return}
    if(!state||state.loadStatus!=='ready'){await showDraftLoadError();return}
    if(state.hasDraft&&!(await confirmDraftReplacement()))return;
    await commitNewPost(draft);
  }finally{newPostInFlight=false;button.disabled=false}
}
let resumeInFlight=false;
async function resumeDraft(){
  if(resumeInFlight)return;
  const composerView=await getNewPostEntryOrReport();
  if(!composerView)return;
  const draft=window.CosmoSofaDraft,overlay=window.CosmoDraftLoadingOverlay;
  if(!draft?.load)return;
  resumeInFlight=true;continueButton.disabled=true;overlay?.showLoading?.();
  try{
    let restored;
    try{restored=await draft.load()}catch{overlay?.hide?.();await showDraftLoadError();return}
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
