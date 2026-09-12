(()=>{
const tg=window.Telegram?.WebApp;
let bypassPreview=false,bypassPublish=false;
function account(){const store=window.CosmoAccountState;if(!store?.refresh)throw new Error('Состояние подключений недоступно.');return store.refresh()}
function ensureModal(){let root=document.querySelector('#cosmo-onboarding-flow-modal');if(root)return root;root=document.createElement('div');root.id='cosmo-onboarding-flow-modal';root.hidden=true;root.innerHTML='<div class="cosmo-flow-modal-card" role="dialog" aria-modal="true"><h2 data-flow-title></h2><p data-flow-message></p><div class="cosmo-flow-modal-actions"><button type="button" data-flow-primary></button><button type="button" data-flow-cancel>Отмена</button></div></div>';document.body.append(root);return root}
function closeModal(){const root=ensureModal();root.hidden=true;const ok=root.querySelector('[data-flow-primary]'),no=root.querySelector('[data-flow-cancel]');if(ok){ok.disabled=false;ok.onclick=null}if(no){no.disabled=false;no.onclick=null}}
function modal({title,message,primary,onPrimary}){const root=ensureModal(),ok=root.querySelector('[data-flow-primary]'),no=root.querySelector('[data-flow-cancel]');root.querySelector('[data-flow-title]').textContent=title;root.querySelector('[data-flow-message]').textContent=message;ok.textContent=primary;ok.disabled=false;no.disabled=false;root.hidden=false;ok.onclick=async()=>{if(ok.disabled)return;ok.disabled=true;no.disabled=true;try{await onPrimary()}catch(error){ok.disabled=false;no.disabled=false;tg?.showAlert?.(error instanceof Error?error.message:'Не удалось выполнить действие.')}};no.onclick=closeModal;return root}
async function flushDraft(reason){const flush=window.CosmoSofaDraft?.flush;if(!flush)return true;const saved=await flush(reason);if(saved===false)throw new Error('Не удалось сохранить черновик. Попробуйте ещё раз.');return true}
async function openSettings(){await flushDraft('telegram-settings');closeModal();window.CosmoRouter?.openSettings?.()}
async function activatePersonalChat(state){const username=state?.managedBot?.username;if(!username)throw new Error('Личный чат ещё не создан.');await flushDraft('telegram-personal-chat-activation');closeModal();window.CosmoTelegramGateway.create().openTelegramLink(`https://t.me/${username}`)}
async function guard(action){const state=await account(),botReady=!!state?.managedBot,previewReady=!!state?.previewReady,groupReady=!!state?.managedBot?.destination?.connected;
  if(action==='telegram_preview'){
    if(previewReady)return true;
    if(!botReady){modal({title:'Настройте Личный чат',message:'Чтобы получать предпросмотр публикаций, сначала настройте Личный чат.',primary:'В настройки',onPrimary:openSettings});return false}
    modal({title:'Активируйте Личный чат',message:'Чтобы получать предпросмотр, откройте Личный чат в Telegram и нажмите «Запустить / Start».',primary:'Активировать',onPrimary:()=>activatePersonalChat(state)});return false
  }
  if(action==='telegram_publish'){
    if(groupReady)return true;
    modal({title:botReady?'Выберите группу для публикаций':'Настройте Telegram',message:botReady?'В настройках выберите Telegram-группу, в которую будут публиковаться ваши посты.':'Сначала создайте Личный чат, затем выберите группу для публикаций.',primary:'В настройки',onPrimary:openSettings});return false
  }
  throw new Error(`Unknown guarded action: ${action}`)
}
document.addEventListener('click',event=>{const button=event.target.closest?.('.composer-telegram-preview');if(!button)return;if(bypassPreview){bypassPreview=false;return}event.preventDefault();event.stopImmediatePropagation();guard('telegram_preview').then(ready=>{if(ready){bypassPreview=true;button.click()}}).catch(error=>tg?.showAlert?.(error instanceof Error?error.message:'Не удалось проверить Личный чат.'))},true);
document.addEventListener('submit',event=>{if(event.target?.id!=='publish-form')return;if(bypassPublish){bypassPublish=false;return}event.preventDefault();event.stopImmediatePropagation();guard('telegram_publish').then(ready=>{if(ready){bypassPublish=true;event.target.requestSubmit(document.querySelector('#publish'))}}).catch(error=>tg?.showAlert?.(error instanceof Error?error.message:'Не удалось проверить Telegram-группу.'))},true);
const style=document.createElement('style');style.textContent=`#cosmo-onboarding-flow-modal{position:fixed;inset:0;z-index:20000;background:rgba(0,0,0,.38);display:grid;place-items:center;padding:20px}#cosmo-onboarding-flow-modal[hidden]{display:none!important}.cosmo-flow-modal-card{width:min(100%,420px);box-sizing:border-box;background:#fff;color:#111;border-radius:16px;padding:20px;box-shadow:0 18px 50px rgba(0,0,0,.22)}.cosmo-flow-modal-card h2{margin:0 0 10px;font-size:20px}.cosmo-flow-modal-card p{margin:0 0 18px;color:#555;line-height:1.45}.cosmo-flow-modal-actions{display:grid;gap:9px}.cosmo-flow-modal-actions button{border:0;border-radius:12px;padding:13px 16px;font:600 15px/1.2 inherit}.cosmo-flow-modal-actions [data-flow-primary]{background:#2481cc;color:#fff}.cosmo-flow-modal-actions [data-flow-cancel]{background:#f2f2f7;color:#2481cc}`;document.head.append(style);
window.CosmoOnboardingFlow=Object.freeze({guard});
})();
