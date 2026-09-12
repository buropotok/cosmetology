(()=>{
const $=selector=>document.querySelector(selector),settings=$('#settings-screen'),controller=window.CosmoOnboardingControllerInstance,tg=window.Telegram?.WebApp;
if(!settings||!controller)return;
function addAction(value,id,label){const item=value?.closest('.settings-item'),row=item?.querySelector('.settings-row'),dot=row?.querySelector('.status-dot');let button=$('#'+id);if(row&&!button){button=document.createElement('button');button.id=id;button.className='settings-action-button';button.type='button';button.setAttribute('aria-label',label)}if(row&&button&&dot&&button.nextElementSibling!==dot)row.insertBefore(button,dot);return{item,row,button,dot,status:row?.querySelector('.settings-copy span')}}
const botValue=$('#settings-bot-value'),previewValue=$('#settings-preview-value'),groupValue=$('#settings-tg-group-value'),vkValue=$('#settings-vk-group-value');
const botUi=addAction(botValue,'edit-personal-bot','Настроить Личный чат'),groupUi=addAction(groupValue,'edit-tg-group','Добавить или сменить Telegram-группу'),vkUi=addAction(vkValue,'edit-vk-group','Добавить или сменить группу ВКонтакте');
for(const item of [botUi.item,groupUi.item]){const detail=item?.querySelector('.accordion-panel.static-detail');if(detail){detail.hidden=true;detail.style.display='none'}}
const previewItem=previewValue?.closest('.settings-item');if(previewItem){const divider=previewItem.previousElementSibling;if(divider?.classList.contains('settings-divider'))divider.hidden=true;previewItem.hidden=true}
const readinessGroup=[...settings.querySelectorAll('.settings-group')].find(group=>group.firstElementChild?.tagName==='H2'&&group.firstElementChild.textContent?.trim()==='Состояние');if(readinessGroup)readinessGroup.hidden=true;
const settingsNote=settings.querySelector('.settings-note');if(settingsNote)settingsNote.hidden=true;
const botTitle=botUi.row?.querySelector('.settings-copy strong');if(botTitle)botTitle.textContent='Личный чат';
const groupTitle=groupUi.row?.querySelector('.settings-copy strong');if(groupTitle)groupTitle.textContent='Группа';
function text(selector,value){const element=$(selector);if(element)element.textContent=value}
function setDot(ui,ready){if(!ui.dot)return;ui.dot.hidden=false;ui.dot.className=`status-dot ${ready?'ok':'warning'}`}
function setAction(ui,label,{hidden=false,tone='attention'}={}){if(!ui.button)return;ui.button.hidden=hidden;ui.button.textContent=label;ui.button.className=`settings-action-button ${tone}`;ui.button.removeAttribute('aria-label')}
function render(account){if(!account)return;const bot=account.managedBot,botReady=!!bot,previewReady=!!account.previewReady,groupReady=!!bot?.destination?.connected,vk=account.vkGroup?.connected?account.vkGroup:null,vkUrl=vk?(vk.screenName?`vk.com/${vk.screenName}`:vk.groupUrl||''):'';
  if(!botReady){if(botUi.status)botUi.status.textContent='Не настроен';text('#settings-bot-value','Не настроен');setAction(botUi,'Подключить');setDot(botUi,false)}
  else if(!previewReady){if(botUi.status)botUi.status.textContent='Не активирован';text('#settings-bot-value','Не активирован');setAction(botUi,'Активировать');setDot(botUi,false)}
  else{const name=bot?.displayName||'Cosmo Sofa Личный чат';if(botUi.status)botUi.status.textContent=name;text('#settings-bot-value',`${name}${bot?.username?` · @${bot.username}`:''}`);setAction(botUi,'Сменить',{tone:'neutral'});setDot(botUi,true)}
  if(!botReady){if(groupUi.status)groupUi.status.textContent='Создайте Личный чат';text('#settings-tg-group-value','Создайте Личный чат');setAction(groupUi,'',{hidden:true});setDot(groupUi,false)}
  else if(!groupReady){if(groupUi.status)groupUi.status.textContent='Не выбрана';text('#settings-tg-group-value','Не выбрана');setAction(groupUi,'Выбрать');setDot(groupUi,false)}
  else{const title=bot.destination.chatTitle||'Telegram-группа';if(groupUi.status)groupUi.status.textContent=title;text('#settings-tg-group-value',title);setAction(groupUi,'Сменить',{tone:'neutral'});setDot(groupUi,true)}
  if(!vk){if(vkUi.status)vkUi.status.textContent='Не выбрана';text('#settings-vk-group-value','Не выбрана');setAction(vkUi,'Выбрать');setDot(vkUi,false)}
  else{const title=vk.groupName||vkUrl||'Группа ВКонтакте';if(vkUi.status)vkUi.status.textContent=title;text('#settings-vk-group-value',vk.groupName&&vkUrl?`${vk.groupName} · ${vkUrl}`:title);setAction(vkUi,'Сменить',{tone:'neutral'});setDot(vkUi,true)}
}
controller.subscribe(state=>render(state.account));controller.refresh().catch(()=>{});
let telegramAction=null;
function setTelegramBusy(busy){if(botUi.button)botUi.button.disabled=busy;if(groupUi.button)groupUi.button.disabled=busy}
async function act(action){if(telegramAction)return telegramAction;setTelegramBusy(true);const run=(async()=>{try{await action();await controller.refresh()}catch(error){window.CosmoTelegramGateway.create().showAlert(error instanceof Error?error.message:'Не удалось выполнить действие.')}})();telegramAction=run;try{return await run}finally{if(telegramAction===run){telegramAction=null;setTelegramBusy(false)}}}
botUi.button?.addEventListener('click',()=>{const account=controller.getState().account;if(account?.managedBot&&!account.previewReady)return act(()=>controller.openPreview());return act(()=>controller.prepareManagedBot())});
groupUi.button?.addEventListener('click',()=>act(()=>controller.connectTelegramGroup()));
let vkSelectionPending=false,vkRefreshPromise=null;
function refreshVkReturn(){if(!vkSelectionPending||vkRefreshPromise||document.visibilityState==='hidden')return;vkRefreshPromise=controller.refresh().catch(error=>window.CosmoTelegramGateway.create().showAlert(error instanceof Error?error.message:'Не удалось обновить группу ВКонтакте.')).finally(()=>{vkSelectionPending=false;vkRefreshPromise=null;if(vkUi.button)vkUi.button.disabled=false})}
vkUi.button?.addEventListener('click',async()=>{if(vkSelectionPending)return;vkSelectionPending=true;vkUi.button.disabled=true;try{await controller.connectVk()}catch(error){vkSelectionPending=false;vkUi.button.disabled=false;window.CosmoTelegramGateway.create().showAlert(error instanceof Error?error.message:'Не удалось открыть выбор группы ВКонтакте.')}});
tg?.onEvent?.('activated',refreshVkReturn);document.addEventListener('visibilitychange',refreshVkReturn);window.addEventListener('focus',refreshVkReturn);
})();
