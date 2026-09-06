import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('./composer-rich-text.js',import.meta.url),'utf8');
test('details UI matches Telegram disclosure while preserving PostDocument contract',()=>{
  assert.match(source,/\.composer-rich-editor details\{[^}]*border-bottom:1px solid #e5e5ea/);
  assert.match(source,/details>summary::before\{[^}]*svg/);
  assert.match(source,/details\[open\]>summary::before\{transform:rotate\(180deg\)\}/);
  assert.match(source,/details>div\{[^}]*border:0;background:transparent/);
  assert.match(source,/type:'details',title:summary\?blockRuns\(summary\).*content:blockRuns\(holder\)/);
});
