import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const fixes=fs.readFileSync(new URL('./composer-tiptap-fixes.js',import.meta.url),'utf8');
const adapterSource=fs.readFileSync(new URL('./post-document-tiptap-adapter.js',import.meta.url),'utf8');
const adapterUrl=`data:text/javascript;base64,${Buffer.from(adapterSource).toString('base64')}`;
const {tiptapToPostDocument}=await import(adapterUrl);

test('active Tiptap details UI matches Telegram disclosure while preserving recursive PostDocument v2 blocks',()=>{
  assert.match(fixes,/\.cosmo-details-node\{[\s\S]*?border:0;[\s\S]*?border-bottom:1px solid #e5e5ea;[\s\S]*?background:transparent/);
  assert.match(fixes,/button\.innerHTML='<svg[^']+<path d="m6 9 6 6 6-6"\/><\/svg>'/);
  assert.match(fixes,/\.cosmo-details-node\.is-open \.cosmo-details-toggle svg\{transform:rotate\(180deg\)\}/);
  assert.match(fixes,/\.cosmo-details-toggle\{[\s\S]*?border:0;[\s\S]*?background:transparent;[\s\S]*?cursor:pointer/);
  assert.match(fixes,/\[data-cosmo-details-body\]\{margin:4px 0 0;padding:0;border:0;background:transparent\}/);
  assert.doesNotMatch(fixes,/button\.textContent=open\?/);

  const document=tiptapToPostDocument({type:'doc',content:[{
    type:'details',
    content:[
      {type:'detailsSummary',content:[{type:'text',text:'Подробнее'}]},
      {type:'detailsBody',content:[
        {type:'paragraph',content:[{type:'text',text:'Основной текст'}]},
        {type:'blockquote',content:[{type:'paragraph',content:[{type:'text',text:'Вложенная цитата'}]}]}
      ]}
    ]
  }]});
  assert.deepEqual(document.blocks,[{
    type:'details',
    title:[{text:'Подробнее'}],
    blocks:[
      {type:'paragraph',content:[{text:'Основной текст'}]},
      {type:'quote',blocks:[{type:'paragraph',content:[{text:'Вложенная цитата'}]}]}
    ]
  }]);
});
