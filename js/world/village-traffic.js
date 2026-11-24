import { VILLAGE_LOTS, VILLAGE_STREET_Z } from '../core/village-layout.js';

const THREE = window.THREE;
const buyers = new Map();
let traffic = [];
let assets;
let clockTime = 0;
let clockAt = 0;

export function setVillageTraffic(next) {
  traffic = Array.isArray(next) ? next : [];
}

function getAssets() {
  if (assets) return assets;
  const mat = color => new THREE.MeshStandardMaterial({ color, roughness: 0.74 });
  assets = {
    cube: new THREE.BoxGeometry(1, 1, 1), wheel: new THREE.CylinderGeometry(0.32, 0.32, 0.24, 10),
    teal: mat(0x438a7c), trim: mat(0xf0d4a4), window: mat(0x38566a), tire: mat(0x34343c),
    light: mat(0xffe89b), jacket: mat(0xb1624e), face: mat(0xe6b693), shoes: mat(0x453831)
  };
  return assets;
}

function part(group, geometry, material, x, y, z, width, height, depth) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.scale.set(width, height, depth);
  group.add(mesh);
  return mesh;
}

function buildBuyer(scene) {
  const a = getAssets();
  const car = new THREE.Group();
  part(car, a.cube, a.teal, 0, 0.54, 0, 3.03, 0.55, 1.43);
  part(car, a.cube, a.window, 0.32, 0.95, 0, 1.40, 0.46, 1.19);
  part(car, a.cube, a.trim, 0.30, 1.21, 0, 1.49, 0.12, 1.28);
  for (const z of [-0.53, 0.53]) part(car, a.cube, a.light, -1.52, 0.59, z, 0.06, 0.17, 0.24);
  for (const x of [-0.91, 0.94]) for (const z of [-0.74, 0.74]) {
    part(car, a.wheel, a.tire, x, 0.31, z, 1, 1, 1).rotation.x = Math.PI / 2;
  }

  const driver = new THREE.Group();
  part(driver, a.cube, a.face, 0, 1.06, 0, 0.40, 0.38, 0.38);
  part(driver, a.cube, a.trim, 0, 1.27, 0, 0.51, 0.12, 0.48);
  part(driver, a.cube, a.jacket, 0, 0.64, 0, 0.40, 0.45, 0.29);
  const legs = [-0.11, 0.11].map(x => {
    const joint = new THREE.Group();
    joint.position.set(x, 0.43, 0);
    part(joint, a.cube, a.shoes, 0, -0.18, 0, 0.16, 0.36, 0.19);
    driver.add(joint);
    return joint;
  });
  const parcel = part(driver, a.cube, a.trim, 0, 0.63, 0.25, 0.27, 0.20, 0.19);
  scene.add(car, driver);
  return { car, driver, legs, parcel };
}

function stepDriver(actor, lot, laneZ, age) {
  const { driver, legs, parcel } = actor;
  driver.visible = age >= -8 && age < 4;
  if (!driver.visible) return;
  const inward = age < 0;
  const progress = inward ? Math.min(1, (age + 8) / 7.8) : 1 - Math.min(1, age / 4);
  const parkingX = lot.x - lot.front * 0.65;
  const innerZ = lot.benchZ + lot.front * 0.60;
  const pZ = Math.min(1, progress / 0.64);
  const pX = Math.max(0, (progress - 0.64) / 0.36);
  const x = progress < 0.22 ? parkingX + (lot.x - parkingX) * (progress / 0.22) : lot.x + (lot.benchX - lot.x) * pX;
  const z = laneZ + (innerZ - laneZ) * pZ;
  driver.position.set(x, 0, z);
  const yaw = pX > 0 ? Math.atan2(lot.benchX - lot.x, 0) : Math.atan2(0, innerZ - laneZ);
  driver.rotation.y = inward ? yaw : yaw + Math.PI;
  const stride = Math.sin(age * 10) * 0.54;
  legs[0].rotation.x = stride;
  legs[1].rotation.x = -stride;
  parcel.visible = !inward;
}

export function stepVillageTraffic(ctx, now) {
  if (ctx.serverTimeSec > 0 && ctx.serverTimeSec !== clockTime) {
    clockTime = ctx.serverTimeSec;
    clockAt = now;
  }
  const time = clockTime ? clockTime + (now - clockAt) * 0.001 : Date.now() / 1000;
  for (const order of traffic) {
    const lot = VILLAGE_LOTS[Number(order.lot_id) - 1];
    const pickup = Number(order.pickup_at);
    if (!lot || !Number.isFinite(pickup) || Math.abs(ctx.playerPos.z - VILLAGE_STREET_Z) > 55) continue;
    const age = time - pickup;
    if (age < -14 || age >= 10) continue;
    const key = `${lot.id}:${pickup}`;
    let actor = buyers.get(key);
    if (!actor) { actor = buildBuyer(ctx.scene); buyers.set(key, actor); }
    actor.seen = now;
    const edge = lot.x > 0 ? 66 : -66;
    const parked = lot.x - lot.front * 0.65;
    const laneZ = VILLAGE_STREET_Z - lot.front * 1.7;
    let x = parked;
    if (age < -8) x = edge + (parked - edge) * ((age + 14) / 6);
    if (age > 4) x = parked + (edge - parked) * ((age - 4) / 6);
    actor.car.position.set(x, 0, laneZ);
    const movingRight = age < 4 ? parked > edge : edge > parked;
    actor.car.rotation.y = movingRight ? Math.PI : 0;
    stepDriver(actor, lot, laneZ, age);
  }
  for (const [key, actor] of buyers) {
    if (actor.seen === now) continue;
    actor.car.removeFromParent();
    actor.driver.removeFromParent();
    buyers.delete(key);
  }
}
