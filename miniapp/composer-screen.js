(()=>{
const composer=document.querySelector('#composer-screen');
if(!composer)return;
const style=document.createElement('style');
style.textContent=`
#composer-screen.approved-composer .composer-assistant{display:none!important}
#composer-screen.approved-composer .composer-ai-photo{display:none!important}
#composer-screen.approved-composer .composer-image-actions{grid-template-columns:1fr!important}
.composer-before-after-entry{width:100%;margin-top:16px;padding:13px 16px;border:1px solid #d7d9de;border-radius:12px;background:transparent;color:inherit;font:600 15px system-ui,sans-serif;cursor:pointer}
`;
document.head.append(style);
function addEntry(){if(document.querySelector('.composer-before-after-entry'))return;const bottom=composer.querySelector('.composer-bottom');if(!bottom)return;const button=document.createElement('button');button.type='button';button.className='composer-before-after-entry';button.textContent='До / После';button.addEventListener('click',()=>{location.href='/before-after.html'});bottom.append(button)}
addEntry();new MutationObserver(addEntry).observe(composer,{childList:true,subtree:true});
})();
