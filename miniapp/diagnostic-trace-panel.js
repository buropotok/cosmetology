import{getRuntimeDiagnosticSnapshot}from'/runtime-diagnostics.js';

const composerContent=document.querySelector('#composer-content');
if(composerContent&&!document.querySelector('#diagnostic-trace-panel')){
  if(!document.querySelector('link[data-cosmo-diagnostic-trace]')){
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href='/diagnostic-trace-panel.css';
    link.dataset.cosmoDiagnosticTrace='';
    document.head.append(link);
  }
  const root=document.createElement('section');
  root.id='diagnostic-trace-panel';
  root.className='diagnostic-trace-panel';
  root.setAttribute('aria-label','Диагностика');
  root.innerHTML='<div class="diagnostic-trace-header"><strong>Диагностика</strong><button id="diagnostic-trace-copy" type="button" class="secondary">Copy</button></div><textarea id="diagnostic-trace-output" readonly spellcheck="false" aria-label="Диагностический trace"></textarea>';
  composerContent.append(root);
  const output=root.querySelector('#diagnostic-trace-output');
  const copyButton=root.querySelector('#diagnostic-trace-copy');
  const format=()=>JSON.stringify(getRuntimeDiagnosticSnapshot(),null,2);
  const render=()=>{output.value=format();output.scrollTop=output.scrollHeight};
  const copy=async()=>{
    const text=format();
    try{
      if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(text);
      else{output.value=text;output.focus();output.select();document.execCommand('copy')}
      copyButton.textContent='Copied';
    }catch{
      copyButton.textContent='Copy failed';
    }finally{
      setTimeout(()=>{copyButton.textContent='Copy'},1200);
    }
  };
  window.addEventListener('cosmo-runtime-diagnostic',render);
  copyButton.addEventListener('click',copy);
  render();
}
