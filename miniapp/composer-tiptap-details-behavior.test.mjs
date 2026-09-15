import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const clone=value=>JSON.parse(JSON.stringify(value));
const children=node=>Array.isArray(node?.content)?node.content:[];
const contentSize=node=>children(node).reduce((sum,child)=>sum+nodeSize(child),0);
function nodeSize(node){return node?.type==='text'?String(node.text||'').length:2+contentSize(node)}
const textContent=node=>node?.type==='text'?String(node.text||''):children(node).map(textContent).join('');
const paragraph=text=>text?{type:'paragraph',content:[{type:'text',text}]}:{type:'paragraph'};
const details=(body,title='Подробнее')=>({type:'details',content:[
  title?{type:'detailsSummary',content:[{type:'text',text:title}]}:{type:'detailsSummary'},
  {type:'detailsBody',content:body}
]});
const doc=content=>({type:'doc',content});

class PMNode{
  constructor(json){this.json=json;this.type={name:json.type};this.isTextblock=['paragraph','detailsSummary','heading'].includes(json.type);this.content={size:contentSize(json)}}
  get childCount(){return children(this.json).length}
  child(index){return new PMNode(children(this.json)[index])}
  get textContent(){return textContent(this.json)}
  descendants(callback){
    const walk=(node,baseOffset)=>{let offset=0;for(const child of children(node)){const childOffset=baseOffset+offset,wrapped=new PMNode(child);callback(wrapped,childOffset);if(child.type!=='text')walk(child,childOffset+1);offset+=nodeSize(child)}};
    walk(this.json,0);
  }
}

class PMDoc extends PMNode{
  constructor(json){super(json);this.content={size:contentSize(json)}}
  textBetween(from,to,blockSeparator='\n'){
    const pieces=[];
    const walk=(node,start,isDoc=false)=>{let offset=0;const contentStart=isDoc?start:start+1;for(const child of children(node)){const childStart=contentStart+offset;if(child.type==='text'){const value=String(child.text||'');for(let i=0;i<value.length;i++){const pos=childStart+i;if(pos>=from&&pos<to)pieces.push(value[i])}}else{const before=pieces.length;walk(child,childStart,false);if(blockSeparator&&pieces.length>before&&child.type==='paragraph'&&childStart+nodeSize(child)<to)pieces.push(blockSeparator)}offset+=nodeSize(child)}};
    walk(this.json,0,true);
    return pieces.join('').replace(new RegExp(`${blockSeparator}+$`),'');
  }
}

function resolvePos(json,pos){
  const path=[new PMDoc(json)],starts=[null];
  const descend=(node,start,isDoc=false)=>{let offset=0;const contentStart=isDoc?0:start+1;for(const child of children(node)){const childStart=contentStart+offset,childEnd=childStart+nodeSize(child);if(child.type!=='text'&&pos>childStart&&pos<childEnd){path.push(new PMNode(child));starts.push(childStart);descend(child,childStart,false);return}offset+=nodeSize(child)}};
  descend(json,0,true);
  return{
    depth:path.length-1,
    parent:path[path.length-1],
    node:depth=>path[depth],
    before:depth=>starts[depth],
    after:depth=>starts[depth]+nodeSize(path[depth].json)
  };
}

function topRanges(json){let offset=0;return children(json).map((node,index)=>{const range={index,node,from:offset,to:offset+nodeSize(node)};offset=range.to;return range})}
function summaryCaret(detailsNode,start){return start+2+textContent(detailsNode.content[0]).length}
function bodyCaret(detailsNode,start){const summarySize=nodeSize(detailsNode.content[0]),bodyStart=start+1+summarySize,paragraphStart=bodyStart+1;return paragraphStart+1}

