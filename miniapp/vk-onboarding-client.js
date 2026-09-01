(()=>{
const tg=window.Telegram?.WebApp;
const $=s=>document.querySelector(s);
function authHeaders(){return{Authorization:`tma ${tg?.initData||''}`}}
function alertUser(message){tg?.showAlert?tg.showAlert(message):alert(message)}
function prepareVkScreen(){
  const screen=$('#vk-group-screen');if(!screen)return;
  const primary=$('#paste-vk-group');if(primary){primary.textContent='Выбрать группу';primary.dataset.vkNativePicker='1'}
  const manual=$('#vk-manual-paste'),warning=$('#vk-paste-alert');if(manual)manual.hidden=true;if(warning)warning.hidden=true;
  const hero=screen.querySelector('.onboarding-hero p');if(hero)hero.textContent='Выберите сообщество ВКонтакте, которым вы управляете.';
}
async function openVkPicker(button){
  if(!tg?.initData){alertUser('Откройте Cosmo Sofa внутри Telegram.');return}
  button.disabled=true;const old=button.textContent;button.textContent='Открываем VK…';
  try{
    const response=await fetch('/api/miniapp/vk-onboarding',{method:'POST',headers:{...authHeaders(),'Content-Type':'application/json'},body:'{}'});
    const data=await response.json().catch(()=>null);if(!response.ok||!data?.vkUrl)throw new Error(data?.error?.message||'Не удалось открыть выбор группы.');
    tg?.HapticFeedback?.selectionChanged?.();
    if(tg?.openLink)tg.openLink(data.vkUrl,{try_instant_view:false});else location.href=data.vkUrl;
  }catch(error){alertUser(error instanceof Error?error.message:'Не удалось открыть выбор группы.')}finally{button.disabled=false;button.textContent=old}
}
function showVkScreen(){
  prepareVkScreen();const screen=$('#vk-group-screen'),settings=$('#settings-screen'),composer=$('#composer-screen');if(!screen)return;
  document.querySelectorAll('.onboarding-step-screen').forEach(item=>item.hidden=item!==screen);if(settings)settings.hidden=true;if(composer)composer.hidden=true;screen.hidden=false;scrollTo(0,0);
}
// Capture the edit action before the legacy settings handler. Existing and new accounts use the same picker.
document.addEventListener('click',event=>{
  const edit=event.target.closest?.('#edit-vk-group');if(edit){event.preventDefault();event.stopImmediatePropagation();showVkScreen();return}
  const primary=event.target.closest?.('#paste-vk-group');if(primary){event.preventDefault();event.stopImmediatePropagation();openVkPicker(primary)}
},true);
window.addEventListener('focus',()=>{setTimeout(()=>{fetch('/api/miniapp/me',{headers:authHeaders(),cache:'no-store'}).catch(()=>{})},250)});
prepareVkScreen();
})();
