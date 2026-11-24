import test from 'node:test';
import assert from 'node:assert/strict';
import { acknowledgeCoinOperation, enqueueCoinDelta, pendingCoinOperations } from '../js/services/coin-outbox.js';

test('a fila de moedas preserva operações por conta até a confirmação', () => {
  const store = new Map();
  globalThis.localStorage = {
    get length() { return store.size; },
    key: (index) => [...store.keys()][index],
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, value),
    removeItem: (key) => store.delete(key)
  };

  enqueueCoinDelta(17, 5300);
  enqueueCoinDelta(18, 40);
  const batch = pendingCoinOperations(17);
  assert.deepEqual(batch.map((entry) => entry.delta), [5000, 300]);
  assert.deepEqual(pendingCoinOperations(17), batch);
  acknowledgeCoinOperation(17, batch[0].operation_id);
  assert.deepEqual(pendingCoinOperations(17), [batch[1]]);
  assert.equal(pendingCoinOperations(18)[0].delta, 40);
});
