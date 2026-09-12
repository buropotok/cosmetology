// @vitest-environment jsdom
import {beforeEach,describe,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root=process.cwd().endsWith('/worker')?resolve(process.cwd(),'..'):process.cwd();
const source=readFileSync(resolve(root,'miniapp','settings.js'),'utf8');

function markup(){return `<div id="settings-screen">
  <div class="settings-item"><div class="settings-row"><div class="settings-copy"><strong>Bot</strong><span></span></div><span id="settings-bot-value"></span><i class="status-dot"></i></div></div>
  <div class="settings-item"><div class="settings-row"><div class="settings-copy"><strong>Group</strong><span id="settings-tg-group-status"></span></div><span id="settings-tg-group-value"></span><button id="edit-tg-group" type="button"></button><i id="settings-tg-group-dot" class="status-dot"></i></div></div>
</div>`}

function mount(account,{prepareManagedBot=vi.fn(async()=>true),openPreview=vi.fn(),connectTelegramGroup=vi.fn(async()=>true)}={}){
  document.body.innerHTML=markup();
  let state={status:'ready',account};const listeners=new Set();
  const controller={
    subscribe:vi.fn(listener=>{listeners.add(listener);listener(state);return()=>listeners.delete(listener)}),
    refresh:vi.fn(async()=>state.account),
    getState:()=>state,
    prepareManagedBot,openPreview,connectTelegramGroup
  };
  window.CosmoOnboardingControllerInstance=controller;
  window.CosmoTelegramGateway={create:()=>({showAlert:vi.fn()})};
  window.eval(source);
  return {controller,prepareManagedBot,openPreview,connectTelegramGroup,setAccount(account){state={...state,account};for(const listener of listeners)listener(state)}};
}

beforeEach(()=>{document.body.innerHTML='';vi.clearAllMocks()});

const botButton=()=>document.querySelector('#edit-personal-bot');
const groupButton=()=>document.querySelector('#edit-tg-group');
const botValue=()=>document.querySelector('#settings-bot-value')?.textContent;
const groupValue=()=>document.querySelector('#settings-tg-group-value')?.textContent;

describe('Telegram Settings capability UI',()=>{
  it('requires the personal chat before group selection is exposed',()=>{
    mount({managedBot:null,previewReady:false,vkGroup:{connected:false}});
    expect(botValue()).toBe('Не настроен');expect(botButton()?.textContent).toBe('Подключить');
    expect(groupValue()).toBe('Создайте Личный чат');expect(groupButton()?.hidden).toBe(true);
  });

  it('shows activation separately from creation and allows group selection before activation',()=>{
    mount({managedBot:{id:'bot-1',username:'personal_chat',destination:{connected:false}},previewReady:false,vkGroup:{connected:false}});
    expect(botValue()).toBe('Не активирован');expect(botButton()?.textContent).toBe('Активировать');
    expect(groupValue()).toBe('Не выбрана');expect(groupButton()?.hidden).toBe(false);expect(groupButton()?.textContent).toBe('Выбрать');
  });

  it('shows configured names and change actions independently',()=>{
    mount({managedBot:{id:'bot-1',username:'personal_chat',displayName:'Cosmo Sofa Личный чат',destination:{connected:true,chatTitle:'Clinic'}},previewReady:true,vkGroup:{connected:false}});
    expect(botValue()).toContain('Cosmo Sofa Личный чат');expect(botButton()?.textContent).toBe('Сменить');
    expect(groupValue()).toBe('Clinic');expect(groupButton()?.textContent).toBe('Сменить');
  });

  it('opens the existing personal chat for activation instead of creating another one',()=>{
    const {openPreview,prepareManagedBot}=mount({managedBot:{id:'bot-1',username:'personal_chat',destination:{connected:false}},previewReady:false,vkGroup:{connected:false}});
    botButton().click();expect(openPreview).toHaveBeenCalledOnce();expect(prepareManagedBot).not.toHaveBeenCalled();
  });

  it('coalesces double taps so group pairing is created only once',async()=>{
    let release;const connectTelegramGroup=vi.fn(()=>new Promise(resolve=>{release=resolve}));
    const {controller}=mount({managedBot:{id:'bot-1',username:'personal_chat',destination:{connected:false}},previewReady:false,vkGroup:{connected:false}},{connectTelegramGroup});
    controller.refresh.mockClear();
    groupButton().click();groupButton().click();
    expect(connectTelegramGroup).toHaveBeenCalledOnce();expect(groupButton().disabled).toBe(true);expect(botButton().disabled).toBe(true);
    release(true);await vi.waitFor(()=>expect(groupButton().disabled).toBe(false));expect(controller.refresh).toHaveBeenCalledOnce();
  });
});
