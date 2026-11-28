import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from '../js/vendor/three.bundle.min.js';

globalThis.window = { THREE };
const { appState } = await import('../js/core/state.js');
const { makeCampusPickup } = await import('../js/items/campus-pickup.js');
const { applyCampusCars, enterCampusCar, getAimedCarSeat, getCampusCarActions, getCampusCarSync,
  leaveCampusCar, stepCampusCarRide, stepCampusCars } = await import('../js/systems/campus-cars.js');

function fixture() {
  const ctx = {
    scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), raycaster: new THREE.Raycaster(),
    playerPos: new THREE.Vector3(-1.65, 0, 0), playerYaw: 0, playerPitch: 0,
    inFps: true, keys: {}, joyX: 0, joyY: 0, solidColliders: [], wallSegments: [], pickableItems: [],
    physCtx: { stairsList: [], walkableFloors: [], supportSurfaces: [], wallSegments: [], solidColliders: [], campusDoors: [] }
  };
  const truck = makeCampusPickup(ctx, { id: 'dyn_shop_truck', x: 0, y: 0, z: 0, ry: 0 });
  return { ctx, truck };
}

test('a porta do motorista abre para fora e o carro pode acelerar, frear e acender os faróis', () => {
  appState.currentUser = null;
  const { ctx, truck } = fixture();
  ctx.raycaster.ray.origin.set(-1.65, 1.12, 0);
  ctx.raycaster.ray.direction.set(1, 0, 0);
  const aim = getAimedCarSeat(ctx);
  assert.equal(aim?.seat, 'driver');
  assert.equal(enterCampusCar(ctx, aim), true);
  const at = ctx.campusRide.at;
  stepCampusCarRide(ctx, 0.05, at + 425);
  stepCampusCars(ctx, 0.05, at + 425);
  assert.ok(truck.campusCar.doors.driver.rotation.y < -0.8);
  stepCampusCarRide(ctx, 0.05, at + 900);
  assert.equal(ctx.campusRide.phase, 'seated');
  ctx.keys.KeyW = true;
  for (let i = 0; i < 15; i++) stepCampusCarRide(ctx, 0.05, at + 950 + i * 50);
  assert.ok(truck.mesh.position.z < -1);
  assert.ok(truck.campusCar.speed > 3);
  assert.equal(leaveCampusCar(ctx), true);
  assert.equal(ctx.campusRide.phase, 'seated', 'permanece no banco enquanto o carro está em movimento');
  getCampusCarActions(ctx).find(action => action.id === 'car_lights').run();
  stepCampusCars(ctx, 0.05, at + 1760);
  assert.ok(truck.campusCar.headlightGlow.intensity > 0);
  ctx.keys.Space = true;
  for (let i = 0; i < 24; i++) stepCampusCarRide(ctx, 0.05, at + 1800 + i * 50);
  leaveCampusCar(ctx);
  const leavingAt = ctx.campusRide.at;
  stepCampusCarRide(ctx, 0.05, leavingAt + 800);
  assert.equal(ctx.campusRide, null);
});

test('o carona aguarda o servidor, segue a picape do motorista e não envia comandos de direção', () => {
  const { ctx, truck } = fixture();
  appState.currentUser = { id: 9 };
  try {
    const snapshot = { owned: false, driver: 'friend', passenger: '', x: 0, y: 0, z: 0, yaw: 0, lights: false, speed: 0, steer: 0 };
    applyCampusCars(ctx, { [truck.id]: snapshot }, null, 1000);
    assert.equal(enterCampusCar(ctx, { item: truck, seat: 'passenger' }), true);
    assert.equal(ctx.campusRide, undefined);
    assert.deepEqual(getCampusCarSync(ctx), { id: truck.id, seat: 'passenger', op: 'enter' });
    applyCampusCars(ctx, { [truck.id]: { ...snapshot, passenger: 'my-seat' } }, { id: truck.id, seat: 'passenger' }, 1050);
    stepCampusCarRide(ctx, 0.05, 2000);
    ctx.keys.KeyW = true;
    applyCampusCars(ctx, { [truck.id]: { ...snapshot, passenger: 'my-seat', z: -3, speed: 4 } }, null, 2100);
    stepCampusCars(ctx, 0.25, 2350);
    stepCampusCarRide(ctx, 0.05, 2400);
    assert.ok(truck.mesh.position.z < -2);
    assert.ok(ctx.camera.position.z < -1.9);
    assert.deepEqual(getCampusCarSync(ctx), { id: truck.id, seat: 'passenger', op: 'ride', pose: null });
  } finally {
    appState.currentUser = null;
  }
});
