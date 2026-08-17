const BLOCK=new Set(['P','DIV','H1','H2','H3','H4','H5','H6','PRE','BLOCKQUOTE']);
export function normalizeText(text:string){return text.replace(/\u00a0/g,' ').replace(/[ \t]+\n/g,'\n').replace(/\n[ \t]+/g,'\n').replace(/\n{3,}/g,'\n\n').trim()}
export function parseResponse(root:Element){
 const clone=root.cloneNode(true) as Element;clone.querySelectorAll('button,svg,script,style,[data-social-publisher],[aria-hidden="true"],sup a').forEach(x=>x.remove());
 const walk=(node:Node):string=>{if(node.nodeType===Node.TEXT_NODE)return node.textContent??'';if(!(node instanceof Element))return '';const tag=node.tagName;if(tag==='BR')return '\n';let value=[...node.childNodes].map(walk).join('');if(tag==='LI'){const parent=node.parentElement;const n=parent?.tagName==='OL'?[...parent.children].indexOf(node)+1:null;value=`${n?`${n}.`:'•'} ${value.trim()}\n`}else if(BLOCK.has(tag))value=`${value.trim()}\n\n`;else if(tag==='A'&&node.getAttribute('href')&&!value.trim())value=node.getAttribute('href')!;return value};
 return normalizeText(walk(clone));
}
export function hasFiveChoices(text:string){return [1,2,3,4,5].every(n=>new RegExp(`(?:^|\\n)\\s*${n}[.)]\\s+\\S`,'m').test(text))}
