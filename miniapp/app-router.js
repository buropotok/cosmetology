(()=>{
const ROUTES=Object.freeze({HOME:'home',AI:'ai',COMPOSER:'composer',SETTINGS:'settings',ONBOARDING:'onboarding'}),screenIds=Object.freeze({home:'home-screen',ai:'ai-screen',composer:'composer-screen',settings:'settings-screen',onboarding:'onboarding-root'}),listeners=new Set();
const telegram=window.CosmoTelegramGateway.create();let current=null,settingsReturn='home',onboardingHandler=null;
function screen(route){return document.getElementById(screenIds[route])}
function show(route,{notify=true}={}){if(!screenIds[route])throw new RangeError(`Unknown application route: ${route}`);for(const [name,id] of Object.entries(screenIds)){const element=document.getElementById(id);if(element)element.hidden=name!==route}current=route;document.body.dataset.cosmoRoute=route;window.scrollTo({top:0,left:0,behavior:'instant'});if(notify)telegram.notifySelection();for(const listener of listeners)listener(route);return route}
function openSettings(){if(current&&current!=='settings'&&current!=='onboarding')settingsReturn=current;return show('settings')}
function closeSettings(){return show(settingsReturn||'home')}
function setOnboardingHandler(handler){onboardingHandler=handler}
function openOnboarding(options={}){if(!onboardingHandler)throw new Error('Onboarding router unavailable');return onboardingHandler({...options,returnTo:options.returnTo==='settings'?'settings':options.returnTo||current||'home'})}
function subscribe(listener,{immediate=true}={}){if(typeof listener!=='function')return()=>{};listeners.add(listener);if(immediate&&current)listener(current);return()=>listeners.delete(listener)}
document.addEventListener('click',event=>{const target=event.target.closest?.('#open-settings,.cosmo-flow-settings,#close-settings');if(!target)return;if(target.id==='close-settings')closeSettings();else openSettings()});
window.CosmoRouter=Object.freeze({ROUTES,show,openSettings,closeSettings,openOnboarding,setOnboardingHandler,subscribe,get current(){return current},get settingsReturn(){return settingsReturn}});
})();
