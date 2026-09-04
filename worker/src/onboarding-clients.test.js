// @vitest-environment jsdom
import {beforeAll,describe,expect,it,vi} from 'vitest';

beforeAll(async()=>{
  await import('../../miniapp/onboarding-api.js');
  await import('../../miniapp/telegram-gateway.js');
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
