import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from '../js/vendor/three.bundle.min.js';

globalThis.window = { THREE };
const { ensureCoreAdminPrefabs, spawnShopItemNearPlayer } = await import('../js/systems/admin-editor.js');
const { handlePrimaryAction } = await import('../js/systems/interaction-system.js');
const { applyRemoteAk47Shots, getRecentAk47Shots, poseAk47, stepAk47Effects } = await import('../js/systems/ak47-effects.js');
const { applyQuickInventory, createQuickInventory, getStorageBlock, selectQuickSlot } = await import('../js/systems/inventory.js');
const { SHOP_SUPPLIES, SHOP_SUPPLY_CATEGORIES } = await import('../js/ui/modal-shop.js');
const { getFloatingActionsPreview } = await import('../js/ui/radial-menu.js');
const { getUfoTelemetry, stepUfoAbduction } = await import('../js/world/ufo-abduction.js');

function fixture() {
  const ctx = {
    scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(65, 1.6, 0.05, 100),
    playerPos: new THREE.Vector3(), playerYaw: 0, lastPickupAt: -Infinity,
    physCtx: { stairsList: [], walkableFloors: [], supportSurfaces: [], wallSegments: [], solidColliders: [], campusDoors: [] },
    pickableItems: [], pickableMap: new Map(), callbacks: {}, inFps: true
  };
  ctx.camera.position.set(0, 1.65, 0);
  return ctx;
}

test('AK-47 é entregue à frente e pode ser guardada no inventário sincronizado', () => {
  const supply = SHOP_SUPPLIES.find(entry => entry.id === 'sup_ak47');
  assert.equal(supply.price_coins, 1300);
  assert.ok(SHOP_SUPPLY_CATEGORIES.some(category => category.id === supply.category));
  const authPhp = readFileSync(new URL('../api/auth.php', import.meta.url), 'utf8');
  const inventoryPhp = readFileSync(new URL('../api/inventory.php', import.meta.url), 'utf8');
  assert.match(authPhp, /'sup_ak47' => \['prefab_id' => 'ak47', 'price_coins' => 1300,/);
  assert.match(inventoryPhp, /in_array\(\$prefab, \[[^\]]*'ak47'[^\]]*\], true\)\) return 'portable';/);

  const ctx = fixture();
  ensureCoreAdminPrefabs();
  const rifle = spawnShopItemNearPlayer(ctx, supply.prefabId);
  assert.ok(rifle.mesh.position.z < -1);
  assert.equal(rifle.mesh.position.y, 0);
  assert.equal(ctx.pickableMap.get(rifle.id), rifle);
  assert.equal(ctx.pendingMovedItems[rifle.id].prefabId, supply.prefabId);
  assert.equal(getStorageBlock(rifle), '');
  assert.ok(rifle.mesh.getObjectByName('ak47-bolt'));

  ctx.inventory = createQuickInventory();
  ctx.findPickable = id => ctx.pickableMap.get(id);
  ctx.heldItem = rifle;
  applyQuickInventory(ctx, {
    ready: true, active: 0, slots: [rifle.id, null, null], holding: rifle.id, reserved: [rifle.id]
  }, [], rifle.id);
  assert.equal(selectQuickSlot(ctx, 1), true);
  applyQuickInventory(ctx, {
    ready: true, active: 1, slots: [rifle.id, null, null], holding: '', reserved: [rifle.id],
    op: ctx.inventory.pending.id, result: 'ok'
  }, [], rifle.id);
  assert.equal(ctx.heldItem, null);
  assert.equal(rifle.mesh.visible, false);

  assert.equal(selectQuickSlot(ctx, 0), true);
  applyQuickInventory(ctx, {
    ready: true, active: 0, slots: [rifle.id, null, null], holding: rifle.id, reserved: [rifle.id],
    op: ctx.inventory.pending.id, result: 'ok'
  }, [], '');
  assert.equal(ctx.heldItem, rifle);
  assert.equal(rifle.mesh.visible, true);
});

test('clique e toque compartilham o disparo, traçantes param em paredes e estojos somem', () => {
  const ctx = fixture();
  ctx.heldItem = spawnShopItemNearPlayer(ctx, 'ak47');
  ctx.isTouchDevice = () => true;
  ctx.wallSegments = [{ x1: -3, x2: 3, z1: -4, z2: -4, minY: 0, maxY: 3 }];
  ctx.hoveredHouseAction = { run: () => assert.fail('disparar não deve acionar a casa') };
  let played = 0;
  window.MycoAudio = { playAk47Shot: () => played++ };

  assert.equal(handlePrimaryAction(ctx), true);
  poseAk47(ctx, ctx.heldItem, 1000, 0.18);
  stepAk47Effects(ctx, 0.016, 1000);
  const fx = ctx.ak47Effects;
  assert.equal(played, 1);
  assert.ok(fx.light.intensity > 0);
  assert.ok(fx.tracers[0].distance < 4);
  assert.equal(fx.brassMesh.count, 1);
  const [snapshot] = getRecentAk47Shots(ctx, 1050);
  assert.equal(snapshot.length, 9);
  assert.equal(snapshot[1], 50);
  assert.deepEqual(getRecentAk47Shots(ctx, 1900), []);

  const fire = getFloatingActionsPreview(ctx)[0];
  assert.equal(fire.id, 'fire_ak47');
  assert.equal(fire.hold, true);
  ctx.isPrimaryDown = true;
  fire.run();
  stepAk47Effects(ctx, 0.016, 1050);
  assert.equal(played, 1);
  poseAk47(ctx, ctx.heldItem, 1050, 0.18);
  assert.ok(ctx.camera.rotation.x > 0);
  stepAk47Effects(ctx, 0.016, 1115);
  stepAk47Effects(ctx, 0.016, 1230);
  assert.equal(played, 3);
  assert.ok(fx.spread > 0.5);
  ctx.placementMode = true;
  stepAk47Effects(ctx, 0.05, 1400);
  assert.equal(played, 3);
  ctx.isPrimaryDown = false;
  for (let now = 1450; now <= 2800; now += 50) stepAk47Effects(ctx, 0.05, now);
  assert.ok(fx.cases[0].settled);
  assert.equal(fx.brassMesh.count, 3);
  assert.equal(fx.light.intensity, 0);
  assert.equal(fx.spread, 0);
  stepAk47Effects(ctx, 0.05, 6500);
  assert.equal(fx.brassMesh.count, 0);
});

