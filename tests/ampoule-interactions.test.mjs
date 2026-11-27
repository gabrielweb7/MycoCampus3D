import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../js/vendor/three.bundle.min.js';

globalThis.window = { THREE };
const { makeAmpouleCase, toggleAmpouleCaseLid, stepAmpouleCases, drawFromAmpouleCase } = await import('../js/items/ampoule-case.js');
const { makeSyringe10ml, updateSyringeVolume, addSyringeMix } = await import('../js/items/syringe.js');
const { queueItemStateSync, getReplicatedItemState } = await import('../js/systems/world-objects-sync.js');
const { resolveHeldItemHover } = await import('../js/systems/hover-held-handlers.js');

function setup() {
  const ctx = {
    scene: new THREE.Scene(), playerPos: new THREE.Vector3(0, 0, 0), inFps: true,
    pickableItems: [], pickableMap: new Map(), pendingMovedItems: {}, cookerPots: [],
    inventory: { reserved: new Set(), slots: [] }, isHeldByRemote: () => false,
    callbacks: {}, isTouchDevice: () => false, notifyWorldAction() {}
  };
  ctx.queueItemStateSync = item => queueItemStateSync(ctx, item);
  const box = makeAmpouleCase(ctx, 'dyn_ampoule_case_test', 0, 0, 0);
  const syringe = makeSyringe10ml(ctx, 'syringe_10ml_lab_test', 0, 0, 1);
  return { ctx, box, syringe };
}

test('a closed lid physically covers every ampoule and opens normally', () => {
  const { ctx, box } = setup();
  box.mesh.updateMatrixWorld(true);
  const lid = box.caseCtrl.lidPivot.children[0];
  const lidBounds = new THREE.Box3().setFromObject(lid);
  for (const visual of box.caseCtrl.slotVisuals.slice(0, 24)) {
    const bounds = new THREE.Box3().setFromObject(visual.root);
    assert.ok(bounds.max.y < lidBounds.min.y, 'vial must fit under the lid');
    const center = bounds.getCenter(new THREE.Vector3());
    const ray = new THREE.Raycaster(new THREE.Vector3(center.x, 1, center.z), new THREE.Vector3(0, -1, 0));
    assert.ok(ray.intersectObject(lid).length, 'the lid panel covers the vial');
    assert.ok(box.caseCtrl.lidPivot.children.includes(ray.intersectObject(box.mesh, true)[0].object), 'the closed lid assembly blocks the view from above');
    for (const side of [new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1)]) {
      const from = center.clone().addScaledVector(side, 1);
      const sideRay = new THREE.Raycaster(from, side.clone().negate());
      assert.ok(box.caseCtrl.lidPivot.children.includes(sideRay.intersectObject(box.mesh, true)[0].object), 'lid blocks the view from each side');
    }
  }
  assert.equal(toggleAmpouleCaseLid(ctx, box, true), true);
  for (let i = 0; i < 100; i++) stepAmpouleCases(ctx, 0.05);
  assert.ok(box.caseCtrl.lidPivot.rotation.x < -1.6);
});

test('the syringe can target the case while held', () => {
  const { ctx, box, syringe } = setup();
  ctx.heldItem = syringe;
  ctx.camera = { position: new THREE.Vector3() };
  ctx.placementGhost = { visible: true };
  ctx.raycaster = { intersectObjects: () => [], intersectObject: () => [] };
  ctx.clock = { elapsedTime: 0 };
  const hit = { distance: 1, object: box.mesh };
  let prompt = '';
  const handled = resolveHeldItemHover(ctx, null, {
    intersectPickableItem: (_ray, item) => item === box ? hit : null,
    setHoverPrompt: (_ctx, text) => { prompt = text; },
    updateHeldItemPlacementPreview() {}
  });
  assert.equal(handled, true);
  assert.equal(ctx.hoveredAmpouleCaseTarget, box);
  assert.match(prompt, /escolher uma ampola/);
});

test('draws chosen doses, respects available volume and queues both states', () => {
  for (let dose = 1; dose <= 5; dose++) {
    const { ctx, box, syringe } = setup();
    toggleAmpouleCaseLid(ctx, box, true);
    ctx.heldItem = syringe;
    const species = box.caseCtrl.slots[0].speciesName;
    assert.equal(drawFromAmpouleCase(ctx, box, 0, dose), dose);
    assert.equal(box.caseCtrl.slots[0].volMl, 5 - dose);
    assert.equal(syringe.mesh.userData.syrCtrl.volMl, dose);
    assert.equal(syringe.mesh.userData.syrCtrl.mix.lcMl, dose);
    assert.equal(syringe.mesh.userData.syrCtrl.speciesName, species);
    assert.equal(ctx.pendingMovedItems[box.id].state.custom.slots[0].volMl, 5 - dose);
    assert.equal(ctx.pendingMovedItems[syringe.id].state.syringe.volMl, dose);
    assert.equal(getReplicatedItemState(ctx, box).custom.slots[0].volMl, 5 - dose);
  }
  const { ctx, box, syringe } = setup();
  ctx.heldItem = syringe;
  assert.equal(drawFromAmpouleCase(ctx, box, 0, 1), 0, 'closed case cannot be used');
  toggleAmpouleCaseLid(ctx, box, true);
  box.caseCtrl.slots[0].volMl = 3;
  assert.equal(drawFromAmpouleCase(ctx, box, 0, 5), 3, 'legacy saved volume is not replenished');
  assert.equal(drawFromAmpouleCase(ctx, box, 0, 1), 0, 'empty vial cannot be drawn twice');
  assert.equal(drawFromAmpouleCase(ctx, box, 1, 2), 0, 'different species cannot be mixed silently');
  updateSyringeVolume(syringe, 9);
  addSyringeMix(syringe, 'lc', 6);
  assert.equal(drawFromAmpouleCase(ctx, box, 2, 2), 0, 'different species remains blocked');
  box.caseCtrl.slots[2].speciesName = syringe.mesh.userData.syrCtrl.speciesName;
  assert.equal(drawFromAmpouleCase(ctx, box, 2, 5), 1, 'syringe capacity is respected');
});
