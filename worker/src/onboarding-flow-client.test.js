import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../../miniapp/onboarding-flow.js',import.meta.url),'utf8');

describe('Onboarding flow client continuation',()=>{
  it('blocks the original guarded action synchronously before async capability checks',()=>{
    expect(source).toContain("event.preventDefault();event.stopImmediatePropagation();guard('telegram_preview')");
    expect(source).toContain("event.preventDefault();event.stopImmediatePropagation();guard('telegram_publish')");
  });

  it('uses one-shot bypasses for resumed preview and publish',()=>{
    expect(source).toContain('if(bypassPreview){bypassPreview=false;return}');
    expect(source).toContain('if(bypassPublish){bypassPublish=false;return}');
    expect(source).toContain('bypassPublish=true;form.requestSubmit?.(submitter)');
  });

  it('does not reopen a bot or group step while an onboarding run is active',()=>{
    expect(source).toContain("if(decision==='continue_bot'){if(window.CosmoOnboardingRouter?.active)return;");
    expect(source).toContain("if(decision==='continue_group'){if(!window.CosmoOnboardingRouter?.active)await openStep('telegram_group');");
  });

  it('renders a reconciliation decision modal only once while it is already visible',()=>{
    expect(source).toContain('if(decision&&visibleFlowDecision===decision&&!root.hidden)return root');
    expect(source).toContain("if(visibleFlowDecision==='show_publish_confirmation'&&!root.hidden)return root");
    expect(source).toContain("decision:'show_publish_confirmation'");
  });

  it('fully resets the reusable modal between publish cycles',()=>{
    expect(source).toContain('function resetModal()');
    expect(source).toContain('ok.disabled=false;ok.onclick=null');
    expect(source).toContain('no.disabled=false;no.onclick=null');
    expect(source).toContain('ok.textContent=primary;ok.disabled=false;no.disabled=false;root.hidden=false');
  });

  it('suppresses reconciliation while publish confirmation is being completed',()=>{
    expect(source).toContain('confirmationInFlight=true;resetModal()');
    expect(source).toContain('if(confirmationInFlight)return;');
    expect(source).toContain('if(reconciling||confirmationInFlight||!tg?.initData)return');
    expect(source).toContain('finally{confirmationInFlight=false}');
  });
});
