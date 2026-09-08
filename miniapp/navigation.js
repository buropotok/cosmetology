import {createNavigationStack,NAVIGATION_STATES as STATES} from './navigation-stack.js';

(()=>{
const tg=window.Telegram?.WebApp,router=window.CosmoRouter;
const composer=document.querySelector('#composer-screen');
const text=document.querySelector('#text');
const imageInput=document.querySelector('#image');
if(!composer||!text||!imageInput)return;

const style=document.createElement('style');
style.textContent=`
.cosmo-flow-screen{--c-bg:#f2f2f7;--c-card:#fff;--c-text:#111;--c-muted:#6e6e73;--c-line:#e5e5ea;--c-blue:#2481cc;color:var(--c-text);background:var(--c-bg);margin:-22px -18px -24px;padding:calc(22px + env(safe-area-inset-top)) 16px calc(30px + env(safe-area-inset-bottom));min-height:100vh;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",sans-serif;box-sizing:border-box}.cosmo-flow-screen[hidden]{display:none!important}.cosmo-flow-nav{height:42px;display:flex;align-items:center;justify-content:center;position:relative}.cosmo-flow-nav .cosmo-logo{position:absolute;left:0;width:36px;height:36px;background:url('/assets/icons/cosmo-sofa.svg') center/contain no-repeat}.cosmo-flow-nav .cosmo-settings-button{position:absolute;top:1px;right:0;width:40px;height:40px;margin:0;padding:8px;border:0;border-radius:0;background:transparent url('/assets/icons/settings.svg') center/24px 24px no-repeat;display:grid;place-items:center;appearance:none}.cosmo-flow-nav h1{font-size:17px;font-weight:700;margin:0}.cosmo-flow-back{position:absolute;left:0;border:0;background:transparent;color:var(--c-blue);font:600 15px/1 inherit;padding:8px 4px}.cosmo-home-hero{padding:42px 4px 28px;text-align:center}.cosmo-home-mark{width:76px;height:76px;margin:0 auto 18px;background:url('/assets/icons/cosmo-sofa.svg') center/contain no-repeat}.cosmo-home-hero h2{font-size:28px;margin:0 0 8px}.cosmo-home-hero p{color:var(--c-muted);font-size:15px;line-height:1.45;margin:0}.cosmo-flow-actions{display:grid;gap:11px}.cosmo-primary,.cosmo-secondary{width:100%;border:0;border-radius:12px;padding:15px 16px;font:700 16px/1.2 inherit}.cosmo-primary{background:var(--c-blue);color:#fff}.cosmo-secondary{background:#fff;color:var(--c-blue)}.cosmo-ai-intro{margin:18px 0 12px}.cosmo-ai-intro strong{display:block;font-size:21px;margin-bottom:5px}.cosmo-ai-intro span{color:var(--c-muted);font-size:14px}.cosmo-ai-card{background:#fff;border-radius:15px;padding:14px;margin-bottom:14px}.cosmo-ai-head{display:flex;gap:10px;align-items:center}.cosmo-ai-avatar{width:38px;height:38px;border-radius:50%;background:var(--c-blue);color:#fff;display:grid;place-items:center;font-size:19px}.cosmo-ai-head strong{display:block;font-size:16px}.cosmo-ai-head span{display:block;color:var(--c-muted);font-size:13px}.cosmo-ai-chips{display:flex;gap:8px;overflow-x:auto;margin:14px -2px 12px;padding:2px;scrollbar-width:none}.cosmo-ai-chip{white-space:nowrap;border:0;background:#f2f2f7;border-radius:999px;padding:9px 12px;font:400 13px/1 inherit;color:#444}.cosmo-ai-chip.active{background:var(--c-blue);color:#fff}.cosmo-ai-prompt{display:flex;gap:7px;background:#f2f2f7;border-radius:11px;padding:4px 5px}.cosmo-ai-prompt input{min-width:0;flex:1;border:0;outline:0;padding:8px;background:transparent;font:14px/1.2 inherit}.cosmo-ai-prompt button{width:34px;height:34px;border:0;border-radius:9px;background:var(--c-blue);color:#fff;font-size:16px}.cosmo-ai-prompt button:disabled{opacity:.55}.cosmo-ai-test{display:flex;gap:8px;margin:10px 0 0}.cosmo-ai-test input{min-width:0;flex:1;border:1px solid #c7c7cc;border-radius:10px;background:#fff;padding:11px 12px;font:16px/1.2 sans-serif;color:#111;position:relative;z-index:50;pointer-events:auto;-webkit-user-select:text;user-select:text}.cosmo-ai-test button{border:0;border-radius:10px;background:#111;color:#fff;padding:0 14px;font:600 14px/1 sans-serif;position:relative;z-index:50}.cosmo-ai-test button:disabled{opacity:.55}.cosmo-manual{margin-top:10px}.cosmo-ai-result{background:#fff;border-radius:15px;overflow:hidden;margin:14px 0}.cosmo-ai-image{height:205px;background:#e9edf1}.cosmo-ai-image svg{display:block;width:100%;height:100%}.cosmo-ai-copy{padding:15px}.cosmo-ai-copy h3{font-size:17px;margin:0 0 9px}.cosmo-ai-copy p{font-size:15px;line-height:1.5;margin:0;color:#26282c}.cosmo-ai-note{font-size:12px;color:var(--c-muted);text-align:center;margin:10px 0 0}.cosmo-composer-back{position:absolute!important;left:0!important;width:auto!important;height:36px!important;border:0!important;background:transparent!important;color:var(--c-blue)!important;font:600 15px/1 inherit!important;padding:8px 4px!important;z-index:3}.approved-composer .composer-nav::before{display:none!important}.cosmo-draft-loading{position:absolute;inset:0;z-index:20;display:flex;align-items:center;justify-content:center;gap:10px;background:rgba(255,255,255,.88);border-radius:inherit;font:600 14px/1.2 inherit;color:#555}.cosmo-draft-loading[hidden]{display:none!important}.cosmo-draft-spinner{width:20px;height:20px;border:2px solid #cfd4d8;border-top-color:var(--c-blue);border-radius:50%;animation:cosmo-spin .8s linear infinite}@keyframes cosmo-spin{to{transform:rotate(360deg)}}
`;
document.head.append(style);

const home=document.createElement('section');home.id='home-screen';home.className='cosmo-flow-screen';home.innerHTML=`<header class="cosmo-flow-nav"><span class="cosmo-logo" aria-hidden="true"></span><h1>Cosmo Sofa</h1><button class="cosmo-flow-settings cosmo-settings-button" type="button" aria-label="Настройки"></button></header><div class="cosmo-home-hero"><div class="cosmo-home-mark" aria-hidden="true"></div><h2>Создайте публикацию</h2><p>Подготовьте новый материал или вернитесь к сохранённому черновику.</p></div><div class="cosmo-flow-actions"><button id="flow-new" class="cosmo-primary" type="button">Новый пост</button><button id="flow-continue" class="cosmo-secondary" type="button" hidden>Продолжить работу</button></div>`;
const ai=document.createElement('section');ai.id='ai-screen';ai.className='cosmo-flow-screen';ai.hidden=true;
const mockText='Увлажнение кожи — это не только крем. На уровень влаги влияют состояние защитного барьера, мягкое очищение и правильно подобранный домашний уход. Если кожа регулярно стянута после умывания, стоит обратить внимание не на количество средств, а на их состав и последовательность применения.';
let latestAiText=mockText;
ai.innerHTML=`<header class="cosmo-flow-nav"><button id="flow-ai-back" class="cosmo-flow-back" type="button">‹ Назад</button><h1>Новый пост</h1><button class="cosmo-flow-settings cosmo-settings-button" type="button" aria-label="Настройки"></button></header><div class="cosmo-ai-intro"><strong>Что публикуем сегодня?</strong><span>Выберите тему или напишите свою</span></div><section class="cosmo-ai-card"><div class="cosmo-ai-head"><div class="cosmo-ai-avatar">✦</div><div><strong>Cosmo Sofa AI</strong><span>Подготовит идею, текст и изображение</span></div></div><div class="cosmo-ai-chips"><button class="cosmo-ai-chip active" type="button">✨ Идея дня</button><button class="cosmo-ai-chip" type="button">Новости</button><button class="cosmo-ai-chip" type="button">Мифы</button><button class="cosmo-ai-chip" type="button">Интересные факты</button><button class="cosmo-ai-chip" type="button">Научпоп</button><button class="cosmo-ai-chip" type="button">Разбор препарата</button><button class="cosmo-ai-chip" type="button">Уход</button></div><div class="cosmo-ai-prompt"><input type="text" value="Как правильно поддерживать увлажнение кожи?" aria-label="Тема публикации" enterkeyhint="send" autocomplete="off"><button type="button" aria-label="Отправить запрос">↑</button></div><div class="cosmo-ai-test"><input id="ai-test-input" type="text" placeholder="ТЕСТ: введите сообщение" autocomplete="off"><button id="ai-test-send" type="button">Отправить</button></div><button id="flow-manual" class="cosmo-secondary cosmo-manual" type="button">Ручное создание публикации</button></section><section class="cosmo-ai-result"><div class="cosmo-ai-image"><svg id="mock-ai-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 460"><rect width="800" height="460" fill="#e8f1f6"/><circle cx="400" cy="230" r="90" fill="#c8dce2"/></svg></div><div class="cosmo-ai-copy"><h3>Как поддерживать увлажнение кожи</h3><p>${mockText}</p></div></section><button id="flow-edit" class="cosmo-primary" type="button">Редактировать и опубликовать</button><p class="cosmo-ai-note">Демонстрационный AI-результат</p>`;
document.querySelector('main')?.prepend(ai);document.querySelector('main')?.prepend(home);
const continueButton=home.querySelector('#flow-continue');
function syncDraftState(state=window.CosmoSofaDraft?.getState?.()){
  if(!state){continueButton.hidden=true;return}
  continueButton.hidden=state.loadStatus!=='ready'||!state.hasDraft;
  const loading=document.querySelector('#cosmo-draft-loading');if(loading)loading.hidden=!state.restoring;imageInput.disabled=Boolean(state.restoring)
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
async function resumeDraft(){
  const state=window.CosmoSofaDraft?.getState?.();
  if(state?.loadStatus!=='ready'||!state.hasDraft)return;
  await navigation.reset([STATES.HOME,STATES.MENU]);
}
home.querySelector('#flow-new').addEventListener('click',()=>{void openNewPost()});
continueButton.addEventListener('click',()=>{void resumeDraft()});
ai.querySelector('#flow-ai-back').addEventListener('click',()=>{void navigation.back()});
ai.querySelectorAll('.cosmo-ai-chip').forEach(chip=>chip.addEventListener('click',()=>{ai.querySelectorAll('.cosmo-ai-chip').forEach(x=>x.classList.remove('active'));chip.classList.add('active');tg?.HapticFeedback?.selectionChanged?.()}));
const aiPrompt=ai.querySelector('.cosmo-ai-prompt input');
const aiSend=ai.querySelector('.cosmo-ai-prompt button');
const aiTestInput=ai.querySelector('#ai-test-input');
const aiTestSend=ai.querySelector('#ai-test-send');
const aiTitle=ai.querySelector('.cosmo-ai-copy h3');
const aiCopy=ai.querySelector('.cosmo-ai-copy p');
const aiNote=ai.querySelector('.cosmo-ai-note');
async function sendAiMessage(message=aiPrompt.value.trim(),sendButton=aiSend){
  if(!message){return}
  tg?.HapticFeedback?.impactOccurred?.('light');
  sendButton.disabled=true;
  aiCopy.textContent='Генерирую ответ…';
  aiNote.textContent='Запрос к Cosmo Sofa AI';
  try{
    const response=await fetch('/api/miniapp/ai/chat',{method:'POST',headers:{Authorization:`tma ${tg?.initData||''}`,'content-type':'application/json'},body:JSON.stringify({message})});
    const result=await response.json().catch(()=>null);
    if(!response.ok)throw new Error(result?.error?.message||'Не удалось получить ответ AI.');
    if(typeof result?.text!=='string'||!result.text.trim())throw new Error('AI вернул пустой ответ.');
    latestAiText=result.text.trim();
    aiTitle.textContent=message;
    aiCopy.textContent=latestAiText;
    aiNote.textContent='Ответ Cosmo Sofa AI';
    tg?.HapticFeedback?.notificationOccurred?.('success');
  }catch(error){
    aiCopy.textContent=error instanceof Error?error.message:'Не удалось получить ответ AI.';
    aiNote.textContent='Ошибка AI';
    tg?.HapticFeedback?.notificationOccurred?.('error');
  }finally{sendButton.disabled=false}
}
aiSend.addEventListener('click',()=>{const message=aiPrompt.value.trim();if(!message){aiPrompt.focus();return}void sendAiMessage(message,aiSend)});
aiPrompt.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();aiSend.click()}});
aiTestSend.addEventListener('click',()=>{const message=aiTestInput.value.trim();if(!message){aiTestInput.focus();return}void sendAiMessage(message,aiTestSend)});
aiTestInput.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();aiTestSend.click()}});
ai.querySelector('#flow-manual').addEventListener('click',async()=>{const draft=window.CosmoSofaDraft;if(draft?.clear)await draft.clear();else{draft?.cancelRestore?.();text.value='';if(typeof DataTransfer!=='undefined'){const dt=new DataTransfer();imageInput.files=dt.files;imageInput.dispatchEvent(new Event('change',{bubbles:true}))}}await navigation.reset([STATES.HOME,STATES.MENU,STATES.PUBLISH],{manual:true})});
ai.querySelector('#flow-edit').addEventListener('click',async()=>{text.value=latestAiText;text.dispatchEvent(new Event('input',{bubbles:true}));try{const svg=ai.querySelector('#mock-ai-svg').outerHTML;const file=new File([new Blob([svg],{type:'image/svg+xml'})],'cosmo-sofa-ai.svg',{type:'image/svg+xml'});const dt=new DataTransfer();dt.items.add(file);imageInput.files=dt.files;imageInput.dispatchEvent(new Event('change',{bubbles:true}))}catch(error){console.warn('Mock AI image transfer failed',error)}await navigation.reset([STATES.HOME,STATES.MENU,STATES.PUBLISH],{focus:false})});
router.show('home',{notify:false});
})();