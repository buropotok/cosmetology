import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../../miniapp/onboarding-flow.js',import.meta.url),'utf8');

describe('Telegram capability guards',()=>{
  it('blocks the original guarded action synchronously before async capability checks',()=>{
    expect(source).toContain("event.preventDefault();event.stopImmediatePropagation();guard('telegram_preview')");
    expect(source).toContain("event.preventDefault();event.stopImmediatePropagation();guard('telegram_publish')");
  });

  it('uses one-shot bypasses only after a capability guard succeeds',()=>{
    expect(source).toContain('if(bypassPreview){bypassPreview=false;return}');
    expect(source).toContain('if(bypassPublish){bypassPublish=false;return}');
    expect(source).toContain("if(ready){bypassPreview=true;button.click()}");
    expect(source).toContain("if(ready){bypassPublish=true;event.target.requestSubmit(document.querySelector('#publish'))}");
  });

  it('routes missing personal chat setup to Settings',()=>{
    expect(source).toContain("title:'Настройте Личный чат'");
    expect(source).toContain("primary:'В настройки',onPrimary:openSettings");
  });

  it('activates an existing personal chat directly from the Preview guard',()=>{
    expect(source).toContain("title:'Активируйте Личный чат'");
    expect(source).toContain("primary:'Активировать',onPrimary:()=>activatePersonalChat(state)");
    expect(source).toContain("window.CosmoTelegramGateway.create().openTelegramLink(`https://t.me/${username}`)");
  });

  it('requires only the configured group for Telegram publication',()=>{
    expect(source).toContain("groupReady=!!state?.managedBot?.destination?.connected");
    expect(source).toContain("if(action==='telegram_publish')");
    expect(source).toContain('if(groupReady)return true');
    expect(source).toContain("title:botReady?'Выберите группу для публикаций':'Настройте Telegram'");
    expect(source).not.toMatch(/telegram_publish[^}]*previewReady/s);
  });

  it('uses factual AccountState and contains no persisted reconciliation workflow',()=>{
    expect(source).toContain('window.CosmoAccountState');
    expect(source).toContain('store.refresh()');
    for(const obsolete of [
      '/api/miniapp/onboarding-intent',
      '/api/miniapp/onboarding-flow',
      "decision==='continue_bot'",
      "decision==='continue_group'",
      'visibleFlowDecision',
      'confirmationInFlight',
      'reconciling'
    ]) expect(source).not.toContain(obsolete);
  });

  it('fully resets the reusable guard modal between actions',()=>{
    expect(source).toContain('function closeModal()');
    expect(source).toContain('ok.disabled=false;ok.onclick=null');
    expect(source).toContain('no.disabled=false;no.onclick=null');
    expect(source).toContain('ok.textContent=primary;ok.disabled=false;no.disabled=false;root.hidden=false');
  });
});
