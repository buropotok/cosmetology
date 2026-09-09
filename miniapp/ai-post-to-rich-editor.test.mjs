import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const transfer=await readFile(new URL('./ai-post-editor-transfer.js',import.meta.url),'utf8');
const responseUi=await readFile(new URL('./ai-response-ui.js',import.meta.url),'utf8');
const tiptap=await readFile(new URL('./composer-tiptap.js',import.meta.url),'utf8');
const adapterSource=await readFile(new URL('./post-document-tiptap-adapter.js',import.meta.url),'utf8');
const bootstrap=await readFile(new URL('./bootstrap.js',import.meta.url),'utf8');
const adapterUrl=`data:text/javascript;base64,${Buffer.from(adapterSource).toString('base64')}`;
const {postDocumentToTiptap,tiptapToPostDocument}=await import(adapterUrl);

test('ready PostDocument v2 exposes primary edit and publish action',()=>{
  assert.match(transfer,/Редактировать и опубликовать/);
  assert.match(transfer,/schemaVersion===2/);
  assert.match(transfer,/COSMO_DRAFT_V3/);
  assert.match(transfer,/version:3,document:doc/);
  assert.match(transfer,/await waitForEditor\(\)/);
  assert.match(transfer,/editor\.restoreDraft\(value\)/);
  assert.match(transfer,/CosmoComposerView\?\.showEditor\?\.\(\{focus:false\}\)/);
});

test('PostDocument adapter preserves recursive quote, details, nested lists, marks and buttons',()=>{
  const document={
    schemaVersion:2,
    blocks:[
      {type:'heading',content:[{text:'Заголовок',marks:[{type:'bold'}]}]},
      {type:'paragraph',content:[{text:'Текст '},{text:'ссылка',marks:[{type:'link',href:'https://example.com/'}]}]},
      {type:'quote',blocks:[
        {type:'paragraph',content:[{text:'Цитата',marks:[{type:'italic'},{type:'strikethrough'}]}]},
        {type:'bullet_list',items:[{content:[{text:'Пункт'}],children:{type:'ordered_list',items:[{content:[{text:'Вложенный'}]}]}}]}
      ]},
      {type:'details',title:[{text:'Подробнее'}],blocks:[{type:'paragraph',content:[{text:'Скрыто',marks:[{type:'spoiler'}]}]}]}
    ],
    buttons:[{text:'Сайт',url:'https://example.com/'}]
  };
  const tiptapDocument=postDocumentToTiptap(document);
  assert.deepEqual(tiptapToPostDocument(tiptapDocument,document.buttons),document);
});

test('PostDocument adapter keeps legacy quote content readable',()=>{
  const legacy={schemaVersion:1,blocks:[{type:'quote',content:[{text:'Старая цитата'}]}]};
  assert.deepEqual(postDocumentToTiptap(legacy),{
    type:'doc',
    content:[{type:'blockquote',content:[{type:'paragraph',content:[{type:'text',text:'Старая цитата',marks:undefined}]}]}]
  });
});

test('AI response keeps canonical PostDocument for direct Tiptap transfer through the adapter',()=>{
  assert.match(responseUi,/window\.CosmoAiPostDocument = doc \|\| null/);
  assert.match(responseUi,/cosmo-ai-post-document/);
  assert.match(responseUi,/Array\.isArray\(block\.blocks\)/);
  assert.match(tiptap,/postDocumentToTiptap,tiptapToPostDocument/);
  assert.match(tiptap,/\.\/post-document-tiptap-adapter\.js/);
  assert.match(tiptap,/COSMO_DRAFT_V3/);
  assert.match(tiptap,/function restoreDraft\(value\)/);
  assert.match(tiptap,/editor\.commands\.setContent\(postDocumentToTiptap\(doc\)/);
  assert.match(tiptap,/tiptapToPostDocument\(editor\.getJSON\(\),buttons\)/);
  assert.match(bootstrap,/ai-post-editor-transfer\.js/);
});
