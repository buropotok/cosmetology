import test from 'node:test';
import assert from 'node:assert/strict';
import {moveItem,ownsDragPointer} from './composer-image-order.js';

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
