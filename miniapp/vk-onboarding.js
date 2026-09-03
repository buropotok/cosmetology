(()=>{
const tg=window.Telegram?.WebApp,$=s=>document.querySelector(s);
const screen=$('#vk-group-screen');
if(!screen||!tg)return;
const old=$('#paste-vk-group')||$('#choose-vk-group');
if(!old)return;
const button=old.cloneNode(true);old.replaceWith(button);button.id='choose-vk-group';button.textContent='Выбрать группу';
$('#vk-manual-paste')?.remove();$('#vk-paste-alert')?.remove();
const hero=screen.querySelector('.onboarding-hero p');if(hero)hero.textContent='Выберите сообщество ВКонтакте, которым вы управляете. Список групп откроется автоматически.';
let waiting=false;
function headers(){return{Authorization:`tma ${tg.initData||''}`}}
function notify(message){tg.showAlert?tg.showAlert(message):alert(message)}
function renderVk(v){
  const connected=!!v?.connected;
  const url=connected?(v.screenName?`vk.com/${v.screenName}`:v.groupUrl||''):'';
  const name=connected?(v.groupName||url):'Группа не выбрана';
  const current=$('#vk-current-group'),currentUrl=$('#vk-current-url'),badge=$('#vk-current-badge');
  if(current)current.textContent=name;
  if(currentUrl)currentUrl.textContent=connected&&v.groupName?url:'';
  if(badge){badge.textContent=connected?'Подключена':'Не подключена';badge.className=`state-badge ${connected?'ready':'missing'}`;}
  button.textContent=connected?'Сменить группу':'Выбрать группу';
  return connected;
}
async function refreshVk(){
  try{
    const r=await fetch('/api/miniapp/me',{headers:headers(),cache:'no-store'}),d=await r.json();
    if(r.ok)return renderVk(d?.vkGroup);
  }catch{}
  return false;
}
async function checkConnected(){
  const connected=await refreshVk();
  if(connected&&waiting){waiting=false;tg.HapticFeedback?.notificationOccurred('success');}
  return connected;
}
button.addEventListener('click',async()=>{
  button.disabled=true;const previous=button.textContent;button.textContent='Открываем ВКонтакте…';
  try{
    const r=await fetch('/api/miniapp/vk-onboarding',{method:'POST',headers:headers()}),d=await r.json().catch(()=>null);
    if(!r.ok||!d?.vkUrl)throw new Error(d?.error?.message||'Не удалось открыть выбор группы.');
    waiting=true;tg.HapticFeedback?.selectionChanged();tg.openLink(d.vkUrl,{try_instant_view:false});
  }catch(e){notify(e?.message||'Не удалось открыть выбор группы.');}
  finally{button.disabled=false;button.textContent=previous;void refreshVk();}
});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(checkConnected,400)});
window.addEventListener('focus',()=>setTimeout(checkConnected,400));
void refreshVk();
})();