// This harness supplies only the Tiptap/ProseMirror contracts used by composer-tiptap.js.
// The production module itself is executed below, so toolbar and keyboard handlers stay production code.
class FakeEditor{
  constructor({extensions=[],content}){
    this.docJson=clone(content);this.selectionSpec={from:1,to:1};this.keyboard={};
    this.commands={
      deleteRange:range=>this._deleteRange(range),
      insertContentAt:(range,value)=>this._insertContentAt(range,value),
      focus:()=>true,
      setContent:value=>{this.docJson=clone(value);this.selectionSpec={from:1,to:1};return true},
      clearContent:()=>{this.docJson=doc([paragraph('')]);this.selectionSpec={from:1,to:1};return true}
    };
    for(const extension of extensions){if(extension?.addKeyboardShortcuts){Object.assign(this.keyboard,extension.addKeyboardShortcuts.call({editor:this}))}}
  }
  get state(){
    const current=new PMDoc(this.docJson),from=this.selectionSpec.from,to=this.selectionSpec.to??from;
    return{doc:current,selection:{from,to,empty:from===to,node:Number.isInteger(this.selectionSpec.nodeIndex)?new PMNode(this.docJson.content[this.selectionSpec.nodeIndex]):null,$from:resolvePos(this.docJson,from),$to:resolvePos(this.docJson,to)}};
  }
  getJSON(){return clone(this.docJson)}
  getText(){return textContent(this.docJson)}
  setTestState(nextDoc,selection){this.docJson=clone(nextDoc);this.selectionSpec={...selection}}
  isActive(){return false}
  getAttributes(){return{}}
  chain(){
    const operations=[],chain={
      focus:()=>chain,
      deleteRange:range=>{operations.push(['deleteRange',range]);return chain},
      insertContent:value=>{operations.push(['insertContent',value]);return chain},
      insertContentAt:(range,value)=>{operations.push(['insertContentAt',range,value]);return chain},
      toggleOrderedList:()=>chain,toggleBulletList:()=>chain,sinkListItem:()=>chain,liftListItem:()=>chain,
      toggleBold:()=>chain,toggleItalic:()=>chain,toggleUnderline:()=>chain,toggleStrike:()=>chain,toggleMark:()=>chain,
      setParagraph:()=>chain,toggleHeading:()=>chain,toggleBlockquote:()=>chain,extendMarkRange:()=>chain,setLink:()=>chain,undo:()=>chain,redo:()=>chain,
      run:()=>{const snapshot=clone(this.docJson),selection={...this.selectionSpec};for(const [kind,a,b] of operations){const ok=kind==='deleteRange'?this._deleteRange(a):kind==='insertContent'?this._insertContent(a):this._insertContentAt(a,b);if(!ok){this.docJson=snapshot;this.selectionSpec=selection;return false}}return true}
    };
    return chain;
  }
  _setCaret(pos){this.selectionSpec={from:pos,to:pos}}
  _selectionAfterInsert(start,value){if(value?.type==='details')return bodyCaret(value,start);return start+1}
  _replaceTop(from,to,replacement){
    const ranges=topRanges(this.docJson),startIndex=ranges.findIndex(range=>range.from===from),endBoundary=ranges.findIndex(range=>range.to===to);
    if(startIndex<0||endBoundary<startIndex)return false;
    this.docJson.content.splice(startIndex,endBoundary-startIndex+1,...replacement.map(clone));
    this._setCaret(replacement.length?this._selectionAfterInsert(from,replacement[0]):Math.min(from,contentSize(this.docJson)));
    return true;
  }
  _deleteRange({from,to}){
    if(this._replaceTop(from,to,[]))return true;
    for(const range of topRanges(this.docJson)){const value=range.node;if(value.type!=='paragraph')continue;const text=textContent(value);if(from===range.from+1&&to===range.from+1+text.length&&contentSize(value)===text.length){this.docJson.content[range.index]=paragraph('');this._setCaret(range.from+1);return true}}
    return false;
  }
  _insertContentAt({from,to},value){return this._replaceTop(from,to,[value])}
  _insertContent(value){
    if(this.selectionSpec.from!==this.selectionSpec.to)return false;
    const pos=this.selectionSpec.from;
    for(const range of topRanges(this.docJson)){if(range.node.type==='paragraph'&&contentSize(range.node)===0&&pos===range.from+1)return this._replaceTop(range.from,range.to,[value])}
    return false;
  }
}

