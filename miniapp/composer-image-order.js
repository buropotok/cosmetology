export function moveItem(items,from,to){
  if(!Array.isArray(items)||!Number.isInteger(from)||!Number.isInteger(to)||from<0||to<0||from>=items.length||to>=items.length||from===to)return null;
  const next=items.slice();
  const [item]=next.splice(from,1);
  next.splice(to,0,item);
  return next;
}

export function translatedActiveIndex(active,from,to){
  if(active===from)return to;
  if(from<active&&active<=to)return active-1;
  if(to<=active&&active<from)return active+1;
  return active;
}
