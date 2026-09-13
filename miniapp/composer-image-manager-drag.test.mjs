import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';

test('thumbnail drag emits a reorder contract without a full input change',async()=>{
 const dom=new JSDOM('<input id="image"><div id="previews"><img id="first"><img id="second"></div><button id="remove-image"></button><p id="status"></p>');
 const {window}=dom;
 const input=window.document.querySelector('#image');
 let inputFiles=[{name:'first.jpg'},{name:'second.jpg'}];
 Object.defineProperty(input,'files',{configurable:true,get:()=>inputFiles,set:value=>{inputFiles=Array.from(value)}});
 class TestDataTransfer{
  constructor(){this.files=[];this.items={add:file=>this.files.push(file)}}
 }
 class TestImage{set src(_value){queueMicrotask(()=>this.onerror?.())}}
 Object.assign(globalThis,{
  window,
  document:window.document,
  CustomEvent:window.CustomEvent,
  Event:window.Event,
  MutationObserver:window.MutationObserver,
  DataTransfer:TestDataTransfer,
  Image:TestImage,
 });
 globalThis.URL.createObjectURL=()=>'/preview';
 globalThis.URL.revokeObjectURL=()=>{};

 let changes=0,reorder=null;
 input.addEventListener('change',()=>changes++);
 window.addEventListener('cosmo-composer-images-reordered',event=>{reorder=event.detail});
 await import(`./composer-image-manager.js?drag-test=${Date.now()}`);

 const [first,second]=window.document.querySelectorAll('.composer-thumb');
 first.getBoundingClientRect=()=>({left:0,top:0,width:62,height:62});
 second.getBoundingClientRect=()=>({left:70,top:0,width:62,height:62});
 first.setPointerCapture=()=>{};
 first.releasePointerCapture=()=>{};
 const pointer=(type,x,target=first)=>{const event=new window.Event(type,{bubbles:true,cancelable:true});Object.assign(event,{pointerId:1,clientX:x,clientY:10,button:0});target.dispatchEvent(event);return event};

 const menu=new window.Event('contextmenu',{bubbles:true,cancelable:true});
 first.dispatchEvent(menu);
 assert.equal(menu.defaultPrevented,true);

 pointer('pointerdown',10);
 assert.equal(first.style.transform,'scale(1.14)');
 pointer('pointermove',140);
 pointer('pointerup',140);
 assert.deepEqual(reorder,{from:0,to:1});
 assert.equal(changes,0);
 assert.deepEqual(window.CosmoComposerImages.getFiles().map(file=>file.name),['second.jpg','first.jpg']);
});

test('delete pointerdown does not start a thumbnail drag',()=>{
 const wrap=document.querySelector('.composer-thumb');
 const button=wrap.querySelector('.composer-image-delete');
 const event=new window.Event('pointerdown',{bubbles:true,cancelable:true});
 Object.assign(event,{pointerId:2,clientX:0,clientY:0,button:0});
 button.dispatchEvent(event);
 assert.equal(wrap.style.transform,'');
});
