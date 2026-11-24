import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../js/vendor/three.bundle.min.js';

globalThis.window = { THREE };

const { handlePrimaryAction } = await import('../js/systems/interaction-system.js');
const { stepSyringePumping } = await import('../js/systems/held-item-loop.js');
const { markItemRemovedForSync, getReplicatedItemState } = await import('../js/systems/world-objects-sync.js');

function makePickable(id, data) {
  const mesh = new THREE.Group();
  Object.assign(mesh.userData, data);
  return { id, mesh };
}

function makeContext(heldItem, extra = {}) {
  return { heldItem, callbacks: {}, lastPickupAt: -1000, notifyWorldAction() {}, ...extra };
}

test('clique com Petri na mão não abre a placa nem usa a porta', () => {
  const plate = makePickable('petri_1', { isPetri: true, petriCtrl: { lidOpen: false } });
  const door = { open: false };
  const ctx = makeContext(plate, { hoveredDoorObj: door, queueWorldStateChange() {} });
  handlePrimaryAction(ctx);
  assert.equal(plate.mesh.userData.petriCtrl.lidOpen, false);
  assert.equal(door.open, false);
  assert.equal(ctx.heldItem, plate);
});

test('clique na bancada apoia a Petri fechada', () => {
  const plate = makePickable('petri_1', { isPetri: true, petriCtrl: { lidOpen: false } });
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 1.65, 0);
  camera.lookAt(0, 1, -1);
  camera.updateMatrixWorld();
  const ctx = makeContext(plate, {
    inFps: true, playerPos: new THREE.Vector3(), camera, raycaster: new THREE.Raycaster(),
    supportSurfaces: [{ minX: -0.5, maxX: 0.5, minZ: -1.5, maxZ: -0.5, topY: 1 }],
    supportMeshes: [], pickableItems: [plate], cookerPots: [], wallSegments: [],
    pendingMovedItems: {}, recentlyDropped: {}, heldRotY: 0,
    setSnapClosePot(value) { this.snapClosePot = value; },
    setSnapPetriStack(value) { this.snapPetriStack = value; }
  });
  ctx.entityCtx = ctx;
  handlePrimaryAction(ctx);

  assert.equal(ctx.heldItem, null);
  assert.equal(plate.mesh.position.y, 1);
  assert.equal(plate.mesh.userData.petriCtrl.lidOpen, false);
});

test('Petri que fecha durante a aplicação cancela sem debitar a seringa', () => {
  const plate = makePickable('petri_1', {
    isPetri: true, petriCtrl: { lidOpen: true, mode: 'empty', sterilized: true }
  });
  const ctrl = { volMl: 1, mix: { lcMl: 1 }, liqMesh: new THREE.Group(), plunger: new THREE.Group() };
  const syringe = makePickable('syringe_1', { isSyringe: true, syrCtrl: ctrl });
  syringe.meta = { compatibilities: { transfersLiquidCulture: true } };
  const ctx = makeContext(syringe, { hoveredSyringeTarget: { item: plate, mode: 'inject' } });

  handlePrimaryAction(ctx);
  assert.ok(ctx.syringePumping, 'dose começa quando a tampa está aberta');
  stepSyringePumping(ctx, 1);
  plate.mesh.userData.petriCtrl.lidOpen = false;
  stepSyringePumping(ctx, 1);

  assert.equal(ctx.syringePumping, null);
  assert.equal(ctrl.volMl, 1);
  assert.equal(ctrl.mix.lcMl, 1);
  assert.equal(plate.mesh.userData.petriCtrl.mode, 'empty');
});

test('lixeira só descarta embalagem de lâmina vazia e publica a remoção', () => {
  const pack = makePickable('scalpel_blade_test', {});
  pack.bladePackCtrl = { empty: false };
  const scene = new THREE.Scene();
  scene.add(pack.mesh);
  const ctx = makeContext(pack, {
    hoveredTrash: true, pickableItems: [pack], pickableMap: new Map([[pack.id, pack]]),
    markItemRemoved: (item) => markItemRemovedForSync(ctx, item)
  });
  handlePrimaryAction(ctx);
  assert.equal(ctx.heldItem, pack);
  pack.bladePackCtrl.empty = true;
  handlePrimaryAction(ctx);
  assert.equal(ctx.heldItem, null);
  assert.equal(pack.mesh.parent, null);
  assert.equal(ctx.pickableMap.has(pack.id), false);
  assert.equal(ctx.pendingMovedItems[pack.id].state.custom.removed, true);
});

test('volume fracionário do frasco é preservado no estado replicado', () => {
  const flask = makePickable('liquid_culture', { liquidCtrl: { volMl: 103.6, sterilized: true } });
  assert.equal(getReplicatedItemState({ cookerPots: [] }, flask).liquid.volMl, 103.6);
});

test('toque usa coordenadas relativas ao canvas, inclusive fora da mira central', async () => {
  const { setPointerFromClient } = await import('../js/systems/input-controller.js');
  const point = new THREE.Vector2();
  const rect = { left: 32, top: 100, width: 240, height: 220 };
  assert.equal(setPointerFromClient(point, rect, 72, 155), true);
  assert.ok(Math.abs(point.x + 2 / 3) < 1e-9);
  assert.equal(point.y, 0.5);
  assert.equal(setPointerFromClient(point, rect, 28, 155), false);
  assert.equal(setPointerFromClient(point, { ...rect, width: 0 }, 32, 155), false);
});

test('repique de grão conserva origem e clones antigos não são inferidos pela geração', async () => {
  const { transferGrainToGrain } = await import('../js/items/spawn-containers.js');
  const source = makePickable('spawn_src', {});
  const target = makePickable('spawn_dst', {});
  source.spawnCtrl = { filled: true, colonized: true, generation: 2, origin: 'monospore', updateVisual() {} };
  target.spawnCtrl = { filled: true, sterilized: true, updateVisual() {} };
  const ctx = makeContext(source, {
    wearingGloves: true, hoodSanitizedUntil: Date.now() + 60000,
    hoodAirData: { on: true, workArea: { minX: -1, maxX: 1, minZ: -1, maxZ: 1, topY: 0 } }
  });
  assert.equal(transferGrainToGrain(ctx, source, target).ok, true);
  assert.equal(target.spawnCtrl.generation, 3);
  assert.equal(getReplicatedItemState(ctx, target).spawn.origin, 'monospore');
  const { calculateHarvestYieldGrams } = await import('../js/core/culture-origin.js');
  assert.equal(calculateHarvestYieldGrams(10, target.spawnCtrl.origin), 10);
  assert.equal(calculateHarvestYieldGrams(10, 'tissue_clone'), 14);
});
