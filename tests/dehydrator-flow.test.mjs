import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../js/vendor/three.bundle.min.js';

globalThis.window = { THREE };

const { makeDehydrator, interactDehydrator, stepDehydrators } = await import('../js/items/dehydrator.js');
const { spawnPersistedWildMushroom } = await import('../js/systems/world-interactions.js');
const { applyCampusItemStates, consumeCampusMovedItems, markItemRemovedForSync, queueItemStateSync } =
  await import('../js/systems/world-objects-sync.js');

function setup() {
  const ctx = {
    scene: new THREE.Scene(),
    pickableItems: [],
    pickableMap: new Map(),
    pendingMovedItems: {},
    cookerPots: [],
    callbacks: {},
    isHeldByRemote: () => false,
    findPickable: id => ctx.pickableMap.get(id)
  };
  ctx.queueItemStateSync = item => queueItemStateSync(ctx, item);
  ctx.markItemRemoved = item => markItemRemovedForSync(ctx, item);
  return ctx;
}

test('desidratadora envia a entrada na mesma fila, preserva progresso e restaura o lote seco', () => {
  const ctx = setup();
  const dryer = makeDehydrator(ctx, 'dehydrator_lab', 1, 0.9, 2);
  const mushroom = spawnPersistedWildMushroom(ctx, 'wild_picked_dryer_test', {
    speciesName: 'Shiitake', grams: 24, isMagic: false
  });
  ctx.heldItem = mushroom;
  const sent = [];
  ctx.notifyWorldAction = () => sent.push(consumeCampusMovedItems(ctx));

  assert.equal(interactDehydrator(ctx, dryer), true);
  assert.equal(ctx.heldItem, null);
  assert.equal(sent.length, 1);
  const load = sent[0].find(entry => entry.id === dryer.id);
  const source = sent[0].find(entry => entry.id === mushroom.id);
  assert.equal(load.state.custom.hasMushroom, true);
  assert.equal(source.state.custom.removed, true);
  assert.equal(dryer.dehydratorCtrl.mushGroup.visible, true);

  ctx.notifyWorldAction = () => {};
  stepDehydrators(ctx, 4.8);
  assert.equal(interactDehydrator(ctx, dryer), true);
  assert.equal(ctx.pendingMovedItems[dryer.id].state.custom.progress, 32);
  applyCampusItemStates(ctx, { [dryer.id]: { custom: { hasMushroom: false, on: false } } });
  assert.equal(dryer.dehydratorCtrl.hasMushroom, true);
  stepDehydrators(ctx, 4);
  assert.equal(dryer.dehydratorCtrl.progress, 32);
  assert.equal(interactDehydrator(ctx, dryer), true);
  stepDehydrators(ctx, 12);
  assert.equal(dryer.dehydratorCtrl.crisp, true);

  const restored = setup();
  const restoredDryer = makeDehydrator(restored, dryer.id, 1, 0.9, 2);
  applyCampusItemStates(restored, { [dryer.id]: ctx.pendingMovedItems[dryer.id].state });
  assert.equal(interactDehydrator(restored, restoredDryer), true);
  const dried = restored.heldItem;
  assert.equal(dried.id, load.state.custom.batchId);
  assert.equal(dried.driedMushroomCtrl.grams, 24);
  assert.equal(dried.driedMushroomCtrl.speciesName, 'Shiitake');
  assert.equal(restored.pendingMovedItems[dried.id].x, 1);
  assert.equal(restored.pendingMovedItems[dryer.id].state.custom.hasMushroom, false);
});
