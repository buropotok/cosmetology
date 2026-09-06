import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const controller=fs.readFileSync(new URL('./before-after-controller.js',import.meta.url),'utf8');

test('successful Before/After save routes explicitly to Composer',()=>{
  const saveStart=controller.indexOf('async function save(');
  const messageStart=controller.indexOf("window.addEventListener('message'",saveStart);
  assert.ok(saveStart>=0&&messageStart>saveStart);
  const saveBody=controller.slice(saveStart,messageStart);
  assert.match(saveBody,/setScreen\?\.\('publish'\)/);
  assert.match(saveBody,/CosmoRouter\?\.show\?\.\('composer'\)/);
  assert.doesNotMatch(saveBody,/CosmoRouter\?\.show\?\.\('home'\)/);
});
