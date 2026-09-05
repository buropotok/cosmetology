import {describe,expect,it} from 'vitest';
import {reconcileIntent} from './services/onboarding-intent';

const intent=(action:'telegram_preview'|'telegram_publish',waiting_for='telegram_bot')=>({user_id:'usr_1',action,draft_ref:null,return_screen:'composer',waiting_for,status:'pending',created_at:'2026-09-05 00:00:00',updated_at:'2026-09-05 00:00:00',expires_at:'2026-09-06 00:00:00'} as any);

describe('onboarding action intent reconciler',()=>{
  it.each([
    ['preview without bot','telegram_preview',{botReady:false,previewReady:false,groupReady:false},'continue_bot','telegram_bot'],
    ['preview bot not activated','telegram_preview',{botReady:true,previewReady:false,groupReady:false},'continue_preview_activation','telegram_preview'],
    ['preview ready','telegram_preview',{botReady:true,previewReady:true,groupReady:false},'resume_preview','confirmation'],
    ['publish without bot','telegram_publish',{botReady:false,previewReady:false,groupReady:false},'continue_bot','telegram_bot'],
    ['publish without group','telegram_publish',{botReady:true,previewReady:false,groupReady:false},'continue_group','telegram_group'],
    ['publish ready','telegram_publish',{botReady:true,previewReady:false,groupReady:true},'show_publish_confirmation','confirmation'],
  ] as const)('%s',(_name,action,capabilities,decision,waitingFor)=>{
    expect(reconcileIntent(intent(action),capabilities)).toMatchObject({decision,waitingFor});
  });

  it('does nothing without a persisted intent',()=>{
    expect(reconcileIntent(null,{botReady:true,previewReady:true,groupReady:true})).toEqual({decision:'idle',reason:'no_pending_intent'});
  });
});
