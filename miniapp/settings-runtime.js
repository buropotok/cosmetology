import {loadOnboardingRuntime} from './onboarding-runtime.js';

let runtimePromise;

export async function loadSettingsRuntime(){
  if(runtimePromise)return runtimePromise;
  runtimePromise=(async()=>{
    await loadOnboardingRuntime();
    await import('./settings.js');
    return Object.freeze({ready:true});
  })().catch(error=>{runtimePromise=undefined;throw error});
  return runtimePromise;
}
