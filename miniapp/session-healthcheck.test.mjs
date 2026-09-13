import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('./app.js',import.meta.url),'utf8');
const lifecycle=source.slice(source.indexOf('const SESSION_HEALTHCHECK_INTERVAL_MS'),source.indexOf('\nfunction vkButton'));

function harness(responses=[]){
  let visibilityState='visible',nextTimer=1;const timers=new Map(),listeners=new Map(),requests=[];const nodes=new Map();
  function element(){return{id:'',style:{cssText:''},children:[],setAttribute(){},append(...items){this.children.push(...items);for(const item of items)if(item.id)nodes.set(item.id,item)},remove(){if(this.id)nodes.delete(this.id)}}}
  const document={get visibilityState(){return visibilityState},set visibilityState(value){visibilityState=value},body:{append(node){if(node.id)nodes.set(node.id,node)}},createElement:element,querySelector(selector){return selector.startsWith('#')?nodes.get(selector.slice(1))||null:null},addEventListener(name,fn){listeners.set(name,fn)}};
  const fetch=async(path,options)=>{requests.push({path,options});const value=responses.shift()||{status:200,body:{ok:true}};if(value.error)throw value.error;return{ok:value.status>=200&&value.status<300,status:value.status,json:async()=>value.body}};
  const context={document,fetch,console,webApp:{initData:'signed'},authHeaders:()=>({Authorization:'tma signed'}),setTimeout(fn,delay){const id=nextTimer++;timers.set(id,{fn,delay});return id},clearTimeout(id){timers.delete(id)}};
  vm.runInNewContext(lifecycle,context,{filename:'app-session-healthcheck.js'});
  return{document,requests,timers,nodes,async settle(){await new Promise(resolve=>setImmediate(resolve))},async visibility(value){visibilityState=value;listeners.get('visibilitychange')();await this.settle()},async tick(){const [{fn}]=timers.values();timers.clear();fn();await this.settle()}};
}

test('visible startup bootstraps once and schedules one 60-second healthcheck',async()=>{const h=harness();await h.settle();assert.equal(h.requests[0].options.method,'POST');assert.equal(h.timers.size,1);assert.equal([...h.timers.values()][0].delay,60_000);await h.tick();assert.equal(h.requests[1].options.method,'GET');assert.equal(h.timers.size,1)});
test('hidden stops the timer and visible performs an immediate check without timer duplication',async()=>{const h=harness();await h.settle();await h.visibility('hidden');assert.equal(h.timers.size,0);await h.visibility('visible');assert.equal(h.requests.length,2);assert.equal(h.timers.size,1);await h.visibility('visible');assert.equal(h.requests.length,3);assert.equal(h.timers.size,1)});
test('confirmed expiry shows one existing-style modal and permanently stops checks',async()=>{const expired={status:401,body:{error:{code:'MINIAPP_AUTH_EXPIRED'}}},h=harness([expired,expired]);await h.settle();assert.ok(h.nodes.has('session-expired-modal'));assert.equal(h.timers.size,0);await h.visibility('visible');assert.equal(h.requests.length,1);assert.equal([...h.nodes.keys()].filter(id=>id==='session-expired-modal').length,1)});
test('network and server failures do not show expiry and retain the next check',async()=>{for(const response of [{error:new Error('offline')},{status:503,body:{error:{code:'INTERNAL_ERROR'}}}]){const h=harness([response]);await h.settle();assert.equal(h.nodes.has('session-expired-modal'),false);assert.equal(h.timers.size,1)}});
