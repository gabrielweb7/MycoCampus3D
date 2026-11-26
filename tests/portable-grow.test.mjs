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
