const VK_APP_ID=54742219,VK_API_VERSION='5.199';
const $=id=>document.getElementById(id),status=$('status'),groupsEl=$('groups'),diagnostics=$('diagnostics'),logEl=$('diagnostic-log');
function params(){const q=new URLSearchParams(location.hash.replace(/^#/,''));return{token:q.get('connect')||'',callback:q.get('callback')||''}}
function safeError(error){return JSON.stringify(error,(k,v)=>/token/i.test(k)?'***':v,2)}
function log(text){if(logEl)logEl.textContent+=(logEl.textContent?'\n':'')+text;console.log(text)}
function showSuccess(group){
  $('picker-view').hidden=true;$('success-view').hidden=false;
  $('selected-group-name').textContent=group.name||'Группа VK';
  $('selected-group-url').textContent=group.screen_name?`vk.com/${group.screen_name}`:`ID ${group.id}`;
}
async function init(){
  const {token,callback}=params();
  if(!token||!callback){status.textContent='Ссылка подключения недействительна.';return}
  try{
    await vkBridge.send('VKWebAppInit');
    status.textContent='Получаем ваши группы…';
    const auth=await vkBridge.send('VKWebAppGetAuthToken',{app_id:VK_APP_ID,scope:'groups'});
    const result=await vkBridge.send('VKWebAppCallAPIMethod',{method:'groups.get',params:{access_token:auth.access_token,filter:'admin',extended:1,count:100,v:VK_API_VERSION}});
    const items=Array.isArray(result?.response?.items)?result.response.items:[];
    log(`groups.get OK: ${items.length}`);
    if(!items.length){status.textContent='Не найдено групп, которыми вы управляете.';return}
    status.textContent='Нажмите на группу, которую хотите подключить.';
    groupsEl.hidden=false;
    for(const group of items){
      const b=document.createElement('button');b.type='button';b.className='group-button';
      const photo=group.photo_100||group.photo_50||'';
      b.innerHTML=`${photo?`<img src="${photo}" alt="">`:''}<span><strong>${group.name||'Группа VK'}</strong><small>${group.screen_name?`vk.com/${group.screen_name}`:`ID ${group.id}`}</small></span>`;
      b.addEventListener('click',()=>selectGroup(group,token,callback));groupsEl.appendChild(b);
    }
  }catch(error){status.textContent='Не удалось получить список групп.';log('ERROR '+safeError(error));diagnostics.open=true}
}
async function selectGroup(group,token,callback){
  [...groupsEl.querySelectorAll('button')].forEach(b=>b.disabled=true);status.textContent='Сохраняем группу…';
  try{
    const launchUser=new URLSearchParams(location.search).get('vk_user_id')||'';
    const response=await fetch(`${callback.replace(/\/+$/,'')}/api/vk-onboarding/${encodeURIComponent(token)}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({vkUserId:launchUser,groupId:group.id,groupName:group.name||'',screenName:group.screen_name||''})});
    const data=await response.json().catch(()=>null);if(!response.ok)throw new Error(data?.error?.message||`HTTP ${response.status}`);
    showSuccess(group);
    vkBridge.send('VKWebAppTapticNotificationOccurred',{type:'success'}).catch(()=>{});
  }catch(error){status.textContent=error instanceof Error?error.message:'Не удалось сохранить группу.';[...groupsEl.querySelectorAll('button')].forEach(b=>b.disabled=false);log('SAVE ERROR '+safeError(error));diagnostics.open=true}
}
init();
