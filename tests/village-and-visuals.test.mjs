import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../js/vendor/three.bundle.min.js';

globalThis.window = { THREE };
const { VILLAGE_LOTS, villageLotAt, canPlaceVillageItem } = await import('../js/core/village-layout.js');
const { terrainHeight } = await import('../js/engine/physics.js');
const { MUSHROOM_SPECIES_CATALOG, createMushroomMeshBySpeciesName } = await import('../js/world/mushroom-species.js');
const { discardHeldLiquid, getDrainableVolume } = await import('../js/systems/liquid-disposal.js');
const { buildGardenTap, buildLabSink } = await import('../js/items/lab-sink.js');

test('ten walkable village lots face the street and accept placements only from their tenant', () => {
  assert.equal(VILLAGE_LOTS.length, 10);
  for (const lot of VILLAGE_LOTS) {
    assert.equal(villageLotAt(lot.x, lot.houseZ), lot);
    assert.equal(terrainHeight(lot.x, lot.houseZ), 0);
    assert.ok(Math.abs(lot.gateZ - 69) < Math.abs(lot.houseZ - 69));
    assert.equal(canPlaceVillageItem(lot.x, lot.z, { isPersonal: true }, { id: lot.id }), true);
    assert.equal(canPlaceVillageItem(lot.x, lot.z, { isPersonal: true, isReadOnly: true }, { id: lot.id }), false);
    assert.equal(canPlaceVillageItem(lot.x, lot.z, { isPersonal: true }, { id: 99 }), false);
    assert.equal(canPlaceVillageItem(lot.x, lot.z, { id: 'delivery_crate_05' }, { id: lot.id }), true);
    assert.equal(canPlaceVillageItem(lot.x, lot.z, { id: 'delivery_crate_05' }, null), false);
  }
  assert.equal(villageLotAt(-13, 54), null);
  assert.equal(villageLotAt(0, 69), null);
});

test('every catalog entry produces a distinct, bounded low-poly mesh', () => {
  const box = new THREE.Box3();
  const size = new THREE.Vector3();
  const signatures = new Set();
  for (const species of MUSHROOM_SPECIES_CATALOG) {
    const name = `${species.common} (${species.scientific})`;
    const group = createMushroomMeshBySpeciesName(name);
    box.setFromObject(group).getSize(size);
    assert.ok(size.y > 0.02 && size.y < 0.6, name);
    let triangles = 0;
    group.traverse(mesh => {
      if (mesh.isMesh) triangles += (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3;
    });
    assert.ok(triangles >= 20 && triangles <= 1200, `${name}: ${triangles}`);
    signatures.add([...size.toArray().map(value => value.toFixed(6)), triangles].join(':'));
  }
  assert.equal(signatures.size, 100);
});

test('cottages register fill and drain targets, while the yard tap only fills', () => {
  const ctx = { scene: new THREE.Scene(), labSinks: [], labSinkMeshes: [], solidColliders: [], supportSurfaces: [], supportMeshes: [] };
  const sink = buildLabSink(ctx, -20, 0.99, 50, 'cottage');
  const tap = buildGardenTap(ctx, -18, 55, -1);
  assert.deepEqual(ctx.labSinks, [sink, tap]);
  assert.deepEqual(ctx.labSinkMeshes.map(mesh => mesh.userData.sinkAction), ['fill', 'drain', 'fill']);
  assert.equal(sink.waterStream.visible, false);
  assert.deepEqual(tap.nozzleWorld.toArray(), [-18, 0.66, 54.64]);
});

test('ground and sink disposal immediately replicate the new volume and preserve the vessel', () => {
  const mesh = new THREE.Group();
  mesh.userData.liquidCtrl = { volMl: 180, maxMl: 500, liqMesh: new THREE.Group(), baseLabel: 'Jar' };
  const jar = { id: 'distilled_jug_01', mesh };
  const syringeMesh = new THREE.Group();
  syringeMesh.userData.syrCtrl = { volMl: 2, liqMesh: new THREE.Group(), plunger: new THREE.Group(), mix: { waterMl: 2 } };
  const syringe = { id: 'syringe_10ml_01', mesh: syringeMesh };
  const ctx = { heldItem: jar, cookerPots: [], pendingMovedItems: {} };
  assert.equal(getDrainableVolume(ctx, jar), 180);
  assert.equal(discardHeldLiquid(ctx), true);
  assert.equal(mesh.userData.liquidCtrl.volMl, 0);
  assert.equal(ctx.heldItem, jar);
  assert.ok(ctx.pendingMovedItems[jar.id].state);
  ctx.heldItem = syringe;
  assert.equal(discardHeldLiquid(ctx, { nozzleWorld: new THREE.Vector3() }), true);
  assert.equal(syringeMesh.userData.syrCtrl.mix.waterMl, 0);
  assert.equal(getDrainableVolume(ctx, { ...jar, spawnCtrl: { isPP5: true, lidOpen: false, waterMl: 30 } }), 0);
});
