// @vitest-environment jsdom
import {beforeAll,beforeEach,describe,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../../miniapp/onboarding-flow.js',import.meta.url),'utf8');
const tgAlert=vi.fn(),openTelegramLink=vi.fn(),openSettings=vi.fn();

beforeAll(()=>{
  window.Telegram={WebApp:{showAlert:tgAlert}};
  window.eval(source);
});

beforeEach(()=>{
  document.body.innerHTML='';
  vi.clearAllMocks();
  window.CosmoRouter={openSettings};
  window.CosmoTelegramGateway={create:()=>({openTelegramLink,showAlert:tgAlert})};
  window.CosmoSofaDraft={flush:vi.fn(async()=>true)};
  window.CosmoAccountState={refresh:vi.fn()};
});

function primary(){return document.querySelector('[data-flow-primary]')}
function title(){return document.querySelector('[data-flow-title]')?.textContent}

describe('Telegram capability guards',()=>{
  it('blocks the original guarded action synchronously before async capability checks',()=>{
    expect(source).toContain("event.preventDefault();event.stopImmediatePropagation();guard('telegram_preview')");
    expect(source).toContain("event.preventDefault();event.stopImmediatePropagation();guard('telegram_publish')");
  });

  it('lets Preview continue immediately when the personal chat is active',async()=>{
    window.CosmoAccountState.refresh.mockResolvedValue({managedBot:{username:'personal_chat'},previewReady:true});
    await expect(window.CosmoOnboardingFlow.guard('telegram_preview')).resolves.toBe(true);
    expect(document.querySelector('#cosmo-onboarding-flow-modal')).toBeNull();
  });

  it('flushes the draft before routing missing personal-chat setup to Settings',async()=>{
    let release;window.CosmoAccountState.refresh.mockResolvedValue({managedBot:null,previewReady:false});
    window.CosmoSofaDraft.flush.mockImplementation(()=>new Promise(resolve=>{release=resolve}));
    await expect(window.CosmoOnboardingFlow.guard('telegram_preview')).resolves.toBe(false);
    expect(title()).toBe('Настройте Личный чат');expect(primary()?.textContent).toBe('В настройки');
    primary().click();await Promise.resolve();
    expect(window.CosmoSofaDraft.flush).toHaveBeenCalledWith('telegram-settings');expect(openSettings).not.toHaveBeenCalled();
    release(true);await vi.waitFor(()=>expect(openSettings).toHaveBeenCalledOnce());
  });

  it('flushes the draft before opening an existing personal chat for activation',async()=>{
    let release;window.CosmoAccountState.refresh.mockResolvedValue({managedBot:{username:'personal_chat'},previewReady:false});
    window.CosmoSofaDraft.flush.mockImplementation(()=>new Promise(resolve=>{release=resolve}));
    await expect(window.CosmoOnboardingFlow.guard('telegram_preview')).resolves.toBe(false);
    expect(title()).toBe('Активируйте Личный чат');expect(primary()?.textContent).toBe('Активировать');
    primary().click();await Promise.resolve();
    expect(window.CosmoSofaDraft.flush).toHaveBeenCalledWith('telegram-personal-chat-activation');expect(openTelegramLink).not.toHaveBeenCalled();
    release(true);await vi.waitFor(()=>expect(openTelegramLink).toHaveBeenCalledWith('https://t.me/personal_chat'));
  });

  it('requires only a configured group for Telegram publication',async()=>{
    window.CosmoAccountState.refresh.mockResolvedValue({managedBot:{username:'personal_chat',destination:{connected:true,chatTitle:'Clinic'}},previewReady:false});
    await expect(window.CosmoOnboardingFlow.guard('telegram_publish')).resolves.toBe(true);
    expect(openSettings).not.toHaveBeenCalled();expect(openTelegramLink).not.toHaveBeenCalled();
  });

  it('routes missing group configuration through Settings and flushes first',async()=>{
    window.CosmoAccountState.refresh.mockResolvedValue({managedBot:{username:'personal_chat',destination:{connected:false}},previewReady:true});
    await expect(window.CosmoOnboardingFlow.guard('telegram_publish')).resolves.toBe(false);
    expect(title()).toBe('Выберите группу для публикаций');expect(primary()?.textContent).toBe('В настройки');
    primary().click();await vi.waitFor(()=>expect(openSettings).toHaveBeenCalledOnce());
    expect(window.CosmoSofaDraft.flush).toHaveBeenCalledWith('telegram-settings');
  });

  it('uses one-shot bypasses only after a capability guard succeeds',()=>{
    expect(source).toContain('if(bypassPreview){bypassPreview=false;return}');
    expect(source).toContain('if(bypassPublish){bypassPublish=false;return}');
    expect(source).toContain("if(ready){bypassPreview=true;button.click()}");
    expect(source).toContain("if(ready){bypassPublish=true;event.target.requestSubmit(document.querySelector('#publish'))}");
  });

  it('uses factual AccountState and contains no persisted reconciliation workflow',()=>{
    expect(source).toContain('window.CosmoAccountState');expect(source).toContain('store.refresh()');
    for(const obsolete of ['/api/miniapp/onboarding-intent','/api/miniapp/onboarding-flow',"decision==='continue_bot'","decision==='continue_group'",'visibleFlowDecision','confirmationInFlight','reconciling'])expect(source).not.toContain(obsolete);
  });
});
