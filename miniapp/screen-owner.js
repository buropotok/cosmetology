(()=>{
const style=document.createElement('style');
style.textContent=`
body[data-cosmo-main="home"] #ai-screen,
body[data-cosmo-main="home"] #composer-screen,
body[data-cosmo-main="ai"] #home-screen,
body[data-cosmo-main="ai"] #composer-screen,
body[data-cosmo-main="composer"] #home-screen,
body[data-cosmo-main="composer"] #ai-screen{display:none!important}
`;
document.head.append(style);

function setMain(screen){
 if(!['home','ai','composer'].includes(screen))return;
 document.body.dataset.cosmoMain=screen;
 window.scrollTo({top:0,left:0,behavior:'instant'});
}

setMain('home');
document.addEventListener('click',event=>{
 const target=event.target.closest?.('#flow-new,#flow-continue,#flow-ai-back,#flow-edit,#flow-composer-back');
 if(!target)return;
 if(target.id==='flow-new')setMain('ai');
 else if(target.id==='flow-continue'||target.id==='flow-edit')setMain('composer');
 else if(target.id==='flow-ai-back'||target.id==='flow-composer-back')setMain('home');
},true);

window.CosmoScreenOwner={show:setMain,get current(){return document.body.dataset.cosmoMain||'home'}};
})();