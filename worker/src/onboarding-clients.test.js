// @vitest-environment jsdom
import {beforeAll,describe,expect,it,vi} from 'vitest';

beforeAll(async()=>{
  await import('../../miniapp/onboarding-api.js');
  await import('../../miniapp/telegram-gateway.js');
  await import('../../miniapp/onboarding-controller.js');
});

describe('OnboardingController',()=>{
  it('owns managed bot orchestration and refreshes after Telegram accepts',async()=>{
    vi.useFakeTimers();
    const account={managedBot:null,vkGroup:{connected:false},onboardingSkips:[]};
    const api={accountState:null,getAccountState:vi.fn(async()=>account),prepareManagedBot:vi.fn(async()=>({requestId:42}))};
    const telegram={requestManagedBot:vi.fn(async()=>true)};
    const controller=window.CosmoOnboardingController.create({api,telegram});
    await expect(controller.prepareManagedBot()).resolves.toBe(true);expect(api.prepareManagedBot).toHaveBeenCalledOnce();expect(telegram.requestManagedBot).toHaveBeenCalledWith(42);
    await vi.runAllTimersAsync();expect(api.getAccountState).toHaveBeenCalledOnce();expect(controller.getState().status).toBe('ready');vi.useRealTimers();
  });

  it('derives an explicit onboarding result from account state',async()=>{
    const account={managedBot:{id:'1',username:'bot',destination:{connected:true}},previewReady:false,vkGroup:{connected:true},onboardingSkips:['telegram_preview']};
    const controller=window.CosmoOnboardingController.create({api:{accountState:null,getAccountState:vi.fn(async()=>account)},telegram:{}});await controller.refresh();
    expect(controller.result()).toEqual({status:'completed',completedSteps:['telegram_bot','telegram_group','vk_group'],skippedSteps:['telegram_preview'],accountState:account});
  });

  it('keeps external return state until resume refreshes the account',async()=>{
    const api={accountState:null,getAccountState:vi.fn(async()=>({vkGroup:{connected:true}})),createVkHandoff:vi.fn(async()=>({vkUrl:'https://vk.com/app'}))};
    const telegram={notifySelection:vi.fn(),openExternalLink:vi.fn()};const controller=window.CosmoOnboardingController.create({api,telegram});
    await controller.connectVk();expect(controller.getState().status).toBe('waiting_external_return');await controller.resume();expect(controller.getState().status).toBe('ready');expect(api.getAccountState).toHaveBeenCalledOnce();
  });

  it('persists skipped steps before refreshing state',async()=>{
    const account={onboardingSkips:['vk_group']};const api={accountState:null,skipStep:vi.fn(async()=>({ok:true})),getAccountState:vi.fn(async()=>account)};
    const controller=window.CosmoOnboardingController.create({api,telegram:{}});await controller.skip('vk_group');
    expect(api.skipStep).toHaveBeenCalledWith('vk_group');expect(controller.getState()).toMatchObject({status:'ready',account});
  });
});

describe('OnboardingApi',()=>{
  it('uses TMA auth and maps the managed bot group contract',async()=>{
    const fetchImpl=vi.fn(async()=>new Response(JSON.stringify({url:'https://t.me/test'}),{status:201,headers:{'content-type':'application/json'}}));
    const api=window.CosmoOnboardingApi.create({fetchImpl,getInitData:()=> 'signed-init-data',accountState:null});
    await expect(api.createTelegramGroupLink('bot-1')).resolves.toEqual({url:'https://t.me/test'});
    expect(fetchImpl).toHaveBeenCalledWith('/api/miniapp/telegram/managed-bot/group-link',expect.objectContaining({method:'POST',headers:{Authorization:'tma signed-init-data','Content-Type':'application/json'},body:'{"managedBotId":"bot-1"}'}));
  });

  it('normalizes backend errors',async()=>{
    const fetchImpl=vi.fn(async()=>new Response(JSON.stringify({error:{code:'HANDOFF_EXPIRED',message:'Ссылка истекла'}}),{status:410,headers:{'content-type':'application/json'}}));
    const api=window.CosmoOnboardingApi.create({fetchImpl,getInitData:()=> 'init',accountState:null});
    await expect(api.createVkHandoff()).rejects.toMatchObject({name:'OnboardingApiError',code:'HANDOFF_EXPIRED',status:410,message:'Ссылка истекла'});
  });
});

describe('TelegramGateway',()=>{
  it('wraps Telegram navigation and haptics',()=>{
    const webApp={openLink:vi.fn(),openTelegramLink:vi.fn(),HapticFeedback:{selectionChanged:vi.fn()}};
    const gateway=window.CosmoTelegramGateway.create({webApp,locationImpl:{assign:vi.fn()},alertImpl:vi.fn()});
    gateway.openExternalLink('https://vk.com/app');gateway.openTelegramLink('https://t.me/bot');gateway.notifySelection();
    expect(webApp.openLink).toHaveBeenCalledWith('https://vk.com/app',{try_instant_view:false});expect(webApp.openTelegramLink).toHaveBeenCalledWith('https://t.me/bot');expect(webApp.HapticFeedback.selectionChanged).toHaveBeenCalledOnce();
  });
});
