import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const fixes=fs.readFileSync(new URL('./composer-tiptap-fixes.js',import.meta.url),'utf8');
const editor=fs.readFileSync(new URL('./composer-tiptap.js',import.meta.url),'utf8');
test('active Tiptap details UI matches Telegram disclosure while preserving PostDocument contract',()=>{
  assert.match(fixes,/\.cosmo-details-node\{[\s\S]*?border:0;[\s\S]*?border-bottom:1px solid #e5e5ea;[\s\S]*?background:transparent/);
  assert.match(fixes,/button\.innerHTML='<svg[^']+<path d="m6 9 6 6 6-6"\/><\/svg>'/);
  assert.match(fixes,/\.cosmo-details-node\.is-open \.cosmo-details-toggle svg\{transform:rotate\(180deg\)\}/);
  assert.match(fixes,/\.cosmo-details-toggle\{[\s\S]*?border:0;[\s\S]*?background:transparent;[\s\S]*?cursor:pointer/);
  assert.match(fixes,/\[data-cosmo-details-body\]\{margin:4px 0 0;padding:0;border:0;background:transparent\}/);
  assert.doesNotMatch(fixes,/button\.textContent=open\?/);
  assert.match(editor,/blocks\.push\(\{type:'details',title:summary\?inlineRuns\(summary\):\[\{text:'Подробнее'\}\],content:body\?inlineRuns\(body\):\[\]\}\)/);
});