class FakeClassList{constructor(){this.values=new Set()}add(...values){values.forEach(value=>this.values.add(value))}remove(...values){values.forEach(value=>this.values.delete(value))}toggle(value,force){const next=force===undefined?!this.values.has(value):Boolean(force);if(next)this.values.add(value);else this.values.delete(value);return next}contains(value){return this.values.has(value)}}
class FakeEvent{constructor(type,{target=null}={}){this.type=type;this.target=target;this.defaultPrevented=false;this.propagationStopped=false}preventDefault(){this.defaultPrevented=true}stopPropagation(){this.propagationStopped=true}}
class FakeCustomEvent extends FakeEvent{constructor(type,init={}){super(type);this.detail=init.detail}}
class FakeElement{
  constructor(tag='div'){this.tagName=String(tag).toUpperCase();this.children=[];this.parentElement=null;this.listeners=new Map();this.classList=new FakeClassList();this.className='';this.textContent='';this.style={};this.attributes={};this.selectorOne=null;this.selectorAll=null}
  append(...nodes){for(const node of nodes){node.parentElement=this;this.children.push(node)}}
  replaceChildren(...nodes){this.children=[];this.append(...nodes)}
  insertBefore(node,reference){const index=this.children.indexOf(reference);node.parentElement=this;if(index<0)this.children.push(node);else this.children.splice(index,0,node)}
  setAttribute(name,value){this.attributes[name]=String(value)}
  querySelector(selector){return this.selectorOne?.(selector)??null}
  querySelectorAll(selector){return this.selectorAll?.(selector)??[]}
  addEventListener(type,listener){const listeners=this.listeners.get(type)||[];listeners.push(listener);this.listeners.set(type,listeners)}
  dispatchEvent(event){if(!event.target)event.target=this;for(const listener of this.listeners.get(event.type)||[])listener(event);return!event.defaultPrevented}
  closest(selector){if(selector==='button'&&this.tagName==='BUTTON')return this;return this.parentElement?.closest(selector)||null}
  remove(){if(!this.parentElement)return;const index=this.parentElement.children.indexOf(this);if(index>=0)this.parentElement.children.splice(index,1);this.parentElement=null}
  getBoundingClientRect(){return{left:0,top:0,right:0,bottom:0,width:0,height:0}}
  focus(){}
  select(){}
}

function setupDom(){
  const host=new FakeElement('div'),toolbar=new FakeElement('div'),toolbarParent=new FakeElement('div');toolbarParent.append(toolbar);
  const listMenu=new FakeElement('div'),listTrigger=new FakeElement('button'),listBox=new FakeElement('div');listTrigger.textContent='';listMenu.append(listTrigger,listBox);
  const baseItems=['Нумерованный','Маркированный','Подробнее'].map(label=>{const button=new FakeElement('button');button.className='composer-menu-item';button.textContent=label;listBox.append(button);return button});
  listMenu.selectorOne=selector=>selector==='.composer-menu-trigger'||selector==='.composer-menu-trigger[title="Списки"]'?listTrigger:null;
  listMenu.selectorAll=selector=>selector==='.composer-menu-item'?listBox.children.filter(child=>child.className==='composer-menu-item'):[];
  const emojiButton=new FakeElement('button');emojiButton.setAttribute('title','Emoji');toolbar.append(listMenu,emojiButton);
  toolbar.selectorAll=selector=>selector==='.composer-tool-menu'?[listMenu]:[];
  toolbar.selectorOne=selector=>selector==='[title="Emoji"]'?emojiButton:null;
  toolbarParent.selectorOne=()=>null;
  const head=new FakeElement('head'),body=new FakeElement('body');
  const document={head,body,createElement:tag=>new FakeElement(tag),querySelector:selector=>selector==='#composer-editor-host'?host:selector==='.composer-toolbar'?toolbar:null};
  return{document,host,toolbar,detailsButton:baseItems[2],emojiButton};
}

const dom=setupDom();
globalThis.document=dom.document;
globalThis.HTMLElement=FakeElement;
globalThis.CustomEvent=FakeCustomEvent;
globalThis.window={dispatchEvent(){},CosmoDiagnostics:null,visualViewport:null};
globalThis.innerWidth=1024;
globalThis.innerHeight=768;
globalThis.__COSMO_TIPTAP_TEST_DEPS__={
  Editor:FakeEditor,
  Mark:{create:config=>config},
  Node:{create:config=>config},
  mergeAttributes:(...values)=>Object.assign({},...values),
  StarterKit:{configure:config=>({name:'starterKit',config})},
  postDocumentToTiptap:value=>value,
  tiptapToPostDocument:value=>value
};

const source=await readFile(new URL('./composer-tiptap.js',import.meta.url),'utf8');
const executable=source
  .replace("import {Editor,Mark,Node,mergeAttributes} from 'https://esm.sh/@tiptap/core@3.0.2';","const {Editor,Mark,Node,mergeAttributes}=globalThis.__COSMO_TIPTAP_TEST_DEPS__;")
  .replace("import StarterKit from 'https://esm.sh/@tiptap/starter-kit@3.0.2';","const {StarterKit}=globalThis.__COSMO_TIPTAP_TEST_DEPS__;")
  .replace("import {postDocumentToTiptap,tiptapToPostDocument} from './post-document-tiptap-adapter.js';","const {postDocumentToTiptap,tiptapToPostDocument}=globalThis.__COSMO_TIPTAP_TEST_DEPS__;");
