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

  it('disables the confirmation primary action while its continuation is running',()=>{
    expect(source).toContain('if(ok.disabled)return;ok.disabled=true');
    expect(source).toContain('finally{ok.disabled=false}');
  });

  it('renders a reconciliation decision modal only once while it is already visible',()=>{
    expect(source).toContain('visibleFlowDecision=null');
    expect(source).toContain('if(decision&&visibleFlowDecision===decision&&!root.hidden)return root');
    expect(source).toContain("if(visibleFlowDecision==='show_publish_confirmation'&&!root.hidden)return root");
    expect(source).toContain("decision:'show_publish_confirmation'");
  });
});
