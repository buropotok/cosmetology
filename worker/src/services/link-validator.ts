import type {PostBlock,PostDocument,PostListItem,PostNestedList,TextRun} from '../../../shared/post-document';
import {safeLink} from '../../../shared/post-document';

const PLACEHOLDER_DOMAINS=['example.com','example.org','example.net','localhost'];
const PRIVATE_HOST=/^(?:127(?:\.\d{1,3}){3}|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|169\.254(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}|0\.0\.0\.0|\[?::1\]?)$/i;

function isPlaceholderHost(host:string):boolean{return PLACEHOLDER_DOMAINS.some(domain=>host===domain||host.endsWith(`.${domain}`))}

export function isPlausiblePublicUrl(value:string):boolean{
  const normalized=safeLink(value);
  if(!normalized)return false;
  const host=new URL(normalized).hostname.toLowerCase();
  return !!host&&!isPlaceholderHost(host)&&!PRIVATE_HOST.test(host);
}

export async function isReachablePublicUrl(value:string,fetcher:typeof fetch=fetch):Promise<boolean>{
  if(!isPlausiblePublicUrl(value))return false;
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),3000);
  try{
    const options={redirect:'follow' as const,signal:controller.signal};
    const head=await fetcher(value,{...options,method:'HEAD'});
    if(head.status>=200&&head.status<400)return true;
    const get=await fetcher(value,{...options,method:'GET',headers:{Range:'bytes=0-0'}});
    return get.status>=200&&get.status<400;
  }catch{return false}finally{clearTimeout(timeout)}
}

function collectRuns(block:PostBlock,out:TextRun[][]){
  const item=(value:TextRun[]|PostListItem)=>{if(Array.isArray(value)){out.push(value);return}out.push(value.content);const children=value.children;if(Array.isArray(children))children.forEach(item);else if(children)(children as PostNestedList).items.forEach(item)};
  if(block.type==='paragraph'||block.type==='heading')out.push(block.content);
  else if(block.type==='bullet_list'||block.type==='ordered_list')block.items.forEach(item);
  else if(block.type==='quote'){if(block.content)out.push(block.content);else block.blocks?.forEach(child=>collectRuns(child,out))}
  else if(block.type==='details'){if(block.title)out.push(block.title);block.blocks.forEach(child=>collectRuns(child,out))}
}

export async function sanitizePostDocumentLinks(document:PostDocument,fetcher:typeof fetch=fetch):Promise<PostDocument>{
  const result=structuredClone(document);
  const urls=new Set<string>();
  result.buttons?.forEach(button=>urls.add(button.url));
  const runs:TextRun[][]=[];result.blocks.forEach(block=>collectRuns(block,runs));
  runs.forEach(group=>group.forEach(run=>run.marks?.forEach(mark=>{if(mark.type==='link')urls.add(mark.href)})));
  const verdict=new Map<string,boolean>();
  await Promise.all([...urls].map(async url=>verdict.set(url,await isReachablePublicUrl(url,fetcher))));
  if(result.buttons)result.buttons=result.buttons.filter(button=>verdict.get(button.url)===true);
  runs.forEach(group=>group.forEach(run=>{if(run.marks)run.marks=run.marks.filter(mark=>mark.type!=='link'||verdict.get(mark.href)===true);if(run.marks?.length===0)delete run.marks}));
  return result;
}
