(()=>{
const STYLE_ID='cosmo-settings-button-style';
const iconUrl='/assets/icons/settings.svg';

if(!document.getElementById(STYLE_ID)){
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent='.cosmo-flow-nav .cosmo-settings-button{position:absolute;top:1px;right:0;width:40px;height:40px;margin:0;padding:8px;border:0;border-radius:0;background:transparent;display:grid;place-items:center;appearance:none}.cosmo-flow-nav .cosmo-settings-button img{display:block;width:24px;height:24px}';
  document.head.append(style);
}

for(const screen of [document.querySelector('#home-screen'),document.querySelector('#ai-screen')]){
  const nav=screen?.querySelector('.cosmo-flow-nav');
  if(!nav)continue;
  let button=nav.querySelector('#open-settings,.cosmo-flow-settings,.cosmo-settings-button');
  if(!button){
    button=document.createElement('button');
    button.type='button';
    button.setAttribute('aria-label','Настройки');
    nav.append(button);
  }
  button.className='cosmo-flow-settings cosmo-settings-button';
  button.replaceChildren(Object.assign(document.createElement('img'),{src:iconUrl,alt:''}));
}
})();
