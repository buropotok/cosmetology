(()=>{
const params=new URLSearchParams(location.search);
if(params.get('embedded')!=='1'||window.parent===window)return;
function close(action){window.parent.postMessage({type:'cosmo-before-after-close',action},location.origin)}
document.addEventListener('click',event=>{
  const button=event.target.closest?.('#back,#finish');
  if(!button||button.disabled)return;
  event.preventDefault();
  event.stopImmediatePropagation();
  close(button.id==='finish'?'save':'back');
},true);
})();