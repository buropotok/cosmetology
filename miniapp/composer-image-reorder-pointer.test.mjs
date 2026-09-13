import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('./composer-image-manager.js',import.meta.url),'utf8');

test('drag destination is resolved only inside the owned preview strip',()=>{
 assert.match(source,/elementFromPoint\?\.\(x,y\)/);
 assert.match(source,/!target\|\|!previews\.contains\(target\)/);
 assert.match(source,/dragState\.to=to/);
 assert.match(source,/if\(from!==to\)moveFile\(from,to\)/);
});
