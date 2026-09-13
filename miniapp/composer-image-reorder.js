export function moveItem(items,from,to){
 if(!Array.isArray(items)||!Number.isInteger(from)||!Number.isInteger(to)||from<0||to<0||from>=items.length||to>=items.length||from===to)return null;
 const next=items.slice();
 const [item]=next.splice(from,1);
 next.splice(to,0,item);
 return next;
}

export function moveItemInPlace(items,from,to){
 const next=moveItem(items,from,to);
 if(!next)return false;
 items.splice(0,items.length,...next);
 return true;
}

export function moveChildInPlace(parent,from,to){
 const children=Array.from(parent?.children||[]);
 if(!moveItem(children,from,to))return false;
 const child=children[from];
 const target=children[to];
 parent.insertBefore(child,from<to?target.nextSibling:target);
 return true;
}

export function translatedActiveIndex(active,from,to){
 if(active===from)return to;
 if(from<active&&active<=to)return active-1;
 if(to<=active&&active<from)return active+1;
 return active;
}

export function insertionSide(pointerX,rect){
 if(!rect||!Number.isFinite(pointerX)||!Number.isFinite(rect.left)||!Number.isFinite(rect.width))return null;
 return pointerX<rect.left+rect.width/2?'before':'after';
}
