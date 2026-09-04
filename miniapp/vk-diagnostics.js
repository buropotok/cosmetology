(()=>{
  const logs=[];
  function render(){
    const area=document.querySelector('#vk-diagnostics-log');
    if(area)area.value=logs.map(x=>JSON.stringify(x)).join('\n');
  }
  function log(kind,data={}){
    logs.push({time:new Date().toISOString(),kind,...data});
    if(logs.length>300)logs.shift();
    render();
  }
  function mount(){
    if(document.querySelector('#vk-diagnostics'))return;
    const box=document.createElement('section');
    box.id='vk-diagnostics';
    box.style.cssText='margin:28px 16px max(24px,env(safe-area-inset-bottom));padding:14px;border:1px solid #bbb;border-radius:14px;background:rgba(128,128,128,.08);font:12px monospace';
    box.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><b style="font:600 14px system-ui">VK диагностика</b><button id="vk-diagnostics-copy" type="button">Copy</button></div><textarea id="vk-diagnostics-log" readonly style="box-sizing:border-box;width:100%;height:260px;resize:vertical;padding:8px;border:1px solid #bbb;border-radius:8px;background:transparent;color:inherit;font:11px/1.45 monospace"></textarea>';
    document.body.append(box);
    box.querySelector('#vk-diagnostics-copy').onclick=async e=>{
      const value=logs.map(x=>JSON.stringify(x)).join('\n');
      try{await navigator.clipboard.writeText(value);e.currentTarget.textContent='Copied';setTimeout(()=>e.currentTarget.textContent='Copy',1200)}catch{const a=box.querySelector('textarea');a.focus();a.select();document.execCommand('copy')}
    };
    log('vk-diagnostics-ready',{build:window.COSMO_BUILD_ID||null,path:location.pathname});
  }
  window.CosmoVkDiagnostics={log};
  document.addEventListener('click',event=>{
    if(event.target.closest?.('#publish-vk'))log('vk-button-click',{build:window.COSMO_BUILD_ID||null});
  },true);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
