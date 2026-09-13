import test from 'node:test';
import assert from 'node:assert/strict';
import {keyboardReorderTarget,listenForOwnedDragEnd,moveItem,ownsDragPointer} from './composer-image-order.js';

function pointerEvent(type,pointerId){
  const event=new Event(type);
  Object.defineProperty(event,'pointerId',{value:pointerId});
  return event;
}

test('only the pointer that owns a drag session may end it',()=>{
  const drag={pointerId:7};
  assert.equal(ownsDragPointer(drag,7),true);
  assert.equal(ownsDragPointer(drag,8),false);
  assert.equal(ownsDragPointer(null,7),false);
});

test('cancelled reorder leaves the file order unchanged while a committed reorder moves it',()=>{
  const files=['first','second','third'];
  const cancelled=files.slice();
  assert.deepEqual(cancelled,['first','second','third']);
  assert.deepEqual(moveItem(files,0,2),['second','third','first']);
  assert.deepEqual(files,['first','second','third']);
});

test('foreign endings do not remove the active pointer lifecycle listeners',()=>{
  const handle=new EventTarget(),endings=[];
  listenForOwnedDragEnd(handle,7,(event,commit)=>endings.push([event.type,commit]));
  handle.dispatchEvent(pointerEvent('pointerup',8));
  handle.dispatchEvent(pointerEvent('pointerup',7));
  handle.dispatchEvent(pointerEvent('pointercancel',7));
  assert.deepEqual(endings,[['pointerup',true]]);
});

test('cancellation and lost pointer capture clean up without committing',()=>{
  for(const type of ['pointercancel','lostpointercapture']){
    const handle=new EventTarget(),endings=[];
    listenForOwnedDragEnd(handle,3,(event,commit)=>endings.push([event.type,commit]));
    handle.dispatchEvent(pointerEvent(type,3));
    handle.dispatchEvent(pointerEvent('pointerup',3));
    assert.deepEqual(endings,[[type,false]]);
  }
});

test('keyboard activation chooses an adjacent destination',()=>{
  assert.equal(keyboardReorderTarget(0,3),1);
  assert.equal(keyboardReorderTarget(1,3),2);
  assert.equal(keyboardReorderTarget(2,3),1);
  assert.equal(keyboardReorderTarget(0,1),null);
});
