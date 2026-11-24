import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../js/vendor/three.bundle.min.js';

globalThis.window = { THREE };
const { appState } = await import('../js/core/state.js');
const { stepPets, updateRemotePets } = await import('../js/entities/pets.js');

function context() {
  const playerPos = new THREE.Vector3(0, 0, 0);
  return { scene: new THREE.Scene(), playerPos, inFps: true,
    physCtx: { playerPos, stairsList: [], walkableFloors: [], supportSurfaces: [], wallSegments: [], campusDoors: [], solidColliders: [] } };
}
function state(selected) {
  return { owned: [selected], selected, mode: 'follow', bowls: { food: { owned: false }, water: { owned: false } }, next_food: {}, next_water: {} };
}

test('all six companions build, follow their owner, and leave with the account', () => {
  const ctx = context();
  for (const id of ['cat_orange', 'cat_black', 'cat_calico', 'dog_golden', 'dog_husky', 'dog_pug']) {
    appState.currentUser = { id: 1, progress: { pets: state(id) } };
    stepPets(ctx, 0.05);
    assert.equal(ctx.scene.children.length, 1);
    const animal = ctx.scene.children[0];
    assert.ok(animal.children.length >= 1);
    ctx.playerPos.x = 10;
    for (let i = 0; i < 30; i++) stepPets(ctx, 0.05);
    assert.ok(animal.position.x > 1, `${id} should walk toward its owner`);
    ctx.playerPos.x = 0;
  }
  appState.currentUser = null;
  stepPets(ctx, 0.05);
  assert.equal(ctx.scene.children.length, 0);
});

test('remote pet and bowl follow multiplayer snapshots and disappear on disconnect', () => {
  const ctx = context();
  appState.currentUser = { id: 3, progress: { pets: state('') } };
  updateRemotePets([{ id: 'remote', pets: { pet: { id: 'dog_husky', x: 2, y: 0, z: 3, yaw: 0, motion: 'walk' }, bowls: { water: { x: 5, y: 0, z: 6, full: true } } } }]);
  stepPets(ctx, 0.05);
  assert.equal(ctx.scene.children.length, 2);
  assert.equal(ctx.scene.children[0].position.x, 2);
  assert.equal(ctx.scene.children[1].position.x, 5);
  updateRemotePets([]);
  stepPets(ctx, 0.05);
  assert.equal(ctx.scene.children.length, 0);
  appState.currentUser = null;
});

test('a hungry cat approaches a full food bowl and asks the server to consume it', async () => {
  const ctx = context();
  const petState = state('cat_orange');
  petState.bowls.food = { owned: true, pos: { x: 4, y: 0, z: 1 }, full: true };
  appState.currentUser = { id: 2, progress: { pets: petState } };
  appState.authToken = 'test';
  const requests = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    requests.push(JSON.parse(options.body));
    const updated = structuredClone(petState);
    updated.bowls.food.full = false;
    updated.next_food.cat_orange = Math.floor(Date.now() / 1000) + 300;
    return { status: 200, text: async () => JSON.stringify({ ok: true, user: { id: 2, progress: { pets: updated } } }) };
  };
  try {
    for (let i = 0; i < 200; i++) stepPets(ctx, 0.05);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(requests.length, 1);
    assert.equal(requests[0].operation, 'consume_food');
    assert.equal(appState.currentUser.progress.pets.bowls.food.full, false);
    appState.currentUser = null;
    stepPets(ctx, 0.05);
    assert.equal(ctx.scene.children.length, 0);
  } finally { globalThis.fetch = originalFetch; }
});
