(()=>{
const tg=window.Telegram?.WebApp,$=s=>document.querySelector(s);
const screen=$('#vk-group-screen');
if(!screen||!tg)return;
const button=$('#open-vk-onboarding');
if(!button)return;
let waiting=false;
function headers(){return{Authorization:`tma ${tg.initData||''}`}}
function notify(message){tg.showAlert?tg.showAlert(message):alert(message)}
function render(v){
  const ready=!!v?.connected;
  const url=ready?(v.screenName?`vk.com/${v.screenName}`:v.groupUrl||''):'';
  const name=ready?(v.groupName||url):'Группа не выбрана';
  const value=$('#vk-group-value'),badge=$('#vk-group-badge');
  if(value)value.textContent=ready&&url&&v.groupName?`${name} · ${url}`:name;
  if(badge){badge.textContent=ready?'Подключена':'Не подключена';badge.className=`state-badge ${ready?'ready':'missing'}`;}
  button.textContent=ready?'Сменить группу':'Открыть VK';
  return ready;
}
async function refresh(){
  try{const r=await fetch('/api/miniapp/me',{headers:headers(),cache:'no-store'}),d=await r.json();if(r.ok)return render(d?.vkGroup)}catch{}return false;
}
button.addEventListener('click',async()=>{
  button.disabled=true;button.textContent='Открываем ВКонтакте…';
  try{
    const r=await fetch('/api/miniapp/vk-onboarding',{method:'POST',headers:headers()}),d=await r.json().catch(()=>null);
    if(!r.ok||!d?.vkUrl)throw new Error(d?.error?.message||'Не удалось открыть выбор группы.');
    waiting=true;tg.HapticFeedback?.selectionChanged();tg.openLink(d.vkUrl,{try_instant_view:false});
  }catch(e){notify(e?.message||'Не удалось открыть выбор группы.');}
  finally{button.disabled=false;await refresh();}
});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&waiting)setTimeout(refresh,400)});
window.addEventListener('focus',()=>{if(waiting)setTimeout(refresh,400)});
void refresh();
})();
import('/onboarding-ux.js').catch(error=>console.warn('Onboarding UX load failed',error));
