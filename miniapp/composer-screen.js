(()=>{
const composer=document.querySelector('#composer-screen');
if(!composer)return;
const style=document.createElement('style');
style.textContent=`
#composer-screen.approved-composer .composer-assistant{display:none!important}
#composer-screen.approved-composer .composer-ai-photo{display:none!important}
#composer-screen.approved-composer .composer-image-actions{grid-template-columns:1fr!important}
`;
document.head.append(style);
})();
