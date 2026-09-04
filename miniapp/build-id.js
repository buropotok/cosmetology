const BUILD_ID='2026.09.04-01';
window.COSMO_BUILD_ID=BUILD_ID;
function mountBuildId(){
  if(document.querySelector('#cosmo-build-id'))return;
  const el=document.createElement('div');
  el.id='cosmo-build-id';
  el.textContent=`build ${BUILD_ID}`;
  el.style.cssText='padding:18px 12px 10px;text-align:center;font:11px/1.3 system-ui,-apple-system,sans-serif;color:var(--tg-theme-hint-color,#8e8e93);opacity:.75;user-select:text';
  document.body.append(el);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mountBuildId,{once:true});else mountBuildId();
console.log('[COSMO BUILD]',BUILD_ID);
