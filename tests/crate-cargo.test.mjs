import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../js/vendor/three.bundle.min.js';

globalThis.window = { THREE };
const { makeDeliveryCrate, interactRoadsideStand } = await import('../js/items/dehydration-packaging.js');
const { registerPickable } = await import('../js/items/item-registry.js');
const { placeHeldInCrate, commitHeldItemPlacement } = await import('../js/systems/held-item-placement.js');
const { handlePrimaryAction, pickHoveredItemForMove } = await import('../js/systems/interaction-system.js');
const { findAimedCrate, freeCrateSlot } = await import('../js/systems/crate-cargo.js');
const { applyCampusItemStates, queueItemStateSync } = await import('../js/systems/world-objects-sync.js');

function setup() {
  const ctx = {
    scene: new THREE.Scene(), playerPos: new THREE.Vector3(),
    pickableItems: [], pickableMap: new Map(), pendingMovedItems: {}, recentlyDropped: {},
    cookerPots: [], callbacks: {}, inventory: { reserved: new Set() }, heldRotY: 0,
    isHeldByRemote: () => false, notifyWorldAction() {}
  };
  ctx.findPickable = id => ctx.pickableMap.get(id);
  ctx.queueItemStateSync = item => queueItemStateSync(ctx, item);
  return ctx;
}

function makeTool(ctx, width = 0.08) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, 0.03, 0.08), new THREE.MeshBasicMaterial());
  return registerPickable(ctx, 'lab_tool_test', 'Ferramenta', mesh, 0, 0, 0);
}

test('crates show their actual contents and sell only sealed packages', () => {
  const ctx = setup();
  const crate = makeDeliveryCrate(ctx, 'delivery_crate_05', 1, 0, 1, { packsCount: 2 });
  assert.match(crate.label, /2 pacote/);
  const tool = makeTool(ctx);
  ctx.heldItem = tool;
  assert.equal(placeHeldInCrate(ctx, crate), true);
  assert.match(crate.label, /1 outro/);
  assert.equal(crate.deliveryCrateCtrl.packMeshes.filter(pack => pack.visible).length, 2);

  ctx.heldItem = crate;
  assert.equal(interactRoadsideStand(ctx), true);
  assert.equal(crate.deliveryCrateCtrl.packsCount, 0);
  assert.equal(crate.trayContents[0].item, tool);
  assert.doesNotMatch(crate.label, /Vazia/);
  assert.equal(crate.deliveryCrateCtrl.packMeshes.some(pack => pack.visible), false);
});

test('mouse and touch aim can find the opening, cargo follows rotation, and saved cargo can be picked back up', () => {
  const ctx = setup();
  const crate = makeDeliveryCrate(ctx, 'delivery_crate_05', 1, 0, 1);
  ctx.camera = new THREE.PerspectiveCamera(65, 1, 0.01, 25);
  ctx.camera.position.set(1, 1.3, 2);
  ctx.camera.lookAt(1, 0.15, 1);
  ctx.camera.updateMatrixWorld();
  ctx.raycaster = new THREE.Raycaster();
  assert.equal(findAimedCrate(ctx, new THREE.Vector2(0, 0)), crate);
  assert.equal(findAimedCrate(ctx, new THREE.Vector2(0.1, 0)), crate);
  assert.equal(findAimedCrate(ctx, new THREE.Vector2(0.75, 0.75)), null);
  const tool = makeTool(ctx, 0.25);
  ctx.heldItem = tool;
  assert.equal(placeHeldInCrate(ctx, crate), true);
  const ref = ctx.pendingMovedItems[tool.id].state.crateCargo;
  assert.ok(ref.slot >= 4, 'a longer tool uses more than one compartment');
  ctx.heldItem = crate;
  ctx.heldRotY = Math.PI / 2;
  assert.equal(commitHeldItemPlacement(ctx, new THREE.Vector3(3, 0, 4), false), true);
  assert.equal(tool.mesh.rotation.y, Math.PI / 2);
  assert.equal(crate.trayContents.length, 1);
  assert.deepEqual(ctx.pendingMovedItems[tool.id].state.crateCargo, ref);

  const restored = setup();
  const savedCrate = makeDeliveryCrate(restored, crate.id, 3, 0, 4, { ry: Math.PI / 2 });
  const savedTool = makeTool(restored, 0.25);
  applyCampusItemStates(restored, { [savedTool.id]: { crateCargo: ref } });
  assert.equal(savedTool.crateParent, savedCrate);
  assert.ok(savedTool.mesh.position.distanceTo(tool.mesh.position) < 0.001);
  assert.equal(pickHoveredItemForMove(restored, savedTool), true);
  assert.equal(restored.pendingMovedItems[savedTool.id].state.crateCargo, null);
  assert.match(savedCrate.label, /Vazia/);
});

test('primary action harvests directly into a held crate and preserves a full crate', async () => {
  const ctx = setup();
  const crate = makeDeliveryCrate(ctx, 'delivery_crate_05', 0, 0, 0, { packsCount: 3 });
  ctx.heldItem = crate;
  ctx.lastPickupAt = -1000;
  let claims = 0;
  ctx.callbacks.onHarvestMushroom = async () => {
    claims++;
    return { ok: true, awarded: true, picked_id: 'wild_picked_crate_test' };
  };
  const source = {
    id: 'wild_crate_test', active: true, group: new THREE.Group(),
    capMesh: { userData: { speciesName: 'Shiitake' } }
  };
  ctx.hoveredMushroom = source;
  assert.equal(handlePrimaryAction(ctx), true);
  assert.equal(handlePrimaryAction(ctx), true);
  await Promise.resolve();
  assert.equal(claims, 1);
  assert.equal(ctx.heldItem, crate);
  assert.equal(source.active, false);
  assert.match(crate.label, /1 cogumelo/);
  assert.equal(freeCrateSlot(crate), -1);
  ctx.hoveredMushroom = { ...source, id: 'wild_crate_test_2', active: true };
  assert.equal(handlePrimaryAction(ctx), true);
  assert.equal(claims, 1);
  assert.equal(ctx.hoveredMushroom.active, true);
});
