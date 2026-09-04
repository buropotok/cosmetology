(()=>{
const tg=window.Telegram?.WebApp,$=s=>document.querySelector(s),controller=window.CosmoOnboardingControllerInstance;
const screen=$('#vk-group-screen');
if(!screen||!tg)return;
const button=$('#open-vk-onboarding');
if(!button)return;
let waiting=false;
function notify(message){controller.telegram.showAlert(message)}
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
  try{const d=await controller.refresh();return render(d?.vkGroup)}catch{}return false;
}
async function resume(){try{const d=await controller.resume();waiting=false;return render(d?.vkGroup)}catch{return false}}
button.addEventListener('click',async()=>{
  button.disabled=true;button.textContent='Открываем ВКонтакте…';
  try{
    await controller.connectVk();waiting=true;
  }catch(e){notify(e?.message||'Не удалось открыть выбор группы.');}
  finally{button.disabled=false;}
});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&waiting)setTimeout(resume,400)});
window.addEventListener('focus',()=>{if(waiting)setTimeout(resume,400)});
void refresh();
})();
import('/onboarding-ux.js').catch(error=>console.warn('Onboarding UX load failed',error));
