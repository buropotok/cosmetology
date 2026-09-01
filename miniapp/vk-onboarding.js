(()=>{
const tg=window.Telegram?.WebApp,$=s=>document.querySelector(s);
const screen=$('#vk-group-screen');
if(!screen||!tg)return;
const old=$('#paste-vk-group');
if(!old)return;
const button=old.cloneNode(true);old.replaceWith(button);button.id='choose-vk-group';button.textContent='Выбрать группу';
$('#vk-manual-paste')?.remove();$('#vk-paste-alert')?.remove();
const hero=screen.querySelector('.onboarding-hero p');if(hero)hero.textContent='Выберите сообщество ВКонтакте, которым вы управляете. Список групп откроется автоматически.';
let waiting=false;
function headers(){return{Authorization:`tma ${tg.initData||''}`}}
function notify(message){tg.showAlert?tg.showAlert(message):alert(message)}
async function checkConnected(){
  try{const r=await fetch('/api/miniapp/me',{headers:headers(),cache:'no-store'}),d=await r.json();if(r.ok&&d?.vkGroup?.connected){location.reload();return true}}catch{}return false;
}
button.addEventListener('click',async()=>{
  button.disabled=true;button.textContent='Открываем ВКонтакте…';
  try{
    const r=await fetch('/api/miniapp/vk-onboarding',{method:'POST',headers:headers()}),d=await r.json().catch(()=>null);
    if(!r.ok||!d?.vkUrl)throw new Error(d?.error?.message||'Не удалось открыть выбор группы.');
    waiting=true;tg.HapticFeedback?.selectionChanged();tg.openLink(d.vkUrl,{try_instant_view:false});
  }catch(e){notify(e?.message||'Не удалось открыть выбор группы.');}
  finally{button.disabled=false;button.textContent='Выбрать группу';}
});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&waiting)setTimeout(checkConnected,400)});
window.addEventListener('focus',()=>{if(waiting)setTimeout(checkConnected,400)});
})();
