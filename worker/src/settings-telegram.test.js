// @vitest-environment jsdom
import {beforeEach,describe,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root=process.cwd().endsWith('/worker')?resolve(process.cwd(),'..'):process.cwd();
const source=readFileSync(resolve(root,'miniapp','settings.js'),'utf8');
const styles=readFileSync(resolve(root,'miniapp','styles.css'),'utf8');

function markup(){return `<div id="settings-screen">
  <div class="settings-item" data-personal-chat><div class="settings-row"><div class="settings-copy"><strong>Bot</strong><span></span></div><i class="status-dot"></i></div><div class="accordion-panel static-detail"><strong id="settings-bot-value"></strong></div></div>
  <div class="settings-divider"></div>
  <div class="settings-item" data-group><div class="settings-row"><div class="settings-copy"><strong>Group</strong><span id="settings-tg-group-status"></span></div><button id="edit-tg-group" type="button"></button><i id="settings-tg-group-dot" class="status-dot"></i></div><div class="accordion-panel static-detail"><strong id="settings-tg-group-value"></strong></div></div>
  <div class="settings-divider" data-preview-divider></div>
  <div class="settings-item" data-preview><div class="settings-row"><div class="settings-copy"><strong>Preview</strong><span></span></div></div><div class="accordion-panel static-detail"><strong id="settings-preview-value"></strong></div></div>
  <div class="settings-item" data-vk><div class="settings-row"><div class="settings-copy"><strong>VK</strong><span></span></div><i class="status-dot"></i></div><div class="accordion-panel static-detail"><strong id="settings-vk-group-value"></strong></div></div>
</div>`}

function mount(account,{prepareManagedBot=vi.fn(async()=>true),openPreview=vi.fn(),connectTelegramGroup=vi.fn(async()=>true)}={}){
  document.head.innerHTML=`<style>${styles}</style>`;
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
  window.CosmoRouter={openOnboarding:vi.fn()};
  window.eval(source);
  return {controller,prepareManagedBot,openPreview,connectTelegramGroup,setAccount(account){state={...state,account};for(const listener of listeners)listener(state)}};
}

beforeEach(()=>{document.head.innerHTML='';document.body.innerHTML='';vi.clearAllMocks()});

const botButton=()=>document.querySelector('#edit-personal-bot');
const groupButton=()=>document.querySelector('#edit-tg-group');
const botStatus=()=>document.querySelector('[data-personal-chat] .settings-copy span')?.textContent;
const groupStatus=()=>document.querySelector('#settings-tg-group-status')?.textContent;

describe('Telegram Settings capability UI',()=>{
  it('keeps Telegram Settings to two visible capability rows',()=>{
    mount({managedBot:null,previewReady:false,vkGroup:{connected:false}});
    expect(document.querySelector('[data-personal-chat] .accordion-panel')?.hidden).toBe(true);
    expect(document.querySelector('[data-personal-chat] .accordion-panel')?.style.display).toBe('none');
    expect(document.querySelector('[data-group] .accordion-panel')?.hidden).toBe(true);
    expect(document.querySelector('[data-group] .accordion-panel')?.style.display).toBe('none');
    expect(document.querySelector('[data-preview]')?.hidden).toBe(true);
    expect(document.querySelector('[data-preview-divider]')?.hidden).toBe(true);
  });

  it('requires the personal chat before group selection is exposed',()=>{
    mount({managedBot:null,previewReady:false,vkGroup:{connected:false}});
    expect(botStatus()).toBe('Не настроен');expect(botButton()?.textContent).toBe('Подключить');
    expect(groupStatus()).toBe('Создайте Личный чат');expect(groupButton()?.hidden).toBe(true);
    expect(groupButton()?.className).toBe('settings-text-action');expect(getComputedStyle(groupButton()).display).toBe('none');
  });

  it('shows activation separately from creation and allows group selection before activation',()=>{
    mount({managedBot:{id:'bot-1',username:'personal_chat',destination:{connected:false}},previewReady:false,vkGroup:{connected:false}});
    expect(botStatus()).toBe('Не активирован');expect(botButton()?.textContent).toBe('Активировать');
    expect(groupStatus()).toBe('Не выбрана');expect(groupButton()?.hidden).toBe(false);expect(groupButton()?.textContent).toBe('Выбрать');
  });

  it('shows configured names and change actions independently',()=>{
    mount({managedBot:{id:'bot-1',username:'personal_chat',displayName:'Cosmo Sofa Личный чат',destination:{connected:true,chatTitle:'Clinic'}},previewReady:true,vkGroup:{connected:false}});
    expect(botStatus()).toBe('Cosmo Sofa Личный чат');expect(botButton()?.textContent).toBe('Сменить');
    expect(groupStatus()).toBe('Clinic');expect(groupButton()?.textContent).toBe('Сменить');
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

  it('preserves the existing VK edit control outside the Telegram refactor',()=>{
    mount({managedBot:null,previewReady:false,vkGroup:{connected:false}});
    const button=document.querySelector('#edit-vk-group');
    expect(button?.className).toBe('row-edit-button');expect(button?.querySelector('svg')).not.toBeNull();expect(button?.textContent).toBe('');
  });
});
