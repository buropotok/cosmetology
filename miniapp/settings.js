(()=>{
const $=selector=>document.querySelector(selector),settings=$('#settings-screen'),controller=window.CosmoOnboardingControllerInstance;
if(!settings||!controller)return;
const editSvg='<svg viewBox="0 0 24 24"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25ZM20.71 7.04a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83Z"/></svg>';
function addAction(value,id,label){const item=value?.closest('.settings-item'),row=item?.querySelector('.settings-row'),dot=row?.querySelector('.status-dot');let button=$('#'+id);if(row&&!button){button=document.createElement('button');button.id=id;button.className='back-button';button.type='button';button.setAttribute('aria-label',label);row.insertBefore(button,dot)}return{item,row,button,dot,status:row?.querySelector('.settings-copy span')}}
function addEdit(value,id,label){const item=value?.closest('.settings-item'),row=item?.querySelector('.settings-row'),dot=row?.querySelector('.status-dot');let button=$('#'+id);if(row&&!button){button=document.createElement('button');button.id=id;button.className='row-edit-button';button.type='button';button.setAttribute('aria-label',label);button.innerHTML=editSvg;row.insertBefore(button,dot)}return{item,row,button,dot,status:row?.querySelector('.settings-copy span')}}
const botValue=$('#settings-bot-value'),previewValue=$('#settings-preview-value'),groupValue=$('#settings-tg-group-value');
const botUi=addAction(botValue,'edit-personal-bot','Настроить Личный чат'),groupUi={item:groupValue?.closest('.settings-item'),row:$('#edit-tg-group')?.closest('.settings-row'),button:$('#edit-tg-group'),dot:$('#settings-tg-group-dot'),status:$('#settings-tg-group-status')},vkUi=addEdit($('#settings-vk-group-value'),'edit-vk-group','Добавить или сменить группу ВКонтакте');
for(const item of [botUi.item,groupUi.item]){const detail=item?.querySelector('.accordion-panel.static-detail');if(detail){detail.hidden=true;detail.style.display='none'}}
const previewItem=previewValue?.closest('.settings-item');if(previewItem){const divider=previewItem.previousElementSibling;if(divider?.classList.contains('settings-divider'))divider.hidden=true;previewItem.hidden=true}
const botTitle=botUi.row?.querySelector('.settings-copy strong');if(botTitle)botTitle.textContent='Личный чат';
const groupTitle=groupUi.row?.querySelector('.settings-copy strong');if(groupTitle)groupTitle.textContent='Группа';
function text(selector,value){const element=$(selector);if(element)element.textContent=value}
function setTelegramDot(ui,ready){if(!ui.dot)return;ui.dot.hidden=!ready;ui.dot.className='status-dot ok'}
function setVkDot(ready){if(!vkUi.dot)return;vkUi.dot.hidden=false;vkUi.dot.className=`status-dot ${ready?'ok':'error'}`}
function setAction(ui,label,{hidden=false}={}){if(!ui.button)return;ui.button.hidden=hidden;ui.button.textContent=label;ui.button.className='back-button';ui.button.removeAttribute('aria-label')}
function render(account){if(!account)return;const bot=account.managedBot,botReady=!!bot,previewReady=!!account.previewReady,groupReady=!!bot?.destination?.connected,vk=account.vkGroup?.connected?account.vkGroup:null,vkUrl=vk?(vk.screenName?`vk.com/${vk.screenName}`:vk.groupUrl||''):'';
  if(!botReady){if(botUi.status)botUi.status.textContent='Не настроен';text('#settings-bot-value','Не настроен');setAction(botUi,'Подключить');setTelegramDot(botUi,false)}
  else if(!previewReady){if(botUi.status)botUi.status.textContent='Не активирован';text('#settings-bot-value','Не активирован');setAction(botUi,'Активировать');setTelegramDot(botUi,false)}
  else{const name=bot?.displayName||'Cosmo Sofa Личный чат';if(botUi.status)botUi.status.textContent=name;text('#settings-bot-value',`${name}${bot?.username?` · @${bot.username}`:''}`);setAction(botUi,'Сменить');setTelegramDot(botUi,true)}
  if(!botReady){if(groupUi.status)groupUi.status.textContent='Создайте Личный чат';text('#settings-tg-group-value','Создайте Личный чат');setAction(groupUi,'',{hidden:true});setTelegramDot(groupUi,false)}
  else if(!groupReady){if(groupUi.status)groupUi.status.textContent='Не выбрана';text('#settings-tg-group-value','Не выбрана');setAction(groupUi,'Выбрать');setTelegramDot(groupUi,false)}
  else{const title=bot.destination.chatTitle||'Telegram-группа';if(groupUi.status)groupUi.status.textContent=title;text('#settings-tg-group-value',title);setAction(groupUi,'Сменить');setTelegramDot(groupUi,true)}
  text('#settings-vk-group-value',vk?(vk.groupName&&vkUrl?`${vk.groupName} · ${vkUrl}`:vk.groupName||vkUrl):'Не подключена');setVkDot(!!vk)
}
controller.subscribe(state=>render(state.account));controller.refresh().catch(()=>{});
let telegramAction=null;
function setTelegramBusy(busy){if(botUi.button)botUi.button.disabled=busy;if(groupUi.button)groupUi.button.disabled=busy}
async function act(action){if(telegramAction)return telegramAction;setTelegramBusy(true);const run=(async()=>{try{await action();await controller.refresh()}catch(error){window.CosmoTelegramGateway.create().showAlert(error instanceof Error?error.message:'Не удалось выполнить действие.')}})();telegramAction=run;try{return await run}finally{if(telegramAction===run){telegramAction=null;setTelegramBusy(false)}}}
botUi.button?.addEventListener('click',()=>{const account=controller.getState().account;if(account?.managedBot&&!account.previewReady)return act(()=>controller.openPreview());return act(()=>controller.prepareManagedBot())});
groupUi.button?.addEventListener('click',()=>act(()=>controller.connectTelegramGroup()));
vkUi.button?.addEventListener('click',()=>window.CosmoRouter.openOnboarding({mode:'edit',initialStep:'vk_group',returnTo:'settings'}));
})();
