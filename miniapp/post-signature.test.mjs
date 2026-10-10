import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const code=await readFile(new URL('./post-signature.js',import.meta.url),'utf8');
const signature=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const memory=new Map();
globalThis.localStorage={
  getItem:key=>memory.has(key)?memory.get(key):null,
  setItem:(key,value)=>memory.set(key,value),
  removeItem:key=>memory.delete(key)
};
globalThis.window={Telegram:{WebApp:{initDataUnsafe:{user:{id:100}}}}};

const paragraph=text=>({type:'paragraph',content:[{text}]});
const signed={schemaVersion:2,blocks:[
  {type:'paragraph',content:[{text:'Врач-косметолог',marks:[{type:'bold'}]}]},
  paragraph('📞 +7 900 000-00-00')
]};

test('saved signature keeps PostDocument rich marks and is scoped to the current Telegram user',()=>{
  memory.clear();
  signature.saveSignature(signed);
  assert.deepEqual(signature.readSignature(),signed);
  window.Telegram.WebApp.initDataUnsafe.user.id=101;
  assert.equal(signature.readSignature(),null);
  window.Telegram.WebApp.initDataUnsafe.user.id=100;
});

test('new manual Composer opens with editable blank paragraph, separator and saved signature',()=>{
  signature.beginNewPostSignature();
  const calls=[];
  const editor={getPlainText:()=>'',setDocument:doc=>calls.push(doc),editor:{commands:{setTextSelection:pos=>calls.push(pos)}}};
  signature.insertDefaultSignature(editor);
  assert.equal(calls[1],1);
  assert.deepEqual(calls[0].blocks,[{type:'paragraph',content:[]},paragraph('_____'),...signed.blocks]);
  signature.insertDefaultSignature(editor);
  assert.equal(calls.length,2,'default applied exactly once');
});

test('new AI PostDocument gets rich signature in the text before publishing, exactly once',()=>{
  const generated={schemaVersion:2,blocks:[paragraph('AI текст')],buttons:[{text:'Сайт',url:'https://example.com'}]};
  signature.beginNewPostSignature();
  const result=signature.signatureForIncomingPost(generated);
  assert.deepEqual(result.blocks,[paragraph('AI текст'),paragraph('_____'),...signed.blocks]);
  assert.deepEqual(result.buttons,generated.buttons);
  assert.deepEqual(generated.blocks,[paragraph('AI текст')],'AI output not mutated');
  signature.finishNewPostSignature();
  assert.equal(signature.signatureForIncomingPost(result),result,'restored/already composed text unchanged');
});

test('existing editor text and restored drafts are never replaced by defaults',()=>{
  signature.beginNewPostSignature();
  let called=false;
  signature.insertDefaultSignature({getPlainText:()=> 'Сохранённый черновик',setDocument:()=>{called=true}});
  assert.equal(called,false);
  assert.equal(signature.signatureForIncomingPost({schemaVersion:2,blocks:[]}).blocks.length,0);
});

test('clearing the saved signature disables injection; malformed saved data fails closed',()=>{
  signature.saveSignature({schemaVersion:2,blocks:[paragraph('')]});
  assert.equal(signature.readSignature(),null);
  signature.beginNewPostSignature();
  assert.equal(signature.initialDocumentWithSignature(),null);
  signature.finishNewPostSignature();
  memory.set('cosmo-sofa.post-signature.v1user-100','{broken json');
  assert.equal(signature.readSignature(),null);
});
