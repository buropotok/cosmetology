import{getRuntimeDiagnosticSnapshot}from'/runtime-diagnostics.js';

const root=document.querySelector('#diagnostic-trace-panel');
const output=document.querySelector('#diagnostic-trace-output');
const copyButton=document.querySelector('#diagnostic-trace-copy');
if(root&&output&&copyButton){
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
  root.hidden=false;
  render();
}
