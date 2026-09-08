export const NAVIGATION_STATES=Object.freeze({
  HOME:'HOME',
  MENU:'MENU',
  AI:'AI',
  PUBLISH:'PUBLISH',
  BEFORE_AFTER:'BEFORE_AFTER'
});

const STATE_VALUES=Object.freeze(Object.keys(NAVIGATION_STATES).map(key=>NAVIGATION_STATES[key]));

export function createNavigationStack({render,initial=[NAVIGATION_STATES.HOME]}={}){
  if(typeof render!=='function')throw new TypeError('Navigation render callback is required');

  function assertState(state){
    if(STATE_VALUES.indexOf(state)===-1)throw new RangeError(`Unknown navigation state: ${state}`);
  }
  function normalizePath(path){
    const next=Array.isArray(path)?path.slice():path===NAVIGATION_STATES.HOME?[NAVIGATION_STATES.HOME]:[NAVIGATION_STATES.HOME,path];
    if(!next.length||next[0]!==NAVIGATION_STATES.HOME)throw new RangeError('Navigation stack must start at HOME');
    next.forEach(assertState);
    return next;
  }

  let stack=normalizePath(initial);
  let transitionTail=Promise.resolve();
  function enqueue(task){
    const result=transitionTail.then(task,task);
    transitionTail=result.then(()=>undefined,()=>undefined);
    return result;
  }
  async function renderAndCommit(next,options){
    const state=next[next.length-1];
    const rendered=await render(state,options);
    if(rendered===false)return null;
    stack=next;
    return state;
  }
  function push(state,options={}){
    return enqueue(async()=>{
      assertState(state);
      if(stack[stack.length-1]===state){
        const rendered=await render(state,options);
        return rendered===false?null:state;
      }
      return renderAndCommit(stack.concat(state),options);
    });
  }
  function replace(state,options={}){
    return enqueue(async()=>{
      assertState(state);
      let next;
      if(state===NAVIGATION_STATES.HOME)next=[NAVIGATION_STATES.HOME];
      else if(stack.length>1&&stack[stack.length-2]===state)next=stack.slice(0,-1);
      else{
        next=stack.slice();
        if(next.length===1)next.push(state);
        else next[next.length-1]=state;
      }
      return renderAndCommit(next,options);
    });
  }
  function reset(path=NAVIGATION_STATES.HOME,options={}){
    return enqueue(()=>renderAndCommit(normalizePath(path),options));
  }
  function back(options={focus:false}){
    return enqueue(async()=>{
      if(stack.length<=1){
        const rendered=await render(NAVIGATION_STATES.HOME,options);
        return rendered===false?null:NAVIGATION_STATES.HOME;
      }
      return renderAndCommit(stack.slice(0,-1),options);
    });
  }

  return Object.freeze({
    STATES:NAVIGATION_STATES,
    push,
    replace,
    reset,
    back,
    get current(){return stack[stack.length-1]},
    get stack(){return stack.slice()}
  });
}
