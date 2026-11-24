import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../js/vendor/three.bundle.min.js';

globalThis.window = { THREE };
const {
  createQuickInventory, selectQuickSlot, getQuickInventoryOperation, applyQuickInventory, getStorageBlock
} = await import('../js/systems/inventory.js');
const { handlePrimaryAction, dropHeldItem } = await import('../js/systems/interaction-system.js');

function fixture() {
  const petri = { id: 'petri_empty', label: 'Petri', mesh: new THREE.Group() };
  petri.mesh.userData.petriCtrl = { lidOpen: false };
  const syringe = { id: 'syringe_10ml_01', label: 'Seringa', mesh: new THREE.Group() };
  const items = new Map([[petri.id, petri], [syringe.id, syringe]]);
  const ctx = {
    inventory: createQuickInventory(), playerPos: new THREE.Vector3(1, 1, 1), inFps: true,
    findPickable: id => items.get(id), heldItem: petri, callbacks: {}, notifyWorldAction() {}
  };
  return { ctx, petri, syringe };
}

test('retém a mão até o servidor confirmar a troca e reenvia o mesmo comando', () => {
  const { ctx, petri, syringe } = fixture();
  applyQuickInventory(ctx, { ready: true, active: 0, slots: [null, syringe.id, null], reserved: [syringe.id] }, [], '');
  assert.equal(selectQuickSlot(ctx, 1), true);
  assert.equal(getQuickInventoryOperation(ctx, () => ({})), null, 'aguarda sincronizar a coleta');
  assert.equal(ctx.heldItem, petri);
  assert.equal(dropHeldItem(ctx), false);
  assert.equal(handlePrimaryAction(ctx), false);
  applyQuickInventory(ctx, { ready: true, active: 0, holding: petri.id, slots: [petri.id, syringe.id, null], reserved: [petri.id, syringe.id] }, [], petri.id);
  const operation = getQuickInventoryOperation(ctx, () => ({ petri: { lidOpen: false } }));
  assert.deepEqual(getQuickInventoryOperation(ctx, () => ({ altered: true })), operation);
  applyQuickInventory(ctx, {
    active: 1, ready: true, op: operation.id, result: 'ok', holding: syringe.id,
    slots: [petri.id, syringe.id, null], reserved: [petri.id, syringe.id]
  }, [], petri.id);
  assert.equal(ctx.heldItem, syringe);
  assert.equal(petri.mesh.visible, false);
  assert.equal(syringe.mesh.visible, true);
  assert.equal(ctx.inventory.pending, null);
});

test('recipientes abertos e equipamentos grandes não entram nos espaços guardados', () => {
  const { ctx, petri } = fixture();
  ctx.inventory.ready = true;
  petri.mesh.userData.petriCtrl.lidOpen = true;
  assert.equal(selectQuickSlot(ctx, 1), false);
  assert.equal(getStorageBlock({ id: 'monotub_24l_01', mesh: new THREE.Group(), monotubCtrl: {} }), 'large');
  assert.equal(getStorageBlock({ id: 'spawn_bag_empty_01', mesh: new THREE.Group(), spawnCtrl: { isBag: true, filled: true, sealed: false } }), 'open');
  assert.equal(getStorageBlock({ id: 'dyn_vial3ml_test', meta: { prefabId: 'vial_3ml' }, mesh: new THREE.Group() }), '');
  assert.equal(ctx.heldItem, petri);
});

test('reservas offline escondem itens; devolução ao mundo restaura o mesmo objeto', () => {
  const { ctx, petri, syringe } = fixture();
  ctx.heldItem = null;
  applyQuickInventory(ctx, {
    ready: true, active: 1, holding: syringe.id,
    slots: [petri.id, syringe.id, null], reserved: [petri.id, syringe.id]
  }, [], '', true);
  assert.equal(ctx.heldItem, syringe);
  assert.equal(petri.mesh.visible, false);
  applyQuickInventory(ctx, { ready: false, active: 0, holding: '', slots: [null, null, null], reserved: [] }, [], '');
  assert.equal(ctx.findPickable(petri.id), petri);
  assert.equal(petri.mesh.visible, true);
});
