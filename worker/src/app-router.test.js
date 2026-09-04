// @vitest-environment jsdom
import {beforeAll,describe,expect,it,vi} from 'vitest';

beforeAll(async()=>{
  document.body.innerHTML='<main><section id="home-screen"></section><section id="ai-screen" hidden></section><section id="composer-screen" hidden></section><section id="settings-screen" hidden><button id="close-settings"></button></section><section id="onboarding-root" hidden></section></main><button id="open-settings"></button>';
  vi.stubGlobal('scrollTo',vi.fn());
  await import('../../miniapp/telegram-gateway.js');
  await import('../../miniapp/app-router.js');
});

describe('AppRouter',()=>{
  it('keeps exactly one registered application screen visible',()=>{
    window.CosmoRouter.show('ai',{notify:false});
    const visible=['home-screen','ai-screen','composer-screen','settings-screen','onboarding-root'].filter(id=>!document.getElementById(id).hidden);
    expect(visible).toEqual(['ai-screen']);expect(window.CosmoRouter.current).toBe('ai');expect(document.body.dataset.cosmoRoute).toBe('ai');
  });

  it('returns Settings to the route that opened it',()=>{
    window.CosmoRouter.show('composer',{notify:false});window.CosmoRouter.openSettings();expect(window.CosmoRouter.current).toBe('settings');window.CosmoRouter.closeSettings();expect(window.CosmoRouter.current).toBe('composer');
  });

  it('delegates onboarding without owning its feature lifecycle',async()=>{
    const handler=vi.fn(async options=>({status:'cancelled',returnTo:options.returnTo}));window.CosmoRouter.show('home',{notify:false});window.CosmoRouter.setOnboardingHandler(handler);
    await expect(window.CosmoRouter.openOnboarding({mode:'edit'})).resolves.toEqual({status:'cancelled',returnTo:'home'});expect(handler).toHaveBeenCalledWith({mode:'edit',returnTo:'home'});
  });
});
