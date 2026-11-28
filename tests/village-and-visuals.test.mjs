import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../js/vendor/three.bundle.min.js';

globalThis.window = { THREE };
const { VILLAGE_LOTS, villageLotAt, canPlaceVillageItem } = await import('../js/core/village-layout.js');
const { terrainHeight } = await import('../js/engine/physics.js');
const { MUSHROOM_SPECIES_CATALOG, createMushroomMeshBySpeciesName, stepForestDistanceCulling } = await import('../js/world/mushroom-species.js');
const { discardHeldLiquid, getDrainableVolume } = await import('../js/systems/liquid-disposal.js');
const { buildGardenTap, buildLabSink } = await import('../js/items/lab-sink.js');
const { DISTILLED_JUG_META } = await import('../js/items/distilled-jug.js');
const { handleSinkHover } = await import('../js/systems/hover-held-handlers.js');
const { handlePrimaryAction } = await import('../js/systems/interaction-system.js');
const { stepSinkWater } = await import('../js/systems/sink-water.js');
const { getFloatingActionsPreview } = await import('../js/ui/radial-menu.js');
const { applyCampusItemStates } = await import('../js/systems/world-objects-sync.js');

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
  const item = { isReadOnly: true, villageEditLot: VILLAGE_LOTS[0].id };
  const first = VILLAGE_LOTS[0];
  assert.equal(canPlaceVillageItem(first.x, first.z, item, null, true), true);
  assert.equal(canPlaceVillageItem(first.x, first.z, item, null), false);
  assert.equal(canPlaceVillageItem(first.x, 69, item, null, true), false);
});

test('forest batches submit only visible instances and preserve the original tree colors', () => {
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial(), 2);
  const red = new THREE.Color('#b35a38');
  const green = new THREE.Color('#609352');
  mesh.setColorAt(0, red);
  mesh.setColorAt(1, green);
  const chunks = [0, 100].map((x, idx) => {
    const activeMat = new THREE.Matrix4().makeTranslation(x, 0, 0);
    mesh.setMatrixAt(idx, activeMat);
    return { x, z: 0, visible: true, maxDistSq: 900, items: [{ inst: mesh, idx, activeMat }] };
  });
  const ctx = { playerPos: { x: 100, z: 0 }, forestInstChunks: chunks };
  const color = new THREE.Color();
  stepForestDistanceCulling(ctx);
  assert.equal(mesh.count, 1);
  mesh.getColorAt(0, color);
  assert.equal(color.getHex(), green.getHex());
  ctx.playerPos.x = 0;
  stepForestDistanceCulling(ctx);
  assert.equal(mesh.count, 1);
  mesh.getColorAt(0, color);
  assert.equal(color.getHex(), red.getHex());
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
  assert.deepEqual(tap.nozzleWorld.toArray(), [-18, 0.70, 54.64]);
});

test('garrafão, pote de mistura e panela enchem na casa pelo clique e pelo botão de toque', () => {
  const makeContext = touch => ({
    scene: new THREE.Scene(), raycaster: new THREE.Raycaster(), labSinks: [], labSinkMeshes: [],
    solidColliders: [], supportSurfaces: [], supportMeshes: [], wallSegments: [],
    cookerPots: [], pendingMovedItems: {}, callbacks: {}, notifyWorldAction() {},
    isTouchDevice: () => touch, isPrimaryDown: true
  });
  const aim = (ctx, position, target) => {
    ctx.scene.updateMatrixWorld(true);
    ctx.raycaster.set(position, target.clone().sub(position).normalize());
    return handleSinkHover(ctx, (_, prompt) => { ctx.aimActionPrompt = prompt; });
  };

  for (const touch of [false, true]) {
    const ctx = makeContext(touch);
    const indoor = buildLabSink(ctx, -20, 0.99, 50, 'cottage');
    const garden = buildGardenTap(ctx, -18, 55, -1);
    const jug = { id: 'village_test_jug', label: 'Garrafão', mesh: new THREE.Group(), meta: DISTILLED_JUG_META, isMoved: true };
    jug.mesh.userData.liquidCtrl = { volMl: 0, maxMl: 5000, baseY: 0.012, maxH: 0.26, liqMesh: new THREE.Group(), baseLabel: jug.label };
    const bowl = { id: 'village_test_bowl', label: 'Pote de Mistura', mesh: new THREE.Group(),
      bowlCtrl: { ingredients: { flocao: 575 } } };
    const pot = { id: 'village_test_pot', label: 'Panela', mesh: new THREE.Group() };
    pot.cookerRef = { potItem: pot, lidItem: { isAttached: false }, waterMl: 0, maxWaterMl: 15000, contents: [] };
    ctx.cookerPots.push(pot.cookerRef);

    for (const [sink, origin] of [[indoor, new THREE.Vector3(-18.5, 1.6, 50)],
      [garden, new THREE.Vector3(-18, 1.6, 56.6)]]) {
      for (const item of [jug, bowl, pot]) {
        ctx.heldItem = item;
        ctx.hoveredSink = null;
        ctx.hoveredSinkAction = null;
        const lc = jug.mesh.userData.liquidCtrl;
        lc.volMl = 0;
        bowl.bowlCtrl.ingredients.water = 0;
        pot.cookerRef.waterMl = 0;
        assert.equal(aim(ctx, origin, sink.nozzleWorld), true);
        assert.equal(ctx.hoveredSink, sink);
        assert.equal(ctx.hoveredSinkAction, 'fill');

        ctx.isPrimaryDown = true;
        if (touch) {
          const action = getFloatingActionsPreview(ctx).find(entry => entry.primary);
          assert.equal(action.hold, true);
          action.run();
        } else {
          assert.equal(handlePrimaryAction(ctx), true);
        }
        stepSinkWater(ctx, 0.3);
        if (item === jug) {
          ctx.pickableItems = [jug];
          applyCampusItemStates(ctx, { [jug.id]: { liquid: { volMl: 35 } } });
          assert.equal(lc.volMl, 230);
        }
        ctx.isPrimaryDown = false;
        stepSinkWater(ctx, 0.3);
        assert.equal(ctx.sinkFilling, null);
        if (item === jug) {
          applyCampusItemStates(ctx, { [jug.id]: { liquid: { volMl: 35 } } });
          assert.equal(lc.volMl, 230);
          assert.equal(ctx.pendingMovedItems[item.id].state.liquid.volMl, 230);
          assert.equal(ctx.pendingMovedItems[item.id].y, undefined);
        } else if (item === bowl) {
          assert.equal(bowl.bowlCtrl.ingredients.water, 25);
        } else {
          assert.equal(pot.cookerRef.waterMl, 400);
        }
      }
    }

    ctx.heldItem = pot;
    pot.cookerRef.lidItem.isAttached = true;
    assert.equal(aim(ctx, new THREE.Vector3(-18, 1.6, 56.6), garden.nozzleWorld), false);
  }
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
