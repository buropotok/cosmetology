(()=>{
const tg=window.Telegram?.WebApp,$=s=>document.querySelector(s),telegram=window.CosmoTelegramGateway.create({webApp:tg}),api=window.CosmoOnboardingApi.create({getInitData:()=>telegram.getInitData()});
const screen=$('#vk-group-screen');
if(!screen||!tg)return;
const button=$('#open-vk-onboarding');
if(!button)return;
let waiting=false;
function notify(message){telegram.showAlert(message)}
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
  try{const d=await api.getAccountState();return render(d?.vkGroup)}catch{}return false;
}
button.addEventListener('click',async()=>{
  button.disabled=true;button.textContent='Открываем ВКонтакте…';
  try{
    const d=await api.createVkHandoff();if(!d?.vkUrl)throw new Error('Не удалось открыть выбор группы.');
    waiting=true;telegram.notifySelection();telegram.openExternalLink(d.vkUrl);
  }catch(e){notify(e?.message||'Не удалось открыть выбор группы.');}
  finally{button.disabled=false;await refresh();}
});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&waiting)setTimeout(refresh,400)});
window.addEventListener('focus',()=>{if(waiting)setTimeout(refresh,400)});
void refresh();
})();
import('/onboarding-ux.js').catch(error=>console.warn('Onboarding UX load failed',error));
