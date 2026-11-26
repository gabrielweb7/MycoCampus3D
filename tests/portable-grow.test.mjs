import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../js/vendor/three.bundle.min.js';

globalThis.window = { THREE };

const { makeGrowShopItem, stepPortableGrows } = await import('../js/items/portable-grow.js');
const { getStorageBlock } = await import('../js/systems/inventory.js');
const { createPlacementGhost, updatePlacementGhostVisual } = await import('../js/entities/placement-ghost.js');

test('grow folds for carrying and inventory while placement shows the full tent', () => {
  const ctx = { scene: new THREE.Scene(), pickableItems: [], pickableMap: new Map() };
  const grow = makeGrowShopItem(ctx, { id: 'dyn_grow_test', x: 0, y: 0, z: 0, ry: 0 }, 'grow_tent');
  const { deployed, carry, slotVisuals } = grow.growCtrl.view;
  const size = new THREE.Box3().setFromObject(deployed).getSize(new THREE.Vector3());
  assert.ok(size.y > 2.25);
  assert.equal(slotVisuals.length, 9);
  assert.equal(new Set(slotVisuals.map(slot => slot.cake.position.y)).size, 3);
  assert.equal(getStorageBlock(grow), '');

  ctx.heldItem = grow;
  stepPortableGrows(ctx, 0.1);
  assert.equal(deployed.visible, false);
  assert.equal(carry.visible, true);

  const ghost = createPlacementGhost(ctx.scene);
  updatePlacementGhostVisual(grow, true, 0, 0);
  const preview = ghost.children.at(-1).children[0];
  assert.equal(preview.children.length, 1);
  assert.ok(new THREE.Box3().setFromObject(preview).getSize(new THREE.Vector3()).y > 2.25);

  ctx.heldItem = null;
  stepPortableGrows(ctx, 0.1);
  assert.equal(deployed.visible, true);
  assert.equal(carry.visible, false);
});

test('grow explains what a bag still needs and announces a newly ready flush only once', async () => {
  const { growHeldFeedback, countReadyGrowSlots } = await import('../js/items/portable-grow.js');
  const messages = [];
  const ctx = { scene: new THREE.Scene(), pickableItems: [], callbacks: { onToast: message => messages.push(message) } };
  const grow = makeGrowShopItem(ctx, { id: 'dyn_grow_notice', x: 0, y: 0, z: 0, ry: 0 }, 'grow_tent').growCtrl;
  const spawnCtrl = { isBag: true, filled: true, pasteurized: true, substrateKind: 'sawdust', inoculated: true };
  assert.match(growHeldFeedback({ spawnCtrl }, grow), /Agite/);
  Object.assign(spawnCtrl, { shaken: true, colonized: true });
  assert.match(growHeldFeedback({ spawnCtrl }, grow), /Pronta para colocar/);

  grow.notifyHarvest = true;
  const slot = { started: Date.now(), duration: 1000, species: 'Shiitake' };
  grow.slots[0] = slot;
  stepPortableGrows(ctx, 0.15);
  assert.equal(messages.length, 0);
  slot.started -= 2000;
  stepPortableGrows(ctx, 0.15);
  stepPortableGrows(ctx, 0.15);
  assert.equal(countReadyGrowSlots(grow), 1);
  assert.equal(messages.length, 1);
  assert.match(messages[0], /ESP32/);
});

