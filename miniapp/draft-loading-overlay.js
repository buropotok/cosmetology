(()=>{
if(window.CosmoDraftLoadingOverlay)return;

const tg=window.Telegram?.WebApp;
const style=document.createElement('style');
style.textContent=`
.cosmo-draft-load-overlay{position:fixed;inset:0;z-index:20000;display:grid;place-items:center;padding:24px;background:rgba(17,17,17,.32);box-sizing:border-box}.cosmo-draft-load-overlay[hidden]{display:none!important}.cosmo-draft-load-card{width:min(100%,360px);box-sizing:border-box;background:var(--tg-theme-bg-color,#fff);color:var(--tg-theme-text-color,#111);border-radius:18px;padding:24px 20px;text-align:center;box-shadow:0 18px 60px rgba(0,0,0,.22);font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",sans-serif}.cosmo-draft-load-spinner{width:32px;height:32px;margin:0 auto 16px;border:3px solid rgba(128,128,128,.28);border-top-color:var(--tg-theme-button-color,#2481cc);border-radius:50%;animation:cosmo-draft-load-spin .8s linear infinite}.cosmo-draft-load-title{margin:0;font-size:17px;line-height:1.35;font-weight:700}.cosmo-draft-load-actions{display:grid;gap:10px;margin-top:20px}.cosmo-draft-load-action{width:100%;border:0;border-radius:12px;padding:13px 16px;font:700 16px/1.2 inherit}.cosmo-draft-load-retry{background:var(--tg-theme-button-color,#2481cc);color:var(--tg-theme-button-text-color,#fff)}.cosmo-draft-load-skip{background:rgba(128,128,128,.12);color:var(--tg-theme-text-color,#111)}@keyframes cosmo-draft-load-spin{to{transform:rotate(360deg)}}
`;
document.head.append(style);

document.querySelector('#flow-continue')?.replaceChildren('Продолжить работу с черновика');

const overlay=document.createElement('div');
overlay.className='cosmo-draft-load-overlay';
overlay.setAttribute('role','dialog');
overlay.setAttribute('aria-modal','true');
overlay.setAttribute('aria-live','polite');
overlay.innerHTML='<div class="cosmo-draft-load-card"><div class="cosmo-draft-load-spinner" aria-hidden="true"></div><p class="cosmo-draft-load-title">Запрос ваших черновиков</p><div class="cosmo-draft-load-actions" hidden><button type="button" class="cosmo-draft-load-action cosmo-draft-load-retry">Ещё раз</button><button type="button" class="cosmo-draft-load-action cosmo-draft-load-skip">Пропустить</button></div></div>';
document.body.append(overlay);

const spinner=overlay.querySelector('.cosmo-draft-load-spinner');
const title=overlay.querySelector('.cosmo-draft-load-title');
const actions=overlay.querySelector('.cosmo-draft-load-actions');
const retry=overlay.querySelector('.cosmo-draft-load-retry');
const skip=overlay.querySelector('.cosmo-draft-load-skip');
let dismissed=false;

function setHomeControlsVisible(visible){
  const settings=document.querySelector('#home-screen #open-settings');
  if(settings)settings.hidden=!visible;
}
function showLoading(){
  dismissed=false;
  overlay.hidden=false;
  setHomeControlsVisible(false);
  spinner.hidden=false;
  actions.hidden=true;
  title.textContent='Запрос ваших черновиков';
}
function showError(){
  if(dismissed)return;
  overlay.hidden=false;
  setHomeControlsVisible(false);
  spinner.hidden=true;
  actions.hidden=false;
  title.textContent='Ошибка загрузки черновиков';
  retry.focus({preventScroll:true});
}
function hide(){
  overlay.hidden=true;
  setHomeControlsVisible(true);
}
function sync(state){
  if(!state||dismissed)return;
  if(state.loadStatus==='error')return showError();
  if(state.loadStatus==='ready')return hide();
  if(state.loadStatus==='loading')showLoading();
}

retry.addEventListener('click',()=>{
  const draft=window.CosmoSofaDraft;
  if(!draft?.load)return;
  showLoading();
  void draft.load().catch(()=>{});
});
skip.addEventListener('click',()=>{
  dismissed=true;
  hide();
});
window.addEventListener('cosmo-draft-state',event=>sync(event.detail));

if(!tg?.initData)hide();
else showLoading();

window.CosmoDraftLoadingOverlay=Object.freeze({sync,hide});
})();