await import(`data:text/javascript;base64,${Buffer.from(executable).toString('base64')}`);
const editor=window.CosmoRichEditor.editor;
const clickDetails=()=>dom.detailsButton.dispatchEvent(new FakeEvent('click',{target:dom.detailsButton}));

await test('Composer details behavior mutates editor state instead of only matching implementation source',async t=>{
  await t.test('converts selected text into a details body and leaves a valid collapsed selection',()=>{
    editor.setTestState(doc([paragraph('Selected')]),{from:1,to:9});
    clickDetails();
    assert.deepEqual(editor.getJSON(),doc([details([paragraph('Selected')])]));
    assert.equal(editor.state.selection.empty,true);
    assert.ok(editor.state.selection.from>0&&editor.state.selection.from<editor.state.doc.content.size);
  });

  await t.test('creates empty details on an empty top-level line without changing surrounding paragraphs',()=>{
    const initial=doc([paragraph('before'),paragraph(''),paragraph('after')]),middle=topRanges(initial)[1];
    editor.setTestState(initial,{from:middle.from+1,to:middle.from+1});
    clickDetails();
    assert.deepEqual(editor.getJSON(),doc([paragraph('before'),details([paragraph('')]),paragraph('after')]));
    assert.equal(editor.state.selection.empty,true);
  });

  await t.test('Backspace keeps the block while the summary still has text, even when the body is empty',()=>{
    const only=details([paragraph('')]),initial=doc([only]),caret=summaryCaret(only,0);
    editor.setTestState(initial,{from:caret,to:caret});
    assert.equal(editor.keyboard.Backspace(),false);
    assert.deepEqual(editor.getJSON(),initial);
  });

  await t.test('Backspace also keeps the block while the body still has text',()=>{
    const only=details([paragraph('body')],''),initial=doc([only]),caret=summaryCaret(only,0);
    editor.setTestState(initial,{from:caret,to:caret});
    assert.equal(editor.keyboard.Backspace(),false);
    assert.deepEqual(editor.getJSON(),initial);
  });

  await t.test('Backspace removes a sole details block only after both summary and body are empty',()=>{
    const only=details([paragraph('')],''),initial=doc([only]),caret=summaryCaret(only,0);
    editor.setTestState(initial,{from:caret,to:caret});
    assert.equal(editor.keyboard.Backspace(),true);
    assert.deepEqual(editor.getJSON(),doc([paragraph('')]));
    assert.equal(editor.state.selection.empty,true);
  });

  await t.test('Backspace removes a fully empty details block from the middle without touching neighbors',()=>{
    const middleDetails=details([paragraph('')],''),initial=doc([paragraph('before'),middleDetails,paragraph('after')]),range=topRanges(initial)[1],caret=summaryCaret(middleDetails,range.from);
    editor.setTestState(initial,{from:caret,to:caret});
    assert.equal(editor.keyboard.Backspace(),true);
    assert.deepEqual(editor.getJSON(),doc([paragraph('before'),paragraph('after')]));
    assert.equal(editor.state.selection.from,range.from);
    assert.equal(editor.state.selection.to,range.from);
  });

  await t.test('Backspace removes a fully node-selected non-empty details block',()=>{
    const selected=details([paragraph('body')]),initial=doc([paragraph('before'),selected,paragraph('after')]),range=topRanges(initial)[1];
    editor.setTestState(initial,{from:range.from,to:range.to,nodeIndex:1});
    assert.equal(editor.keyboard.Backspace(),true);
    assert.deepEqual(editor.getJSON(),doc([paragraph('before'),paragraph('after')]));
  });

  await t.test('heading style is injected and toolbar/emoji pointer guards prevent focus-stealing defaults',()=>{
    const css=dom.document.head.children.map(node=>node.textContent).join('\n');
    assert.match(css,/\.composer-tiptap-editor \.tiptap h1\{[^}]*font-family:"Times New Roman",Times,serif/);
    const toolbarPointer=new FakeEvent('pointerdown',{target:dom.detailsButton});dom.toolbar.dispatchEvent(toolbarPointer);assert.equal(toolbarPointer.defaultPrevented,true);
    const emojiMouse=new FakeEvent('mousedown',{target:dom.emojiButton});dom.emojiButton.dispatchEvent(emojiMouse);assert.equal(emojiMouse.defaultPrevented,true);
  });
});
