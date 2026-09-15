const REDUCED_MOTION_QUERY='(prefers-reduced-motion: reduce)';
const TRANSITION_PROPERTY='transform';
const FALLBACK_MS=160;

export function runAfterBackButtonPress(button,action){
  if(!button||typeof action!=='function')return false;
  if(button.dataset.backButtonActivation==='pending')return false;
  if(window.matchMedia?.(REDUCED_MOTION_QUERY).matches){action();return true}
  button.dataset.backButtonActivation='pending';
  let settled=false,fallbackTimer;
  const finish=event=>{
    if(settled)return;
    if(event&&(event.target!==button||event.propertyName!==TRANSITION_PROPERTY))return;
    settled=true;
    button.removeEventListener('transitionend',finish);
    clearTimeout(fallbackTimer);
    button.classList.remove('back-button-activating');
    delete button.dataset.backButtonActivation;
    action();
  };
  button.addEventListener('transitionend',finish);
  button.classList.add('back-button-activating');
  fallbackTimer=setTimeout(()=>finish(),FALLBACK_MS);
  return true;
}
