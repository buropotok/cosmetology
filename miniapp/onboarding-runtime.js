let runtimePromise;

export async function loadOnboardingRuntime(){
  if(window.CosmoOnboardingRouter)return window.CosmoOnboardingRouter;
  if(!runtimePromise){
    runtimePromise=(async()=>{
      await import('./account-state.js');
      await import('./onboarding-api.js');
      await import('./onboarding-controller.js');
      await import('./onboarding-view.js');
      await import('./onboarding-router.js');
      if(!window.CosmoOnboardingRouter)throw new Error('Onboarding runtime did not initialize');
      return window.CosmoOnboardingRouter;
    })().catch(error=>{runtimePromise=undefined;throw error});
  }
  return runtimePromise;
}
