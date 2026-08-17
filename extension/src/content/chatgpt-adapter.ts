// Centralize all fragile ChatGPT DOM knowledge here.
const S={messages:'[data-message-author-role="assistant"]',content:'.markdown, [data-message-author-role="assistant"] > div',composer:'#prompt-textarea, textarea[data-id="root"], textarea',send:'button[data-testid="send-button"], button[aria-label*="Send"], button[aria-label*="Отправ"]'};
export class ChatGPTAdapter{
 findMessages(){return [...document.querySelectorAll<HTMLElement>(S.messages)]}
 contentRoot(message:HTMLElement){return message.querySelector<HTMLElement>('.markdown')??message}
 async insert(text:string,submit=false){const el=document.querySelector<HTMLElement>(S.composer);if(!el)throw new Error('Не найден редактор ChatGPT');el.focus();if(el instanceof HTMLTextAreaElement){el.value=text;el.dispatchEvent(new Event('input',{bubbles:true}))}else{el.textContent=text;el.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:text}))}if(submit){await new Promise(r=>setTimeout(r,50));document.querySelector<HTMLButtonElement>(S.send)?.click()}}
 images(message:HTMLElement){return [...this.contentRoot(message).querySelectorAll<HTMLImageElement>('img')].filter(i=>i.naturalWidth>200&&i.naturalHeight>200).map(i=>i.currentSrc||i.src).filter(Boolean)}
 observe(cb:()=>void){let timer=0;const observer=new MutationObserver(()=>{clearTimeout(timer);timer=window.setTimeout(cb,200)});observer.observe(document.querySelector('main')??document.body,{childList:true,subtree:true});return observer}
}
