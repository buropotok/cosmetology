import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {insertionSide,moveChildInPlace,moveItem,moveItemInPlace,translatedActiveIndex} from './composer-image-reorder.js';

test('moveItem reorders without mutating the source array',()=>{
 const source=['a','b','c','d'];
 assert.deepEqual(moveItem(source,0,2),['b','c','a','d']);
 assert.deepEqual(moveItem(source,3,1),['a','d','b','c']);
 assert.deepEqual(source,['a','b','c','d']);
});

test('moveItem rejects invalid and no-op moves',()=>{
 assert.equal(moveItem(['a','b'],0,0),null);
 assert.equal(moveItem(['a','b'],-1,1),null);
 assert.equal(moveItem(['a','b'],0,2),null);
});

test('active photo identity follows a reordered item',()=>{
 assert.equal(translatedActiveIndex(0,0,2),2);
 assert.equal(translatedActiveIndex(1,0,2),0);
 assert.equal(translatedActiveIndex(2,0,2),1);
 assert.equal(translatedActiveIndex(1,2,0),2);
 assert.equal(translatedActiveIndex(0,2,0),1);
});

test('pointer crossing the card midpoint selects before or after placement',()=>{
 const rect={left:100,width:62};
 assert.equal(insertionSide(100,rect),'before');
 assert.equal(insertionSide(130,rect),'before');
 assert.equal(insertionSide(131,rect),'after');
 assert.equal(insertionSide(170,rect),'after');
});

test('insertionSide rejects unusable geometry',()=>{
 assert.equal(insertionSide(Number.NaN,{left:0,width:62}),null);
 assert.equal(insertionSide(10,null),null);
});

test('reorder consumers retain preview URL and photo-stage node identities',()=>{
 const urls=[{id:'a'},{id:'b'},{id:'c'}];
 const originalUrls=urls.slice();
 assert.equal(moveItemInPlace(urls,0,2),true);
 assert.deepEqual(urls,[originalUrls[1],originalUrls[2],originalUrls[0]]);

 const document=new JSDOM('<div><img id="a"><img id="b"><img id="c"></div>').window.document;
 const track=document.querySelector('div');
 const originalNodes=Array.from(track.children);
 assert.equal(moveChildInPlace(track,0,2),true);
 assert.deepEqual(Array.from(track.children),[originalNodes[1],originalNodes[2],originalNodes[0]]);
 assert.equal(track.children[2],originalNodes[0]);
});