test('a porta do grow conserva umidade e só permite colher pela mira quando aberta', async () => {
  const { growSlotActionLabel, toggleGrowDoor } = await import('../js/items/portable-grow.js');
  const { updateHoverRay } = await import('../js/systems/hover-raycaster.js');
  const { handlePrimaryAction } = await import('../js/systems/interaction-system.js');
  const queued = [];
  const ctx = {
    scene: new THREE.Scene(),
    pickableItems: [],
    inFps: true,
    isTouchDevice: () => true,
    isHeldByRemote: () => false,
    isItemInsideClosedCooker: () => false,
    camera: new THREE.PerspectiveCamera(),
    raycaster: new THREE.Raycaster(),
    playerPos: new THREE.Vector3(),
    cookerPots: [],
    doorHitMeshes: [],
    rankingBtnMeshes: [],
    scaleTareMeshes: [],
    burnerSwitchMeshes: [],
    stirSwitchMeshes: [],
    hoodSwitchMeshes: [],
    lightSwitchMeshes: [],
    wildMushrooms: [],
    queueItemStateSync: item => queued.push(item.id)
  };
  const item = makeGrowShopItem(ctx, { id: 'dyn_grow_door', x: 0, y: 0, z: 0, ry: 0 }, 'grow_tent');
  const grow = item.growCtrl;
  grow.slots[0] = { started: Date.now() - 100000, duration: 90000, species: 'Shiitake', flush: 1 };
  grow.humidity = 85;
  assert.equal(toggleGrowDoor(ctx, item), true);
  stepPortableGrows(ctx, 1);
  assert.equal(grow.view.doorFlap.visible, true);
  assert.ok(grow.humidity > 82);
  const state = item.meta.serializeState(item);
  assert.equal(state.grow.doorClosed, true);
  const restored = makeGrowShopItem(ctx, { id: 'dyn_grow_restore', x: 3, y: 0, z: 0, ry: 0 }, 'grow_tent');
  restored.meta.applyState(restored, state);
  assert.equal(restored.growCtrl.view.doorFlap.visible, true);

  ctx.hoveredPickable = item;
  ctx.hoveredGrowSlot = 0;
  assert.equal(handlePrimaryAction(ctx), false);
  assert.equal(grow.slots[0].flush, 1);
  assert.equal(toggleGrowDoor(ctx, item), true);
  stepPortableGrows(ctx, 1);
  assert.equal(grow.view.doorFlap.visible, false);
  const aimedCap = grow.view.slotVisuals[0].mushrooms.children[0].children[1];
  item.mesh.updateMatrixWorld(true);
  const point = aimedCap.getWorldPosition(new THREE.Vector3());
  ctx.camera.position.copy(point).add(new THREE.Vector3(0, 0, 1.5));
  ctx.camera.lookAt(point);
  ctx.camera.updateMatrixWorld(true);
  ctx.playerPos.copy(ctx.camera.position);
  updateHoverRay(ctx);
  assert.equal(ctx.hoveredGrowSlot, 0);
  assert.match(ctx.mobileAimPrompt, /Colher Shiitake/);
  assert.match(growSlotActionLabel(grow, ctx.hoveredGrowSlot), /Colher Shiitake/);
  assert.equal(handlePrimaryAction(ctx), true);
  assert.equal(ctx.heldItem.wildMushroomCtrl.speciesName, 'Shiitake');
  assert.equal(grow.slots[0].flush, 2);
  assert.ok(queued.includes(ctx.heldItem.id));
});

test('a meetup link uses the fixed trailhead and is consumed only once', async () => {
  const { applyCampusMeetupInvite } = await import('../js/ui/campus-agenda.js');
  const { FOREST_ENTRY } = await import('../js/core/campus-route-layout.js');
  const calls = [];
  const originalDocument = globalThis.document;
  globalThis.document = { getElementById: () => null };
  window.location = { href: 'https://campus.example/index.html?encontro=forest&lang=pt-BR' };
  window.history = { replaceState(_state, _title, url) { window.location.href = url.href; } };
  window.teleportCampusPlayer = (...pose) => calls.push(pose);
  try {
    assert.equal(applyCampusMeetupInvite(), true);
    assert.deepEqual(calls, [[FOREST_ENTRY.x, FOREST_ENTRY.y, FOREST_ENTRY.z, FOREST_ENTRY.yaw]]);
    assert.equal(new URL(window.location.href).searchParams.get('lang'), 'pt-BR');
    assert.equal(applyCampusMeetupInvite(), false);
    window.location.href = 'https://campus.example/index.html?encontro=unrecognized';
    assert.equal(applyCampusMeetupInvite(), false);
    assert.equal(calls.length, 1);
  } finally {
    delete window.location;
    delete window.history;
    delete window.teleportCampusPlayer;
    globalThis.document = originalDocument;
  }
});
