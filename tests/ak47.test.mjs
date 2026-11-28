import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from '../js/vendor/three.bundle.min.js';

globalThis.window = { THREE };
const { ensureCoreAdminPrefabs, spawnShopItemNearPlayer } = await import('../js/systems/admin-editor.js');
const { handlePrimaryAction } = await import('../js/systems/interaction-system.js');
const { poseAk47, stepAk47Effects } = await import('../js/systems/ak47-effects.js');
const { applyQuickInventory, createQuickInventory, getStorageBlock, selectQuickSlot } = await import('../js/systems/inventory.js');
const { SHOP_SUPPLIES, SHOP_SUPPLY_CATEGORIES } = await import('../js/ui/modal-shop.js');
const { getFloatingActionsPreview } = await import('../js/ui/radial-menu.js');

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
  stepAk47Effects(ctx, 0.05, 1050);
  const distance = tracer.mesh.position.clone().sub(tracer.start).dot(tracer.direction);
  const straightHeight = tracer.start.y + tracer.direction.y * distance;
  assert.ok(tracer.mesh.visible);
  assert.ok(distance > 15);
  assert.ok(tracer.mesh.position.y < straightHeight - 0.15);
});