test('o traçante perde altura ao se afastar do cano', () => {
  const ctx = fixture();
  ctx.heldItem = spawnShopItemNearPlayer(ctx, 'ak47');
  assert.equal(handlePrimaryAction(ctx), true);
  poseAk47(ctx, ctx.heldItem, 1000, 0.18);
  stepAk47Effects(ctx, 0.016, 1000);
  const tracer = ctx.ak47Effects.tracers[0];
  stepAk47Effects(ctx, 0.02, 1020);
  const nearDistance = tracer.mesh.position.clone().sub(tracer.start).dot(tracer.direction);
  assert.ok(Math.abs(tracer.mesh.position.y - (tracer.start.y + tracer.direction.y * nearDistance)) < 0.001);
  stepAk47Effects(ctx, 0.05, 1080);
  const distance = tracer.mesh.position.clone().sub(tracer.start).dot(tracer.direction);
  const straightHeight = tracer.start.y + tracer.direction.y * distance;
  assert.ok(tracer.mesh.visible);
  assert.ok(distance > 15);
  assert.ok(tracer.mesh.position.y < straightHeight - 0.15);
});

test('tiros próximos têm áudio direcional e deixam uma única marca temporária na face da parede', () => {
  const ctx = fixture();
  ctx.camera.position.set(1, 1.6, -6);
  ctx.wallSegments = [{ x1: -3, x2: 3, z1: -12, z2: -12, halfThick: 0.1, minY: 0, maxY: 3 }];
  let cracks = 0;
  const passes = [];
  const impacts = [];
  window.MycoAudio = {
    playAk47Shot: () => cracks++,
    playAk47Pass: (gain, pan, delay) => passes.push({ gain, pan, delay }),
    playAk47Impact: (gain, pan, delay) => impacts.push({ gain, pan, delay })
  };
  const players = [{ id: 'nearby-player', shots: [[1, 0, 1.6, 0, 0, 0, -1, 12]] }];
  applyRemoteAk47Shots(ctx, players, 1000);
  applyRemoteAk47Shots(ctx, players, 1020);
  assert.equal(cracks, 1);
  assert.equal(passes.length, 1);
  assert.equal(impacts.length, 1);
  assert.ok(impacts[0].delay > passes[0].delay);
  assert.ok(passes[0].pan < 0 && passes[0].gain > 0 && passes[0].delay > 0);
  const fx = ctx.ak47Effects;
  stepAk47Effects(ctx, 0.016, 1014);
  assert.ok(fx.remoteLight.intensity > 0);
  assert.ok(fx.flashes[0].core.visible);
  assert.ok(fx.tracers[0].mesh.visible);
  stepAk47Effects(ctx, 0.05, 1050);
  assert.equal(fx.impactMesh.count, 1);
  assert.ok(Math.abs(fx.impacts[0].position.z - (-11.9)) < 0.04);
  stepAk47Effects(ctx, 0.05, 56000);
  assert.equal(fx.impactMesh.count, 1);
  stepAk47Effects(ctx, 0.05, 62000);
  assert.equal(fx.impactMesh.count, 0);

  ctx.camera.position.set(7, 1.6, -6);
  applyRemoteAk47Shots(ctx, [{ id: 'nearby-player', shots: [[2, 0, 1.6, 0, 0, 0, -1, 12]] }], 63000);
  assert.equal(cracks, 2);
  assert.equal(passes.length, 1, 'quem está fora da trajetória não ouve o assobio');
  ctx.camera.position.set(100, 1.6, -6);
  applyRemoteAk47Shots(ctx, [{ id: 'nearby-player', shots: [[3, 0, 1.6, 0, 0, 0, -1, 12]] }], 64000);
  assert.equal(cracks, 3, 'o disparo chega a quem está longe do atirador');
  assert.equal(impacts.length, 2, 'o impacto só é audível perto do ponto atingido');
});

test('o vigésimo acerto derruba a nave antes da recuperação e da saída', () => {
  const ctx = fixture();
  stepUfoAbduction(ctx, 33);
  const [target] = ctx.scene.userData.shotTargets;
  const origin = new THREE.Vector3();
  const direction = new THREE.Vector3(0, 0.28, -1).normalize();
  for (let i = 0; i < 19; i++) target.onHit(ctx, origin, target.mesh.position, direction);
  assert.equal(getUfoTelemetry().phase, 'flyby');
  target.onHit(ctx, origin, target.mesh.position, direction);
  assert.equal(getUfoTelemetry().phase, 'crashing');
  for (let i = 0; i < 110; i++) stepUfoAbduction(ctx, 0.05);
  assert.equal(getUfoTelemetry().phase, 'wrecked');
  assert.equal(target.active(), false);
  stepUfoAbduction(ctx, 73);
  assert.equal(getUfoTelemetry().phase, 'recovering');
  stepUfoAbduction(ctx, 7);
  assert.equal(getUfoTelemetry().active, false);
});
